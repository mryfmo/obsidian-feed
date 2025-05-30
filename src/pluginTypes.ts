import { Plugin } from 'obsidian';
import { FeedInfo, RssFeedContent, FeedsReaderSettings, RssFeedItem } from './types';
import { NetworkService } from './networkService';
import { ContentParserService } from './contentParserService';
import { AssetService } from './assetService';

/**
 * Interface for the FeedsReaderPlugin to break circular dependencies.
 * This allows other modules to depend on the interface rather than the concrete implementation.
 */
export interface IFeedsReaderPlugin extends Plugin {
  settings: FeedsReaderSettings;
  feedList: FeedInfo[];
  feedsStore: { [feedName: string]: RssFeedContent };
  feedsStoreChange: boolean;
  feedsStoreChangeList: Set<string>;
  feeds_reader_dir: string;
  lenStrPerFile: number;

  // Services
  networkService: NetworkService;
  contentParserService: ContentParserService;
  assetService: AssetService;

  // Methods
  activateView(): Promise<void>;
  loadSettings(): Promise<void>;
  saveSettings(): Promise<void>;
  savePendingChanges(force?: boolean): Promise<void>;
  requestSave(): void;
  addNewFeed(name: string, url: string): Promise<void>;
  markAllRead(feedName: string): Promise<void>;
  purgeDeletedItems(feedName: string): Promise<void>;
  purgeAllItems(feedName: string): Promise<void>;
  unsubscribeFeed(feedName: string): Promise<void>;
  refreshView(): void;
  ensureFeedDataLoaded(feedName: string): Promise<RssFeedContent | null>;
  flagChangeAndSave(feedName: string): void;
  markItemReadState(feedName: string, itemId: string, read: boolean): boolean;
  markItemDeletedState(feedName: string, itemId: string, deleted: boolean): boolean;
  getFeedItem(feedName: string, itemId: string): Promise<RssFeedItem | null>;
  saveItemAsMarkdown(feedName: string, itemId: string): Promise<string | null>;
  saveSnippet(item: RssFeedItem): Promise<void>;
  fetchFullContent(feedName: string, itemId: string): Promise<boolean>;
  // Additional methods can be added as needed
}
