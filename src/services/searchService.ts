import { sanitizeHTMLToDom } from 'obsidian';
import type { RssFeedItem } from '../types';

/**
 * Search index entry for fast text searching
 */
interface SearchIndexEntry {
  itemId: string;
  feedName: string;
  searchableText: string; // Pre-processed lowercase text
  originalItem: RssFeedItem;
}

/**
 * Service for efficient feed item searching with indexing
 */
export class SearchService {
  private index: Map<string, SearchIndexEntry> = new Map();

  private isIndexBuilt = false;

  /**
   * Build search index from feed items
   * Pre-processes text for fast searching
   */
  buildIndex(items: RssFeedItem[]): void {
    this.index.clear();

    for (const item of items) {
      // Extract text content efficiently
      const contentText = item.content ? sanitizeHTMLToDom(item.content).textContent || '' : '';

      // Combine all searchable fields
      const searchableText = [
        item.title,
        item.creator, // Use creator instead of author
        contentText,
        item.category, // Use category instead of categories
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const itemId = item.id || `${item.title}-${item.pubDate}`; // Generate ID if missing
      this.index.set(itemId, {
        itemId,
        feedName: item.__sourceFeed || '', // Use __sourceFeed instead of feed
        searchableText,
        originalItem: item,
      });
    }

    this.isIndexBuilt = true;
  }

  /**
   * Search items using the pre-built index
   * Returns matching items sorted by relevance
   */
  search(query: string): RssFeedItem[] {
    if (!this.isIndexBuilt) {
      console.warn('Search index not built. Call buildIndex() first.');
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return [];
    }

    const results: Array<{ item: RssFeedItem; score: number }> = [];
    const queryWords = lowerQuery.split(/\s+/);

    for (const entry of this.index.values()) {
      let score = 0;

      // Check each query word
      for (const word of queryWords) {
        if (entry.searchableText.includes(word)) {
          // Higher score for title matches
          if (entry.originalItem.title.toLowerCase().includes(word)) {
            score += 3;
          }
          // Medium score for content matches
          else {
            score += 1;
          }
        }
      }

      if (score > 0) {
        results.push({ item: entry.originalItem, score });
      }
    }

    // Sort by score (descending) then by date (newest first)
    return results
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Fallback to date comparison
        const dateA = a.item.pubDate ? new Date(a.item.pubDate).getTime() : 0;
        const dateB = b.item.pubDate ? new Date(b.item.pubDate).getTime() : 0;
        return dateB - dateA;
      })
      .map(result => result.item);
  }

  /**
   * Search within a specific feed
   */
  searchInFeed(query: string, feedName: string): RssFeedItem[] {
    const allResults = this.search(query);
    return allResults.filter(item => item.__sourceFeed === feedName);
  }

  /**
   * Get index size for monitoring
   */
  getIndexSize(): number {
    return this.index.size;
  }

  /**
   * Clear the search index
   */
  clearIndex(): void {
    this.index.clear();
    this.isIndexBuilt = false;
  }
}
