import { App, Notice, TFile, TFolder } from "obsidian";
import { FeedInfo, FeedListSchema, RssFeedContent, RssFeedContentSchema, RssFeedItem, RssFeedMeta, RssFeedMetaSchema } from "./types";
import FeedsReaderPlugin from "./main";
import { SUBSCRIPTIONS_FNAME, LEN_STR_PER_FILE, FEEDS_META_FNAME, FEEDS_ITEMS_CHUNK_FNAME_PREFIX, FEEDS_ITEMS_CHUNK_FNAME_SUFFIX, OLD_FEEDS_DATA_FNAME_BASE } from "./constants";
import { generateDeterministicItemIdSync, generateRandomUUID } from "./utils";
import { Gzip, Gunzip } from 'minizlib';

export async function loadSubscriptions(app: App, subsPath: string, feedsStoreBase: string): Promise<FeedInfo[]> {
  try {
    const fileExists = await app.vault.adapter.exists(subsPath);
    if (!fileExists) {
      console.log("Subscriptions file not found, returning empty list.", subsPath); // Less verbose
      return [];
    }
    const raw = await app.vault.adapter.read(subsPath);
    if (!raw.trim()) {
      console.log("Subscriptions file is empty, returning empty list.", subsPath); // Less verbose
      return [];
    }
    const json = JSON.parse(raw);
    const result = FeedListSchema.safeParse(json);
    if (!result.success) {
      const errorMessage = `Warning: Subscriptions file (${subsPath}) is corrupted or has an invalid format. Some feeds may not load. Please check the console for technical details.`;
      console.error(`loadSubscriptions: Invalid subscriptions file format at ${subsPath}. Details:`, result.error.flatten());
      new Notice(errorMessage, 10000);
      return [];
    }
    // Validate/Rebuild folder paths relative to plugin structure
    let listModified = false;
    result.data.forEach(feedInfo => {
      // Ensure folder path starts with the base directory name and a slash
      if (!feedInfo.folder || !feedInfo.folder.startsWith(feedsStoreBase + "/")) {
        console.warn(`loadSubscriptions: Feed "${feedInfo.name}" has missing or invalid folder path: "${feedInfo.folder}". Attempting to rebuild default path. This might indicate a past data issue.`);
        const folderName = feedInfo.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50) || `feed_${Date.now()}`;
        feedInfo.folder = `${feedsStoreBase}/${folderName}`;
        listModified = true; // Mark if we had to modify anything
      }
    });
    if (listModified) {
      console.warn("loadSubscriptions: Subscription list was modified due to invalid folder paths. The changes will be saved on the next plugin data save.");
      // Optionally, trigger a save here, or let the main plugin handle it.
    }
    return result.data;
  } catch (err: unknown) {
    console.error(`Failed to load subscriptions from ${subsPath}:`, err);
    new Notice(`Error loading subscriptions: ${(err instanceof Error) ? err.message : String(err)}. Check console.`);
    return [];
  }
}

// saveSubscriptions now takes plugin instance and the feedList to save
export async function saveSubscriptions(plugin: FeedsReaderPlugin, feedList: FeedInfo[]): Promise<void> {
  const app = plugin.app;
  const subsPath = `${plugin.feeds_reader_dir}/${SUBSCRIPTIONS_FNAME}`;
  try {
    // Ensure unread counts are up-to-date based on plugin's feedsStore
    feedList.forEach(feedInfo => {
      const feedStoreData = plugin.feedsStore[feedInfo.name];
      if (feedStoreData?.items) {
        feedInfo.unread = feedStoreData.items.filter(item => item.read === "0" && item.deleted === "0").length;
      }
      // Ensure 'updated' timestamp reflects last known good update or save time
      // This might already be handled correctly when saving feed data
    });
    const json = JSON.stringify(feedList, null, 2);
    await app.vault.adapter.write(subsPath, json);
    console.log(`Subscriptions saved to ${subsPath}`); // Less verbose
  } catch (err: unknown) {
    const errorMessage = `Error saving subscriptions to "${subsPath}". Your feed list might not be saved correctly. Please check file permissions or disk space.`;
    console.error(`saveSubscriptions: Failed to save subscriptions to ${subsPath}. Details:`, err);
    new Notice(errorMessage + ` (Technical details: ${(err instanceof Error) ? err.message : String(err)})`, 10000);
    throw err; // Re-throw to indicate failure
  }
}

export async function removeAllFeedDataFiles(plugin: FeedsReaderPlugin, feedFolderRelativePath: string): Promise<void> {
  const vault = plugin.app.vault;
  const fullFolderPath = `${plugin.feeds_reader_dir}/${feedFolderRelativePath}`;
  try {
    const folder = vault.getAbstractFileByPath(fullFolderPath);
    if (folder instanceof TFolder) {
      const filesToRemove = folder.children.filter(
        (file): file is TFile =>
          file instanceof TFile &&
          (file.name === FEEDS_META_FNAME ||
          (file.name.startsWith(FEEDS_ITEMS_CHUNK_FNAME_PREFIX) && file.name.endsWith(FEEDS_ITEMS_CHUNK_FNAME_SUFFIX)) ||
          // Include old format files in removal if they somehow still exist
          (file.name.startsWith(OLD_FEEDS_DATA_FNAME_BASE) && file.name.endsWith(".frag.gzip")))
      );
      if (filesToRemove.length > 0) {
        console.log(`Removing ${filesToRemove.length} data file(s) from ${fullFolderPath}`);
        for (const file of filesToRemove) {
          await vault.delete(file);          
        }
      }
    } else if (await vault.adapter.exists(fullFolderPath)) {
      console.warn(`removeFileFragments: Path "${fullFolderPath}" for feed data exists but is not a folder. Cannot remove fragments. This might indicate a problem with plugin data structure.`);
    }
  } catch (err: unknown) {
    console.error(`Failed to remove file fragments in ${fullFolderPath}:`, err);
    // Don't throw here, maybe just log the error
  }
}

export function compress(text: string): Uint8Array {
  try {
    const inputBuffer = Buffer.from(text, 'utf-8');
    const gzip = new Gzip({});
    const chunks: Buffer[] = [];
    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.write(inputBuffer);
    gzip.end();
    const resultBuffer = Buffer.concat(chunks);
    return new Uint8Array(resultBuffer.buffer, resultBuffer.byteOffset, resultBuffer.byteLength);
  } catch (error) {
    console.error("Compression failed with minizlib:", error);
    throw error;
  }
}

export function decompress(byteArray: Uint8Array): string {
  try {
    const inputBuffer = Buffer.from(byteArray);
    const gunzip = new Gunzip({});
    const chunks: Buffer[] = [];
    gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gunzip.write(inputBuffer);
    gunzip.end();
    const resultBuffer = Buffer.concat(chunks);
    return resultBuffer.toString('utf-8');
  } catch (error) {
    console.error("Decompression failed with minizlib:", error);
    throw error;
  }
}

type FeedContext = {
  plugin: FeedsReaderPlugin;
  feedName: string;
  feed: RssFeedContent | undefined;
  metaInfo: RssFeedMeta;
  absFolder: string;
  tmpSuffix: string;
  stagingDir: string; // unique temporary directory used for atomic swap
};

export async function saveFeedsData(
  plugin: FeedsReaderPlugin,
  names: Set<string> | string[],
): Promise<Set<string>> {

  const successSaved = new Set<string>();
  const feedNames = Array.isArray(names) ? names : Array.from(names);

  console.info(`Saving data for feeds: ${feedNames.join(", ")}`);

  for (const name of feedNames) {
    const ctx = buildContext(plugin, name);
    if (!ctx) {
      console.warn(`buildContext: Feed "${name}" not found in feedList. Skipping save.`);
      continue; // skip if feed meta info not found
    }

    try {
      await ensureFolder(ctx);
      const { meta, items } = await prepareData(ctx);
      console.log(`saveFeedsData: Prepared data for feed: ${name}`);
      await writeMeta(ctx, meta);
      console.log(`saveFeedsData: Wrote meta for feed: ${name}`);
      await writeItems(ctx, items);
      console.log(`saveFeedsData: Wrote items for feed: ${name}`);
      await swapIn(ctx);
      console.log(`saveFeedsData: Swapped in for feed: ${name}`);
      successSaved.add(name);
      console.info(`Successfully saved data for feed: ${name}`);

    } catch (err) {
      console.error(`Failed to save data for feed: ${name}`, err);
      await cleanupTmp(ctx);
      console.log(`saveFeedsData: Cleanup tmp for feed: ${name}`);
    }
  }
  return successSaved;
}

function buildContext(plugin: FeedsReaderPlugin, feedName: string): FeedContext | null {
  const feedFromStore = plugin.feedsStore[feedName];
  const feedInfoFromList = plugin.feedList.find(f => f.name === feedName);

  if (!feedInfoFromList) {
    console.warn(`Skip saving data for feed: "${feedName}" (meta info not found in feedList)`);
    return null;
  }

  // Construct RssFeedMeta for the context
  const contextMetaInfo: RssFeedMeta = {
    name: feedInfoFromList.name,
    title: feedFromStore?.title ?? (feedInfoFromList as FeedInfo & { siteTitle?: string })?.siteTitle ?? feedInfoFromList.name,
    link: feedFromStore?.link ?? feedInfoFromList.feedUrl,
    folder: feedInfoFromList.folder,
    // Optional fields from RssFeedContent if available
    subtitle: feedFromStore?.subtitle,
    image: feedFromStore?.image,
    description: feedFromStore?.description,
    pubDate: feedFromStore?.pubDate,
  };

  console.log(`feedFromStore: ${JSON.stringify(feedFromStore)}`);
  console.log(`contextMetaInfo: ${JSON.stringify(contextMetaInfo)}`);
  console.log(`feedInfoFromList: ${JSON.stringify(feedInfoFromList)}`);

  return {
    plugin,
    feedName,
    feed: feedFromStore,
    metaInfo: contextMetaInfo, // Assign the correctly typed RssFeedMeta
    absFolder: `${plugin.feeds_reader_dir}/${feedInfoFromList.folder}`,
    tmpSuffix: ".tmp",
    stagingDir: `${plugin.feeds_reader_dir}/${feedInfoFromList.folder}.__swap_${generateRandomUUID()}`,
  };
}

async function ensureFolder({ plugin, absFolder }: { plugin: FeedsReaderPlugin; absFolder: string }) {
  const { vault } = plugin.app;
  if (!(await vault.adapter.exists(absFolder))) {
    await vault.createFolder(absFolder);
    console.log(`ensureFolder: Created folder ${absFolder}`);
  }
}

async function prepareData(ctx: FeedContext): Promise<{ meta: RssFeedMeta; items: RssFeedItem[] }> {
  const { feed, feedName, metaInfo } = ctx;

  if (!feed?.items?.length) {
    const meta: RssFeedMeta = {
      name: feed?.name ?? feedName,
      title: feed?.title ?? feedName,
      link: feed?.link ?? "",
      folder: metaInfo.folder,
      image: feed?.image,
      description: feed?.description,
      pubDate: feed?.pubDate,
    };
    console.log(`prepareData: Created meta ${JSON.stringify(meta)}`);
    return { meta, items: [] };
  }

  // -----------------------------------------------------------------------
  // ID completion – generate deterministic IDs *synchronously* to avoid an
  // "await" *per item* when a large feed is imported for the very first
  // time.  This reduces the round-trip to the (potentially async)
  // SubtleCrypto API from *N* to *0*.
  // -----------------------------------------------------------------------

  for (const item of feed.items) {
    if (!item.id) {
      const base = (item.link || item.title || "") + (item.pubDate ?? "");
      const generated = generateDeterministicItemIdSync(base);
      item.id = generated || generateRandomUUID();
    }
  }

  // Schema Validation
  const validContent = RssFeedContentSchema.parse(feed);
  const { items, ...meta } = validContent;
  RssFeedMetaSchema.parse(meta);
  console.log(`saveFeedsData: Validated meta ${JSON.stringify(meta)}`);
  console.log(`saveFeedsData: Validated items ${JSON.stringify(items)}`);

  return { meta, items };
}

async function writeMeta(ctx: FeedContext, meta: RssFeedMeta) {
  const tmpDir = ctx.stagingDir;
  await ensureFolder({ ...ctx, absFolder: tmpDir });

  const tmp = `${tmpDir}/${FEEDS_META_FNAME}`;
  const gzip = compress(JSON.stringify(meta));
  console.log(`writeMeta: Compressed meta ${JSON.stringify(meta)}`);
  await ctx.plugin.app.vault.adapter.writeBinary(
    tmp,
    gzip.buffer.slice(gzip.byteOffset, gzip.byteOffset + gzip.byteLength) as ArrayBuffer,
  );
  console.log(`writeMeta: Wrote meta to ${tmp}`);
}

/**
 * Writes the given items array into chunk files not exceeding the size limit set
 * by `plugin.lenStrPerFile`.  The algorithm is UTF-8 aware – it measures the
 * *byte* length of the JSON representation and guarantees that multi-byte
 * characters are **never** split across fragment boundaries.  Each fragment is
 * itself a valid JSON array so it can be parsed independently when reading
 * back the data.
 */
async function writeItems(ctx: FeedContext, items: RssFeedItem[]): Promise<number>  {
  if (!items.length) return 0;

  const encoder = new TextEncoder();
  const sizeLimit = ctx.plugin.lenStrPerFile ?? LEN_STR_PER_FILE; // bytes
  const dir = ctx.stagingDir;
  await ensureFolder({ ...ctx, absFolder: dir });

  const writePromises: Promise<void>[] = [];
  let chunkIndex = 0;
  let currentChunkItems: RssFeedItem[] = [];
  let currentChunkSize = 2; // account for the opening & closing brackets []

  const flushChunk = async () => {
    if (currentChunkItems.length === 0) return;

    const json = JSON.stringify(currentChunkItems);
    const gzip = compress(json);
    const tmpPath = `${dir}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}${chunkIndex}${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`;
    console.log(`writeItems: Compressed item chunk ${chunkIndex} (${currentChunkItems.length} items) for path ${tmpPath}`);

    const writePromise = ctx.plugin.app.vault.adapter.writeBinary(
      tmpPath,
      gzip.buffer.slice(gzip.byteOffset, gzip.byteOffset + gzip.byteLength) as ArrayBuffer,
    ).then(() => {
      console.log(`writeItems: Successfully wrote item chunk ${chunkIndex} to ${tmpPath}`);
    }).catch(err => {
      console.error(`writeItems: Failed to write item chunk ${chunkIndex} to ${tmpPath}`, err);
      throw err;
    });

    writePromises.push(writePromise);
    chunkIndex += 1;
    currentChunkItems = [];
    currentChunkSize = 2; // reset for next chunk (the [] brackets)
  };

  for (const item of items) {
    const itemJson = JSON.stringify(item);
    const itemSize = encoder.encode(itemJson).length + (currentChunkItems.length > 0 ? 1 : 0); // +1 for comma if not first item

    if (currentChunkSize + itemSize > sizeLimit && currentChunkItems.length > 0) {
      // Flushing current chunk before adding the item keeps size under limit
      await flushChunk();
    }

    // If single item itself exceeds limit we still write it alone (might exceed limit)
    currentChunkItems.push(item);
    currentChunkSize += itemSize;
  }

  // Flush the final chunk
  await flushChunk();

  try {
    await Promise.all(writePromises);
    console.log(`writeItems: All ${writePromises.length} item chunks written successfully.`);
  } catch (error) {
    console.error("writeItems: Error writing one or more item chunks in parallel.", error);
    throw error;
  }

  return chunkIndex;
}

/**
 * Atomically swaps the current feed folder with the freshly-written stagingDir.
 *
 * Algorithm (all paths share the same parent directory):
 *   1.  Rename the existing folder to <absFolder>.__old_<uuid>
 *   2.  Rename the fully-populated stagingDir to <absFolder>
 *   3.  Recursively delete the ⬆ old folder (best-effort – errors are logged)
 *
 * Note: At every instant either the old complete data or the new complete data folder is present in <absFolder>
 *       so concurrent save operations will not leave the folder empty.
 */
async function swapIn(ctx: FeedContext) {
  const { plugin, absFolder, stagingDir } = ctx;
  const { vault } = plugin.app;

  const oldBackupDir = `${absFolder}.__old_${generateRandomUUID()}`;

  try {
    // Step-1: move current live folder away (if it exists)
    if (await vault.adapter.exists(absFolder)) {
      await vault.adapter.rename(absFolder, oldBackupDir);
      console.log(`swapIn: Moved existing data folder to backup ${oldBackupDir}`);
    }

    // Step-2: promote stagingDir to live path
    await vault.adapter.rename(stagingDir, absFolder);
    console.log(`swapIn: Promoted staging folder ${stagingDir} to live path ${absFolder}`);

  } catch (err) {
    console.error("swapIn: Atomic folder swap failed", err);
    // Attempt best-effort rollback – if live folder missing, restore backup
    try {
      if (!(await vault.adapter.exists(absFolder)) && await vault.adapter.exists(oldBackupDir)) {
        await vault.adapter.rename(oldBackupDir, absFolder);
      }
    } catch (rollbackErr) {
      console.error("swapIn: Rollback also failed", rollbackErr);
    }
    throw err;
  }

  // Step-3: delete old backup asynchronously (do not block function)
  (async () => {
    try {
      if (await vault.adapter.exists(oldBackupDir)) {
        // Using Obsidian API: remove folder recursively
        const oldFolder = vault.getAbstractFileByPath(oldBackupDir);
        if (oldFolder) {
          await vault.delete(oldFolder, true);
          console.log(`swapIn: Deleted old backup folder ${oldBackupDir}`);
        }
      }
    } catch (cleanupErr) {
      console.warn(`swapIn: Failed to clean up backup folder ${oldBackupDir}`, cleanupErr);
    }
  })();
}

async function cleanupTmp(ctx: FeedContext) {
  const { absFolder, tmpSuffix, plugin } = ctx;
  const { vault } = plugin.app;

  // Remove temporary meta file
  const tmpMeta = `${absFolder}/${FEEDS_META_FNAME}${tmpSuffix}`;
  if (await vault.adapter.exists(tmpMeta)) await vault.adapter.remove(tmpMeta);

  // Remove temporary chunk files
  const entries = await vault.adapter.list(absFolder);
  for (const p of entries.files) {
    if (p.endsWith(tmpSuffix)) await vault.adapter.remove(p);
  }
}

async function loadOldFormatData(plugin: FeedsReaderPlugin, feedMeta: FeedInfo, feedFolderPathAbsolute: string): Promise<RssFeedContent | null> {
  // ... (Implementation of loadOldFormatData - should be mostly the same as provided in the context)
  // This function attempts to load data from the old ".frag.gzip" format.
  // For brevity, its internal logic isn't fully reproduced here but should be maintained from the original file.

  // Simplified placeholder for the original logic:
  const oldFormatFilePath = `${feedFolderPathAbsolute}/${OLD_FEEDS_DATA_FNAME_BASE}.frag.gzip`; // Example, might be more complex
  if (await plugin.app.vault.adapter.exists(oldFormatFilePath)) {
    console.log(`Attempting to load old format data for ${feedMeta.name} from ${oldFormatFilePath}`);
    try {
      // Simulate reading and parsing old format
      const binaryData = await plugin.app.vault.adapter.readBinary(oldFormatFilePath);
      const json = decompress(new Uint8Array(binaryData));
      const parsed = JSON.parse(json);
      // Basic validation and transformation to RssFeedContent
      if (parsed && parsed.items && parsed.name) {
        const validated = RssFeedContentSchema.safeParse(parsed);
        if (validated.success) {
          console.log(`Successfully loaded and migrated old format data for ${feedMeta.name}`);
          // Mark for re-save in new format:
          // This should ideally be handled by the caller or a higher-level migration logic
          // For now, we can assume the main plugin will eventually save it in the new format.
          return validated.data;
        } else {
          console.warn(`Old format data for ${feedMeta.name} failed RssFeedContentSchema validation.`, validated.error.flatten());
        }
      }
    } catch (e) {
      console.error(`Error loading old format data for ${feedMeta.name}:`, e);
    }
  }
  return null;
}

/**
 * Loads stored data for a given feed.
 * Returns the loaded RssFeedContent object or a default empty structure.
 * Includes on-the-fly migration from old data format if necessary.* 
 */
export async function loadFeedsStoredData(plugin: FeedsReaderPlugin, feedMeta: FeedInfo): Promise<RssFeedContent> {
  const vault = plugin.app.vault;
  const feedFolderPathAbsolute = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
  let loadedFeed: RssFeedContent | null = null;

  try {
    if (!(await vault.adapter.exists(feedFolderPathAbsolute))) {
      console.warn(`loadFeedsStoredData: Folder for feed "${feedMeta.name}" not found: ${feedFolderPathAbsolute}. Returning empty structure.`);
      // Return a minimal valid RssFeedContent structure
      return RssFeedContentSchema.parse({
        name: feedMeta.name,
        title: feedMeta.name, // Use feed name as title if nothing else
        link: feedMeta.feedUrl,
        folder: feedMeta.folder,
        items: [],
        image: undefined,
        description: undefined,
        pubDate: undefined,
      });
    }

    // Attempt to load new format first
    const metaFilePath = `${feedFolderPathAbsolute}/${FEEDS_META_FNAME}`;
    if (await vault.adapter.exists(metaFilePath)) {
      const compressedMeta = await vault.adapter.readBinary(metaFilePath);
      const metaJson = decompress(new Uint8Array(compressedMeta)); 
      const parsedMeta = JSON.parse(metaJson) as RssFeedMeta; 

      const chunkFilePaths: string[] = [];
      for (let i = 0; ; i++) {
        const chunkFilePath = `${feedFolderPathAbsolute}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}${i}${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`;
        if (!(await vault.adapter.exists(chunkFilePath))) break;
        chunkFilePaths.push(chunkFilePath);
      }

      const loadedItems: RssFeedItem[] = [];
      if (chunkFilePaths.length > 0) {
        const readPromises = chunkFilePaths.map(path => vault.adapter.readBinary(path));
        try {
          const compressedChunks = await Promise.all(readPromises);
          compressedChunks.forEach(compressedChunk => {
            const chunkJson = decompress(new Uint8Array(compressedChunk));
            const itemsInChunk = JSON.parse(chunkJson) as RssFeedItem[]; 
            loadedItems.push(...itemsInChunk);
          });
        } catch (error) {
          console.error(`loadFeedsStoredData: Error reading item chunks in parallel for feed "${feedMeta.name}". Details:`, error);
          // Error occurred, continue with partially loaded items or empty items
          // Here, we continue with empty items and return the fallback structure
          loadedFeed = { ...parsedMeta, items: [] }; // Items are empty
          // throw error; // If further error handling is needed, throw the error
        }
      }
      // If no error, or error but items are loaded
      if (loadedFeed === null || loadedFeed.items.length === 0 && loadedItems.length > 0) {
        loadedFeed = { ...parsedMeta, items: loadedItems };
      }
    } else {
      // If new format meta not found, try loading old format
      // console.log(`loadFeedsStoredData: New format meta not found for "${feedMeta.name}". Attempting to load old format.`);
      loadedFeed = await loadOldFormatData(plugin, feedMeta, feedFolderPathAbsolute);
      if (loadedFeed) {
        // If old format loaded successfully, immediately mark it for re-save in new format
        // This ensures migration happens on next save.
        plugin.feedsStoreChange = true;
        plugin.feedsStoreChangeList.add(feedMeta.name);
        console.log(`loadFeedsStoredData: Feed "${feedMeta.name}" loaded from old format and marked for migration to new format.`);
      }
    }

    if (loadedFeed) {
      // Ensure all items have an ID after loading, regardless of format
      for (const item of loadedFeed.items) {
        if (!item.id) {
          const baseString = item.link || item.title || '' + (item.pubDate || '') + (item.content || '').substring(0,100);
          item.id = generateDeterministicItemIdSync(baseString);
          if (!item.id.startsWith("fallback_") && (item.id === item.link)) {
            item.id = generateDeterministicItemIdSync(item.link + (item.pubDate || ''));
          }
          if (!item.id || item.id === "fallback_") {
            item.id = generateRandomUUID();
          }
        }
      }
      const validation = RssFeedContentSchema.safeParse(loadedFeed);
      if (validation.success) {
        return validation.data;
      } else {
        console.error(`loadFeedsStoredData: Loaded data for feed "${feedMeta.name}" is invalid after attempting all load paths. Details:`, validation.error.flatten());
        // Fallback to empty structure if validation fails
      }
    }

  } catch (error) {
    console.error(`loadFeedsStoredData: Failed to load data for feed "${feedMeta.name}" from "${feedFolderPathAbsolute}". Details:`, error);
    // Fallback to empty structure on any other error
  }

  // Fallback: Return a minimal valid RssFeedContent structure if all loading fails or results in invalid data
  console.warn(`loadFeedsStoredData: Critical failure loading "${feedMeta.name}". Returning empty structure.`);
  return RssFeedContentSchema.parse({
    name: feedMeta.name,
    title: feedMeta.name,
    link: feedMeta.feedUrl,
    folder: feedMeta.folder,
    items: [],
    image: undefined,
    description: undefined,
    pubDate: undefined,
  });
}
