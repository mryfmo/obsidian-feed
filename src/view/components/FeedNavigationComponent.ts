import { Notice, setIcon } from "obsidian";
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

    /* -----------------------------------------------------------
     *  Determine feed type (Blog/RSS, YouTube, Podcast …) based
     *  on URL heuristics so that an appropriate icon can be shown
     *  in front of the feed name.  This gives the user immediate
     *  visual context without adding an explicit property to the
     *  saved feed list.
     * --------------------------------------------------------- */
    let icon = "rss"; // default – generic blog / RSS icon
    const urlL = feed.feedUrl.toLowerCase();
    if (/(youtube\.com|youtu\.be)/.test(urlL)) {
      icon = "youtube";
    } else if (/\b(podcast|itunes\.apple\.com|soundcloud\.com|podbean|spotify)\b/.test(urlL)) {
      icon = "mic"; // podcast mic icon (lucide)
    }

    const iconSpan = feedItemEl.createEl("span", { cls: "fr-feed-item-icon" });
    setIcon(iconSpan, icon);

    const storedFeedData = plugin.feedsStore[feed.name];
    const unreadCount = storedFeedData?.items ? storedFeedData.items.filter(i => i.read === "0" && i.deleted === "0").length : feed.unread;

    // Feed name text
    feedItemEl.createSpan({ text: feed.name });

    // Unread badge – only show when >0 for clarity
    if (unreadCount > 0) {
      const badge = feedItemEl.createSpan({ cls: "fr-feed-badge", text: String(unreadCount) });
      badge.setAttribute("aria-label", `${unreadCount} unread items`);
    }
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
        view.dispatchEvent({ type: "SelectFeed", feed: feedName });
        // Keep navSelectedIndex for keyboard highlight
        view['navSelectedIndex'] = sortedFeedList.findIndex(f => f.name === feedName);
        view['renderFeedList'](); view.renderFeedContent(); view.createControlButtons();
      } catch (error: unknown) {
        loadingNotice.hide(); new Notice(`Error loading feed "${feedName}". ${(error instanceof Error) ? error.message : String(error)}`, 7000);
      }
    });
  });
}
