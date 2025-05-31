import type { IFeedsReaderPlugin } from '../pluginTypes';

/**
 * Tracks reading progress using Intersection Observer for better performance
 */
export class ReadingProgressTracker {
  private observer: IntersectionObserver | null = null;

  private plugin: IFeedsReaderPlugin;

  private trackedElements: Map<string, HTMLElement> = new Map();

  private progressUpdateTimeout: number | null = null;

  constructor(plugin: IFeedsReaderPlugin) {
    this.plugin = plugin;
    this.initializeObserver();
  }

  /**
   * Initialize the Intersection Observer
   */
  private initializeObserver(): void {
    const options: IntersectionObserverInit = {
      root: null, // Use viewport as root
      rootMargin: '0px',
      threshold: [0, 0.25, 0.5, 0.75, 1.0], // Multiple thresholds for smooth progress
    };

    this.observer = new IntersectionObserver(entries => {
      this.handleIntersections(entries);
    }, options);
  }

  /**
   * Handle intersection changes
   */
  private handleIntersections(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const itemId = entry.target.getAttribute('data-item-id');
      if (!itemId) {
        return;
      }

      const progressElement = entry.target.querySelector('.fr-item-progress') as HTMLElement;
      if (!progressElement) {
        return;
      }

      if (entry.isIntersecting) {
        // Calculate reading progress based on visibility
        const visibleRatio = entry.intersectionRatio;
        const progress = Math.round(visibleRatio * 100);

        // Update progress display
        progressElement.textContent = `${progress}% read`;
        progressElement.style.opacity = '1';

        // Mark as read if significantly visible
        if (visibleRatio >= 0.75) {
          this.markItemAsRead(itemId);
        }
      } else {
        // Hide progress when not visible
        progressElement.style.opacity = '0.5';
      }
    }
  }

  /**
   * Mark an item as read after a delay
   */
  private markItemAsRead(itemId: string): void {
    // Clear any existing timeout
    if (this.progressUpdateTimeout) {
      clearTimeout(this.progressUpdateTimeout);
    }

    // Delay to ensure user actually read the item
    this.progressUpdateTimeout = window.setTimeout(() => {
      const feedName = this.getFeedNameFromItemId(itemId);
      if (feedName && this.plugin.feedsStore[feedName]) {
        const item = this.plugin.feedsStore[feedName].items?.find(i => i.id === itemId);
        if (item && item.read === '0') {
          item.read = new Date().toISOString();
          // Trigger update in the plugin
          this.plugin.updateFeedData(feedName);
        }
      }
    }, 2000); // 2 second delay
  }

  /**
   * Get feed name from item ID
   */
  private getFeedNameFromItemId(itemId: string): string | null {
    // Search through all feeds to find the item
    for (const [feedName, feedData] of Object.entries(this.plugin.feedsStore)) {
      if (feedData.items?.some(item => item.id === itemId)) {
        return feedName;
      }
    }
    return null;
  }

  /**
   * Start tracking a feed item element
   */
  trackItem(element: HTMLElement, itemId: string): void {
    if (!this.observer) return;

    // Set data attribute for identification
    element.setAttribute('data-item-id', itemId);

    // Add progress element if not exists
    let progressEl = element.querySelector('.fr-item-progress') as HTMLElement;
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.className = 'fr-item-progress';
      progressEl.style.cssText =
        'font-size: 0.8em; color: var(--text-muted); opacity: 0.5; transition: opacity 0.3s;';
      element.appendChild(progressEl);
    }

    // Start observing
    this.observer.observe(element);
    this.trackedElements.set(itemId, element);
  }

  /**
   * Stop tracking a feed item
   */
  untrackItem(itemId: string): void {
    if (!this.observer) return;

    const element = this.trackedElements.get(itemId);
    if (element) {
      this.observer.unobserve(element);
      this.trackedElements.delete(itemId);
    }
  }

  /**
   * Stop tracking all items
   */
  untrackAll(): void {
    if (!this.observer) return;

    for (const element of this.trackedElements.values()) {
      this.observer.unobserve(element);
    }
    this.trackedElements.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.progressUpdateTimeout) {
      clearTimeout(this.progressUpdateTimeout);
    }

    this.untrackAll();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
