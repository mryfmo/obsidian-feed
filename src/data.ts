import { App, Notice, TFile, TFolder } from "obsidian";
import { FeedInfo, FeedListSchema, RssFeedContent, RssFeedContentSchema, RssFeedItemSchema, RssFeedMeta, RssFeedMetaSchema } from "./types";
import FeedsReaderPlugin from "./main"; // Assuming FeedsReaderPlugin has feeds_store_base constant
import { SUBSCRIPTIONS_FNAME, LEN_STR_PER_FILE, FEEDS_META_FNAME, FEEDS_ITEMS_CHUNK_FNAME_PREFIX, FEEDS_ITEMS_CHUNK_FNAME_SUFFIX, OLD_FEEDS_DATA_FNAME_BASE } from "./constants";

// Helper function (could be in utils)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
    // console.log(`Subscriptions saved to ${subsPath}`); // Less verbose
  } catch (err: unknown) {
    const errorMessage = `Error saving subscriptions to "${subsPath}". Your feed list might not be saved correctly. Please check file permissions or disk space.`;
    console.error(`saveSubscriptions: Failed to save subscriptions to ${subsPath}. Details:`, err);
    new Notice(errorMessage + ` (Technical details: ${(err instanceof Error) ? err.message : String(err)})`, 10000);
    throw err; // Re-throw to indicate failure
  }
}

async function removeOldFileFragments(plugin: FeedsReaderPlugin, feedFolderRelativePath: string): Promise<void> {
  const vault = plugin.app.vault;
  const baseFileName = OLD_FEEDS_DATA_FNAME_BASE;
  const fullFolderPath = `${plugin.feeds_reader_dir}/${feedFolderRelativePath}`;
  try {
    const folder = vault.getAbstractFileByPath(fullFolderPath);
    if (folder instanceof TFolder) {
      const filesToRemove = folder.children.filter(
        (file): file is TFile =>
          file instanceof TFile &&
          (file.name.startsWith(baseFileName + ".") || file.name === baseFileName + ".frag.gzip") && // Handle both numbered and primary fragments
          file.name.endsWith(".frag.gzip")
      );
      if (filesToRemove.length > 0) {
        for (const file of filesToRemove) {
          await vault.delete(file);
        }
        console.log(`Removed ${filesToRemove.length} old format fragment(s) from ${fullFolderPath}`);
      }
    }
  } catch (err: unknown) {
    console.error(`Failed to remove old file fragments in ${fullFolderPath}:`, err);
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

export async function compress(text: string, format: "gzip" = "gzip"): Promise<Uint8Array> {
  try {
    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();
    const encoded = new TextEncoder().encode(text);
    await writer.write(encoded);
    await writer.close();
    const res = new Response(cs.readable);
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("Compression failed:", error);
    throw error;
  }
}

export async function decompress(byteArray: Uint8Array, format: "gzip" = "gzip"): Promise<string> {
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    await writer.write(byteArray);
    await writer.close();
    const res = new Response(ds.readable);
    const text = await res.text(); // Use text() directly for better performance with large strings
    return text;
  } catch (error) {
    console.error("Decompression failed:", error);
    throw error;
  }
}

/**
 * Saves data for a specified list of feed names.
 * Returns the set of feed names that were successfully saved.
 * Does NOT modify plugin state flags or save subscriptions.
 */
export async function saveFeedsData(plugin: FeedsReaderPlugin, feedNamesToSave: Set<string> | string[]): Promise<Set<string>> {
  const app = plugin.app;
  const vault = app.vault;
  const successfullySaved = new Set<string>();
  const feedNameArray = Array.isArray(feedNamesToSave) ? feedNamesToSave : Array.from(feedNamesToSave);

  console.log(`Saving data for feeds: ${feedNameArray.join(', ')}`);

  for (const feedName of feedNameArray) {
    try {
      const feed = plugin.feedsStore[feedName];
      const feedMeta = plugin.feedList.find(f => f.name === feedName);
      if (!feedMeta) { console.warn(`Save skipped: Metadata missing for ${feedName}.`); continue; }

      const feedFolderRelativePath = feedMeta.folder;
      const feedFolderPathAbsolute = `${plugin.feeds_reader_dir}/${feedFolderRelativePath}`;

      if (!(await vault.adapter.exists(feedFolderPathAbsolute))) {
        await vault.createFolder(feedFolderPathAbsolute);
      }

      // Remove existing new-format files before saving new ones
      await removeAllFeedDataFiles(plugin, feedFolderRelativePath);
      // Also remove old format files if they exist (part of migration cleanup)
      await removeOldFileFragments(plugin, feedFolderRelativePath);

      if (!feed || !feed.items || feed.items.length === 0) {
        // console.log(`No items to save for ${feedName}, fragments removed.`); // Less verbose
        // Still save meta if feed object exists (even with no items)
        if (feed) {
          const metaToSave: RssFeedMeta = {
            name: feed.name, title: feed.title, link: feed.link, folder: feed.folder,
            image: feed.image, description: feed.description, pubDate: feed.pubDate
          };
          const metaValidation = RssFeedMetaSchema.safeParse(metaToSave);
          if (!metaValidation.success) {
            console.error(`saveFeedsData: Meta for empty feed "${feedName}" is invalid. Details:`, metaValidation.error.flatten());
            continue;
          }
          const metaJson = JSON.stringify(metaValidation.data);
          const compressedMeta = await compress(metaJson);
          const metaFilePath = `${feedFolderPathAbsolute}/${FEEDS_META_FNAME}`;
          await vault.adapter.writeBinary(metaFilePath, compressedMeta.buffer as ArrayBuffer);
        }        
      } else {
        feed.items.forEach(item => { if (!item.id) item.id = item.link || generateUUID(); });
        const validation = RssFeedContentSchema.safeParse(feed);
        if (!validation.success) {
          const errorMessage = `Error: Data for feed "${feedName}" is corrupted and cannot be saved. Please check the console for details. You might need to re-add this feed if issues persist.`;
          console.error(`saveFeedsData: Save skipped for feed "${feedName}" due to invalid RssFeedContent data. Details:`, validation.error.flatten());
          new Notice(errorMessage, 10000);
          continue;
        }

        const { items, ...meta } = validation.data;
        const metaValidation = RssFeedMetaSchema.safeParse(meta);
        if (!metaValidation.success) {
          const errorMessage = `Error: Metadata for feed "${feedName}" is invalid and cannot be saved.`;
          console.error(`saveFeedsData: Save skipped for feed "${feedName}" due to invalid RssFeedMeta data. Details:`, metaValidation.error.flatten());
          new Notice(errorMessage, 10000);
          continue;
        }
        const metaJson = JSON.stringify(metaValidation.data);
        const compressedMeta = await compress(metaJson);
        const metaFilePath = `${feedFolderPathAbsolute}/${FEEDS_META_FNAME}`;
        await vault.adapter.writeBinary(metaFilePath, compressedMeta.buffer as ArrayBuffer);

        const itemsJson = JSON.stringify(items);
        const len = itemsJson.length;
        const maxLen = LEN_STR_PER_FILE;

        for (let i = 0, partIndex = 0; i < len; i += maxLen, partIndex++) {
          const partJson = itemsJson.substring(i, Math.min(i + maxLen, len));
          const compressedPart = await compress(partJson);
          const chunkFilePath = `${feedFolderPathAbsolute}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}${partIndex}${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`;
          await vault.adapter.writeBinary(chunkFilePath, compressedPart.buffer as ArrayBuffer);
        }
      }
      successfullySaved.add(feedName);

    } catch (feedSaveError: unknown) {
      const userMessage = `Error saving data for feed "${feedName}". Changes to this feed might be lost. Please check file permissions or disk space.`;
      console.error(`saveFeedsData: Failed to save data for feed "${feedName}". Details:`, feedSaveError);
      new Notice(userMessage + ` (Technical details: ${(feedSaveError instanceof Error) ? feedSaveError.message : String(feedSaveError)})`, 10000);
    }
  }
  return successfullySaved;
}

async function loadOldFormatData(plugin: FeedsReaderPlugin, feedMeta: FeedInfo, feedFolderPathAbsolute: string): Promise<RssFeedContent | null> {
  const vault = plugin.app.vault;
  let combinedJsonString = "";
  const baseFileName = OLD_FEEDS_DATA_FNAME_BASE;

  try {
    const primaryFragmentPath = `${feedFolderPathAbsolute}/${baseFileName}.frag.gzip`;
    if (await vault.adapter.exists(primaryFragmentPath)) {
      const data = await vault.adapter.readBinary(primaryFragmentPath);
      combinedJsonString += await decompress(new Uint8Array(data));
    }

    for (let partIndex = 0; ; partIndex++) {
      const fragmentPath = `${feedFolderPathAbsolute}/${baseFileName}.${partIndex}.frag.gzip`;
      if (await vault.adapter.exists(fragmentPath)) {
        const data = await vault.adapter.readBinary(fragmentPath);
        combinedJsonString += await decompress(new Uint8Array(data));
      } else { break; }
    }

    if (!combinedJsonString) return null;

    const parsedJson = JSON.parse(combinedJsonString);
    const validationResult = RssFeedContentSchema.safeParse(parsedJson);
    if (validationResult.success) {
      console.log(`Successfully loaded old format data for feed "${feedMeta.name}". Will attempt to migrate.`);
      return validationResult.data;
    } else {
      console.warn(`loadOldFormatData: Old format data for feed "${feedMeta.name}" failed schema validation. Cannot migrate. Details:`, validationResult.error.flatten());
      return null;
    }
  } catch (err: unknown) {
    console.error(`loadOldFormatData: Error loading old format data for feed "${feedMeta.name}". Details:`, err);
    return null;
  }
}

/**
 * Loads stored data for a given feed.
 * Returns the loaded RssFeedContent object or a default empty structure.
 * Includes on-the-fly migration from old data format if necessary.* 
 */
export async function loadFeedsStoredData(plugin: FeedsReaderPlugin, feedMeta: FeedInfo): Promise<RssFeedContent> {
  const feedFolderPathAbsolute = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
  const vault = plugin.app.vault;
  const defaultEmptyContent: RssFeedContent = { name: feedMeta.name, folder: feedMeta.folder, title: feedMeta.name, link: feedMeta.feedUrl, items: [] };

  try {
    const metaFilePath = `${feedFolderPathAbsolute}/${FEEDS_META_FNAME}`;
    let loadedMeta: RssFeedMeta | null = null;
    let loadedItems: import("zod").z.infer<typeof RssFeedItemSchema>[] = [];

    if (await vault.adapter.exists(metaFilePath)) {
      // Load new format
      const metaDataBytes = await vault.adapter.readBinary(metaFilePath);
      const metaJson = await decompress(new Uint8Array(metaDataBytes));
      const parsedMeta = JSON.parse(metaJson);
      const metaValidation = RssFeedMetaSchema.safeParse(parsedMeta);
      if (metaValidation.success) {
        loadedMeta = metaValidation.data;
      } else {
        console.warn(`loadFeedsStoredData: Metadata for feed "${feedMeta.name}" is invalid. Details:`, metaValidation.error.flatten());
        // Proceed with empty meta, items might still be recoverable or it's an old format.
      }

      let combinedItemsJsonString = "";
      for (let partIndex = 0; ; partIndex++) {
        const chunkFilePath = `${feedFolderPathAbsolute}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}${partIndex}${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`;
        if (await vault.adapter.exists(chunkFilePath)) {
          const itemDataBytes = await vault.adapter.readBinary(chunkFilePath);
          combinedItemsJsonString += await decompress(new Uint8Array(itemDataBytes));
        } else { break; }
      }
      if (combinedItemsJsonString) {
        const parsedItems = JSON.parse(combinedItemsJsonString);
        if (Array.isArray(parsedItems)) {
          loadedItems = parsedItems.map(item => RssFeedItemSchema.parse(item)); // Assuming direct parse or use safeParse for recovery
        }
      }
    } else {
      // Attempt to load old format and migrate
      console.log(`Metadata file not found for "${feedMeta.name}". Checking for old format data to migrate.`);
      const oldData = await loadOldFormatData(plugin, feedMeta, feedFolderPathAbsolute);
      if (oldData) {
        // Save in new format (this will also remove old files due to saveFeedsData logic)
        plugin.feedsStore[feedMeta.name] = oldData; // Temporarily put in store for save
        await saveFeedsData(plugin, [feedMeta.name]);
        // plugin.feedsStore[feedMeta.name] will be correctly populated now from the new files
        // so, re-assign loadedMeta and loadedItems from oldData for current return
        const {items, ...meta} = oldData;
        loadedMeta = meta;
        loadedItems = items;
        new Notice(`Feed "${feedMeta.name}" data migrated to new format.`, 5000);
      } else {
        console.log(`No data found for feed: ${feedMeta.name} in new or old format. Returning empty.`);
        return defaultEmptyContent;
      }
    }

    const finalContent: RssFeedContent = { ...(loadedMeta || defaultEmptyContent), items: loadedItems };
    finalContent.items.forEach(item => { if (!item.id) item.id = item.link || generateUUID(); });
    const validationResult = RssFeedContentSchema.safeParse(finalContent);

    if (!validationResult.success) {
      const errorMessage = `Warning: Data for feed "${feedMeta.name}" might be corrupted or in an old format. Attempting to recover. Some items may be missing or incorrect.`;
      console.warn(`loadFeedsStoredData: Feed "${feedMeta.name}" failed schema validation after loading/migration. Attempting recovery. Details:`, validationResult.error.flatten(), "\nFinal Content (first 500 chars):", JSON.stringify(finalContent).substring(0,500));
      let recoveredItems: RssFeedContent['items'] = [];
      if (finalContent.items && Array.isArray(finalContent.items)) {
        recoveredItems = finalContent.items
          .map((item: unknown) => RssFeedItemSchema.safeParse(item))
          .filter((res): res is import("zod").SafeParseSuccess<import("zod").z.infer<typeof RssFeedItemSchema>> => res.success)
          .map(res => res.data);
        if (recoveredItems.length > 0) console.warn(`loadFeedsStoredData: Partially recovered ${recoveredItems.length}/${finalContent.items.length} items for "${feedMeta.name}".`);
      }
      new Notice(errorMessage, 10000);
      const reconstructedContent: RssFeedContent = { // Use finalContent which has the loadedMeta
        ...(loadedMeta || defaultEmptyContent),
        title: loadedMeta?.title || feedMeta.name, // Ensure title has a fallback
        items: recoveredItems,
      };
      const finalValidation = RssFeedContentSchema.safeParse(reconstructedContent);
      const finalData = finalValidation.success ? finalValidation.data : defaultEmptyContent;
      finalData.items.forEach(item => { if (!item.id) item.id = item.link || generateUUID(); }); // Ensure IDs on recovery
      return finalData;
    }

    return validationResult.data;
  } catch (err: unknown) {
    const errorMessage = `Critical error loading data for feed "${feedMeta.name}". Please check console for details.`;
    console.error(`loadFeedsStoredData: Critical error for feed "${feedMeta.name}". Details:`, err);
    new Notice(errorMessage + ` (Technical details: ${(err instanceof Error) ? err.message : String(err)})`, 10000);
    return defaultEmptyContent;
  }
}
