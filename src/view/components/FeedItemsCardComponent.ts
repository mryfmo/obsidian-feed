import { IFeedsReaderView } from '../types';
import { IFeedsReaderPlugin } from '../../pluginTypes';
import { RssFeedItem } from '../../types';

import { renderFeedItemCard } from './FeedItemCardComponent';
import { isVisibleItem, shuffleArray } from '../../utils';

/**
 * Renders a list of items in *card* layout.  All business logic that is
 * independent of the visual style (filtering, ordering, pagination, empty
 * placeholders) mirrors the implementation of FeedItemsListComponent to keep
 * behavior consistent across the two layouts.
 */
export function renderFeedItemsCard(
  contentAreaEl: HTMLElement,
  items: RssFeedItem[],
  view: IFeedsReaderView,
  plugin: IFeedsReaderPlugin
): void {
  contentAreaEl.empty();

  if (!items || items.length === 0) {
    const placeholder = ((): string => {
      if (view.isMixedViewEnabled()) {
        return 'All feeds are up-to-date!';
      }
      if (!view.currentFeed) {
        return 'No feed selected – pick one from the sidebar or enable the unified timeline.';
      }
      return `No items available in feed "${view.currentFeed}". Check your filters.`;
    })();

    contentAreaEl.setText(placeholder);
    return;
  }

  // Filter read / deleted items depending on showAll flag
  let itemsToShow = [...items];

  if (!view.isMixedViewEnabled() && view.currentFeed) {
    const feedContent = plugin.feedsStore[view.currentFeed];
    if (!feedContent) {
      contentAreaEl.setText(`Data for feed "${view.currentFeed}" is not ready.`);
      return;
    }
    itemsToShow = itemsToShow.filter(i => isVisibleItem(i, view.showAll));
  } else if (view.isMixedViewEnabled()) {
    itemsToShow = itemsToShow.filter(i => isVisibleItem(i, view.showAll));
  }

  // Ordering
  const { itemOrder } = view;
  if (itemOrder === 'New to old') {
    itemsToShow.sort((a, b) => {
      const dA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dB - dA;
    });
  } else if (itemOrder === 'Old to new') {
    itemsToShow.sort((a, b) => {
      const dA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dA - dB;
    });
  } else if (itemOrder === 'Random') {
    shuffleArray(itemsToShow);
  }

  // Pagination – same logic as list component
  let pageItems: typeof itemsToShow;
  if (view.isMixedViewEnabled()) {
    pageItems = itemsToShow;
  } else {
    const start = view.currentPage * view.itemsPerPage;
    const end = start + view.itemsPerPage;
    pageItems = itemsToShow.slice(start, end);
  }

  if (pageItems.length === 0) {
    let baseMsg: string;
    if (view.isMixedViewEnabled()) {
      baseMsg = 'All feeds are up-to-date!';
    } else if (view.currentFeed) {
      baseMsg = `No items match filter for "${view.currentFeed}". Check your filters.`;
    } else {
      baseMsg = 'No feed selected.';
    }

    contentAreaEl.setText(view.currentPage === 0 ? baseMsg : 'No more items.');
    return;
  }

  pageItems.forEach(item => renderFeedItemCard(item, contentAreaEl, view, plugin));
}
