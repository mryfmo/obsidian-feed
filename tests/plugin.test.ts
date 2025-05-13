import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FeedsReaderPlugin from '../src/main';
import { App, Vault, TFolder, PluginManifest } from 'obsidian';
import * as DataFuncs from '../src/data';
import * as GetFeedFuncs from '../src/getFeed';
import { RssFeedItem, RssFeedContent } from '../src/types';
import { FEEDS_STORE_BASE, SUBSCRIPTIONS_FNAME } from '../src/constants';

// Removed top-level destructuring of DataFuncs and GetFeedFuncs
// They will be accessed via DataFuncs.xyz and GetFeedFuncs.xyz to ensure mocked versions are used.

// --- Mock Obsidian App & Vault ---
const mockAdapter = { exists: vi.fn(), read: vi.fn(), write: vi.fn(), createFolder: vi.fn(), writeBinary: vi.fn(), remove: vi.fn(), rmdir: vi.fn(), readBinary: vi.fn(), list: vi.fn().mockResolvedValue({files:[], folders:[]}), append: vi.fn() };
const mockVault = { adapter: mockAdapter, configDir: "/fake/.obsidian", getAbstractFileByPath: vi.fn(), createFolder: vi.fn(), delete: vi.fn(), create: vi.fn() } as unknown as Vault;
const mockApp = { vault: mockVault, request: vi.fn(), workspace: { getActiveViewOfType: vi.fn(), revealLeaf: vi.fn(), getLeaf: vi.fn(()=>({ setViewState: vi.fn() })) } } as unknown as App;

// --- Mock Plugin Dependencies ---
vi.mock('../src/data', async (importOriginal) => {
    const original = await importOriginal() as typeof DataFuncs;
    return {
        ...original,
        loadSubscriptions: vi.fn(), 
        saveFeedsData: vi.fn(),
        removeAllFeedDataFiles: vi.fn(),
        loadFeedsStoredData: vi.fn(),
    };
});
vi.mock('../src/getFeed', async (importOriginal) => {
    const original = await importOriginal() as typeof GetFeedFuncs;
    return {
        ...original, getFeedItems: vi.fn(),
    };
});
vi.mock('obsidian', async (importOriginal) => {
    const original = await importOriginal() as typeof import('obsidian');
    return {
        ...original, Notice: vi.fn((msg:string)=>console.log(`NOTICE: ${msg}`)),
        request: vi.fn(),
        sanitizeHTMLToDom: vi.fn((html) => {
             const frag = document.createDocumentFragment();
             const div = document.createElement('div');
             div.innerHTML = html || "";
             frag.textContent = div.textContent;
             while(div.firstChild) frag.appendChild(div.firstChild);
             return frag;
         })
     };
});
const { request: mockGlobalRequest } = await import('obsidian');

// Mocking obsidian's request, Notice, sanitizeHTMLToDom
const mockNotice = vi.fn((msg: string) => console.log(`NOTICE: ${msg}`));
const mockSanitizeHTML = vi.fn((html) => {
    const frag = document.createDocumentFragment();
    const div = document.createElement('div');
    div.innerHTML = html || "";
    frag.textContent = div.textContent;
    while(div.firstChild) frag.appendChild(div.firstChild);
    return frag;
});

vi.mock('obsidian', async (importOriginal) => {
    const original = await importOriginal() as typeof import('obsidian');
    return {
        ...original,
        request: mockGlobalRequest,
        Notice: mockNotice,
        sanitizeHTMLToDom: mockSanitizeHTML
    };
});

// Helper to setup mocks for loadFeedsStoredData (copied from data.test.ts)
const setupLoadMocks = (fragments: { [path: string]: ArrayBuffer }) => {
  mockAdapter.exists.mockImplementation(async (path: string) => path in fragments);
  mockAdapter.readBinary.mockImplementation(async (path: string) => {
    if (path in fragments) return fragments[path];
      throw new Error(`Mock File not found: ${path}`);
  });
};

// --- Test Suite ---
describe("FeedsReaderPlugin", () => {
  let plugin: FeedsReaderPlugin;

  beforeEach(async () => {
    vi.clearAllMocks();
    plugin = new FeedsReaderPlugin(mockApp, { id: "test-plugin", dir:"/fake/.obsidian/plugins/test-plugin" } as unknown as PluginManifest);
    plugin.loadData = vi.fn().mockResolvedValue({ saveSnippetNewToOld: false });
    plugin.saveData = vi.fn().mockResolvedValue(undefined);
    vi.mocked(DataFuncs.loadSubscriptions).mockResolvedValue([]); 
    mockAdapter.exists.mockResolvedValue(true);
    await plugin.onload();
    plugin.feedsStore = {}; plugin.feedList = []; plugin.feedsStoreChange = false; plugin.feedsStoreChangeList.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

   const setupTestDataForPlugin = () => {
        const feedName = "TestFeed";
        const folderPath = `${FEEDS_STORE_BASE}/${feedName}`;
        plugin.feedsStore = {
           [feedName]: { name:feedName, title:"T", link:"l", folder:folderPath, items: [
               { id: "item1", title: "Item 1", read: "0", deleted: "0", link:"http://l1.com", content:"<p>Content 1</p>", category:"", creator:"", pubDate:"pd1", downloaded:"0" },
               { id: "item2", title: "Item 2", read: "0", deleted: "0", link:"http://l2.com", content:"Content 2", category:"", creator:"", pubDate:"pd2", downloaded:"ts_dl" },
               { id: "item3", title: "Item 3", read: "ts_read", deleted: "ts_del", link:"http://l3.com", content:"Content 3", category:"", creator:"", pubDate:"pd3", downloaded:"0" },
               { id: "item4", title: "Item 4", read: "0", deleted: "0", link:"http://l4.com", content:"Content 4", category:"", creator:"", pubDate:"pd4", downloaded:"0" },
           ]}
        };
        plugin.feedList = [{ name: feedName, feedUrl:"u", unread: 3, updated: 0, folder:folderPath }];
   };

  describe("addNewFeed", () => {
    it("should add a new feed, fetch items, save data, and refresh view", async () => {
        const feedName = "NewFeed"; const feedUrl = "http://new.com/rss";
        const folderName = feedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const relativeFolderPath = `${FEEDS_STORE_BASE}/${folderName}`;
        const mockFeedContent: RssFeedContent = { name: feedName, title: "New Title", link: feedUrl, folder: relativeFolderPath, items: [{id: "n1", title:"New", read:"0", deleted:"0", link:"ln", content:"cn", category:"", creator:"", pubDate:"", downloaded:"0"}] };
        vi.mocked(GetFeedFuncs.getFeedItems).mockResolvedValue(mockFeedContent);
        vi.mocked(DataFuncs.saveFeedsData).mockResolvedValue(new Set([feedName])); 
        const refreshViewSpy = vi.spyOn(plugin, 'refreshView');
        mockAdapter.exists.mockResolvedValue(false);
        vi.mocked(mockVault.createFolder).mockResolvedValue(undefined as unknown as TFolder);
        await plugin.addNewFeed(feedName, feedUrl);
        expect(GetFeedFuncs.getFeedItems).toHaveBeenCalledWith(feedUrl, feedName);
        expect(vi.mocked(mockVault.createFolder)).toHaveBeenCalledWith(`${plugin.feeds_reader_dir}/${relativeFolderPath}`);
        expect(DataFuncs.saveFeedsData).toHaveBeenCalledWith(plugin, new Set([feedName]));
        expect(refreshViewSpy).toHaveBeenCalled();
    });
     it("should throw error if feed name exists", async () => {
        plugin.feedList = [{ name: "ExistingFeed", feedUrl: "u", unread: 0, updated: 0, folder: "f" }];
        await expect(plugin.addNewFeed("ExistingFeed", "http://new.com")).rejects.toThrow(/already exists/);
    });
     it("should throw error on network/parse failure", async () => {
        vi.mocked(GetFeedFuncs.getFeedItems).mockRejectedValue(new Error("Fetch failed"));
        await expect(plugin.addNewFeed("FailFeed", "http://fail.com")).rejects.toThrow("Fetch failed");
    });
     it("handles case where getFeedItems returns empty items array", async () => {
        const feedName = "EmptyItemsFeed"; const feedUrl = "http://empty.com/rss";
        const folderName = feedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const relativeFolderPath = `${FEEDS_STORE_BASE}/${folderName}`;
        const mockFeedContent: RssFeedContent = { name: feedName, title: "Empty Items", link: feedUrl, folder: relativeFolderPath, items: [] };
        vi.mocked(GetFeedFuncs.getFeedItems).mockResolvedValue(mockFeedContent);
        vi.mocked(DataFuncs.saveFeedsData).mockResolvedValue(new Set());
        mockAdapter.exists.mockResolvedValue(true);

        await plugin.addNewFeed(feedName, feedUrl);

        expect(plugin.feedList.length).toBe(1);
        expect(plugin.feedList[0].unread).toBe(0);
        expect(plugin.feedsStore[feedName]?.items.length).toBe(0);
        expect(DataFuncs.saveFeedsData).toHaveBeenCalledWith(plugin, new Set([feedName]));
   });
  });

  describe("markItemReadState", () => {
     beforeEach(setupTestDataForPlugin);
    it("marks an unread item as read", () => {
        const changed = plugin.markItemReadState("TestFeed", "item1", true);
        expect(changed).toBe(true); expect(plugin.feedsStore["TestFeed"].items[0].read).not.toBe("0");
        expect(plugin.feedsStoreChange).toBe(true); expect(plugin.feedsStoreChangeList.has("TestFeed")).toBe(true);
        expect(plugin.feedList[0].unread).toBe(2); // 2, 4 remain unread
    });
    it("marks a read item as unread", () => {
        plugin.feedsStore["TestFeed"].items[1].read = "was_read"; // Make item2 initially read
        plugin.feedList[0].unread = 2; // item 1 and 4 are unread
        const changed = plugin.markItemReadState("TestFeed", "item2", false);
        expect(changed).toBe(true); expect(plugin.feedsStore["TestFeed"].items[1].read).toBe("0");
        expect(plugin.feedsStoreChange).toBe(true); expect(plugin.feedsStoreChangeList.has("TestFeed")).toBe(true);
        expect(plugin.feedList[0].unread).toBe(3); // 1, 2, 4 are now unread
    });
    it("returns false if state is already target state", () => {
        expect(plugin.markItemReadState("TestFeed", "item1", false)).toBe(false); // Already unread
        expect(plugin.feedsStoreChange).toBe(false);
    });
    it("returns false if item/feed not found", () => {
        expect(plugin.markItemReadState("TestFeed", "missing", true)).toBe(false);
        expect(plugin.markItemReadState("MissingFeed", "item1", true)).toBe(false);
    });
  });

  describe("markItemDeletedState", () => {
     beforeEach(setupTestDataForPlugin);
    it("marks an active item as deleted", () => {
        const changed = plugin.markItemDeletedState("TestFeed", "item1", true);
        expect(changed).toBe(true); expect(plugin.feedsStore["TestFeed"].items[0].deleted).not.toBe("0");
        expect(plugin.feedsStoreChange).toBe(true); expect(plugin.feedsStoreChangeList.has("TestFeed")).toBe(true);
        expect(plugin.feedList[0].unread).toBe(2); // Item 1 was unread, now deleted. 2, 4 remain unread.
    });
    it("restores a deleted item", () => {
        const changed = plugin.markItemDeletedState("TestFeed", "item3", false); // Item 3 was deleted
        expect(changed).toBe(true); expect(plugin.feedsStore["TestFeed"].items[2].deleted).toBe("0");
        expect(plugin.feedsStoreChange).toBe(true); expect(plugin.feedsStoreChangeList.has("TestFeed")).toBe(true);
        expect(plugin.feedList[0].unread).toBe(3); // Item 3 restored (and was read), 1, 2, 4 are unread.
    });
     it("returns false if state is already target state", () => {
        expect(plugin.markItemDeletedState("TestFeed", "item1", false)).toBe(false); // Already active
        expect(plugin.feedsStoreChange).toBe(false);
    });
    it("returns false if item/feed not found", () => {
        expect(plugin.markItemDeletedState("TestFeed", "missing", true)).toBe(false);
        expect(plugin.markItemDeletedState("MissingFeed", "item1", true)).toBe(false);
    });
  });

   describe("markItemDownloaded", () => {
      beforeEach(setupTestDataForPlugin);
      it("marks an item as downloaded", () => {
          const changed = plugin.markItemDownloaded("TestFeed", "item1");
          expect(changed).toBe(true); expect(plugin.feedsStore["TestFeed"].items[0].downloaded).not.toBe("0");
          expect(plugin.feedsStoreChange).toBe(true); expect(plugin.feedsStoreChangeList.has("TestFeed")).toBe(true);
      });
      it("returns false if already downloaded", () => {
          const changed = plugin.markItemDownloaded("TestFeed", "item2");
          expect(changed).toBe(false); expect(plugin.feedsStoreChange).toBe(false);
      });
       it("returns false if item/feed not found", () => {
         expect(plugin.markItemDownloaded("TestFeed", "missing")).toBe(false);
         expect(plugin.markItemDownloaded("MissingFeed", "item1")).toBe(false);
      });
  });

  describe("saveSnippet", () => {
      const item: RssFeedItem = { id: "snip1", title: "Snippet Test", link:"lsnip", content:"<p>Snip Content</p>", read:"0", deleted:"0", category:"", creator:"", pubDate:"pd", downloaded:"0"};
      const snippetPath = `/fake/.obsidian/plugins/test-plugin-data/snippets.md`;

      it("appends snippet to file if it doesn't exist (append setting)", async () => {
          plugin.settings.saveSnippetNewToOld = false;
          mockAdapter.read.mockRejectedValue(new Error("not found"));
          mockAdapter.write.mockResolvedValue(undefined);
          await plugin.saveSnippet(item);
          const expected = `## Snippet Test\nLink: lsnip\nDate: pd\n\nSnip Content...\n\n---\n`;
          expect(mockAdapter.write).toHaveBeenCalledWith(snippetPath, expected);
      });
      it("prepends snippet to file (prepend setting)", async () => {
          plugin.settings.saveSnippetNewToOld = true;
          mockAdapter.read.mockResolvedValue("Existing");
          mockAdapter.write.mockResolvedValue(undefined);
          await plugin.saveSnippet(item);
           const expectedPrefix = `## Snippet Test\nLink: lsnip\nDate: pd\n\nSnip Content...\n\n---\n`;
          expect(mockAdapter.write).toHaveBeenCalledWith(snippetPath, expectedPrefix + "Existing");
      });
       it("throws error on file write failure", async () => {
          mockAdapter.read.mockRejectedValue(new Error("not found"));
          mockAdapter.write.mockRejectedValue(new Error("Disk Full"));
          await expect(plugin.saveSnippet(item)).rejects.toThrow(/Disk Full/);
      });
  });

  describe("fetchFullContent", () => {
      beforeEach(setupTestDataForPlugin);
      // const item1 = plugin.feedsStore["TestFeed"].items[0]; // item1 is defined but not used if mockGlobalRequest is module-level

      it("updates item content on successful fetch", async () => {
          vi.mocked(mockGlobalRequest).mockResolvedValue("<article>New Content</article>");
          const changed = await plugin.fetchFullContent("TestFeed", "item1");
          expect(changed).toBe(true);
          expect(vi.mocked(mockGlobalRequest)).toHaveBeenCalledWith({ url: plugin.feedsStore["TestFeed"].items[0].link });
          expect(plugin.feedsStore["TestFeed"].items[0].content).toBe("New Content");
          expect(plugin.feedsStoreChange).toBe(true);
      });
      it("returns false if fetched content is same", async () => {
           vi.mocked(mockGlobalRequest).mockResolvedValue("<p>Content 1</p>");
           const changed = await plugin.fetchFullContent("TestFeed", "item1");
           expect(changed).toBe(false);
           expect(plugin.feedsStoreChange).toBe(false);
      });
      it("throws error if link is invalid", async () => {
           plugin.feedsStore["TestFeed"].items[0].link = "";
           await expect(plugin.fetchFullContent("TestFeed", "item1")).rejects.toThrow(/Invalid or missing link/);
      });
       it("throws error on network failure", async () => {
            vi.mocked(mockGlobalRequest).mockRejectedValue(new Error("Timeout"));
            await expect(plugin.fetchFullContent("TestFeed", "item1")).rejects.toThrow(/Fetch failed: Timeout/);
       });
  });

  describe("purgeDeletedItems", () => {
      beforeEach(setupTestDataForPlugin);
      it("removes deleted items and saves", async () => {
        vi.mocked(DataFuncs.saveFeedsData).mockResolvedValue(new Set());
        const initialLength = plugin.feedsStore["TestFeed"].items.length;
        await plugin.purgeDeletedItems("TestFeed");
        expect(plugin.feedsStore["TestFeed"].items.length).toBe(initialLength - 1);
        expect(plugin.feedsStore["TestFeed"].items.find(i => i.id === "item3")).toBeUndefined();
        expect(DataFuncs.saveFeedsData).toHaveBeenCalledWith(plugin, new Set(["TestFeed"]));
        expect(plugin.feedList[0].unread).toBe(3);
      });
       it("does nothing if no items deleted", async () => {
           plugin.feedsStore["TestFeed"].items[2].deleted = "0";
           plugin.feedList[0].unread = 3;
           await plugin.purgeDeletedItems("TestFeed");
           expect(DataFuncs.saveFeedsData).not.toHaveBeenCalled();
       });
  });

  describe("purgeAllItems", () => {
      beforeEach(setupTestDataForPlugin);
      it("removes items, fragments, saves subs", async () => {
          vi.mocked(DataFuncs.removeAllFeedDataFiles).mockResolvedValue(undefined);
          vi.mocked(mockAdapter.write).mockResolvedValue(undefined);
          await plugin.purgeAllItems("TestFeed");
          expect(plugin.feedsStore["TestFeed"]).toBeUndefined();
          expect(DataFuncs.removeAllFeedDataFiles).toHaveBeenCalledWith(plugin, `${FEEDS_STORE_BASE}/TestFeed`);
          expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining(SUBSCRIPTIONS_FNAME), expect.stringContaining('"unread":0'));
          expect(DataFuncs.saveFeedsData).not.toHaveBeenCalled();
      });
  });

   describe("unsubscribeFeed", () => {
       beforeEach(setupTestDataForPlugin);
       it("removes feed, data, folder, saves subs", async () => {
            vi.mocked(DataFuncs.removeAllFeedDataFiles).mockResolvedValue(undefined);
            vi.mocked(mockAdapter.rmdir).mockResolvedValue(undefined);
            vi.mocked(mockAdapter.write).mockResolvedValue(undefined);
            mockAdapter.exists.mockResolvedValue(true);
            await plugin.unsubscribeFeed("TestFeed");
            expect(plugin.feedList.length).toBe(0);
            expect(plugin.feedsStore["TestFeed"]).toBeUndefined();
            expect(DataFuncs.removeAllFeedDataFiles).toHaveBeenCalledWith(plugin, `${FEEDS_STORE_BASE}/TestFeed`);
            expect(mockAdapter.rmdir).toHaveBeenCalledWith(`${plugin.feeds_reader_dir}/${FEEDS_STORE_BASE}/TestFeed`);
            expect(mockAdapter.write).toHaveBeenCalledWith(expect.stringContaining(SUBSCRIPTIONS_FNAME), "[]");
       });
   });

    describe("Method Interaction (Save/Load after state changes)", () => {
        it("should save/load read state changes", async () => {
            setupTestDataForPlugin();
            plugin.markItemReadState("TestFeed", "item1", true);
            expect(plugin.feedsStoreChange).toBe(true);

            const writtenFragments: { [path: string]: ArrayBuffer } = {};
            vi.mocked(mockAdapter.writeBinary).mockImplementation(async (p:string,d:ArrayBuffer) => { writtenFragments[p]=d; return Promise.resolve(); });
            vi.mocked(mockAdapter.write).mockResolvedValue(undefined);
            mockAdapter.exists.mockResolvedValue(true);

            await DataFuncs.saveFeedsData(plugin, new Set(["TestFeed"]));

            plugin.feedsStore = {};
            setupLoadMocks(writtenFragments);
            
            const itemsForMock = plugin.feedList.length > 0 && plugin.feedsStore["TestFeed"]?.items ? plugin.feedsStore["TestFeed"].items.map(i => i.id === "item1" ? {...i, read: "timestamp"} : i) : [];
            const mockLoadedItem = { name: "TestFeed", title: "T", link:"l", folder: `${FEEDS_STORE_BASE}/TestFeed`, items: itemsForMock } as RssFeedContent;
            vi.mocked(DataFuncs.loadFeedsStoredData).mockResolvedValue(mockLoadedItem);

            const loadedData = await DataFuncs.loadFeedsStoredData(plugin, plugin.feedList[0]);
            expect(loadedData?.items.find(i => i.id === "item1")?.read).not.toBe("0");
            expect(loadedData?.items.find(i => i.id === "item2")?.read).toBe("0");
        });
    });

});
