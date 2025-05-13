import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import { UndoAction } from "./globals";
import FeedsReaderPlugin from "./main";
import { renderControlsBar } from "./view/components/ControlsBarComponent";
import { renderFeedNavigation } from "./view/components/FeedNavigationComponent";
import { renderFeedItemsList, handleContentAreaClick as handleItemsListClick } from "./view/components/FeedItemsListComponent";
import { renderSingleItemContent } from "./view/components/FeedItemCardComponent";

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
  private readonly MAX_UNDO_STEPS = 20;

  public itemsPerPage = 20;
  private navHidden = false;

  // UI References
  private controlsEl!: HTMLElement;
  private navEl!: HTMLElement;
  public contentAreaEl!: HTMLElement;
  public actionIconsGroupEl!: HTMLElement; // Made public for components

  // Plugin Reference
  private plugin: FeedsReaderPlugin;

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
  }

  public createControlButtons(): void {
    renderControlsBar(this.actionIconsGroupEl, this, this.plugin);
  }

  private renderFeedList(): void {
    renderFeedNavigation(this.navEl, this, this.plugin);
  }

  public nextPage() {
    if (!this.currentFeed || !this.plugin.feedsStore[this.currentFeed]?.items) { new Notice("No feed selected."); return;}
    const feedContent = this.plugin.feedsStore[this.currentFeed];
    const itemsToShow = this.showAll ? feedContent.items : feedContent.items.filter(i => i.read === "0" && i.deleted === "0");
    const totalPages = Math.ceil(itemsToShow.length / this.itemsPerPage);
    if (this.currentPage < totalPages - 1) { this.currentPage++; this.renderFeedContent(); }
    else if (totalPages > 0) { new Notice("You are on the last page."); } // Only show if there are pages
    else { new Notice("No items to paginate."); }
  }
  public prevPage() {
    if (this.currentPage > 0) { this.currentPage--; this.renderFeedContent(); }
    else {
      const feedContent = this.plugin.feedsStore[this.currentFeed!]; // Should be safe if currentFeed is set
      if (feedContent?.items?.length > 0) new Notice("You are on the first page."); // Only show if there are items
    }  
  }

  public renderFeedContent(): void {
    if (!this.contentAreaEl ) { console.warn("Content area not ready."); return; }
      renderFeedItemsList(this.contentAreaEl, this, this.plugin);
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
}
