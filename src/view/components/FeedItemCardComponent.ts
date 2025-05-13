import { FeedsReaderSettings, RssFeedItem } from "../../types";
import FeedsReaderPlugin from "../../main";
import { setIcon, MarkdownRenderer } from "obsidian";
import { generateUUID } from "../utils";
import { FeedsReaderView } from "../../view";

export function renderFeedItemCard(
  item: RssFeedItem,
  parentEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  const settings = plugin.settings;
  if (!item.id) { item.id = item.link || generateUUID(); }
  const isExpanded = view.expandedItems.has(item.id);

  const itemDiv = parentEl.createEl("div", { cls: "fr-item", attr: { "data-item-id": item.id } });
  if (isExpanded) { itemDiv.addClass("expanded"); }

  const titleEl = itemDiv.createEl("div", { cls: "fr-item-title", text: item.title || "Untitled Item" });
  titleEl.dataset.action = "toggle-item-content";
  titleEl.dataset.itemId = item.id;

  itemDiv.createEl("div", { cls: "fr-item-meta", text: item.pubDate || "No date" });

  const actionsEl = itemDiv.createEl("div", { cls: "fr-item-actions" });
  createItemActionButtons(actionsEl, item, settings);

  const contentDisplayEl = itemDiv.createEl("div", { cls: "fr-item-content" });
  contentDisplayEl.hidden = view['titleOnly'] && !isExpanded;
  if (!view['titleOnly'] || isExpanded) {
    renderSingleItemContent(item, contentDisplayEl, plugin);
  }
}

function createItemActionButtons(actionsEl: HTMLElement, item: RssFeedItem, settings: FeedsReaderSettings | undefined): void {
  if (!item.id) item.id = item.link || generateUUID();
  const createButton = (action: string, defaultIcon: string, activeIcon: string | null, settingKey: keyof FeedsReaderSettings, defaultLabel: string, activeLabel: string, isActive: boolean) => {
    if (settings && typeof settings[settingKey] === 'boolean' && settings[settingKey] === false) return;
    const currentIcon = isActive && activeIcon ? activeIcon : defaultIcon;
    const currentLabel = isActive ? activeLabel : defaultLabel;
    const btn = actionsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": currentLabel, title: currentLabel } });
    setIcon(btn, currentIcon); btn.dataset.action = action; btn.dataset.itemId = item.id!;
  };
  createButton("markRead", "book-open", "book-marked", "showRead", "Mark as Read", "Mark as Unread", item.read !== "0");
  createButton("delete", "trash-2", "history", "showDelete", "Delete Item", "Restore Item", item.deleted !== "0");
  if(settings?.showSave) createButton("save", "save", null, "showSave", "Save Note", "", false);
  if(settings?.showLink) createButton("openLink", "external-link", null, "showLink", "Open Link", "", false);
  if(settings?.showJot) createButton("jot", "edit-3", null, "showJot", "Jot Note", "", false);
  if(settings?.showSnippet) createButton("snippet", "scissors", null, "showSnippet", "Save Snippet", "", false);
  if(settings?.showFetch) createButton("fetch", "download-cloud", null, "showFetch", "Fetch Full Content", "", false);
  if(settings?.showGPT) createButton("GPT", "brain", null, "showGPT", "Ask GPT", "", false);
}

export async function renderSingleItemContent(item: RssFeedItem, contentDisplayEl: HTMLElement, plugin: FeedsReaderPlugin): Promise<void> {
  try {
    contentDisplayEl.empty();
    // Assuming item.content is now Markdown
    if (item.content && item.content.trim() !== "") {
      await MarkdownRenderer.render(plugin.app, item.content, contentDisplayEl, item.link || plugin.app.vault.getRoot().path, plugin);
    } else {
      contentDisplayEl.setText("No content available.");
    }
  } catch (e: unknown) {
    const errorMessage = `Error rendering content for "${item.title?.substring(0,20)}...". Content might be malformed. (Details: ${(e instanceof Error) ? e.message : String(e)})`;
    contentDisplayEl.setText(errorMessage);
    console.error(`renderSingleItemContent: Error for item ID "${item.id}", title "${item.title}". Details:`, e);
  }
}
