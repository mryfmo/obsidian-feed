import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import { UndoAction } from "./globals";
import FeedsReaderPlugin from "./main";
import { renderControlsBar } from "./view/components/ControlsBarComponent";
import { renderFeedNavigation } from "./view/components/FeedNavigationComponent";
import { renderFeedItemsList, handleContentAreaClick as handleItemsListClick } from "./view/components/FeedItemsListComponent";
import { renderSingleItemContent } from "./view/components/FeedItemCardComponent";
import { isVisibleItem } from "./utils";
import { RssFeedItem } from "./types";

export const VIEW_TYPE_FEEDS_READER = "feeds-reader-view";

export class FeedsReaderView extends ItemView {
  // View-Specific State
  public currentFeed: string | null = null;
  private showAll: boolean = false;
  private titleOnly: boolean = true;
  private itemOrder: "New to old" | "Old to new" | "Random" = "New to old";
  private currentPage: number = 0;
  public undoList: UndoAction[] = [];
  public expandedItems: Set<string> = new Set();
  private selectedIndex: number = -1; // index within currently rendered page
  private focusArea: 'content' | 'nav' = 'content';
  private navSelectedIndex: number = 0;
  private readonly MAX_UNDO_STEPS = 20;

  /** Cached scroll callback so we attach it only once per view lifecycle. */
  private _scrollCb?: () => void;

  public itemsPerPage = 20;
  private navHidden = false;

  /**
   * Returns the list of items currently in scope for the view, already filtered
   * by `showAll` (read / deleted) flag.  This is used both for pagination
   * calculations and for actual rendering (via `renderFeedContent`).  Keeping
   * the logic in one place guarantees that the two stay in sync.
   */
  private getVisibleItems(): Array<RssFeedItem & { __sourceFeed?: string }> {
    let pool: Array<RssFeedItem & { __sourceFeed?: string }> = [];

    if (this.plugin.settings.mixedFeedView) {
      for (const feed of Object.values(this.plugin.feedsStore)) {
        const title = feed.title || "(unknown)";
        pool = pool.concat(
          feed.items.map(item => ({ ...item, __sourceFeed: title }))
        );
      }
    } else {
      if (!this.currentFeed) return [];
      const feedContent = this.plugin.feedsStore[this.currentFeed];
      if (!feedContent) return [];
      pool = [...feedContent.items];
    }

    return pool.filter(i => isVisibleItem(i, this.showAll));
  }

  // UI References
  private controlsEl!: HTMLElement;
  private navEl!: HTMLElement;
  public contentAreaEl!: HTMLElement;
  public actionIconsGroupEl!: HTMLElement; // Made public for components

  // Plugin Reference
  public plugin: FeedsReaderPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FeedsReaderPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "rss";
    this.itemsPerPage = this.plugin.settings.nItemPerPage ?? 20;
  }

  getViewType() { return VIEW_TYPE_FEEDS_READER; }

  getDisplayText() {
    this.itemsPerPage = this.plugin.settings.nItemPerPage ?? 20;
    return "Feeds Reader";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("fr-view-container");
    container.style.display = "flex"; container.style.flexDirection = "column"; container.style.height = "100%";

    this.controlsEl = container.createEl("div", { cls: "fr-controls-bar" });
    const mainArea = container.createEl("div", {cls: "fr-main-area"});
    mainArea.style.display = "flex"; mainArea.style.flexGrow = "1"; mainArea.style.overflow = "hidden";

    this.navEl = mainArea.createEl("div", { cls: "fr-nav", attr: { id: "fr-nav" } });
    this.contentAreaEl = mainArea.createEl("div", { cls: "fr-content-area", attr: { id: "fr-content" } });
    this.contentAreaEl.style.flexGrow = "1"; this.contentAreaEl.style.overflowY = "auto"; this.navEl.style.overflowY = "auto";
    this.actionIconsGroupEl = this.controlsEl.createEl("div", { cls: "fr-action-icons-group"});
    this.actionIconsGroupEl.style.cssText = "display: flex; flex-grow: 1; justify-content: flex-end;";

    this.currentFeed = null; this.showAll = false; this.titleOnly = true;
    this.itemOrder = "New to old"; this.currentPage = 0; this.undoList = []; this.expandedItems = new Set();

    this.navEl.hidden = this.navHidden;

    // Nav toggle button - should be part of controlsEl, not actionIconsGroupEl if it's at the far left
    const navBtn = this.controlsEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Toggle Feed List Sidebar" } });
    this.controlsEl.insertBefore(navBtn, this.actionIconsGroupEl);
    const syncNavIcon = () => setIcon(navBtn, this.navEl.hidden ? "panel-left-open" : "panel-left-close");
    syncNavIcon();
    this.registerDomEvent(navBtn, "click", () => { this.navEl.hidden = !this.navEl.hidden; this.navHidden = this.navEl.hidden; syncNavIcon(); });

    this.createControlButtons();
    this.contentAreaEl.setText("Select a feed from the list.");

    this.renderFeedList();
    this.registerDomEvent(this.contentAreaEl, "click", (event) => handleItemsListClick(event, this, this.plugin));

    // Register a single scroll listener for reading-progress updates. Guard to
    // ensure we don't attach multiple listeners if onOpen somehow executes
    // more than once (shouldn't happen, but defensive).
    if (!this._scrollCb) {
      this._scrollCb = () => this.updateReadingProgress();
      this.registerDomEvent(this.contentAreaEl, "scroll", this._scrollCb);
    }

    // Keyboard navigation
    this.registerDomEvent(this.containerEl.ownerDocument, "keydown", (e: KeyboardEvent) => this.handleKeyDown(e));
  }

  public createControlButtons(): void {
    renderControlsBar(this.actionIconsGroupEl, this, this.plugin);
  }

  private renderFeedList(): void {
    renderFeedNavigation(this.navEl, this, this.plugin);
  }

  public nextPage() {
    const items = this.getVisibleItems();
    if (items.length === 0) {
      new Notice("No items to paginate.");
      return;
    }

    const totalPages = Math.ceil(items.length / this.itemsPerPage);
    if (this.currentPage < totalPages - 1) {
      this.currentPage++;
      this.renderFeedContent();
    } else {
      new Notice("You are on the last page.");
    }
  }
  public prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderFeedContent();
    } else {
      // Only notify if there is at least one page worth of items
      if (this.getVisibleItems().length > 0) {
        new Notice("You are on the first page.");
      }
    }
  }

  public renderFeedContent(): void {
    const contentEl = this.contentAreaEl;
    contentEl.empty();

    const items = this.getVisibleItems();

    if (!this.plugin.settings.mixedFeedView && !this.currentFeed) {
      contentEl.setText("No feed selected to display items.");
      return;
    }

    if (!this.contentAreaEl ) { console.warn("Content area not ready."); return; }
      renderFeedItemsList(this.contentAreaEl, items, this, this.plugin);

    // reset selection to first item of page
    this.selectedIndex = 0;
    this.highlightSelected();
  }

  public toggleItemExpansion(itemId: string): void {
    if (itemId && this.currentFeed && this.plugin.feedsStore[this.currentFeed]) {
      if (!this.expandedItems) this.expandedItems = new Set();
      const itemDiv = this.contentAreaEl.querySelector(`.fr-item[data-item-id="${itemId}"]`);
      if (itemDiv) {
        const contentEl = itemDiv.querySelector(".fr-item-content") as HTMLElement;
        if (itemDiv.classList.contains("expanded")) {
          itemDiv.classList.remove("expanded"); this.expandedItems.delete(itemId);
          if (contentEl && this.titleOnly) contentEl.hidden = true; // Hide only if in titleOnly mode          
        } else {
          itemDiv.classList.add("expanded"); this.expandedItems.add(itemId);
          if (contentEl) {
            contentEl.hidden = false; // Always show if expanded
            // If content was never rendered (e.g. initially hidden by titleOnly), render it now.
            if (contentEl.childNodes.length === 0) {
              const itemData = this.plugin.feedsStore[this.currentFeed!]?.items.find(i => i.id === itemId);
              if(itemData) renderSingleItemContent(itemData, contentEl, this.plugin);
            }
          }
        }
      }

      // Ensure the clicked/expanded item becomes the current selection so
      // subsequent keyboard actions operate on the same element the user just
      // interacted with using the mouse.
      this.setSelectedItemById(itemId);
    }
  }

  public pushUndo(action: UndoAction): void {
    this.undoList.push(action);
    if (this.undoList.length > this.MAX_UNDO_STEPS) {
      this.undoList.shift();
    }
    this.updateUndoButtonState();
  }

  public updateUndoButtonState(): void {    
    const undoBtn = this.actionIconsGroupEl.querySelector('button[aria-label="Undo last action"]') as HTMLButtonElement | null;
    if(undoBtn) undoBtn.disabled = this.undoList.length === 0;
  }

  public refreshView(): void {
    // console.log("FeedsReaderView: Refreshing view state...");    
    this.renderFeedList();
    if (this.currentFeed) { this.renderFeedContent(); }
    else if (this.contentAreaEl) { this.contentAreaEl.setText("Select a feed from the list."); }
    this.createControlButtons();
  }

  public resetFeedSpecificViewState(): void {
    this.showAll = false;
    this.titleOnly = true;
    this.itemOrder = "New to old";
    this.currentPage = 0;
    this.undoList = []; // Clear undo for the new feed
    this.expandedItems = new Set(); // Clear expanded items
    this.updateUndoButtonState();
  }

  // ---------------- Keyboard Navigation ------------------
  private handleKeyDown(e: KeyboardEvent): void {
    // Only act if this view is the active workspace leaf
    if (this.app.workspace.getActiveViewOfType(FeedsReaderView) !== this) return;

    // Ignore if input/textarea is focused
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;

    const key = e.key;
    // Allow tab to toggle focus between nav and content
    if (key === "Tab") {
      e.preventDefault();
      this.toggleFocusArea();
      return;
    }

    const jOrDown = key === "j" || key === "ArrowDown";
    const kOrUp = key === "k" || key === "ArrowUp";
    const enterOrO = key === "Enter" || key === "o";
    const markKey = key === "r";
    const delKey = key === "d";
    const nextPageKey = key === "PageDown" || key === " "; // space
    const prevPageKey = key === "PageUp";

    if (!(jOrDown || kOrUp || enterOrO || markKey || delKey || nextPageKey || prevPageKey)) return;
    if (this.focusArea === 'nav') {
      this.handleNavKey(jOrDown, kOrUp, enterOrO);
      return;
    }

    // Prevent default to keep page from scrolling etc.
    e.preventDefault();

    if (nextPageKey) { this.nextPage(); this.selectedIndex = 0; this.highlightSelected(); return; }
    if (prevPageKey) { this.prevPage(); this.selectedIndex = 0; this.highlightSelected(); return; }

    const currentItems = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>(".fr-item"));
    if (currentItems.length === 0) return;

    if (this.selectedIndex < 0 || this.selectedIndex >= currentItems.length) {
      this.selectedIndex = 0;
    }

    if (jOrDown) {
      if (this.selectedIndex < currentItems.length - 1) {
        this.selectedIndex++;
        this.highlightSelected();
      } else { // end of list, advance page
        this.nextPage();
        this.selectedIndex = 0; this.highlightSelected();
      }
      return;
    }

    if (kOrUp) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--; this.highlightSelected();
      } else { // top of list, previous page
        const prevPage = this.currentPage;
        this.prevPage();
        if (this.currentPage !== prevPage) {
          const itemsAfter = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>(".fr-item"));
          this.selectedIndex = itemsAfter.length - 1;
          this.highlightSelected();
        }
      }
      return;
    }

    const selectedItemEl = currentItems[this.selectedIndex];
    const itemId = selectedItemEl?.dataset.itemId;
    if (!itemId || !this.currentFeed) return;

    if (enterOrO) {
      this.toggleItemExpansion(itemId);
      return;
    }

    if (markKey) {
      const item = this.plugin.feedsStore[this.currentFeed]?.items.find(i => i.id === itemId);
      if (item) {
        this.plugin.markItemReadState(this.currentFeed, itemId, item.read === "0");
        this.renderFeedContent();
        this.highlightSelected();
      }
      return;
    }

    if (delKey) {
      const item = this.plugin.feedsStore[this.currentFeed]?.items.find(i => i.id === itemId);
      if (item) {
        this.plugin.markItemDeletedState(this.currentFeed, itemId, item.deleted === "0");
        this.renderFeedContent();
        this.highlightSelected();
      }
    }
  }

  /**
   * Updates the internally tracked selection (used for keyboard navigation)
   * based on the DOM element that was interacted with.
   * This keeps mouse and keyboard interaction in sync so that a user can
   * freely switch between the two without losing context.
   */
  public setSelectedItemById(itemId: string): void {
    if (!this.contentAreaEl) return;
    const items = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>(".fr-item"));
    const idx = items.findIndex(el => el.dataset.itemId === itemId);
    if (idx !== -1) {
      this.selectedIndex = idx;
      this.highlightSelected();
    }
  }

  private highlightSelected(): void {
    const items = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>(".fr-item"));
    items.forEach((el, idx) => {
      if (idx === this.selectedIndex) el.classList.add("fr-item-selected");
      else el.classList.remove("fr-item-selected");
    });

    const selectedEl = items[this.selectedIndex];
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }

  private toggleFocusArea(): void {
    if (this.focusArea === 'content') {
      // switch to nav if visible
      if (!this.navEl.hidden) {
        this.focusArea = 'nav';
        this.highlightNav();
      }
    } else {
      this.focusArea = 'content';
      this.clearNavHighlight();
      this.highlightSelected();
    }
  }

  private handleNavKey(down: boolean, up: boolean, enter: boolean): void {
    const feeds = Array.from(this.navEl.querySelectorAll<HTMLElement>(".fr-feed-item"));
    if (feeds.length === 0) return;

    if (down) {
      this.navSelectedIndex = (this.navSelectedIndex + 1) % feeds.length;
      this.highlightNav(); return;
    }
    if (up) {
      this.navSelectedIndex = (this.navSelectedIndex - 1 + feeds.length) % feeds.length;
      this.highlightNav(); return;
    }
    if (enter) {
      const el = feeds[this.navSelectedIndex];
      el.click();
      this.focusArea = 'content';
      this.selectedIndex = 0;
      this.highlightSelected();
    }
  }

  private highlightNav(): void {
    const feeds = Array.from(this.navEl.querySelectorAll<HTMLElement>(".fr-feed-item"));
    if (feeds.length === 0) return;
    if (this.navSelectedIndex >= feeds.length) this.navSelectedIndex = feeds.length - 1;
    if (this.navSelectedIndex < 0) this.navSelectedIndex = 0;

    feeds.forEach((el, idx) => {
      if (idx === this.navSelectedIndex) el.classList.add("fr-feed-item-selected");
      else el.classList.remove("fr-feed-item-selected");
    });
    feeds[this.navSelectedIndex].scrollIntoView({ block: 'nearest' });
  }

  private clearNavHighlight(): void {
    this.navEl.querySelectorAll<HTMLElement>(".fr-feed-item-selected").forEach(el => el.classList.remove("fr-feed-item-selected"));
  }

  public resetToDefaultState(): void {
    // console.log("FeedsReaderView: Resetting to default state.");
    this.currentFeed = null; 
    this.resetFeedSpecificViewState();
    if(this.contentAreaEl) this.contentAreaEl.setText("Select a feed from the list.");
    this.createControlButtons();
    this.renderFeedList();
  }

  public handleUndo(): void {
    if (this.undoList.length === 0) { new Notice("Nothing to undo."); return; }
    const lastAction = this.undoList.pop();
    this.updateUndoButtonState();
    if (!lastAction || !this.currentFeed || (this.currentFeed !== lastAction.feedName)) {
      if(lastAction) this.pushUndo(lastAction); // Put it back if context is wrong
      new Notice("Cannot undo: Action is for a different feed or context is invalid.");
      return;
    }

    let actionUndone = false;
    let noticeMessage = "";

    if (lastAction.action === "markAllRead" && lastAction.previousStates) {
      lastAction.previousStates.forEach(prevState => {
        const itemToUndo = this.plugin.feedsStore[this.currentFeed!]?.items.find(i => i.id === prevState.itemId);
        if (itemToUndo) { itemToUndo.read = prevState.readState; actionUndone = true; }
      });
      if(actionUndone) { noticeMessage = `Reverted "mark all read" for ${lastAction.previousStates.length} items.`; this.plugin.flagChangeAndSave(this.currentFeed); }
    } else if (lastAction.itemId) { // Single item undo
      const itemToUndo = this.plugin.feedsStore[this.currentFeed]?.items.find(i => i.id === lastAction.itemId);
      if (itemToUndo && lastAction.previousState !== undefined) {
        if (lastAction.action === "read" || lastAction.action === "unread") { itemToUndo.read = lastAction.previousState; noticeMessage = `Item "${itemToUndo.title?.substring(0,20)}..." read state reverted.`; actionUndone = true; }
        else if (lastAction.action === "deleted" || lastAction.action === "undeleted") { itemToUndo.deleted = lastAction.previousState; noticeMessage = `Item "${itemToUndo.title?.substring(0,20)}..." delete state reverted.`; actionUndone = true; }
        if(actionUndone) this.plugin.flagChangeAndSave(this.currentFeed);
      }
    }
    if (actionUndone) { this.refreshView(); new Notice(noticeMessage || "Action undone."); }
    else { if(lastAction) this.pushUndo(lastAction); new Notice("Could not undo: Item state or context issue."); }
  }  

  public updateReadingProgress(): void {
    if (!this.contentAreaEl) return;
    const container = this.contentAreaEl;
    // No need for manual scroll position math; bounding rect handles it.
    const items = container.querySelectorAll('.fr-item');
    items.forEach(itemDiv => {
      const contentEl = itemDiv.querySelector('.fr-item-content') as HTMLElement;
      const progressEl = itemDiv.querySelector('.fr-item-progress') as HTMLElement;
      if (!contentEl || !progressEl) return;
      if (contentEl.hidden) {
        progressEl.hidden = true;
      } else {
        progressEl.hidden = false;
        // Calculate intersection between the item and the viewport using
        // bounding rectangles so that nested offset contexts and transforms
        // are handled correctly.
        const containerRect = container.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();

        let percent: number;
        if (contentRect.bottom <= containerRect.top) {
          // Item is completely above the viewport – treat as fully read.
          percent = 100;
        } else if (contentRect.top >= containerRect.bottom) {
          // Item is completely below the viewport – not started.
          percent = 0;
        } else {
          // Partial intersection.
          const intersectHeight = Math.max(
            0,
            Math.min(containerRect.bottom, contentRect.bottom) -
              Math.max(containerRect.top, contentRect.top),
          );

          percent = contentRect.height === 0 ? 0 : (intersectHeight / contentRect.height) * 100;
        }
        progressEl.textContent = Math.floor(percent) + '%';
      }
    });
  }
}
