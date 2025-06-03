import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { updateAllFeeds } from '../../src/controller/updateAllFeeds';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import type { IFeedsReaderView } from '../../src/view/types';
import type { FeedInfo, RssFeedContent, RssFeedItem } from '../../src/types';

// Mock getFeedItems
vi.mock('../../src/getFeed', () => ({
  getFeedItems: vi.fn(),
}));

// Helper to create a minimal feed item
function createFeedItem(overrides: Partial<RssFeedItem> = {}): RssFeedItem {
  return {
    id: 'item1',
    title: 'Test Item',
    content: '',
    category: '',
    link: '',
    creator: '',
    pubDate: '',
    read: '0',
    deleted: '0',
    downloaded: '0',
    ...overrides,
  };
}

// Helper to create a minimal feed content
function createFeedContent(overrides: Partial<RssFeedContent> = {}): RssFeedContent {
  return {
    title: 'Test Feed',
    name: 'test-feed',
    link: 'https://example.com',
    folder: 'test',
    items: [],
    ...overrides,
  };
}

describe('updateAllFeeds', () => {
  let plugin: IFeedsReaderPlugin;
  let view: IFeedsReaderView;
  let notify: ReturnType<typeof vi.fn>;
  let getFeedItems: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Suppress console.error during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Import the mocked function
    const feedModule = await import('../../src/getFeed');
    getFeedItems = feedModule.getFeedItems as ReturnType<typeof vi.fn>;

    notify = vi.fn();

    // Create minimal plugin mock
    plugin = {
      feedList: [],
      feedsStore: {},
      feedsStoreChangeList: new Set<string>(),
      ensureFeedDataLoaded: vi.fn().mockResolvedValue(undefined),
      requestSave: vi.fn(),
      networkService: {} as unknown as IFeedsReaderPlugin['networkService'],
      contentParserService: {} as unknown as IFeedsReaderPlugin['contentParserService'],
      assetService: {} as unknown as IFeedsReaderPlugin['assetService'],
    } as unknown as IFeedsReaderPlugin;

    // Create minimal view mock
    view = {} as IFeedsReaderView;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should notify start and completion when no feeds exist', async () => {
    await updateAllFeeds(plugin, view, notify);

    expect(notify).toHaveBeenCalledWith('Fetching updates for all feeds…', 0);
    expect(notify).toHaveBeenCalledWith('Update finished. 0 updated.', 6000);
  });

  it('should update a single feed with new items', async () => {
    const feedInfo: FeedInfo = {
      name: 'test-feed',
      feedUrl: 'https://example.com/feed.xml',
      folder: 'test',
      unread: 0,
      updated: 0,
    };

    const existingFeed = createFeedContent({
      description: 'A test feed',
      items: [createFeedItem({ id: 'item1', title: 'Item 1' })],
    });

    const newFeedContent = createFeedContent({
      description: 'A test feed',
      items: [
        createFeedItem({ id: 'item2', title: 'Item 2' }),
        createFeedItem({ id: 'item1', title: 'Item 1' }),
      ],
    });

    plugin.feedList = [feedInfo];
    plugin.feedsStore['test-feed'] = existingFeed;
    getFeedItems.mockResolvedValueOnce(newFeedContent);

    await updateAllFeeds(plugin, view, notify);

    expect(plugin.ensureFeedDataLoaded).toHaveBeenCalledWith('test-feed');
    expect(getFeedItems).toHaveBeenCalledWith(
      plugin,
      feedInfo,
      plugin.networkService,
      plugin.contentParserService,
      plugin.assetService
    );

    // Should prepend new item
    expect(plugin.feedsStore['test-feed'].items).toHaveLength(2);
    expect(plugin.feedsStore['test-feed'].items[0].id).toBe('item2');

    // Should update unread count
    expect(feedInfo.unread).toBe(2);

    // Should mark feed as changed
    expect(plugin.feedsStoreChangeList.has('test-feed')).toBe(true);
    expect(plugin.requestSave).toHaveBeenCalled();

    expect(notify).toHaveBeenCalledWith('Update finished. 1 updated.', 6000);
  });

  it('should handle feed update failures gracefully', async () => {
    const feedInfo: FeedInfo = {
      name: 'failing-feed',
      feedUrl: 'https://example.com/failing.xml',
      folder: 'test',
      unread: 0,
      updated: 0,
    };

    plugin.feedList = [feedInfo];
    getFeedItems.mockRejectedValueOnce(new Error('Network error'));

    await updateAllFeeds(plugin, view, notify);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'updateAllFeeds: update failed for failing-feed',
      expect.any(Error)
    );
    expect(notify).toHaveBeenCalledWith('Failed to update "failing-feed". Network error', 7000);
    expect(notify).toHaveBeenCalledWith('Update finished. 0 updated. 1 failed.', 6000);
    expect(plugin.requestSave).not.toHaveBeenCalled();
  });

  it('should update feed metadata when changed', async () => {
    const feedInfo: FeedInfo = {
      name: 'meta-feed',
      feedUrl: 'https://example.com/meta.xml',
      folder: 'test',
      unread: 0,
      updated: 0,
    };

    const existingFeed = createFeedContent({
      name: 'meta-feed',
      title: 'Old Title',
      description: 'Old description',
      image: 'old-image.jpg',
    });

    const newFeedContent = createFeedContent({
      name: 'meta-feed',
      title: 'New Title',
      description: 'New description',
      image: 'new-image.jpg',
      pubDate: '2024-01-01',
    });

    plugin.feedList = [feedInfo];
    plugin.feedsStore['meta-feed'] = existingFeed;
    getFeedItems.mockResolvedValueOnce(newFeedContent);

    await updateAllFeeds(plugin, view, notify);

    const updatedFeed = plugin.feedsStore['meta-feed'];
    expect(updatedFeed.title).toBe('New Title');
    expect(updatedFeed.description).toBe('New description');
    expect(updatedFeed.image).toBe('new-image.jpg');
    expect(updatedFeed.pubDate).toBe('2024-01-01');

    expect(plugin.feedsStoreChangeList.has('meta-feed')).toBe(true);
    expect(plugin.requestSave).toHaveBeenCalled();
  });

  it('should handle multiple feeds with mixed results', async () => {
    const feeds: FeedInfo[] = [
      { name: 'feed1', feedUrl: 'url1', folder: 'f1', unread: 0, updated: 0 },
      { name: 'feed2', feedUrl: 'url2', folder: 'f2', unread: 0, updated: 0 },
      { name: 'feed3', feedUrl: 'url3', folder: 'f3', unread: 0, updated: 0 },
    ];

    plugin.feedList = feeds;

    // Feed 1: Success with new items
    getFeedItems.mockResolvedValueOnce(
      createFeedContent({
        name: 'feed1',
        title: 'Feed 1',
        items: [createFeedItem({ id: 'new1' })],
      })
    );

    // Feed 2: Failure
    getFeedItems.mockRejectedValueOnce(new Error('Failed'));

    // Feed 3: Success but no new items
    plugin.feedsStore.feed3 = createFeedContent({ name: 'feed3', title: 'Feed 3' });
    getFeedItems.mockResolvedValueOnce(createFeedContent({ name: 'feed3', title: 'Feed 3' }));

    await updateAllFeeds(plugin, view, notify);

    expect(notify).toHaveBeenCalledWith('Update finished. 2 updated. 1 failed.', 6000);
    expect(plugin.requestSave).toHaveBeenCalled();
  });

  it('should handle feeds without existing data', async () => {
    const feedInfo: FeedInfo = {
      name: 'new-feed',
      feedUrl: 'https://example.com/new.xml',
      folder: 'test',
      unread: 0,
      updated: 0,
    };

    const newFeedContent = createFeedContent({
      name: 'new-feed',
      title: 'New Feed',
      items: [
        createFeedItem({ id: 'item1', read: '0', deleted: '0' }),
        createFeedItem({ id: 'item2', read: '1', deleted: '0' }),
        createFeedItem({ id: 'item3', read: '0', deleted: '1' }),
      ],
    });

    plugin.feedList = [feedInfo];
    getFeedItems.mockResolvedValueOnce(newFeedContent);

    await updateAllFeeds(plugin, view, notify);

    expect(plugin.feedsStore['new-feed']).toEqual(newFeedContent);
    expect(feedInfo.unread).toBe(1); // Only item1 is unread and not deleted
    expect(plugin.feedsStoreChangeList.has('new-feed')).toBe(true);
  });
});
