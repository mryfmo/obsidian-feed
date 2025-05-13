import { Notice, setIcon } from "obsidian";
import { FeedsReaderView } from "../../view";
import FeedsReaderPlugin from "../../main";
import { FRAddFeedModal } from "../../addFeedModal";
import { FRManageFeedsModal } from "../../manageFeedsModal";
import { FRSearchModal } from "../../searchModal";
import { getFeedItems } from "../../getFeed";
import { generateUUID } from "../utils";

export function renderControlsBar(
  controlsEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  controlsEl.empty(); // Clear existing buttons

  const addBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Add new feed", title: "Add new feed" } });
  setIcon(addBtn, "plus");
  view.registerDomEvent(addBtn, "click", () => new FRAddFeedModal(view.app, plugin).open());

  const manageBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Manage feeds", title: "Manage feeds" } });
  setIcon(manageBtn, "settings-2");
  view.registerDomEvent(manageBtn, "click", () => new FRManageFeedsModal(view.app, plugin).open());

  const updateBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Update all feeds", title: "Update all feeds" } });
  setIcon(updateBtn, "refresh-ccw");
  view.registerDomEvent(updateBtn, "click", async () => {
    const initialNotice = new Notice("Fetching updates for all feeds...", 0);
    let changesMadeOverall = false; let feedsSuccessfullyUpdated = 0; let feedsFailedToUpdate = 0;
    const updatePromises = plugin.feedList.map(async (feedInfo) => {
      try {
        // Pass the plugin instance and services to getFeedItems
        const newFeedContent = await getFeedItems(plugin, feedInfo, plugin.networkService, plugin.contentParserService, plugin.assetService);
        const existingFeed = plugin.feedsStore[feedInfo.name];
        let newItemsCount = 0; let feedChanged = false;
        if (existingFeed?.items) {
          const existingItemIds = new Set(existingFeed.items.map(item => item.id || item.link || generateUUID()));
          const freshItems = newFeedContent.items.filter(newItem => { if(!newItem.id) newItem.id=newItem.link||generateUUID(); return !existingItemIds.has(newItem.id); });
          if(freshItems.length > 0) { freshItems.forEach(n=>{if(!n.id)n.id=n.link||generateUUID()}); existingFeed.items.unshift(...freshItems); newItemsCount = freshItems.length; feedChanged = true; }
          if(existingFeed.title !== newFeedContent.title || existingFeed.description !== newFeedContent.description || existingFeed.image !== newFeedContent.image) { existingFeed.title=newFeedContent.title; existingFeed.description=newFeedContent.description; existingFeed.image=newFeedContent.image; feedChanged = true; }
          existingFeed.pubDate=newFeedContent.pubDate;
          existingFeed.items.forEach(i=>{if(!i.id)i.id=i.link||generateUUID()});
          feedInfo.unread = existingFeed.items.filter(i=>i.read==="0"&&i.deleted==="0").length;
        } else {
          newFeedContent.items.forEach(i=>{if(!i.id)i.id=i.link||generateUUID()});
          plugin.feedsStore[feedInfo.name] = newFeedContent;
          feedInfo.unread = newFeedContent.items.filter(i=>i.read==="0"&&i.deleted==="0").length;
          newItemsCount = newFeedContent.items.length; feedChanged = true;
        }
        if(feedChanged) { plugin.feedsStoreChangeList.add(feedInfo.name); changesMadeOverall = true; }
        return { status: 'fulfilled' as const, name: feedInfo.name, newItems: newItemsCount };
      } catch (error: unknown) {
        console.error(`Update error for ${feedInfo.name}:`, error);
        return { status: 'rejected' as const, name: feedInfo.name, reason: error };
      }
    });
    const results = await Promise.allSettled(updatePromises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') feedsSuccessfullyUpdated++; // Check inner status
      else {
        feedsFailedToUpdate++;
        let feedName = 'Unknown Feed';
        let errorMessage = 'Unknown error during update.';
        if (result.status === 'fulfilled' && result.value.status === 'rejected') { feedName = result.value.name; errorMessage = result.value.reason instanceof Error ? result.value.reason.message : String(result.value.reason); }
        else if (result.status === 'rejected') { feedName = (result.reason as { name?: string })?.name ?? feedName; errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason); }
        new Notice(`Failed to update feed "${feedName}". Reason: ${errorMessage.substring(0, 150)}...`, 7000);
      }
    });
    initialNotice.hide();
    if (changesMadeOverall) { plugin.requestSave(); }
    new Notice(`Update finished. ${feedsSuccessfullyUpdated} updated. ${feedsFailedToUpdate > 0 ? `${feedsFailedToUpdate} failed.` : ''}`, 7000);
    view.refreshView();
  });

  const saveBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Save feed data", title: "Save feed data" } });
  setIcon(saveBtn, "save");
  view.registerDomEvent(saveBtn, "click", async () => {
    if (plugin.feedsStoreChange) {
      const savingNotice = new Notice("Saving data...", 0);
      try { await plugin.savePendingChanges(true); }
      catch (error: unknown) { new Notice(`Manual save failed. ${(error instanceof Error) ? error.message : String(error)}`, 7000); }
      finally { savingNotice.hide(); }
    } else { new Notice("No changes to save."); }
  });

  if (view.currentFeed && plugin.feedsStore[view.currentFeed]) {
    const searchBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Search in feed", title: "Search in feed" } });
    setIcon(searchBtn, "search");
    view.registerDomEvent(searchBtn, "click", () => {
      if(view.currentFeed && plugin.feedsStore[view.currentFeed]) { new FRSearchModal(view.app, view.currentFeed, plugin).open(); }
      else { new Notice("Please select a valid feed first."); }
    });

    const unreadBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Toggle unread / all", title: "Toggle unread / all" } });
    const syncUnreadIcon = () => setIcon(unreadBtn, view['showAll'] ? "filter" : "filter-x"); syncUnreadIcon();
    view.registerDomEvent(unreadBtn, "click", () => { view['showAll'] = !view['showAll']; syncUnreadIcon(); view.renderFeedContent(); });

    const contentBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Toggle title / content", title: "Toggle title / content" } });
    const syncContentIcon = () => setIcon(contentBtn, view['titleOnly'] ? "layout-list" : "layout-grid"); syncContentIcon();
    view.registerDomEvent(contentBtn, "click", () => { view['titleOnly'] = !view['titleOnly']; syncContentIcon(); view.renderFeedContent(); });

    const orderBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Change sort order", title: "Change sort order" } });
    const syncOrderIcon = () => { setIcon(orderBtn, view['itemOrder'] === "New to old" ? "sort-desc" : view['itemOrder'] === "Old to new" ? "sort-asc" : "shuffle"); }; syncOrderIcon();
    view.registerDomEvent(orderBtn, "click", () => { view['itemOrder'] = view['itemOrder'] === "New to old" ? "Old to new" : view['itemOrder'] === "Old to new" ? "Random" : "New to old"; syncOrderIcon(); view.renderFeedContent(); });

    const undoBtn = controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Undo last action", title: "Undo last action" } });
    setIcon(undoBtn, "rotate-ccw");
    undoBtn.disabled = view.undoList.length === 0;
    view.registerDomEvent(undoBtn, "click", () => view.handleUndo());
  }
}
