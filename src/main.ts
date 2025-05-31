// Initialize debug logging behavior **before** anything else executes
import './debug';

import { Plugin, Notice, sanitizeHTMLToDom, WorkspaceLeaf, FileSystemAdapter } from 'obsidian';
import {
  FeedInfo,
  RssFeedContent,
  FeedsReaderSettings,
  RssFeedItem,
  RssFeedItemWithBlocks,
} from './types';
import { FeedsReaderView, VIEW_TYPE_FEEDS_READER } from './view';
import {
  loadSubscriptions,
  saveFeedsData,
  removeAllFeedDataFiles,
  loadFeedsStoredData,
  saveSubscriptions,
} from './data';
import { FeedReaderSettingTab } from './settings';
import { registerCommands } from './commands';
import { PluginApi } from './pluginApi';
import { UndoAction } from './globals';
import { getFeedItems, getCurrentIsoDateTime } from './getFeed';
import { NetworkService } from './networkService';
import { ContentParserService } from './contentParserService';
import { AssetService } from './assetService';
import { FEEDS_STORE_BASE, SUBSCRIPTIONS_FNAME, SAVED_SNIPPETS_FNAME } from './constants';
import {
  PluginOperationError,
  FeedValidationError,
  FeedFetchError,
  FeedParseError,
  FeedStorageError,
} from './errors';
import { IFeedsReaderPlugin } from './pluginTypes';

declare global {
  interface Window {
    pluginApi: PluginApi;
  }
}

const DEFAULT_SETTINGS: FeedsReaderSettings = {
  mixedFeedView: false,
  nItemPerPage: 20,
  saveContent: false,
  saveSnippetNewToOld: true,
  showJot: true,
  showSnippet: true,
  showRead: true,
  showSave: true,
  showMath: true,
  showGPT: true,
  showEmbed: true,
  showFetch: true,
  showLink: true,
  showDelete: true,
  showThumbnails: true,
  chatGPTApiKey: '',
  chatGPTPrompt: 'Summarize the following content (max 4000 chars):\n\n{{content}}',
  chatGPTModel: 'gpt-4o-mini',
  enableHtmlCache: true,
  htmlCacheDurationMinutes: 1440, // 24 hours
  enableAssetDownload: false,
  assetDownloadPath: 'feeds_assets', // Relative to plugin data directory
  latestNOnly: false,
  latestNCount: 0,
  viewStyle: 'card',
  defaultTitleOnly: true,
  // Performance settings
  enableVirtualScrolling: false,
  searchDebounceMs: 300,
  scrollThrottleMs: 120,
  maxItemsPerPage: 50,
  enableSearchIndex: true,
  enableReadingProgress: false,
};

export default class FeedsReaderPlugin extends Plugin implements IFeedsReaderPlugin {
  settings!: FeedsReaderSettings;

  public feedList: FeedInfo[] = [];

  public feedsStore: { [feedName: string]: RssFeedContent } = {};

  public feedsStoreChange: boolean = false;

  public feedsStoreChangeList: Set<string> = new Set();

  public feeds_reader_dir!: string;

  public lenStrPerFile: number = 1024 * 1024; // This could be moved to constants too, or remain if it's truly a plugin instance specific setting for some reason. For now, keep as example.

  // Services
  public networkService!: NetworkService;

  public contentParserService!: ContentParserService;

  public assetService!: AssetService;

  private saveTimeout: number | null = null;

  private readonly SAVE_DEBOUNCE_MS = 2000; // Debounce save calls by 2 seconds

  // --- Serialization helpers for savePendingChanges ----------------------
  private isSaving: boolean = false; // true while an async save is running

  private queuedSave: boolean = false; // another save request arrived during save

  async onload(): Promise<void> {
    // Debug logging handled by debug.ts
    await this.loadSettings(); // Loads into this.settings

    // Initialize services
    this.networkService = new NetworkService(
      this.app.vault.adapter as FileSystemAdapter,
      this.settings,
      this.manifest.id
    );
    this.assetService = new AssetService(
      this.app.vault.adapter as FileSystemAdapter,
      this.settings,
      this.manifest.id,
      this.networkService
    );
    this.contentParserService = new ContentParserService(this.assetService, this.settings);

    this.feeds_reader_dir = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;

    this.feedsStoreChange = false;
    this.feedsStoreChangeList = new Set();
    this.feedsStore = {};

    const baseDir = this.feeds_reader_dir;
    const storeDir = `${baseDir}/${FEEDS_STORE_BASE}`;

    try {
      if (!(await this.app.vault.adapter.exists(baseDir))) {
        await this.app.vault.createFolder(baseDir);
      }
      if (!(await this.app.vault.adapter.exists(storeDir))) {
        await this.app.vault.createFolder(storeDir);
      }
      const subsPath = `${this.feeds_reader_dir}/${SUBSCRIPTIONS_FNAME}`;
      // Pass feeds_store_base to loadSubscriptions for path validation
      this.feedList = await loadSubscriptions(this.app, subsPath, FEEDS_STORE_BASE);
    } catch (error: unknown) {
      const errorMessage =
        'Error initializing Feeds Reader plugin. Some saved data might not be loaded correctly. Please check the console for technical details.';
      console.error('FeedsReaderPlugin.onload: Error during plugin initialization:', error);
      new Notice(errorMessage, 10000);
    }

    this.registerView(VIEW_TYPE_FEEDS_READER, leaf => new FeedsReaderView(leaf, this));
    const ribbon = this.addRibbonIcon('rss', 'Contents Feeds Reader', () => this.activateView());
    ribbon.addClass('feeds-ribbon-class');
    registerCommands(this);
    window.pluginApi = new PluginApi();
    this.addSettingTab(new FeedReaderSettingTab(this.app, this));
    await this.registerStyles();

    // Use debounced save instead of interval for better performance
    // this.registerInterval(window.setInterval(async () => {
    //     if (this.feedsStoreChange) {
    //         console.log("Auto-saving feed data due to interval...");
    //         await this.savePendingChanges(); // Call the new save method
    //     }
    // }, 5 * 60 * 1000));

    this.register(async (): Promise<void> => {
      if (this.saveTimeout) window.clearTimeout(this.saveTimeout); // Clear any pending timeout
      if (this.feedsStoreChange) {
        // Debug: Saving feed data on unload
        await this.savePendingChanges(true); // Force immediate save
      }
    });
  }

  private async registerStyles(): Promise<void> {
    const cssPath = `${this.manifest.dir}/styles.css`;
    try {
      const cssContent = await this.app.vault.adapter.read(cssPath);
      const styleEl = document.createElement('style');
      styleEl.id = `${this.manifest.id}-styles`;
      styleEl.textContent = cssContent;
      document.head.appendChild(styleEl);
      this.register((): void => styleEl.detach());
    } catch (e) {
      console.error(
        `FeedsReaderPlugin: Failed to load styles from ${cssPath}. Plugin styles may not be applied.`,
        e
      );
      new Notice(
        `Error loading Feeds Reader styles. Some UI elements might not appear correctly. Please check the console for details.`
      );
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_FEEDS_READER);
    // Debug: Unloading Feeds Reader Plugin
    // Save is handled by this.register()
  }

  async activateView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER);
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeaf();
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
    }

    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_FEEDS_READER,
        active: true,
      });
      this.app.workspace.revealLeaf(leaf);
    } else {
      console.error('FeedsReaderPlugin: Could not get a leaf to activate the view.');
      new Notice('Could not open Feeds Reader view. Please try again.');
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Refresh *all* Feeds Reader views so toggles like "Show thumbnails" are
    // applied consistently across split panes / secondary windows.
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER);
    for (const leaf of leaves) {
      const v = leaf.view as unknown;
      if (v && (v as FeedsReaderView).refreshView) {
        (v as FeedsReaderView).refreshView();
      }
    }
  }

  // === Data Manipulation Methods ===

  /** Triggers a debounced save of pending changes */
  requestSave(): void {
    if (!this.feedsStoreChange) return; // No changes to save
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout); // Clear existing timeout
    }
    this.saveTimeout = window.setTimeout(async (): Promise<void> => {
      await this.savePendingChanges();
      this.saveTimeout = null; // Clear timeout ref after execution
    }, this.SAVE_DEBOUNCE_MS);
  }

  /** Saves all pending changes marked in feedsStoreChangeList */
  async savePendingChanges(immediate = false): Promise<void> {
    // If a save is already running, remember that another save is requested
    // and exit early.  When the running save finishes it will immediately run
    // another round to process the queued changes.
    if (this.isSaving) {
      this.queuedSave = true;
      return;
    }

    if (this.saveTimeout && !immediate) {
      // Debug: Save request ignored, waiting for debounce timeout
      return;
    }
    if (this.saveTimeout && immediate) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (!this.feedsStoreChange || this.feedsStoreChangeList.size === 0) {
      // Debug: savePendingChanges called, but no changes detected
      this.feedsStoreChange = false; // Ensure flag is false if list is empty
      return;
    }

    // Mark as saving **after** all early-return conditions pass
    this.isSaving = true;

    const feedsToSaveAttempt = new Set(this.feedsStoreChangeList); // Keep a copy of what we attempted to save
    // Debug: Attempting to save pending changes for feeds

    try {
      // saveFeedsData now returns a Set of successfully saved feed names
      const successfullySavedFeeds = await saveFeedsData(this, feedsToSaveAttempt);

      // Update the main change list - remove successfully saved ones
      successfullySavedFeeds.forEach((savedName): void => {
        this.feedsStoreChangeList.delete(savedName);
      });

      if (
        successfullySavedFeeds.size > 0 &&
        successfullySavedFeeds.size === feedsToSaveAttempt.size
      ) {
        // All attempted feeds were saved successfully
        new Notice('Feed data saved successfully.', 3000);
        // Debug: All attempted feeds were saved successfully
      } else if (successfullySavedFeeds.size > 0) {
        // Some feeds were saved, but some failed
        const failedFeedsCount = feedsToSaveAttempt.size - successfullySavedFeeds.size;
        new Notice(
          `${successfullySavedFeeds.size} feed(s) saved. ${failedFeedsCount} feed(s) failed to save.`,
          5000
        );
        // Debug: Some feeds saved, some failed
      } else if (feedsToSaveAttempt.size > 0) {
        // No feeds were saved, though an attempt was made
        // Errors within saveFeedsData for individual feeds should have already shown a Notice.
        // This notice is a fallback or general summary if nothing got saved.
        new Notice(
          `Failed to save data for ${feedsToSaveAttempt.size} feed(s). Check console for details.`,
          7000
        );
        // Debug: Failed to save feeds
      }

      // If all *pending* changes were successfully processed (i.e., list is now empty or only contains feeds that failed), reset the flag
      if (this.feedsStoreChangeList.size === 0) {
        this.feedsStoreChange = false;
      } else {
        console.warn(
          `${this.feedsStoreChangeList.size} feed(s) remain in pending list after save attempt (these likely failed).`
        );
        // Keep feedsStoreChange = true if there are still unsaved changes that failed
      }

      // Always try to save subscriptions, as unread counts might change even if feed data save failed for some
      // saveSubscriptions will throw its own errors if it fails, which will be caught by the outer catch.
      await saveSubscriptions(this, this.feedList);
    } catch (error) {
      // Catch errors from saveSubscriptions or other unexpected issues during the process
      const errorMessage =
        'An unexpected error occurred during the save process. Some changes might be lost.';
      console.error('FeedsReaderPlugin.savePendingChanges: Error during save process:', error);
      new Notice(`${errorMessage} Check console for details.`, 7000);
      // If the caller relies on this throwing, it needs adjustment.
      // Based on previous changes, addNewFeed has its own try/catch for savePendingChanges.
      throw error;
    } finally {
      // Mark save finished before possibly starting a queued one
      this.isSaving = false;
      if (this.queuedSave) {
        // Clear the flag and immediately handle the queued request
        this.queuedSave = false;
        // We use `void` to ignore the returned promise; caller can await the
        // original call.  Serialization guarantee is maintained.
        void this.savePendingChanges(true);
      }
    }
  }

  async addNewFeed(name: string, url: string): Promise<void> {
    if (this.feedList.find(f => f.name === name)) {
      throw new FeedValidationError(
        `A feed named "${name}" already exists. Please choose a unique name.`
      );
    }
    if (!name || !url) {
      throw new FeedValidationError('Please provide both a name and a URL for the feed.');
    }
    try {
      new URL(url);
    } catch {
      throw new FeedValidationError(
        `The URL format is invalid. Please provide a valid URL (e.g., https://example.com/rss).`
      );
    }

    let feedContent;
    try {
      const tempFeedInfo: FeedInfo = { name, feedUrl: url, unread: 0, updated: 0, folder: '' };
      feedContent = await getFeedItems(
        this,
        tempFeedInfo,
        this.networkService,
        this.contentParserService,
        this.assetService
      );
    } catch (error: unknown) {
      if (error instanceof FeedFetchError || error instanceof FeedParseError) {
        // Debug: Feed fetch or parse error, re-throwing
        throw error;
      }
      const internalMsg = `Error during getFeedItems for feed "${name}" from URL "${url}": ${error instanceof Error ? error.message : String(error)}`;
      const userMsg = `Could not retrieve or understand the feed from the URL. Please check the URL or try again later.`;
      console.error(`FeedsReaderPlugin.addNewFeed: ${internalMsg}`, error);
      throw new PluginOperationError(userMsg);
    }

    const folderName =
      name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || `feed_${Date.now()}`;
    const newFeedFolderRelative = `${FEEDS_STORE_BASE}/${folderName}`;

    // getFeedItems may already have determined the folder (e.g., for existing feeds).
    // Only assign the default folder if it's not already set, to prevent duplicate creation.
    if (!feedContent.folder) {
      feedContent.folder = newFeedFolderRelative;
    }

    const newFeed: FeedInfo = {
      name,
      feedUrl: url,
      unread: feedContent.items.filter(i => i.read === '0' && i.deleted === '0').length,
      updated: Date.now(), // updated should reflect when the feed *metadata* was last known to be current
      folder: newFeedFolderRelative,
    };

    const feedFolderPathAbsolute = `${this.feeds_reader_dir}/${newFeed.folder}`;
    let folderCreated = false;

    if (!(await this.app.vault.adapter.exists(feedFolderPathAbsolute))) {
      try {
        await this.app.vault.createFolder(feedFolderPathAbsolute);
        folderCreated = true;
      } catch (folderError: unknown) {
        const internalMsg = `Failed to create storage folder "${feedFolderPathAbsolute}" for feed "${name}": ${folderError instanceof Error ? folderError.message : String(folderError)}`;
        const userMsg = `Could not create a storage folder for the new feed. Please check plugin permissions or disk space.`;
        console.error(`FeedsReaderPlugin.addNewFeed: ${internalMsg}`, folderError);
        throw new FeedStorageError(userMsg);
      }
    }

    try {
      this.feedList.push(newFeed);
      this.feedsStore[name] = feedContent;
      this.feedsStoreChangeList.add(name);
      this.feedsStoreChange = true;

      // Debug: Saving pending changes for new feed

      await this.savePendingChanges(true); // This will attempt to save this new feed and any other pending changes.
      await saveSubscriptions(this, this.feedList); // Save the updated feedList

      this.refreshView();
      new Notice(`Feed "${name}" added successfully.`);
    } catch (saveError: unknown) {
      // This catch is for errors explicitly thrown by savePendingChanges or other logic within this try block
      console.error(
        `FeedsReaderPlugin.addNewFeed: Save operation failed for new feed "${name}". Initiating rollback.`,
        saveError
      );

      const feedIndex = this.feedList.findIndex(
        f => f.name === newFeed.name && f.feedUrl === newFeed.feedUrl
      );
      if (feedIndex > -1) {
        this.feedList.splice(feedIndex, 1);
      }
      delete this.feedsStore[name];
      this.feedsStoreChangeList.delete(name);
      if (this.feedsStoreChangeList.size === 0) {
        this.feedsStoreChange = false;
      }

      if (folderCreated && (await this.app.vault.adapter.exists(feedFolderPathAbsolute))) {
        try {
          await this.app.vault.adapter.rmdir(feedFolderPathAbsolute, true);
          // Debug: Rolled back folder creation
        } catch (rmdirError) {
          console.warn(
            `FeedsReaderPlugin.addNewFeed: Failed to roll back folder creation ${feedFolderPathAbsolute}:`,
            rmdirError
          );
        }
      }

      // Re-throw as FeedStorageError for consistent error handling by the caller (e.g. AddFeedModal)
      console.error(
        `Failed to save new feed "${name}" to persistent storage.`,
        saveError instanceof Error ? saveError.message : String(saveError)
      );
      const userMsg = `Could not save the new feed "${name}" permanently. Changes may have been rolled back.`;
      throw new FeedStorageError(userMsg);
    }
  }

  async markAllRead(feedName: string): Promise<void> {
    const feedData = await this.ensureFeedDataLoaded(feedName);
    if (!feedData?.items) throw new Error(`Feed "${feedName}" not found or empty.`);

    let changed = false;
    const affectedItemsPreviousStates: Array<{
      itemId: string;
      readState: string;
      feedName: string;
    }> = [];

    feedData.items.forEach((item): void => {
      if (item.read === '0') {
        affectedItemsPreviousStates.push({ itemId: item.id!, readState: item.read, feedName });
        item.read = getCurrentIsoDateTime();
        changed = true;
      }
    });

    if (changed) {
      const feedMeta = this.feedList.find(f => f.name === feedName);
      if (feedMeta) feedMeta.unread = 0;
      this.flagChange(feedName); // Use helper to flag change
      await this.savePendingChanges(true); // Force save
      this.refreshView(); // This will re-render the list and content
      new Notice(`All items in "${feedName}" marked as read.`);
      if (affectedItemsPreviousStates.length > 0) {
        this.pushUndoToView({
          action: 'markAllRead',
          feedName,
          previousStates: affectedItemsPreviousStates,
        });
      }
    } else {
      new Notice(`All items in "${feedName}" already read.`);
    }
  }

  async purgeDeletedItems(feedName: string): Promise<void> {
    const feedData = await this.ensureFeedDataLoaded(feedName);
    if (!feedData?.items) throw new Error(`Feed "${feedName}" not found or empty.`);

    const originalLength = feedData.items.length;
    feedData.items = feedData.items.filter(item => item.deleted === '0');
    const numPurged = originalLength - feedData.items.length;
    if (numPurged > 0) {
      const feedMeta = this.feedList.find(f => f.name === feedName);
      if (feedMeta) feedMeta.unread = feedData.items.filter(i => i.read === '0').length;
      this.flagChange(feedName);
      await this.savePendingChanges(true); // This will also save subscriptions
      new Notice(`${numPurged} deleted item(s) purged from "${feedName}".`);
      this.refreshView();
    } else if (originalLength > 0) {
      // Only show notice if there were items to begin with
      new Notice(`No items marked as deleted found in "${feedName}".`);
    } else {
      new Notice(`No deleted items found in "${feedName}".`);
    }
  }

  async purgeAllItems(feedName: string): Promise<void> {
    const feedMeta = this.feedList.find(f => f.name === feedName);
    if (!feedMeta) throw new Error(`Feed "${feedName}" not found.`);
    await removeAllFeedDataFiles(this, feedMeta.folder);
    delete this.feedsStore[feedName];
    feedMeta.unread = 0;
    feedMeta.updated = Date.now();
    // Directly save subscriptions only, no need to save feed data
    try {
      await saveSubscriptions(this, this.feedList);
    } catch (err: unknown) {
      // This handles its own Notices on error
      const errorMessage = `Failed to update subscriptions after purging items from "${feedName}". The unread count might be inaccurate temporarily.`;
      console.error(
        `FeedsReaderPlugin.purgeAllItems: Failed to save subscriptions for "${feedName}". Details:`,
        err
      );
      new Notice(
        `${errorMessage} (Technical details: ${err instanceof Error ? err.message : String(err)})`,
        7000
      );
      throw new Error(errorMessage); // Re-throw for consistency if needed
    }
    new Notice(`All items purged for "${feedName}".`);
    this.refreshView();
  }

  async unsubscribeFeed(feedName: string): Promise<void> {
    const feedIndex = this.feedList.findIndex(f => f.name === feedName);
    if (feedIndex === -1) throw new Error(`Feed "${feedName}" not found.`);
    const feedMeta = this.feedList[feedIndex];
    await removeAllFeedDataFiles(this, feedMeta.folder);
    const feedFolderPathAbsolute = `${this.feeds_reader_dir}/${feedMeta.folder}`;
    try {
      if (await this.app.vault.adapter.exists(feedFolderPathAbsolute))
        await this.app.vault.adapter.rmdir(feedFolderPathAbsolute, true);
    } catch (rmdirError) {
      console.warn(`Could not remove folder ${feedFolderPathAbsolute}:`, rmdirError);
    }
    delete this.feedsStore[feedName];
    this.feedList.splice(feedIndex, 1);
    // Immediately save subscriptions after structural change
    try {
      await saveSubscriptions(this, this.feedList);
    } catch (err: unknown) {
      // Handles its own Notices
      const userMessage = `Failed to update subscriptions after unsubscribing from "${feedName}". The feed might reappear temporarily until next save.`;
      console.error(
        `FeedsReaderPlugin.unsubscribeFeed: Failed to save subscriptions for "${feedName}". Details:`,
        err
      );
      new Notice(
        `${userMessage} (Technical details: ${err instanceof Error ? err.message : String(err)})`,
        7000
      );
      throw new Error(userMessage); // Re-throw
    }
    new Notice(`Unsubscribed from "${feedName}".`);
    const activeView = this.app.workspace.getActiveViewOfType(FeedsReaderView);
    if (
      activeView &&
      activeView instanceof FeedsReaderView &&
      (activeView as FeedsReaderView).currentFeed === feedName
    ) {
      (activeView as FeedsReaderView).resetToDefaultState();
    } else this.refreshView();
  }

  refreshView(): void {
    const view = this.app.workspace.getActiveViewOfType(FeedsReaderView);
    if (view && view instanceof FeedsReaderView) {
      (view as FeedsReaderView).refreshView();
    }
  }

  updateFeedData(feedName: string): void {
    // Update feed data and trigger necessary UI updates
    this.flagChangeAndSave(feedName);
    this.refreshView();
  }

  /** Helper to flag a feed as changed and request a save */
  private flagChange(feedName: string): void {
    this.feedsStoreChange = true;
    this.feedsStoreChangeList.add(feedName);
    this.requestSave(); // Trigger debounced save
  }

  public flagChangeAndSave(feedName: string): void {
    // More explicit name for immediate save trigger logic
    this.feedsStoreChange = true; // Always set true if this is called
    this.feedsStoreChangeList.add(feedName); // Add to list of changed feeds
    this.requestSave(); // Trigger debounced save
  }

  markItemReadState(feedName: string, itemId: string, read: boolean): boolean {
    if (!this.feedsStore[feedName]?.items) return false;
    const item = this.feedsStore[feedName].items.find(i => i.id === itemId);
    if (!item) return false;
    const newState = read ? getCurrentIsoDateTime() : '0';
    if (item.read !== newState) {
      item.read = newState;
      const feedInfo = this.feedList.find(f => f.name === feedName);
      if (feedInfo)
        feedInfo.unread = this.feedsStore[feedName].items.filter(
          i => i.read === '0' && i.deleted === '0'
        ).length;
      this.flagChange(feedName); // Use helper
      return true;
    }
    return false;
  }

  markItemDeletedState(feedName: string, itemId: string, deleted: boolean): boolean {
    if (!this.feedsStore[feedName]?.items) return false;
    const item = this.feedsStore[feedName].items.find(i => i.id === itemId);
    if (!item) return false;
    const newState = deleted ? getCurrentIsoDateTime() : '0';
    if (item.deleted !== newState) {
      item.deleted = newState;
      const feedInfo = this.feedList.find(f => f.name === feedName);
      if (feedInfo)
        feedInfo.unread = this.feedsStore[feedName].items.filter(
          i => i.read === '0' && i.deleted === '0'
        ).length;
      this.flagChange(feedName); // Use helper
      return true;
    }
    return false;
  }

  markItemDownloaded(feedName: string, itemId: string): boolean {
    if (!this.feedsStore[feedName]?.items) return false;
    const item = this.feedsStore[feedName].items.find(i => i.id === itemId);
    if (!item) return false;
    const newState = getCurrentIsoDateTime();
    if (item.downloaded === '0') {
      // Only flag change if it wasn't downloaded before
      item.downloaded = newState;
      this.flagChange(feedName); // Use helper
      return true;
    }
    return false;
  }

  async saveSnippet(item: RssFeedItem): Promise<void> {
    const snippetPath = `${this.feeds_reader_dir}/${SAVED_SNIPPETS_FNAME}`;
    const textContentForSnippet = (
      sanitizeHTMLToDom(item.content || '').textContent || ''
    ).substring(0, 500);
    const snippetEntry = `## ${item.title || 'Untitled'}\nLink: ${item.link || 'N/A'}\nDate: ${item.pubDate || 'N/A'}\n\n${textContentForSnippet}...\n\n---\n`;
    try {
      const existingSnippets = await this.app.vault.adapter.read(snippetPath).catch(() => '');
      const newSnippetsContent = this.settings.saveSnippetNewToOld
        ? snippetEntry + existingSnippets
        : existingSnippets + snippetEntry;
      await this.app.vault.adapter.write(snippetPath, newSnippetsContent);
    } catch (err: unknown) {
      const errorMessage = `Error saving snippet for "${item.title.substring(0, 30)}...". Please check file permissions for the plugin data folder or disk space.`;
      console.error(
        `FeedsReaderPlugin.saveSnippet: Error saving snippet for item ID "${item.id}", title "${item.title}". Path: ${snippetPath}. Details:`,
        err
      );
      new Notice(
        `${errorMessage} (Technical details: ${err instanceof Error ? err.message.substring(0, 100) : String(err).substring(0, 100)})`,
        7000
      );
      throw new Error(errorMessage); // Re-throw
    }
  }

  async fetchFullContent(feedName: string, itemId: string): Promise<boolean> {
    const item = (await this.getFeedItem(feedName, itemId)) as RssFeedItemWithBlocks | null;
    if (!item || !item.link || !item.link.startsWith('http')) {
      /* ... error handling ... */ throw new Error('Invalid item or link');
    }

    try {
      const fetchedHtml = await this.networkService.fetchHtml(item.link);
      if (fetchedHtml && fetchedHtml !== item.sourceHtml) {
        item.sourceHtml = fetchedHtml;
        item.blocks = await this.contentParserService.htmlToContentBlocks(fetchedHtml, item.link);
        if (this.settings.enableAssetDownload && item.blocks) {
          item.blocks = await this.assetService.downloadAssetsForBlocks(item.blocks, item.link);
        }
        item.content = this.contentParserService.contentBlocksToMarkdown(item.blocks);
        this.markItemDownloaded(feedName, itemId); // Mark as "downloaded" in the sense of content fetched
        this.flagChange(feedName);
        new Notice(`Full content fetched and processed for "${item.title.substring(0, 30)}...".`);
        return true;
      }
      new Notice(
        `Fetched content for "${item.title.substring(0, 30)}..." is the same as current or fetch failed. No changes made.`
      );
      return false;
    } catch (err: unknown) {
      const errorMessage = `Failed to fetch full content for "${item.title.substring(0, 30)}...". The website might be down, or content is not accessible.`;
      console.error(
        `FeedsReaderPlugin.fetchFullContent: Fetch failed for item ID "${item.id}", title "${item.title}", link "${item.link}". Details:`,
        err
      );
      new Notice(
        `${errorMessage} (Technical details: ${err instanceof Error ? err.message.substring(0, 100) : String(err).substring(0, 100)})`,
        7000
      );
      throw new Error(errorMessage); // Re-throw
    }
  }

  async saveItemAsMarkdown(feedName: string, itemId: string): Promise<string | null> {
    const item = await this.getFeedItem(feedName, itemId);
    if (!item) throw new Error('Item not found.');

    // Ensure content is Markdown or can be converted to it
    let markdownContent = item.content;
    if (item.content?.startsWith('<') && item.content.endsWith('>')) {
      // Basic check for HTML
      markdownContent = this.contentParserService.contentBlocksToMarkdown(
        await this.contentParserService.htmlToContentBlocks(item.content, item.link || '')
      );
    }
    const fileName = `${(item.title || 'Untitled').replace(/[\\/:*?"<>|#%&{}]/g, '_').substring(0, 100)}.md`;
    const filePath = `${this.feeds_reader_dir}/${fileName}`; // Save within plugin data dir
    const mdFileContent = `# ${item.title || 'Untitled'}\n\nSource: [${item.link || 'N/A'}](${item.link || ''})\nDate: ${item.pubDate || 'N/A'}\n\n${markdownContent}`;
    try {
      await this.app.vault.create(filePath, mdFileContent);
      new Notice(`Item "${item.title.substring(0, 30)}..." saved as Markdown: ${fileName}.`);
      this.markItemDownloaded(feedName, itemId); // Use plugin method
      return fileName;
    } catch (err: unknown) {
      let errorMessage = `Error saving item "${item.title.substring(0, 30)}..." as Markdown. Please check file permissions or if a file with the same name already exists.`;
      if (err instanceof Error && err.message?.includes('already exists')) {
        errorMessage = `File "${fileName}" already exists. Item not saved as Markdown.`;
      }
      console.error(
        `FeedsReaderPlugin.saveItemAsMarkdown: Error for item ID "${item.id}", title "${item.title}". Path: ${filePath}. Details:`,
        err
      );
      new Notice(
        errorMessage +
          (err instanceof Error && err.message?.includes('already exists')
            ? ''
            : ` (Technical details: ${err instanceof Error ? err.message.substring(0, 100) : String(err).substring(0, 100)})`),
        7000
      );
      throw new Error(errorMessage); // Re-throw
    }
  }

  async ensureFeedDataLoaded(feedName: string): Promise<RssFeedContent | null> {
    if (!this.feedsStore[feedName]) {
      const feedMeta = this.feedList.find(f => f.name === feedName);
      if (feedMeta) {
        const loadedData = await loadFeedsStoredData(this, feedMeta);
        this.feedsStore[feedName] = loadedData; // Update cache
        return loadedData;
      }
      return null; // Feed not subscribed
    }
    return this.feedsStore[feedName];
  }

  async getFeedItem(feedName: string, itemId: string): Promise<RssFeedItem | null> {
    const feedData = await this.ensureFeedDataLoaded(feedName);
    if (!feedData) return null;
    return feedData.items.find(i => i.id === itemId) || null;
  }

  pushUndoToView(undoAction: UndoAction): void {
    const view = this.app.workspace.getActiveViewOfType(FeedsReaderView);
    if (view && view instanceof FeedsReaderView) {
      (view as FeedsReaderView).pushUndo(undoAction);
    }
  }
}
