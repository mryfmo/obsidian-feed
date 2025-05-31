import { Notice } from 'obsidian';
import { IFeedsReaderView } from '../types';
import { IFeedsReaderPlugin } from '../../pluginTypes';
import { RssFeedItem } from '../../types';
import { isVisibleItem, shuffleArray } from '../../utils';

import { createFeedItemBase, renderItemMarkdown } from './FeedItemBase';

export function renderFeedItemListStyle(
  item: RssFeedItem,
  parentEl: HTMLElement,
  view: IFeedsReaderView,
  plugin: IFeedsReaderPlugin
): void {
  // Build shared skeleton but add the list-specific root class so that
  // CSS Grid rules apply.
  const { contentEl, isExpanded } = createFeedItemBase(item, parentEl, view, plugin, [
    'fr-item-list',
  ]);

  // -----------------------------------------------------------------------
  // Markdown body – only if visible
  // -----------------------------------------------------------------------
  if (isExpanded || !contentEl.hidden) {
    renderItemMarkdown(item, contentEl, plugin).catch(err =>
      console.error('ListView: Failed to render content', err)
    );
  }
}

export function renderFeedItemsList(
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

  const { itemOrder } = view;
  if (itemOrder === 'New to old') {
    itemsToShow.sort((a, b) => {
      const dA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dB - dA; // recent first
    });
  } else if (itemOrder === 'Old to new') {
    itemsToShow.sort((a, b) => {
      const dA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dA - dB; // oldest first
    });
  } else if (itemOrder === 'Random') shuffleArray(itemsToShow);
  /*
   * Pagination – Mixed (unified) timeline vs single-feed
   * ----------------------------------------------------
   * When browsing **per-feed** we keep the traditional pagination so that very
   * large feeds do not lock up the UI by rendering thousands of items at
   * once.  In *mixed view*, however, users reported that newer items from
   * the 3rd feed onwards often do not show up on the first page because the
   * page is already filled with entries from the first couple of feeds.
   * This leads to the false impression that only two feeds are merged.
   *
   * To avoid the confusion we disable pagination for the unified timeline
   * and render the **entire** chronologically-sorted list in one go.
   *
   * For most users the combined number of *unread* items across all feeds is
   * still within a reasonable range.  Should performance become a concern
   * we can revisit this decision or add a dedicated setting.
   */

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
      baseMsg = 'All feeds are up-to-date!'; // unified timeline empty after filtering
    } else if (view.currentFeed) {
      baseMsg = `No items match filter for "${view.currentFeed}". Check your filters.`;
    } else {
      baseMsg = 'No feed selected.';
    }

    contentAreaEl.setText(view.currentPage === 0 ? baseMsg : 'No more items.');
    return;
  }

  pageItems.forEach(item => {
    renderFeedItemListStyle(item, contentAreaEl, view, plugin);
  });
}

export async function handleContentAreaClick(
  event: MouseEvent,
  view: IFeedsReaderView,
  plugin: IFeedsReaderPlugin
): Promise<void> {
  const target = event.target as HTMLElement;
  const actionButton = target.closest('button[data-action]') as HTMLButtonElement;
  const titleElement = target.closest(
    ".fr-item-title[data-action='toggle-item-content']"
  ) as HTMLElement;

  if (actionButton) {
    // Keep keyboard-selection state in sync with the element the user just
    // clicked so that they can seamlessly switch back to keyboard shortcuts.
    const parentItem = actionButton.closest('.fr-item') as HTMLElement | null;
    if (parentItem && parentItem.dataset.itemId) {
      view.setSelectedItemById(parentItem.dataset.itemId);
    }

    const { action } = actionButton.dataset;
    const { itemId } = actionButton.dataset;
    if (!itemId) {
      new Notice('Action error: Missing item ID.');
      return;
    }

    // In mixed view, we need to find the feed that contains this item
    let feedName = view.currentFeed;
    let item: RssFeedItem | null = null;

    if (feedName) {
      // Single feed view - use currentFeed
      item = await plugin.getFeedItem(feedName, itemId);
    } else if (view.isMixedViewEnabled()) {
      // Mixed view - search all feeds to find the item
      for (const [fname, feedContent] of Object.entries(plugin.feedsStore)) {
        const found = feedContent.items.find((i: RssFeedItem) => i.id === itemId);
        if (found) {
          item = found;
          feedName = fname;
          break;
        }
      }
    }

    if (!item || !feedName) {
      new Notice(`Item "${itemId}" not found.`);
      return;
    }

    try {
      let stateChangedForRender = false;
      let refreshList = false;
      switch (action) {
        case 'markRead': {
          const newStateIsRead = item.read === '0';
          if (plugin.markItemReadState(feedName, itemId, newStateIsRead)) {
            view.pushUndo({
              feedName,
              itemId: item.id!,
              action: newStateIsRead ? 'unread' : 'read',
              previousState: newStateIsRead ? '0' : item.read,
            });
            new Notice(
              `Item "${item.title?.substring(0, 20)}..." ${newStateIsRead ? 'read' : 'unread'}.`
            );
            stateChangedForRender = true;
            refreshList = true;
          } else {
            new Notice(`Item already ${item.read === '0' ? 'unread' : 'read'}.`);
          }
          break;
        }
        case 'delete': {
          const newStateIsDeleted = item.deleted === '0';
          if (plugin.markItemDeletedState(feedName, itemId, newStateIsDeleted)) {
            view.pushUndo({
              feedName,
              itemId: item.id!,
              action: newStateIsDeleted ? 'deleted' : 'undeleted',
              previousState: newStateIsDeleted ? '0' : item.deleted,
            });
            new Notice(
              `Item "${item.title?.substring(0, 20)}..." ${newStateIsDeleted ? 'deleted' : 'restored'}.`
            );
            stateChangedForRender = true;
            refreshList = true;
          } else {
            new Notice(`Item already ${item.deleted === '0' ? 'active' : 'deleted'}.`);
          }
          break;
        }
        case 'save': {
          // Persist note via plugin method; it may update the `downloaded`
          // flag – verify only once afterwards to avoid redundant IO.
          await plugin.saveItemAsMarkdown?.(feedName, itemId); // Perform save
          const itemAfterSave = await plugin.getFeedItem(feedName, itemId);
          if (itemAfterSave && item.downloaded !== itemAfterSave.downloaded) {
            stateChangedForRender = true;
          }
          break;
        }
        case 'openLink':
          if (item.link && item.link.startsWith('http')) window.open(item.link, '_blank');
          else new Notice(`No valid link for "${item.title?.substring(0, 20)}...".`);
          break;
        case 'jot':
          new Notice('Jot: Not implemented.');
          break;
        case 'snippet':
          await plugin.saveSnippet(item);
          break; // Notice in plugin method
        case 'fetch': {
          const fNotice = new Notice(`Fetching: "${item.title?.substring(0, 30)}..."`, 0);
          if (await plugin.fetchFullContent(feedName, itemId)) {
            stateChangedForRender = true;
            refreshList = true;
          } // Full refresh if content changed
          fNotice.hide(); // Notices in plugin method
          break;
        }
        case 'GPT': {
          const { settings } = plugin;
          if (!settings?.chatGPTApiKey?.trim()) {
            new Notice('ChatGPT API Key missing.');
            break;
          }
          // Use item.content directly as it should be Markdown now.
          const pText = (item.content || item.title || '').substring(0, 4000);
          if (!pText.trim()) {
            new Notice('No content for GPT.');
            break;
          }
          const pr = settings.chatGPTPrompt.replace('{{content}}', pText);
          const m = settings.chatGPTModel || 'gpt-4o-mini';
          const gNotice = new Notice(`Asking ${m}...`, 0);
          await window.pluginApi.fetchChatGPT(settings.chatGPTApiKey, 0.7, pr, m);
          gNotice.hide();
          new Notice(
            `GPT (${m}) summary for "${item.title?.substring(0, 20)}..." (see console).`,
            5000
          );
          // Debug: GPT reply received
          break;
        }
        default:
          console.warn('Unhandled action:', action);
      }
      if (stateChangedForRender) {
        const currentFeedInfo = plugin.feedList.find(f => f.name === feedName);
        if (currentFeedInfo && plugin.feedsStore[feedName])
          currentFeedInfo.unread =
            plugin.feedsStore[feedName].items.filter(i => i.read === '0' && i.deleted === '0')
              .length ?? 0;
        view.renderFeedContent();
        if (refreshList) view.renderFeedList();
      }
    } catch (error: unknown) {
      new Notice(
        `Error on action '${action}': ${error instanceof Error ? error.message : String(error)}`,
        7000
      );
    }
  } else if (titleElement) {
    const { itemId } = titleElement.dataset;
    if (itemId) {
      // Update selection first, then toggle expansion so highlight + scroll
      // position are correct even if the item moves due to re-rendering.
      view.setSelectedItemById(itemId);
      view.toggleItemExpansion(itemId);
    }
  }
}
