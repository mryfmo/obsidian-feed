import { describe, it, expect, beforeEach } from 'vitest';
import { FeedStore } from '../../src/services/feedStore';
import type { RssFeedContent, RssFeedItem } from '../../src/types';

// Helper to create a minimal feed item
function createFeedItem(overrides: Partial<RssFeedItem> = {}): RssFeedItem {
  return {
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

describe('FeedStore', () => {
  let store: FeedStore;

  beforeEach(() => {
    store = new FeedStore();
  });

  describe('setFeed', () => {
    it('should add a new feed with items', () => {
      const feedData = createFeedContent({
        items: [
          createFeedItem({ id: 'item1', title: 'Item 1' }),
          createFeedItem({ id: 'item2', title: 'Item 2' }),
        ],
      });

      store.setFeed('test-feed', feedData);

      const retrieved = store.getFeed('test-feed');
      expect(retrieved).toEqual(feedData);
    });

    it('should replace existing feed and clean up old items', () => {
      const oldFeedData = createFeedContent({
        title: 'Old Feed',
        items: [
          createFeedItem({ id: 'old1', title: 'Old Item 1' }),
          createFeedItem({ id: 'old2', title: 'Old Item 2' }),
        ],
      });

      const newFeedData = createFeedContent({
        title: 'New Feed',
        items: [
          createFeedItem({ id: 'new1', title: 'New Item 1' }),
          createFeedItem({ id: 'new2', title: 'New Item 2' }),
        ],
      });

      store.setFeed('test-feed', oldFeedData);
      store.setFeed('test-feed', newFeedData);

      const retrieved = store.getFeed('test-feed');
      expect(retrieved?.title).toBe('New Feed');
      expect(retrieved?.items).toHaveLength(2);
      expect(retrieved?.items?.[0].id).toBe('new1');
    });

    it('should generate IDs for items without them', () => {
      const feedData = createFeedContent({
        items: [
          createFeedItem({ id: undefined, title: 'Item 1', pubDate: '2024-01-01' }),
          createFeedItem({ id: undefined, title: 'Item 2', pubDate: '2024-01-02' }),
        ],
      });

      store.setFeed('test-feed', feedData);

      // Get items through the getItem method
      const item1 = store.getItem('Item 1-2024-01-01');
      const item2 = store.getItem('Item 2-2024-01-02');

      expect(item1?.id).toBe('Item 1-2024-01-01');
      expect(item2?.id).toBe('Item 2-2024-01-02');
    });

    it('should handle feeds without items', () => {
      const feedData = createFeedContent({
        description: 'A feed with no items',
      });

      store.setFeed('empty-feed', feedData);

      const retrieved = store.getFeed('empty-feed');
      expect(retrieved).toEqual(feedData);
    });
  });

  describe('getFeed', () => {
    it('should return undefined for non-existent feed', () => {
      const result = store.getFeed('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllFeeds', () => {
    it('should return all feeds', () => {
      const feed1 = createFeedContent({ name: 'feed1', title: 'Feed 1' });
      const feed2 = createFeedContent({ name: 'feed2', title: 'Feed 2' });

      store.setFeed('feed1', feed1);
      store.setFeed('feed2', feed2);

      const allFeeds = store.getAllFeeds();
      expect(allFeeds.size).toBe(2);
      expect(allFeeds.get('feed1')).toEqual(feed1);
      expect(allFeeds.get('feed2')).toEqual(feed2);
    });

    it('should return a copy of the feeds map', () => {
      const feed = createFeedContent();
      store.setFeed('test', feed);

      const allFeeds1 = store.getAllFeeds();
      const allFeeds2 = store.getAllFeeds();

      expect(allFeeds1).not.toBe(allFeeds2);
      expect(allFeeds1).toEqual(allFeeds2);
    });
  });

  describe('removeFeed', () => {
    it('should remove a feed and its items', () => {
      const feedData = createFeedContent({
        items: [createFeedItem({ id: 'item1', title: 'Item 1' })],
      });

      store.setFeed('test-feed', feedData);
      expect(store.getFeed('test-feed')).toBeDefined();

      const removed = store.removeFeed('test-feed');
      expect(removed).toBe(true);
      expect(store.getFeed('test-feed')).toBeUndefined();
      expect(store.getItem('item1')).toBeUndefined();
    });

    it('should handle removing non-existent feed gracefully', () => {
      const removed = store.removeFeed('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getItem', () => {
    it('should retrieve an item by ID', () => {
      const item = createFeedItem({ id: 'item1', title: 'Test Item' });
      const feedData = createFeedContent({
        items: [item],
      });

      store.setFeed('test-feed', feedData);

      const retrieved = store.getItem('item1');
      expect(retrieved).toEqual({ ...item, id: 'item1' });
    });

    it('should return undefined for non-existent item', () => {
      const result = store.getItem('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateItem', () => {
    it('should update an existing item', () => {
      const feedData = createFeedContent({
        items: [createFeedItem({ id: 'item1', title: 'Original', read: '0' })],
      });

      store.setFeed('test-feed', feedData);

      const updated = store.updateItem('item1', { read: '1' });
      expect(updated).toBe(true);

      const item = store.getItem('item1');
      expect(item?.read).toBe('1');
      expect(item?.title).toBe('Original');
    });

    it('should return false when updating non-existent item', () => {
      const updated = store.updateItem('non-existent', { read: '1' });
      expect(updated).toBe(false);
    });
  });

  describe('getFeedItems', () => {
    it('should return all items for a feed', () => {
      const items = [
        createFeedItem({ id: '1', title: 'Item 1' }),
        createFeedItem({ id: '2', title: 'Item 2' }),
        createFeedItem({ id: '3', title: 'Item 3' }),
      ];

      const feedData = createFeedContent({ items });
      store.setFeed('test-feed', feedData);

      const feedItems = store.getFeedItems('test-feed');
      expect(feedItems).toHaveLength(3);
      expect(feedItems.map(i => i.id)).toEqual(['1', '2', '3']);
    });

    it('should return empty array for non-existent feed', () => {
      const items = store.getFeedItems('non-existent');
      expect(items).toEqual([]);
    });
  });

  describe('getAllItems', () => {
    it('should return all items across all feeds', () => {
      store.setFeed(
        'feed1',
        createFeedContent({
          name: 'feed1',
          items: [
            createFeedItem({ id: '1', title: 'Feed 1 Item 1' }),
            createFeedItem({ id: '2', title: 'Feed 1 Item 2' }),
          ],
        })
      );

      store.setFeed(
        'feed2',
        createFeedContent({
          name: 'feed2',
          items: [createFeedItem({ id: '3', title: 'Feed 2 Item 1' })],
        })
      );

      const allItems = store.getAllItems();
      expect(allItems).toHaveLength(3);
      expect(allItems.map(i => i.id).sort()).toEqual(['1', '2', '3']);
    });
  });

  describe('batchUpdateItems', () => {
    it('should update multiple items', () => {
      const feedData = createFeedContent({
        items: [
          createFeedItem({ id: '1', read: '0' }),
          createFeedItem({ id: '2', read: '0' }),
          createFeedItem({ id: '3', read: '0' }),
        ],
      });

      store.setFeed('test-feed', feedData);

      const updates = [
        { itemId: '1', updates: { read: '1' } },
        { itemId: '2', updates: { read: '1' } },
        { itemId: 'non-existent', updates: { read: '1' } }, // Should fail
      ];

      const updateCount = store.batchUpdateItems(updates);
      expect(updateCount).toBe(2);

      expect(store.getItem('1')?.read).toBe('1');
      expect(store.getItem('2')?.read).toBe('1');
      expect(store.getItem('3')?.read).toBe('0');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      store.setFeed(
        'feed1',
        createFeedContent({
          name: 'feed1',
          items: [createFeedItem({ id: '1' }), createFeedItem({ id: '2' })],
        })
      );

      store.setFeed(
        'feed2',
        createFeedContent({
          name: 'feed2',
          items: [createFeedItem({ id: '3' })],
        })
      );

      const stats = store.getStats();
      expect(stats.feedCount).toBe(2);
      expect(stats.totalItems).toBe(3);
      expect(stats.itemsByFeed).toEqual({
        feed1: 2,
        feed2: 1,
      });
    });
  });

  describe('clear', () => {
    it('should remove all data', () => {
      store.setFeed(
        'feed1',
        createFeedContent({
          items: [createFeedItem({ id: '1' })],
        })
      );
      store.setFeed(
        'feed2',
        createFeedContent({
          items: [createFeedItem({ id: '2' })],
        })
      );

      store.clear();

      expect(store.getAllFeeds().size).toBe(0);
      expect(store.getAllItems()).toHaveLength(0);
      expect(store.getStats().feedCount).toBe(0);
    });
  });
});
