import { FeedsReaderSettings, RssFeedItem } from "../../types";
import FeedsReaderPlugin from "../../main";
import { setIcon, MarkdownRenderer } from "obsidian";
import { generateDeterministicItemId, generateRandomUUID } from "../../utils";
import { FeedsReaderView } from "../../view";

// Helper function to extract a string URL from the RssFeedItem['image'] type
function getImageUrlForItem(imageInput: RssFeedItem['image']): string | undefined {
  if (!imageInput) return undefined;
  if (typeof imageInput === 'string') return imageInput;
  if (Array.isArray(imageInput)) {
    // Accept either raw string URLs *or* objects containing a `url` field.

    // 1. Prefer the first string element – this is the most common shape for
    //    <media:thumbnail> or <enclosure> arrays in many feeds.
    const firstString = imageInput.find(i => typeof i === "string") as string | undefined;
    if (firstString) return firstString;

    // 2. Fallback: find the first object that exposes a `url` property.
    const firstImageObject = imageInput.find(imgObj =>
      typeof imgObj === "object" && imgObj !== null && typeof (imgObj as { url?: string }).url === "string",
    ) as { url: string } | undefined;
    return firstImageObject?.url;
  }
  // Handles single image object
  if (typeof imageInput === 'object' && typeof imageInput.url === 'string') {
    return imageInput.url;
  }
  return undefined;
}

export function renderFeedItemCard(
  item: RssFeedItem,
  parentEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  const settings = plugin.settings;
  if (!item.id) {
    item.id = item.link ? generateDeterministicItemId(item.link) : generateRandomUUID();
  }
  const isExpanded = view.expandedItems.has(item.id);

  const itemDiv = parentEl.createEl("div", { cls: "fr-item", attr: { "data-item-id": item.id } });
  if (isExpanded) { itemDiv.addClass("expanded"); }

  // 1. Create main elements (titleEl, contentDisplayEl, safeId)
  const titleEl = itemDiv.createEl("div", { cls: "fr-item-title", text: item.title || "Untitled Item" });
  const contentDisplayEl = itemDiv.createEl("div", { cls: "fr-item-content" });
  const safeId = item.id.replace(/[^\w-]/g, "_");

  // 2. Set ID and basic display state
  titleEl.id = "fr-item-title-" + safeId;
  contentDisplayEl.id = "fr-item-content-" + safeId;
  contentDisplayEl.hidden = view['titleOnly'] && !isExpanded;

  // 3. Set ARIA attributes
  titleEl.setAttribute("role", "button");
  titleEl.setAttribute("tabindex", "0");
  titleEl.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  titleEl.setAttribute("aria-controls", contentDisplayEl.id);

  contentDisplayEl.setAttribute("role", "region");
  contentDisplayEl.setAttribute("aria-labelledby", titleEl.id);
  contentDisplayEl.setAttribute("aria-hidden", contentDisplayEl.hidden ? "true" : "false");

  const progressEl = itemDiv.createEl("div", { cls: "fr-item-progress", text: "0%" });
  progressEl.hidden = view['titleOnly'] && !isExpanded;
  contentDisplayEl.after(progressEl);

  if (isExpanded) {
    contentDisplayEl.classList.add("blink-highlight");
    window.setTimeout(() => contentDisplayEl.classList.remove("blink-highlight"), 900);
  }

  // Keyboard accessibility
  view.registerDomEvent(titleEl, "keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      view.toggleItemExpansion(item.id!);
    }
  });

  // Scoring & recommendation
  // -----------------------------------------------------------------------
  // Recommendation heuristic
  // -----------------------------------------------------------------------
  // Positives: freshness (<=24 h = +20, <7 d = +10) + unread (+10)
  // Negative: deleted (–50)
  // After calculation the score is *clamped* to the 0-MAX_SCORE range to
  // avoid enormous swings when a single flag flips (e.g. delete ↔ restore).

  const MAX_SCORE = 30; // 20 (fresh) + 10 (unread). Hard ceiling.

  let score = 0;

  if (item.pubDate) {
    const pubTime = Date.parse(item.pubDate);
    if (!Number.isNaN(pubTime)) {
      const ageHours = (Date.now() - pubTime) / 3.6e6; // ms → h
      score += ageHours < 24 ? 20 : ageHours < 168 ? 10 : 0;
    }
  }

  if (item.read === "0") score += 10;

  if (item.deleted !== "0") score -= 50; // Strong negative but will be clamped

  // Clamp to the 0-MAX_SCORE band to avoid excessive jumps.
  score = Math.min(Math.max(score, 0), MAX_SCORE);

  const isRecommended = score >= 25;
  if (isRecommended) {
    titleEl.classList.add("fr-recommendation");
    titleEl.createEl("span", { text: " (おすすめ)" });
  }
  
  const imageUrl = getImageUrlForItem(item.image);
  if (plugin.settings.showThumbnails && imageUrl) {
    const thumbEl = itemDiv.createEl("img", { attr: { src: imageUrl, alt: "Preview image" }, cls: "fr-thumbnail" });
    thumbEl.style.maxWidth = "100px";
    thumbEl.style.float = "right";
    thumbEl.style.margin = "0 0 0.5rem 1rem";
    itemDiv.appendChild(thumbEl);
  }
  titleEl.dataset.action = "toggle-item-content";
  titleEl.dataset.itemId = item.id;

  if (item.__sourceFeed) {
    itemDiv.createEl("div", { cls: "fr-item-source", text: `Source: ${item.__sourceFeed}` });
  }
  itemDiv.createEl("div", { cls: "fr-item-meta", text: item.pubDate || "No date" });

  const actionsEl = itemDiv.createEl("div", { cls: "fr-item-actions" });
  createItemActionButtons(actionsEl, item, settings);

  if (!view['titleOnly'] || isExpanded) {
    renderSingleItemContent(item, contentDisplayEl, plugin);
  }
}

function createItemActionButtons(actionsEl: HTMLElement, item: RssFeedItem, settings: FeedsReaderSettings | undefined): void {
  if (!item.id) item.id = item.link ? generateDeterministicItemId(item.link) : generateRandomUUID();
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
