import { Notice } from "obsidian";
import { FeedsReaderView } from "../../view";
import FeedsReaderPlugin from "../../main";

export function renderFeedNavigation(
  navEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  if (!navEl) return;
  navEl.empty();
  const sortedFeedList = [...plugin.feedList].sort((a, b) => a.name.localeCompare(b.name));
  sortedFeedList.forEach(feed => {
    const feedItemEl = navEl.createEl("div", { cls: "fr-feed-item" });
    const storedFeedData = plugin.feedsStore[feed.name];
    const unreadCount = storedFeedData?.items ? storedFeedData.items.filter(i => i.read === "0" && i.deleted === "0").length : feed.unread;
    feedItemEl.setText(`${feed.name} (${unreadCount})`);
    feedItemEl.id = `feed-${feed.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    if (view.currentFeed === feed.name) { feedItemEl.addClass('is-active'); }
    view.registerDomEvent(feedItemEl, "click", async () => {
      const feedName = feed.name;
      const loadingNotice = new Notice(`Loading ${feedName}...`, 0);
      try {
        await plugin.ensureFeedDataLoaded(feedName);
        loadingNotice.hide();
        if (!plugin.feedsStore[feedName]?.items) {
          new Notice(`Failed to load data for ${feedName}.`);
          (view as FeedsReaderView).contentAreaEl.setText(`Data for ${feedName} could not be loaded.`);
          view.currentFeed = null; view.createControlButtons(); view['renderFeedList'](); return;
        }
        view.currentFeed = feedName;
        // Update keyboard-navigation index so that the newly clicked feed is
        // treated as the current selection when the user switches back to
        // keyboard control.
        view['navSelectedIndex'] = sortedFeedList.findIndex(f => f.name === feedName);
        view.resetFeedSpecificViewState();
        view['renderFeedList'](); view.renderFeedContent(); view.createControlButtons();
      } catch (error: unknown) {
        loadingNotice.hide(); new Notice(`Error loading feed "${feedName}". ${(error instanceof Error) ? error.message : String(error)}`, 7000);
      }
    });
  });
}
