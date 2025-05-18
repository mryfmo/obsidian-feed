import { setIcon } from "obsidian";
import { FeedsReaderSettings, RssFeedItem } from "../../types";
import { generateDeterministicItemId, generateRandomUUID } from "../../utils";

/*
 * Centralized creation of per-item action buttons.
 * Both CardView and ListView can reuse the same button group.
 * FeedItemCardComponent is extracted as a common module.
 */

// Use definitions to declaratively describe which actions to generate.
interface ActionDef {
  key: string;
  defaultIcon: string;
  activeIcon?: string | null;
  settingKey: keyof FeedsReaderSettings;
  defaultLabel: string;
  activeLabel?: string;
  isActive: (item: RssFeedItem) => boolean;
}

const ACTIONS: ActionDef[] = [
  {
    key: "markRead",
    defaultIcon: "book-open",
    activeIcon: "book-marked",
    settingKey: "showRead",
    defaultLabel: "Mark as Read",
    activeLabel: "Mark as Unread",
    isActive: (i) => i.read !== "0",
  },
  {
    key: "delete",
    defaultIcon: "trash-2",
    activeIcon: "history",
    settingKey: "showDelete",
    defaultLabel: "Delete Item",
    activeLabel: "Restore Item",
    isActive: (i) => i.deleted !== "0",
  },
  {
    key: "save",
    defaultIcon: "save",
    settingKey: "showSave",
    defaultLabel: "Save Note",
    isActive: () => false,
  },
  {
    key: "openLink",
    defaultIcon: "external-link",
    settingKey: "showLink",
    defaultLabel: "Open Link",
    isActive: () => false,
  },
  {
    key: "jot",
    defaultIcon: "edit-3",
    settingKey: "showJot",
    defaultLabel: "Jot Note",
    isActive: () => false,
  },
  {
    key: "snippet",
    defaultIcon: "scissors",
    settingKey: "showSnippet",
    defaultLabel: "Save Snippet",
    isActive: () => false,
  },
  {
    key: "fetch",
    defaultIcon: "download-cloud",
    settingKey: "showFetch",
    defaultLabel: "Fetch Full Content",
    isActive: () => false,
  },
  {
    key: "GPT",
    defaultIcon: "brain",
    settingKey: "showGPT",
    defaultLabel: "Ask GPT",
    isActive: () => false,
  },
];

/**
 * Append the full set of action buttons to the given container.
 * The caller is responsible for providing a parent element with class `fr-item-actions`.
 */
export function createItemActionButtons(
  actionsEl: HTMLElement,
  item: RssFeedItem,
  settings: FeedsReaderSettings | undefined,
): void {
  if (!settings) return;

  if (!item.id) {
    item.id = item.link ? generateDeterministicItemId(item.link) : generateRandomUUID();
  }

  ACTIONS.forEach((def) => {
    if (typeof settings[def.settingKey] === "boolean" && settings[def.settingKey] === false) return;

    const active = def.isActive(item);
    const currentIcon = active ? def.activeIcon ?? def.defaultIcon : def.defaultIcon;
    const currentLabel = active && def.activeLabel ? def.activeLabel : def.defaultLabel;

    const btn = actionsEl.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": currentLabel, title: currentLabel },
    });

    setIcon(btn, currentIcon);
    btn.dataset.action = def.key;
    btn.dataset.itemId = item.id!;
  });
}
