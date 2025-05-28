/**
 * Use-case: update **all** subscribed feeds.
 *
 * @param plugin - The plugin instance that holds services and data stores.
 * @param view   - The active view requesting the update operation.
 * @param notify - A callback used to report progress messages back to the UI.
 *                 A no-op function is supplied by default so that the routine
 *                 can be exercised in pure Node unit tests without producing
 *                 any UI side effects.
 *
 * @returns A promise that resolves when every feed has been processed.
 *
 * @remarks
 * This function is designed as the single entry point that the UI (toolbar
 * button, hot-key, etc.) calls. It orchestrates the entire domain flow:
 *   1. Load the persisted feed data if necessary.
 *   2. Fetch the latest content over the network.
 *   3. Merge fresh data into the store and persist changes.
 *
 * All communication back to the UI goes exclusively through `notify`, keeping
 * the implementation free from direct UI dependencies and therefore easy to
 * unit-test.
 */

import type FeedsReaderPlugin from '../main';
import type { FeedsReaderView } from '../view';
import { getFeedItems } from '../getFeed';

/** Callback signature for UI notifications */
export type NotifyFn = (message: string, timeoutMs?: number) => void;

export async function updateAllFeeds(
  plugin: FeedsReaderPlugin,
  view: FeedsReaderView,
  notify: NotifyFn = () => {}
): Promise<void> {
  notify('Fetching updates for all feeds…', 0);

  let changesMadeOverall = false;
  let feedsSuccessfullyUpdated = 0;
  let feedsFailedToUpdate = 0;

  for (const feedInfo of plugin.feedList) {
    try {
      await plugin.ensureFeedDataLoaded(feedInfo.name);

      const newFeedContent = await getFeedItems(
        plugin,
        feedInfo,
        plugin.networkService,
        plugin.contentParserService,
        plugin.assetService
      );

      const existingFeed = plugin.feedsStore[feedInfo.name];
      let feedChanged = false;

      if (existingFeed?.items) {
        const existingItemIds = new Set(existingFeed.items.map(i => i.id ?? ''));

        const freshItems = newFeedContent.items.filter(i => {
          // Defensive: ensure id present.
          if (!i.id) return true;
          return !existingItemIds.has(i.id);
        });

        if (freshItems.length) {
          existingFeed.items.unshift(...freshItems);
          feedChanged = true;
        }

        // Meta-information updates
        if (
          existingFeed.title !== newFeedContent.title ||
          existingFeed.description !== newFeedContent.description ||
          existingFeed.image !== newFeedContent.image
        ) {
          existingFeed.title = newFeedContent.title;
          existingFeed.description = newFeedContent.description;
          existingFeed.image = newFeedContent.image;
          feedChanged = true;
        }

        existingFeed.pubDate = newFeedContent.pubDate;

        // refresh unread counter
        feedInfo.unread = existingFeed.items.filter(
          i => i.read === '0' && i.deleted === '0'
        ).length;
      } else {
        plugin.feedsStore[feedInfo.name] = newFeedContent;
        feedInfo.unread = newFeedContent.items.filter(
          i => i.read === '0' && i.deleted === '0'
        ).length;
        feedChanged = true;
      }

      if (feedChanged) {
        plugin.feedsStoreChangeList.add(feedInfo.name);
        changesMadeOverall = true;
      }

      feedsSuccessfullyUpdated += 1;
    } catch (err: unknown) {
      console.error(`updateAllFeeds: update failed for ${feedInfo.name}`, err);
      feedsFailedToUpdate += 1;
      notify(
        `Failed to update "${feedInfo.name}". ${(err instanceof Error ? err.message : String(err)).substring(0, 120)}`,
        7000
      );
    }
  }

  if (changesMadeOverall) {
    plugin.requestSave();
  }

  notify(
    `Update finished. ${feedsSuccessfullyUpdated} updated.${feedsFailedToUpdate ? ` ${feedsFailedToUpdate} failed.` : ''}`,
    6000
  );
}
