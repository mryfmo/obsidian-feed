import { Notice } from "obsidian";
import { FeedsReaderView } from "../../view";
import FeedsReaderPlugin from "../../main";
import { renderFeedItemCard } from "./FeedItemCardComponent";

export function renderFeedItemsList(
  contentAreaEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  contentAreaEl.empty();
  if (!view.currentFeed || !plugin.feedsStore[view.currentFeed]) {
    contentAreaEl.setText(view.currentFeed ? `Data for feed "${view.currentFeed}" is not ready.` : "Select a feed.");
    return;
  }
  const feedContent = plugin.feedsStore[view.currentFeed];
  if (!feedContent.items || feedContent.items.length === 0) {
    contentAreaEl.setText(`No items found for feed "${view.currentFeed}".`);
    return;
  }
  let itemsToShow = [...feedContent.items];
  if (!view['showAll']) itemsToShow = itemsToShow.filter(i => i.read === "0" && i.deleted === "0");
  const itemOrder = view['itemOrder'];
  if (itemOrder === "New to old") itemsToShow.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  else if (itemOrder === "Old to new") itemsToShow.sort((a, b) => (a.pubDate || "").localeCompare(b.pubDate || ""));
  else if (itemOrder === "Random") itemsToShow.sort(() => Math.random() - 0.5);
  const start = view['currentPage'] * view.itemsPerPage;
  const end = start + view.itemsPerPage;
  const pageItems = itemsToShow.slice(start, end);
  if (pageItems.length === 0) {
    contentAreaEl.setText(view['currentPage'] === 0 ? `No items match filter for "${view.currentFeed}".` : "No more items.");
    return;
  }
  pageItems.forEach(item => renderFeedItemCard(item, contentAreaEl, view, plugin));
}

export async function handleContentAreaClick(event: MouseEvent, view: FeedsReaderView, plugin: FeedsReaderPlugin): Promise<void> {
  const target = event.target as HTMLElement;
  const actionButton = target.closest("button[data-action]") as HTMLButtonElement;
  const titleElement = target.closest(".fr-item-title[data-action='toggle-item-content']") as HTMLElement;

  if (actionButton) {
    const action = actionButton.dataset.action;
    const itemId = actionButton.dataset.itemId;
    if (!itemId || !view.currentFeed) { new Notice("Action error: Missing context."); return; }

    const item = await plugin.getFeedItem(view.currentFeed, itemId);
    if (!item) { new Notice(`Item "${itemId}" not found.`); return; }

    try {
      let stateChangedForRender = false; let refreshList = false;
      switch (action) {
        case "markRead": {
          const newStateIsRead = item.read === "0";
          if (plugin.markItemReadState(view.currentFeed, itemId, newStateIsRead)) {
            view.pushUndo({ feedName: view.currentFeed, itemId: item.id!, action: newStateIsRead ? "unread" : "read", previousState: newStateIsRead ? "0" : item.read });
            new Notice(`Item "${item.title?.substring(0,20)}..." ${newStateIsRead ? 'read' : 'unread'}.`);
            stateChangedForRender = true; refreshList = true;
          } else { new Notice(`Item already ${item.read === "0" ? 'unread' : 'read'}.`); }
          break;
        }
        case "delete": {
          const newStateIsDeleted = item.deleted === "0";
          if (plugin.markItemDeletedState(view.currentFeed, itemId, newStateIsDeleted)) {
            view.pushUndo({ feedName: view.currentFeed, itemId: item.id!, action: newStateIsDeleted ? "deleted" : "undeleted", previousState: newStateIsDeleted ? "0" : item.deleted });
            new Notice(`Item "${item.title?.substring(0,20)}..." ${newStateIsDeleted ? 'deleted' : 'restored'}.`);
            stateChangedForRender = true; refreshList = true;
          } else { new Notice(`Item already ${item.deleted === "0" ? 'active' : 'deleted'}.`); }
          break;
        }
        case "save": {
          // Check if item.downloaded state was changed by saveItemAsMarkdown
          const itemAfterSave = await plugin.getFeedItem(view.currentFeed, itemId);
          if (itemAfterSave && item.downloaded !== itemAfterSave.downloaded) stateChangedForRender = true;
          const iAfter = await plugin.getFeedItem(view.currentFeed,itemId); if(iAfter && item.downloaded!==iAfter.downloaded) stateChangedForRender=true;
          break;
        }
        case "openLink":
          if (item.link && item.link.startsWith("http")) window.open(item.link, "_blank");
          else new Notice(`No valid link for "${item.title?.substring(0,20)}...".`);
          break;
        case "jot": new Notice("Jot: Not implemented."); break;
        case "snippet": await plugin.saveSnippet(item); break; // Notice in plugin method
        case "fetch": {
          const fNotice = new Notice(`Fetching: "${item.title?.substring(0,30)}..."`, 0);
          if (await plugin.fetchFullContent(view.currentFeed, itemId)) { stateChangedForRender = true; refreshList = true; } // Full refresh if content changed
          fNotice.hide(); // Notices in plugin method
          break;
        }
        case "GPT": {
          const settings = plugin.settings;
          if (!settings?.chatGPTApiKey?.trim()) { new Notice("ChatGPT API Key missing."); break; }
          // Use item.content directly as it should be Markdown now.
          const pText = (item.content || item.title || "").substring(0, 4000);          
          if (!pText.trim()) { new Notice("No content for GPT."); break; }
          const pr = settings.chatGPTPrompt.replace("{{content}}", pText); const m = settings.chatGPTModel || "gpt-4o-mini";
          const gNotice = new Notice(`Asking ${m}...`, 0);
          const r = await window.pluginApi.fetchChatGPT(settings.chatGPTApiKey, 0.7, pr, m);
          gNotice.hide(); new Notice(`GPT (${m}) summary for "${item.title?.substring(0,20)}..." (see console).`, 5000);
          console.log(`GPT Reply for '${item.title}' (${m}):\n${r}`);
          break;
        }
        default: console.warn("Unhandled action:", action);
      }
      if (stateChangedForRender) {
        const currentFeedInfo = plugin.feedList.find(f => f.name === view.currentFeed);
        if(currentFeedInfo && plugin.feedsStore[view.currentFeed!]) currentFeedInfo.unread = plugin.feedsStore[view.currentFeed!].items.filter(i => i.read === "0" && i.deleted === "0").length ?? 0;
        view.renderFeedContent();
        if (refreshList) view['renderFeedList']();
      }
    } catch (error: unknown) {
      new Notice(`Error on action '${action}': ${(error instanceof Error) ? error.message : String(error)}`, 7000);
    }
  } else if (titleElement) {
    const itemId = titleElement.dataset.itemId;
    if (itemId) view.toggleItemExpansion(itemId);
  }
}
