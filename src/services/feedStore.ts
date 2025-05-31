import type { RssFeedItem, RssFeedContent } from '../types';

/**
 * Optimized feed store with O(1) lookups and efficient batch operations
 */
export class FeedStore {
  private itemsById: Map<string, RssFeedItem> = new Map();

  private itemsByFeed: Map<string, Set<string>> = new Map();

  private feedsData: Map<string, RssFeedContent> = new Map();

  /**
   * Add or update a feed with its items
   */
  setFeed(feedName: string, feedData: RssFeedContent): void {
    this.feedsData.set(feedName, feedData);

    // Clear old items for this feed
    const oldItemIds = this.itemsByFeed.get(feedName);
    if (oldItemIds) {
      for (const itemId of oldItemIds) {
        this.itemsById.delete(itemId);
      }
    }

    // Add new items
    const itemIds = new Set<string>();
    if (feedData.items) {
      for (const item of feedData.items) {
        const itemId = item.id || `${item.title}-${item.pubDate}`; // Generate ID if missing
        this.itemsById.set(itemId, { ...item, id: itemId });
        itemIds.add(itemId);
      }
    }
    this.itemsByFeed.set(feedName, itemIds);
  }

  /**
   * Get a feed by name
   */
  getFeed(feedName: string): RssFeedContent | undefined {
    return this.feedsData.get(feedName);
  }

  /**
   * Get all feeds
   */
  getAllFeeds(): Map<string, RssFeedContent> {
    return new Map(this.feedsData);
  }

  /**
   * Get a specific item by ID (O(1) lookup)
   */
  getItem(itemId: string): RssFeedItem | undefined {
    return this.itemsById.get(itemId);
  }

  /**
   * Get all items for a specific feed
   */
  getFeedItems(feedName: string): RssFeedItem[] {
    const itemIds = this.itemsByFeed.get(feedName);
    if (!itemIds) return [];

    const items: RssFeedItem[] = [];
    for (const itemId of itemIds) {
      const item = this.itemsById.get(itemId);
      if (item) items.push(item);
    }
    return items;
  }

  /**
   * Get all items across all feeds
   */
  getAllItems(): RssFeedItem[] {
    return Array.from(this.itemsById.values());
  }

  /**
   * Update a specific item
   */
  updateItem(itemId: string, updates: Partial<RssFeedItem>): boolean {
    const item = this.itemsById.get(itemId);
    if (!item) return false;

    // Apply updates
    Object.assign(item, updates);

    // Also update in the feed's items array
    const sourceFeed = item.__sourceFeed;
    if (sourceFeed) {
      const feedData = this.feedsData.get(sourceFeed);
      if (feedData?.items) {
        const itemIndex = feedData.items.findIndex(i => {
          const iId = i.id || `${i.title}-${i.pubDate}`;
          return iId === itemId;
        });
        if (itemIndex !== -1) {
          feedData.items[itemIndex] = item;
        }
      }
    }

    return true;
  }

  /**
   * Batch update multiple items
   */
  batchUpdateItems(updates: Array<{ itemId: string; updates: Partial<RssFeedItem> }>): number {
    let updateCount = 0;
    for (const { itemId, updates: itemUpdates } of updates) {
      if (this.updateItem(itemId, itemUpdates)) {
        updateCount += 1;
      }
    }
    return updateCount;
  }

  /**
   * Remove a feed and all its items
   */
  removeFeed(feedName: string): boolean {
    const itemIds = this.itemsByFeed.get(feedName);
    if (itemIds) {
      for (const itemId of itemIds) {
        this.itemsById.delete(itemId);
      }
      this.itemsByFeed.delete(feedName);
    }
    return this.feedsData.delete(feedName);
  }

  /**
   * Get statistics about the store
   */
  getStats(): {
    feedCount: number;
    totalItems: number;
    itemsByFeed: Record<string, number>;
  } {
    const itemsByFeed: Record<string, number> = {};
    for (const [feedName, itemIds] of this.itemsByFeed) {
      itemsByFeed[feedName] = itemIds.size;
    }

    return {
      feedCount: this.feedsData.size,
      totalItems: this.itemsById.size,
      itemsByFeed,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.itemsById.clear();
    this.itemsByFeed.clear();
    this.feedsData.clear();
  }
}
