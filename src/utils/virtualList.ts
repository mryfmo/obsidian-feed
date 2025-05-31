import type { RssFeedItem } from '../types';

/**
 * Configuration for virtual list
 */
export interface VirtualListConfig {
  itemHeight: number; // Estimated height of each item
  containerHeight: number; // Height of the scrollable container
  bufferSize: number; // Number of items to render outside visible area
}

/**
 * Represents the visible range of items
 */
export interface VisibleRange {
  start: number;
  end: number;
  offsetY: number; // Top offset for the first visible item
}

/**
 * Virtual list implementation for efficient rendering of large lists
 */
export class VirtualList<T = RssFeedItem> {
  private config: VirtualListConfig;

  private totalItems: number = 0;

  private scrollTop: number = 0;

  constructor(config: Partial<VirtualListConfig> = {}) {
    this.config = {
      itemHeight: config.itemHeight || 120, // Default item height
      containerHeight: config.containerHeight || 600, // Default container height
      bufferSize: config.bufferSize || 5, // Default buffer
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VirtualListConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate which items should be visible based on scroll position
   */
  calculateVisibleRange(scrollTop: number, totalItems: number): VisibleRange {
    this.scrollTop = scrollTop;
    this.totalItems = totalItems;

    const { itemHeight, containerHeight, bufferSize } = this.config;

    // Calculate the index of the first visible item
    const firstVisibleIndex = Math.floor(scrollTop / itemHeight);

    // Calculate how many items fit in the container
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);

    // Add buffer items before and after visible range
    const start = Math.max(0, firstVisibleIndex - bufferSize);
    const end = Math.min(totalItems, firstVisibleIndex + visibleItemCount + bufferSize);

    // Calculate the Y offset for positioning the visible items
    const offsetY = start * itemHeight;

    return { start, end, offsetY };
  }

  /**
   * Get the subset of items that should be rendered
   */
  getVisibleItems(items: T[], range?: VisibleRange): T[] {
    const visibleRange = range || this.calculateVisibleRange(this.scrollTop, items.length);
    return items.slice(visibleRange.start, visibleRange.end);
  }

  /**
   * Calculate the total height of the list (for scrollbar)
   */
  getTotalHeight(): number {
    return this.totalItems * this.config.itemHeight;
  }

  /**
   * Get the height of the spacer element that maintains scroll position
   */
  getSpacerHeight(range: VisibleRange): { top: number; bottom: number } {
    const totalHeight = this.getTotalHeight();
    const visibleHeight = (range.end - range.start) * this.config.itemHeight;

    return {
      top: range.offsetY,
      bottom: Math.max(0, totalHeight - range.offsetY - visibleHeight),
    };
  }

  /**
   * Handle dynamic item height updates
   */
  updateItemHeight(index: number, actualHeight: number): void {
    // For now, we use fixed height. This could be extended
    // to support dynamic heights with a height cache
    // eslint-disable-next-line no-console
    console.log(`Item ${index} actual height: ${actualHeight}px`);
  }

  /**
   * Scroll to a specific item
   */
  getScrollPositionForItem(index: number): number {
    return index * this.config.itemHeight;
  }
}
