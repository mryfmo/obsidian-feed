import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compress, decompress, loadSubscriptions, saveFeedsData, loadFeedsStoredData } from '../src/data';
import { App, TFolder, TFile, Vault } from 'obsidian';
import FeedsReaderPlugin from '../src/main';
import { RssFeedItem } from '../src/types';
import { FEEDS_STORE_BASE, FEEDS_META_FNAME, FEEDS_ITEMS_CHUNK_FNAME_PREFIX, FEEDS_ITEMS_CHUNK_FNAME_SUFFIX, OLD_FEEDS_DATA_FNAME_BASE, SUBSCRIPTIONS_FNAME, LEN_STR_PER_FILE } from '../src/constants';

// --- Mock Obsidian Vault Adapter ---
const mockAdapter = {
  exists: vi.fn(), read: vi.fn(), write: vi.fn(),
  readBinary: vi.fn(), writeBinary: vi.fn(),
  remove: vi.fn(), rmdir: vi.fn(), list: vi.fn()
};
const mockVault = {
  adapter: mockAdapter, configDir: "/fake/.obsidian",
  getAbstractFileByPath: vi.fn(), createFolder: vi.fn(), delete: vi.fn()
} as unknown as Vault;
const mockApp = { vault: mockVault } as unknown as App;

// --- Mock Plugin Instance Setup ---
const createMockPlugin = (): FeedsReaderPlugin => {
  const plugin = {
    app: mockApp,
    settings: { nItemPerPage: 20, saveSnippetNewToOld: false },
    feeds_reader_dir: "/fake/.obsidian/plugins/test-plugin-data",
    feeds_store_base: "feeds-store",
    feeds_data_fname: "feed-data",
    subscriptions_fname: "subscriptions.json",
    saved_snippets_fname: "snippets.md", // Needed for snippet path tests if done here
    lenStrPerFile: LEN_STR_PER_FILE, // Initialize with the number type from constants
    feedList: [],
    feedsStore: {},
    feedsStoreChange: false,
    feedsStoreChangeList: new Set(),
    refreshView: vi.fn(),
    manifest: { id: "test-plugin" }
  } as unknown as FeedsReaderPlugin; // Cast to FeedsReaderPlugin
  return plugin;
};

// Helper to setup mocks for loadFeedsStoredData
const setupLoadMocks = (fragments: { [path: string]: ArrayBuffer }) => {
  mockAdapter.exists.mockImplementation(async (path: string) => path in fragments);
  mockAdapter.readBinary.mockImplementation(async (path: string) => {
    if (path in fragments) return fragments[path];
      throw new Error(`Mock File not found: ${path}`);
  });
};

// --- Test Suite ---
describe("data.ts", () => {
    let plugin: FeedsReaderPlugin;

    beforeEach(() => {
        vi.clearAllMocks();
        plugin = createMockPlugin();
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Restore any spies
    });

    describe("Compression", () => {
        it("round-trip gzip", async () => {
          const text = "こんにちは、世界！Hello world!";
          const zipped = await compress(text);
          const unzipped = await decompress(zipped);
          expect(unzipped).toBe(text);
        });
    });

    describe("loadSubscriptions", () => {
        it("returns empty array if file does not exist", async () => {
          mockAdapter.exists.mockResolvedValue(false);
          const subs = await loadSubscriptions(mockApp, "/path/subs.json", FEEDS_STORE_BASE);
          expect(subs).toEqual([]);
          expect(mockAdapter.read).not.toHaveBeenCalled();
        });
        it("returns empty array if file is empty", async () => {
            mockAdapter.exists.mockResolvedValue(true);
            mockAdapter.read.mockResolvedValue("");
            const subs = await loadSubscriptions(mockApp, "/path/subs.json", FEEDS_STORE_BASE);
            expect(subs).toEqual([]);
        });
        it("returns parsed subscriptions on valid JSON", async () => {
          const validSubsData = [{ name: "Feed1", feedUrl: "http://f1.com", unread: 2, updated: 123, folder: `${FEEDS_STORE_BASE}/Feed1` }];
          mockAdapter.exists.mockResolvedValue(true);
          mockAdapter.read.mockResolvedValue(JSON.stringify(validSubsData));
          const subs = await loadSubscriptions(mockApp, "/path/subs.json", FEEDS_STORE_BASE);
          expect(subs).toEqual(validSubsData);
        });
        it("returns empty array and logs error on invalid JSON", async () => {
            mockAdapter.exists.mockResolvedValue(true);
            mockAdapter.read.mockResolvedValue("{invalid json}");
            const consoleErrorSpy = vi.spyOn(console, 'error');
            const subs = await loadSubscriptions(mockApp, "/path/subs.json", FEEDS_STORE_BASE);
            expect(subs).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load subscriptions"), expect.any(SyntaxError));
        });
         it("returns empty array and logs error on invalid schema", async () => {
            const invalidSubsData = [{ name: "Feed1", url: "http://f1.com" }];
            mockAdapter.exists.mockResolvedValue(true);
            mockAdapter.read.mockResolvedValue(JSON.stringify(invalidSubsData));
            const consoleErrorSpy = vi.spyOn(console, 'error');
            await loadSubscriptions(mockApp, "/path/subs.json", FEEDS_STORE_BASE);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid subscriptions file format"), expect.anything());
        });
    });

    describe("saveFeedsData", () => {
         const setupSaveState = (feedName: string, items: RssFeedItem[]) => {
            plugin.feedList = [{ name: feedName, feedUrl: "http://test.com", unread: items.filter(i=>i.read==="0" && i.deleted === "0").length, updated: 0, folder: `${FEEDS_STORE_BASE}/${feedName}` }];
            plugin.feedsStore = { [feedName]: { name: feedName, title: feedName, link: "http://test.com", folder: `${FEEDS_STORE_BASE}/${feedName}`, items: items } };
            plugin.feedsStoreChange = true;
            plugin.feedsStoreChangeList = new Set([feedName]);
         };
        it("does nothing if feedsStoreChange is false", async () => {
            plugin.feedsStoreChange = false;
            await saveFeedsData(plugin, new Set());
            expect(mockAdapter.writeBinary).not.toHaveBeenCalled();
            expect(mockAdapter.write).not.toHaveBeenCalled();
        });
         it("saves a single fragment if data is small", async () => {
            const items = [{ id: "1", title: "Item 1", read: "0", deleted: "0", link: "l1", content: "c1", category: "", creator: "", pubDate: "", downloaded: "0" }];
            setupSaveState("SmallFeed", items);
            mockAdapter.exists.mockResolvedValue(true);
            await saveFeedsData(plugin, new Set(["SmallFeed"]));
            const feedFolder = `${plugin.feeds_reader_dir}/${plugin.feedList[0].folder}`;
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${feedFolder}/${FEEDS_META_FNAME}`, expect.any(ArrayBuffer));
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}0${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`, expect.any(ArrayBuffer));
            const expectedSubsPath = `${plugin.feeds_reader_dir}/${SUBSCRIPTIONS_FNAME}`;
            expect(mockAdapter.write).toHaveBeenCalledWith(expectedSubsPath, expect.any(String));
            expect(plugin.feedsStoreChange).toBe(false);
            expect(plugin.feedsStoreChangeList.size).toBe(0);
        });
        it("saves multiple fragments if data is large", async () => {
            plugin.lenStrPerFile = 50; // Override for this specific test, this is fine as plugin is FeedsReaderPlugin type
            const largeContent = "c".repeat(40);
            const items = [ { id:"1", title:"I1", read:"0", deleted:"0", link:"l1", content:largeContent, category:"", creator:"", pubDate:"", downloaded:"0" }, { id:"2", title:"I2", read:"0", deleted:"0", link:"l2", content:largeContent, category:"", creator:"", pubDate:"", downloaded:"0" } ];
            setupSaveState("LargeFeed", items);
            mockAdapter.exists.mockResolvedValue(true);
            await saveFeedsData(plugin, new Set(["LargeFeed"]));
            const feedFolder = `${plugin.feeds_reader_dir}/${plugin.feedList[0].folder}`;
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${feedFolder}/${FEEDS_META_FNAME}`, expect.any(ArrayBuffer));
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}0${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`, expect.any(ArrayBuffer));
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}1${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`, expect.any(ArrayBuffer));
            expect(mockAdapter.write).toHaveBeenCalledOnce();
            expect(plugin.feedsStoreChange).toBe(false);
            // Reset lenStrPerFile if it affects other tests, or rely on beforeEach to recreate the plugin mock
            plugin.lenStrPerFile = LEN_STR_PER_FILE; 
        });
        it("removes fragments and updates meta if feed becomes empty", async () => {
            setupSaveState("EmptyFeed", []);
            mockAdapter.exists.mockResolvedValue(true);
            const mockFileToRemove = { path: `${plugin.feeds_reader_dir}/${plugin.feedList[0].folder}/${OLD_FEEDS_DATA_FNAME_BASE}.frag.gzip`, name: `${OLD_FEEDS_DATA_FNAME_BASE}.frag.gzip` } as TFile;
            const mockFolder = { children: [mockFileToRemove], path: `${plugin.feeds_reader_dir}/${plugin.feedList[0].folder}` } as unknown as TFolder;
            (mockVault.getAbstractFileByPath as unknown as { mockReturnValue: (value: TFolder) => unknown }).mockReturnValue(mockFolder);
            await saveFeedsData(plugin, new Set(["EmptyFeed"]));
            expect(mockVault.delete).toHaveBeenCalledWith(mockFileToRemove);
            expect(mockAdapter.write).toHaveBeenCalledOnce();
            const savedSubs = JSON.parse(mockAdapter.write.mock.calls[0][1]);
            expect(savedSubs[0].unread).toBe(0);
            expect(plugin.feedsStoreChange).toBe(false);
        });
        it("handles errors during individual feed save and continues", async () => {
            setupSaveState("GoodFeed", [{ id: "g1", title:"G", read:"0", deleted:"0", link:"lg", content:"cg", category:"", creator:"", pubDate:"", downloaded:"0" }]);
            const errorFeedName = "ErrorFeed";
            plugin.feedList.push({ name: errorFeedName, feedUrl: "u", unread: 1, updated: 0, folder: `${FEEDS_STORE_BASE}/${errorFeedName}` });
            plugin.feedsStore[errorFeedName] = { name:errorFeedName, title:"E", link:"l", folder:`${FEEDS_STORE_BASE}/${errorFeedName}`, items:[{id:"e1", title:"E", read:"0", deleted:"0", link:"le", content:"ce", category:"", creator:"", pubDate:"", downloaded:"0"}]};
            plugin.feedsStoreChangeList.add(errorFeedName); plugin.feedsStoreChange = true;
            mockAdapter.writeBinary.mockImplementation(async (path: string) => { if (path.includes(errorFeedName)) throw new Error("Fail"); return new Uint8Array().buffer; });
            mockAdapter.exists.mockResolvedValue(true);
            await saveFeedsData(plugin, new Set(["GoodFeed", errorFeedName]));
            const goodFeedFolder = `${plugin.feeds_reader_dir}/${plugin.feedList[0].folder}`;
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(`${goodFeedFolder}/${FEEDS_META_FNAME}`, expect.any(ArrayBuffer)); // GoodFeed meta
            expect(mockAdapter.writeBinary).toHaveBeenCalledWith(expect.stringContaining(errorFeedName), expect.any(ArrayBuffer)); // ErrorFeed attempt
            expect(mockAdapter.write).toHaveBeenCalledOnce(); // Subscriptions saved even with error
            expect(plugin.feedsStoreChangeList.has(errorFeedName)).toBe(true);
            expect(plugin.feedsStoreChange).toBe(true);
        });
        it("should not save if data validation fails", async () => {
            const feedName = "InvalidFeed";
            plugin.feedsStore = { [feedName]: { name: feedName, title: "T", folder: "f", items: [{id:"1", title:"I" /* missing link etc */ }] } } as unknown as typeof plugin.feedsStore;
            plugin.feedList = [{ name: feedName, feedUrl: "u", unread: 0, updated: 0, folder: `feeds-store/${feedName}` }];
            plugin.feedsStoreChange = true; plugin.feedsStoreChangeList = new Set([feedName]);
            mockAdapter.exists.mockResolvedValue(true);
            const consoleErrorSpy = vi.spyOn(console, 'error');
            await saveFeedsData(plugin, new Set([feedName]));
            expect(mockAdapter.writeBinary).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Data for feed InvalidFeed is invalid"), expect.anything());
            expect(plugin.feedsStoreChangeList.has(feedName)).toBe(true);
            expect(plugin.feedsStoreChange).toBe(true);
        });
        it("should correctly update unread count before saving subscriptions", async () => {
            const feedName = "UnreadCountFeed";
            plugin.feedsStore = { [feedName]: { name:feedName, title:"T", link:"l", folder:"f", items: [ { id:"1", read:"0", deleted:"0", /*...*/ }, { id:"2", read:"ts", deleted:"0", /*...*/ }, { id:"3", read:"0", deleted:"1", /*...*/ }, { id:"4", read:"0", deleted:"0", /*...*/ } ] } } as unknown as typeof plugin.feedsStore;
            plugin.feedList = [{ name: feedName, feedUrl: "u", unread: 99, updated: 0, folder: `feeds-store/${feedName}` }];
            plugin.feedsStoreChange = true; plugin.feedsStoreChangeList = new Set([feedName]);
            mockAdapter.exists.mockResolvedValue(true);
            await saveFeedsData(plugin, new Set([feedName]));
            expect(mockAdapter.write).toHaveBeenCalledOnce();
            const savedSubs = JSON.parse(mockAdapter.write.mock.calls[0][1]);
            expect(savedSubs[0].unread).toBe(2);
        });
    });

    describe("loadFeedsStoredData", () => {
        it("loads data from a single primary fragment", async () => {
            const feedName = "SingleFragFeed";
            const feedMeta = { name: feedName, feedUrl:"u", unread:1, updated:0, folder:`${FEEDS_STORE_BASE}/${feedName}`};
            const items = [{ id: "s1", title: "Single", read:"0", deleted:"0", link:"ls", content:"cs", category:"", creator:"", pubDate:"", downloaded:"0" }];
            const metaToStore = { name: feedName, folder: feedMeta.folder, title: feedName, link: "u" };
            const itemsToStore = items;
            const compressedMeta = await compress(JSON.stringify(metaToStore));
            const compressedItems = await compress(JSON.stringify(itemsToStore));
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
            const metaPath = `${feedFolder}/${FEEDS_META_FNAME}`;
            const itemsPath = `${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}0${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`;
            setupLoadMocks({ [metaPath]: compressedMeta.buffer as ArrayBuffer, [itemsPath]: compressedItems.buffer as ArrayBuffer });
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            expect(loadedData?.items[0].title).toBe("Single");
            expect(plugin.feedsStore[feedName]).toEqual(loadedData);
        });
        it("loads and combines data from multiple numbered fragments", async () => {
            const feedName = "MultiFragFeed"; 
            const feedMetaInfo = { name: feedName, feedUrl:"u", unread:2, updated:0, folder:`${FEEDS_STORE_BASE}/${feedName}`};
            const items = [ { id: "m1", title:"Multi1", read:"0", deleted:"0", link:"lm1", content:"c".repeat(40), category:"", creator:"", pubDate:"", downloaded:"0" }, { id: "m2", title:"Multi2", read:"0", deleted:"0", link:"lm2", content:"c".repeat(40), category:"", creator:"", pubDate:"", downloaded:"0" } ];
            const metaToStore = { name: feedName, folder: feedMetaInfo.folder, title: feedName, link: "u" };
            const itemsJson = JSON.stringify(items);
            const compressedMeta = await compress(JSON.stringify(metaToStore));
            
            const fragments: { [path: string]: ArrayBuffer } = {};
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMetaInfo.folder}`;
            fragments[`${feedFolder}/${FEEDS_META_FNAME}`] = compressedMeta.buffer as ArrayBuffer;

            const len = itemsJson.length; 
            let maxLen = plugin.lenStrPerFile; // plugin.lenStrPerFile is number
            if (typeof maxLen !== 'number' || maxLen <=0) maxLen = LEN_STR_PER_FILE; 

            for (let i = 0, partIndex = 0; i < len; i += maxLen, partIndex++) {
              const partJson = itemsJson.substring(i, Math.min(i + maxLen, len));
              const compressedPart = await compress(partJson);
              fragments[`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}${partIndex}${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`] = compressedPart.buffer as ArrayBuffer;
            }

            setupLoadMocks(fragments);
             const loadedData = await loadFeedsStoredData(plugin, feedMetaInfo);
             expect(loadedData?.items.length).toBe(2);
             expect(loadedData?.items[0].title).toBe("Multi1");
             expect(loadedData?.items[1].title).toBe("Multi2");
        });
        it("returns empty structure if no fragments found", async () => {
            const feedMeta = { name: "NoDataFeed", feedUrl:"u", unread:0, updated:0, folder:`${FEEDS_STORE_BASE}/NoDataFeed`};
            setupLoadMocks({});
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            expect(loadedData?.items).toEqual([]);
            expect(plugin.feedsStore[feedMeta.name]?.items).toEqual([]); 
        });
        it("returns empty structure and logs error on parse failure", async () => {
            const feedMeta = { name: "CorruptDataFeed", feedUrl:"u", unread:0, updated:0, folder:`${FEEDS_STORE_BASE}/Corrupt`};
            const compressedMeta = await compress('{"invalid meta json');
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
            const metaPath = `${feedFolder}/${FEEDS_META_FNAME}`;
            setupLoadMocks({ [metaPath]: compressedMeta.buffer as ArrayBuffer });
            const consoleErrorSpy = vi.spyOn(console, 'error');
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            expect(loadedData?.items).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Decompression failed"), expect.any(Error));
        });
        it("should handle missing intermediate fragments and likely fail parsing", async () => {
            const feedName = "MissingMiddle";
            const feedMeta = { name: feedName, feedUrl: "u", unread: 0, updated: 0, folder: `${FEEDS_STORE_BASE}/${feedName}` };
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
            // Simulate only meta and one item chunk, but an items chunk is missing or content is malformed
            const metaToStore = { name: feedName, folder: feedMeta.folder, title: feedName, link: "u" };
            const itemPart = `[{"id":"1"`; // Malformed items JSON part
            const compressedMeta = await compress(JSON.stringify(metaToStore));
            const compressedItemPart = await compress(itemPart);

            const fragments = { 
                [`${feedFolder}/${FEEDS_META_FNAME}`]: compressedMeta.buffer as ArrayBuffer,
                // Missing chunk 0, or chunk 0 is malformed
                [`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}1${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`]: compressedItemPart.buffer as ArrayBuffer 
            };
            setupLoadMocks(fragments);
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            // Expectation depends on how loadFeedsStoredData handles missing/corrupt item chunks
            // It might log a warning and return meta with empty items or default items.
            expect(consoleWarnSpy).toHaveBeenCalled(); // Check if a warning was logged
            expect(loadedData?.items).toEqual([]); // Expect empty items due to parse failure or missing data
        });
        it("should attempt item recovery on schema validation failure", async () => {
            const feedName = "PartialValid";
            const feedMeta = { name: feedName, feedUrl: "u", unread: 0, updated: 0, folder: `${FEEDS_STORE_BASE}/${feedName}` };
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
            const metaToStore = { name: feedName, folder: feedMeta.folder, title: feedName, link: "l" };
            const itemsJson = `[ {"id":"1", "title":"Valid", "link":"lv", "read":"0", "deleted":"0", "content":"c", "category":"", "creator":"", "pubDate":"", "downloaded":"0"}, {"id":"2", "title":"Invalid"} ]`; // Invalid item missing link etc.
            const compressedMeta = await compress(JSON.stringify(metaToStore));
            const compressedItems = await compress(itemsJson);
            const fragments = { 
                [`${feedFolder}/${FEEDS_META_FNAME}`]: compressedMeta.buffer as ArrayBuffer,
                [`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}0${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`]: compressedItems.buffer as ArrayBuffer
            };
            setupLoadMocks(fragments);
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("failed schema validation"));
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Partially recovered 1/2 items"));
            expect(loadedData?.items.length).toBe(1);
            expect(loadedData?.items[0].title).toBe("Valid");
        });
         it("assigns fallback IDs to loaded items lacking one", async () => {
            const feedName = "NeedsID";
            const feedMeta = { name: feedName, feedUrl: "u", unread: 1, updated: 0, folder: `${FEEDS_STORE_BASE}/${feedName}` };
            const feedFolder = `${plugin.feeds_reader_dir}/${feedMeta.folder}`;
            const metaToStore = { name: feedName, folder: feedMeta.folder, title: feedName, link: "l" };
            const itemsJson = `[ {"title":"Needs ID", "link":"lid", "read":"0", "deleted":"0", "content":"c", "category":"", "creator":"", "pubDate":"pd", "downloaded":"0"} ]`;
            const compressedMeta = await compress(JSON.stringify(metaToStore));
            const compressedItems = await compress(itemsJson);
            const fragments = { 
                [`${feedFolder}/${FEEDS_META_FNAME}`]: compressedMeta.buffer as ArrayBuffer,
                [`${feedFolder}/${FEEDS_ITEMS_CHUNK_FNAME_PREFIX}0${FEEDS_ITEMS_CHUNK_FNAME_SUFFIX}`]: compressedItems.buffer as ArrayBuffer
            };
            setupLoadMocks(fragments);
            const loadedData = await loadFeedsStoredData(plugin, feedMeta);
            expect(loadedData?.items[0].id).toBe("lid"); // Uses link
        });
    });
});
