import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { UndoAction } from './globals';
import { IFeedsReaderPlugin } from './pluginTypes';
import { IFeedsReaderView } from './view/types';
import { renderControlsBar } from './view/components/ControlsBarComponent';
import { renderFeedNavigation } from './view/components/FeedNavigationComponent';
import {
  renderFeedItemsList,
  handleContentAreaClick as handleItemsListClick,
} from './view/components/FeedItemsListComponent';

import { renderFeedItemsCard } from './view/components/FeedItemsCardComponent';
import { renderItemMarkdown as renderSingleItemContent } from './view/components/FeedItemBase';
import { isVisibleItem } from './utils';
import { RssFeedItem, RssFeedContent } from './types';
// Centralized FSM – governs view state & side-effects
import {
  reducer as viewReducer,
  createInitialState,
  Event as ViewEvent,
  ViewState,
  ViewStyle,
} from './stateMachine';

export const VIEW_TYPE_FEEDS_READER = 'feeds-reader-view';

export class FeedsReaderView extends ItemView implements IFeedsReaderView {
  // View-Specific State
  public currentFeed: string | null = null;

  public showAll: boolean = false;

  public titleOnly: boolean = true;

  public itemOrder: 'New to old' | 'Old to new' | 'Random' = 'New to old';

  public currentPage: number = 0;

  public undoList: UndoAction[] = [];

  public expandedItems: Set<string> = new Set();

  private selectedIndex: number = -1; // index within currently rendered page

  private focusArea: 'content' | 'nav' = 'content';

  public navSelectedIndex: number = 0;

  private readonly MAX_UNDO_STEPS = 20;

  /** Cached scroll callback so we attach it only once per view lifecycle. */
  private _scrollCb?: () => void;

  /** Timestamp of the last "reading progress" update – used to throttle the
   *  expensive calculations that run on every scroll event. */
  private _lastProgressUpdate = 0;

  public itemsPerPage = 20;

  private navHidden = false;

  /**
   * Returns the list of items currently in scope for the view, already filtered
   * by `showAll` (read / deleted) flag.  This is used both for pagination
   * calculations and for actual rendering (via `renderFeedContent`).  Keeping
   * the logic in one place guarantees that the two stay in sync.
   */
  private getVisibleItems(): Array<
    RssFeedItem & { __sourceFeed?: string; __sourceFeedName?: string }
  > {
    let pool: Array<RssFeedItem & { __sourceFeed?: string; __sourceFeedName?: string }> = [];

    if (this.fsm.mixedView) {
      for (const [feedName, feedContent] of Object.entries(this.plugin.feedsStore) as [
        string,
        RssFeedContent,
      ][]) {
        const title = feedContent.title || '(unknown)';
        pool = pool.concat(
          feedContent.items.map((item: RssFeedItem) => ({
            ...item,
            __sourceFeed: title,
            __sourceFeedName: feedName,
          }))
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
  public plugin: IFeedsReaderPlugin;

  /** Finite-state machine representing the UI state.  Acts as the single
   *  source of truth; legacy class properties proxy selected fields for now
   *  to avoid a massive refactor. */
  private fsm: ViewState;

  constructor(leaf: WorkspaceLeaf, plugin: IFeedsReaderPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.icon = 'rss';
    this.itemsPerPage = this.plugin.settings.nItemPerPage ?? 20;

    // Seed FSM with persisted settings
    this.fsm = createInitialState({
      viewStyle: this.plugin.settings.viewStyle,
      titleOnly: this.plugin.settings.defaultTitleOnly ?? true,
      mixedView: this.plugin.settings.mixedFeedView,
    });

    // Keep legacy fields in sync for incremental migration
    this.syncLegacyFieldsFromFsm();
  }

  getViewType(): string {
    return VIEW_TYPE_FEEDS_READER;
  }

  getDisplayText(): string {
    this.itemsPerPage = this.plugin.settings.nItemPerPage ?? 20;
    return 'Feeds Reader';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('fr-view-container');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';

    this.controlsEl = container.createEl('div', { cls: 'fr-controls-bar' });
    const mainArea = container.createEl('div', { cls: 'fr-main-area' });
    mainArea.style.display = 'flex';
    mainArea.style.flexGrow = '1';
    mainArea.style.overflow = 'hidden';

    this.navEl = mainArea.createEl('div', { cls: 'fr-nav', attr: { id: 'fr-nav' } });
    this.contentAreaEl = mainArea.createEl('div', {
      cls: 'fr-content-area',
      attr: { id: 'fr-content' },
    });
    this.contentAreaEl.style.flexGrow = '1';
    this.contentAreaEl.style.overflowY = 'auto';
    this.navEl.style.overflowY = 'auto';
    this.actionIconsGroupEl = this.controlsEl.createEl('div', { cls: 'fr-action-icons-group' });
    this.actionIconsGroupEl.style.cssText =
      'display: flex; flex-grow: 1; justify-content: flex-end;';

    this.currentFeed = null;
    this.showAll = false;
    // Start in the persisted layout preference.
    this.titleOnly = this.plugin.settings.defaultTitleOnly ?? true;
    this.itemOrder = 'New to old';
    this.currentPage = 0;
    this.undoList = [];
    this.expandedItems = new Set();

    this.navEl.hidden = this.navHidden;

    // Nav toggle button - should be part of controlsEl, not actionIconsGroupEl if it's at the far left
    const navBtn = this.controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Toggle Feed List Sidebar' },
    });
    this.controlsEl.insertBefore(navBtn, this.actionIconsGroupEl);
    const syncNavIcon = (): void =>
      setIcon(navBtn, this.navEl.hidden ? 'panel-left-open' : 'panel-left-close');
    syncNavIcon();
    this.registerDomEvent(navBtn, 'click', (): void => {
      this.dispatch({ type: 'ToggleNav' });
      // navHidden mirrored into legacy field inside dispatch
      this.navEl.hidden = this.fsm.navHidden;
      syncNavIcon();
    });

    // -------------------------------------------------------------------
    // Unified-view toggle (mixed ↔ per-feed)
    // -------------------------------------------------------------------
    const mixedBtn = this.controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Toggle unified timeline' },
    });
    // Place it just before the nav button so it is the very left-most.
    this.controlsEl.insertBefore(mixedBtn, navBtn);
    // Reflect FSM state, not persisted settings, to avoid stale UI after
    // programmatic changes.  The icon depicts *list* when the **unified
    // timeline** (mixed view) is active and the classic *rss* icon when
    // browsing a single feed.
    const syncMixedIcon = (): void =>
      setIcon(mixedBtn, this.fsm.mixedView ? 'circle-chevron-down' : 'circle-chevron-right');
    syncMixedIcon();
    this.registerDomEvent(mixedBtn, 'click', async (): Promise<void> => {
      this.dispatch({ type: 'ToggleMixedView' });

      // Persist preference so the view re-opens in the same mode next time.
      this.plugin.settings.mixedFeedView = this.fsm.mixedView;
      await this.plugin.saveSettings();

      this.navEl.hidden = this.fsm.navHidden; // may stay unchanged

      // If the unified timeline has just been enabled we need to ensure all
      // subscribed feeds are loaded before rendering, otherwise the list will
      // appear empty until the user manually refreshes.
      if (this.fsm.mixedView) {
        const loadingNotice = new Notice('Loading feeds…', 0);
        (async (): Promise<void> => {
          for (const feedInfo of this.plugin.feedList) {
            try {
              await this.plugin.ensureFeedDataLoaded(feedInfo.name);
            } catch (err: unknown) {
              console.error(`FeedsReaderView: Failed to load data for '${feedInfo.name}'.`, err);
            }
          }
          loadingNotice.hide();
          this.refreshView();
          syncMixedIcon();
        })();
      } else {
        // Leaving unified view – reset selection so controls update properly.
        this.refreshView();
        syncMixedIcon();
      }
    });

    this.createControlButtons();
    // Show an initial placeholder only when browsing per-feed.  In *mixed
    // view* the list will instead be populated asynchronously once the
    // individual feeds are loaded so displaying the prompt would be
    // misleading.
    if (!this.fsm.mixedView) {
      this.contentAreaEl.setText('Select a feed from the list.');
    }

    // ---------------------------------------------------------------
    // "Unified timeline" start-up experience
    // ---------------------------------------------------------------
    // When the user has enabled *Mixed Feed View* in the settings they
    // expect to see a global timeline straight away – not a prompt to select
    // a single feed.  We therefore load (lazily, from disk) the stored JSON
    // for every subscribed feed and, once ready, render the combined list.
    // This runs **after** the initial synchronous layout so the UI paints
    // instantly and the loading work happens asynchronously.
    //
    // • If there are many feeds the operation may take a little while.  A
    //   non-blocking Notice gives feedback without freezing the interface.
    // • Any feeds that fail to load are skipped; an error is logged but the
    //   rest of the timeline still appears.
    // ---------------------------------------------------------------

    if (this.fsm.mixedView) {
      const loadingNotice = new Notice('Loading feeds…', 0);
      (async (): Promise<void> => {
        for (const feedInfo of this.plugin.feedList) {
          try {
            await this.plugin.ensureFeedDataLoaded(feedInfo.name);
          } catch (err: unknown) {
            console.error(`FeedsReaderView: Failed to load data for '${feedInfo.name}'.`, err);
          }
        }
        loadingNotice.hide();
        // If no items end up available fall back to a friendly placeholder
        // inside renderFeedContent().
        this.renderFeedContent();
      })();
    }

    this.renderFeedList();
    this.registerDomEvent(this.contentAreaEl, 'click', (event): void => {
      handleItemsListClick(event, this, this.plugin);
    });

    // Register a single scroll listener for reading-progress updates. Guard to
    // ensure we don't attach multiple listeners if onOpen somehow executes
    // more than once (shouldn't happen, but defensive).
    if (!this._scrollCb) {
      this._scrollCb = (): void => this.updateReadingProgress();
      this.registerDomEvent(this.contentAreaEl, 'scroll', this._scrollCb);
    }

    // Keyboard navigation
    this.registerDomEvent(this.containerEl.ownerDocument, 'keydown', (e: KeyboardEvent): void =>
      this.handleKeyDown(e)
    );
  }

  public createControlButtons(): void {
    renderControlsBar(this.actionIconsGroupEl, this, this.plugin);
  }

  /* ------------------------------------------------------------
   * FSM Dispatch helper – routes events through reducer and applies
   * resulting state & effects.
   * ---------------------------------------------------------- */
  private dispatch(event: ViewEvent): void {
    const [nextState, effects] = viewReducer(this.fsm, event);
    this.fsm = nextState;
    this.syncLegacyFieldsFromFsm();

    // Minimal effect interpreter – extend as migrations progress
    for (const ef of effects) {
      switch (ef.type) {
        case 'Render':
          this.renderFeedContent();
          break;
        case 'ResetFeedSpecificState':
          this.resetFeedSpecificViewState();
          break;
        default:
          break;
      }
    }
  }

  // Expose a safe wrapper for external components (ControlsBar, etc.)
  public dispatchEvent(event: unknown): void {
    this.dispatch(event as ViewEvent);
  }

  /** Bridges old public fields ↔新 FSM.  Call after every dispatch. */
  private syncLegacyFieldsFromFsm(): void {
    const s = this.fsm;
    this.currentFeed = s.currentFeed;
    this.showAll = s.showAll;
    this.titleOnly = s.titleOnly;
    this.itemOrder = s.itemOrder;
    this.currentPage = s.currentPage;
    this.expandedItems = s.expandedItems;
    this.navHidden = s.navHidden;
  }

  public renderFeedList(): void {
    renderFeedNavigation(this.navEl, this, this.plugin);
  }

  /** Public, read-only accessor so view sub-components can reliably query
   *  whether the unified timeline is active without poking at private
   *  implementation details or the plugin settings object. */
  public isMixedViewEnabled(): boolean {
    return this.fsm.mixedView;
  }

  public nextPage(): void {
    const items = this.getVisibleItems();
    if (items.length === 0) {
      new Notice('No items to paginate.');
      return;
    }

    const totalPages = Math.ceil(items.length / this.itemsPerPage);
    if (this.currentPage < totalPages - 1) {
      this.currentPage += 1;
      this.renderFeedContent();
    } else {
      new Notice('You are on the last page.');
    }
  }

  public prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage -= 1;
      this.renderFeedContent();
    } else if (this.getVisibleItems().length > 0) {
      // Only notify if there is at least one page worth of items
      new Notice('You are on the first page.');
    }
  }

  public renderFeedContent(): void {
    const contentEl = this.contentAreaEl;
    contentEl.empty();

    const items = this.getVisibleItems();

    /*
     * Ensure the currently selected page is still valid after the underlying
     * item pool has changed (e.g. a feed was added/removed while the viewer
     * is in *mixed* mode).  Without this guard the list could end up empty
     * and show the misleading "No more items" placeholder although there
     * are entries available on an earlier page.
     */
    if (this.itemsPerPage > 0) {
      const totalPages = items.length === 0 ? 1 : Math.ceil(items.length / this.itemsPerPage);
      if (this.currentPage >= totalPages) {
        this.currentPage = Math.max(0, totalPages - 1);
      }
    }

    if (!this.fsm.mixedView && !this.currentFeed) {
      contentEl.setText('No feed selected to display items.');
      return;
    }

    if (!this.contentAreaEl) {
      console.warn('Content area not ready.');
      return;
    }

    // Delegate to the renderer that matches the current view style.
    if (this.fsm.viewStyle === 'card') {
      renderFeedItemsCard(this.contentAreaEl, items, this, this.plugin);
    } else {
      renderFeedItemsList(this.contentAreaEl, items, this, this.plugin);
    }

    // reset selection to first item of page
    // Preserve selection if already valid. When called from interactions like
    // toggling between *title* and *content* view, keeping the current
    // selection intact provides better ergonomics because the user stays on
    // the item they were just reading.  If the previous selectedIndex is out
    // of range for the newly rendered list (different page length, etc.) we
    // fall back to the first item.
    if (this.selectedIndex < 0 || this.selectedIndex >= items.length) {
      this.selectedIndex = 0;
    }
    this.highlightSelected();
  }

  /**
   * Toggle between "title-only" (collapsed) mode and full-content mode.
   *
   * Behavior requirements (UX):
   *   • title → content : every item should reveal its content.
   *   • content → title : only the *currently focused* item remains expanded
   *     so that the reader preserves context while collapsing distraction.
   */
  public toggleTitleOnlyMode(): void {
    this.dispatch({ type: 'ToggleTitleOnly' });

    // Persist user preference asynchronously
    if (this.plugin.settings.defaultTitleOnly !== this.titleOnly) {
      this.plugin.settings.defaultTitleOnly = this.titleOnly;
      this.plugin
        .saveSettings()
        .catch((err: unknown) =>
          console.error('FeedsReaderView: Failed to persist defaultTitleOnly', err)
        );
    }
  }

  /**
   * Expand/collapse a given item by ID.
   *
   * This helper previously required a valid `currentFeed` which broke
   * functionality in *mixed* (unified) view because that mode has no single
   * active feed.  The guard has therefore been removed and the missing item
   * data is now resolved on-demand by searching **all** feeds – a cheap
   * operation as the dataset is already available in-memory.
   */
  public toggleItemExpansion(itemId: string): void {
    if (!itemId) return;

    if (!this.expandedItems) this.expandedItems = new Set();

    const itemDiv = this.contentAreaEl.querySelector(`.fr-item[data-item-id="${itemId}"]`);
    if (!itemDiv) return;

    const contentEl = itemDiv.querySelector('.fr-item-content') as HTMLElement | null;

    const collapse = itemDiv.classList.contains('expanded');

    if (collapse) {
      itemDiv.classList.remove('expanded');
      this.expandedItems.delete(itemId);
      this.dispatch({ type: 'CollapseItem', id: itemId });
      if (contentEl && this.titleOnly) contentEl.hidden = true;
    } else {
      itemDiv.classList.add('expanded');
      this.expandedItems.add(itemId);
      this.dispatch({ type: 'ExpandItem', id: itemId });

      if (contentEl) {
        contentEl.hidden = false;

        // Lazily render Markdown if it has not been rendered before.
        if (contentEl.childNodes.length === 0) {
          let itemData: import('./types').RssFeedItem | undefined;

          if (this.currentFeed) {
            itemData = this.plugin.feedsStore[this.currentFeed]?.items.find(
              (i: RssFeedItem) => i.id === itemId
            );
          } else {
            // Mixed view – walk every feed once to locate the item.
            for (const feed of Object.values(this.plugin.feedsStore) as RssFeedContent[]) {
              const found = feed.items.find((i: RssFeedItem) => i.id === itemId);
              if (found) {
                itemData = found;
                break;
              }
            }
          }

          if (itemData) {
            renderSingleItemContent(itemData, contentEl, this.plugin);
          }
        }
      }
    }

    // Sync keyboard selection with the element the user just interacted with.
    this.setSelectedItemById(itemId);
  }

  public pushUndo(action: UndoAction): void {
    this.undoList.push(action);
    if (this.undoList.length > this.MAX_UNDO_STEPS) {
      this.undoList.shift();
    }
    this.updateUndoButtonState();
  }

  public updateUndoButtonState(): void {
    const undoBtn = this.actionIconsGroupEl.querySelector(
      'button[aria-label="Undo last action"]'
    ) as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = this.undoList.length === 0;
  }

  public refreshView(): void {
    // Ensure view style follows the latest persisted setting.  When the user
    // changes the display layout (card ↔ list) in the plugin *Settings* panel
    // the open views need to reflect the choice immediately.  The settings
    // tab already triggers `plugin.saveSettings()` which calls this method
    // for every active view.  Here we reconcile the FSM with the new
    // persisted preference.
    // ------------------------------------------------------------------
    // Synchronize persisted *Settings* → FSM
    // ------------------------------------------------------------------
    const prevStyle = this.fsm.viewStyle;
    if (prevStyle !== this.plugin.settings.viewStyle) {
      // The dispatch will emit a "Render" effect which re-draws the content
      // area in the newly chosen layout. We therefore must *not* re-render
      // once more below or the work would be duplicated (flicker & waste).
      this.dispatch({ type: 'SetViewStyle', style: this.plugin.settings.viewStyle as ViewStyle });
    }

    // --------------------------------------------------------------
    // Always refresh side-bar navigation – its appearance does not
    // depend on the content layout, yet the underlying subscription
    // list might have changed while the settings tab was open.
    // --------------------------------------------------------------
    this.renderFeedList();

    // Skip an extra content render when it has *already* been done by the
    // FSM effect above.  Saves a full traversal / DOM diff pass.
    const styleChanged = prevStyle !== this.fsm.viewStyle;

    if (!styleChanged) {
      if (this.fsm.mixedView) {
        // Unified timeline renders regardless of currentFeed selection.
        this.renderFeedContent();
      } else if (this.currentFeed) {
        this.renderFeedContent();
      } else if (this.contentAreaEl) {
        // Per-feed mode with nothing selected → friendly prompt.
        this.contentAreaEl.setText('Select a feed from the list.');
      }
    }

    // Controls (title-only toggle, etc.) can be recreated unconditionally –
    // their construction is inexpensive compared to full content rendering.
    this.createControlButtons();
  }

  public resetFeedSpecificViewState(): void {
    this.showAll = false;
    this.titleOnly = true;
    this.itemOrder = 'New to old';
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
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        (active as HTMLElement).isContentEditable)
    )
      return;

    const { key } = e;
    // Allow tab to toggle focus between nav and content
    if (key === 'Tab') {
      e.preventDefault();
      this.toggleFocusArea();
      return;
    }

    const jOrDown = key === 'j' || key === 'ArrowDown';
    const kOrUp = key === 'k' || key === 'ArrowUp';
    const enterOrO = key === 'Enter' || key === 'o';
    const markKey = key === 'r';
    const delKey = key === 'd';
    // Note: On some browsers / keyboard layouts the space bar reports
    // "space bar" instead of a single space character.  Handle both to
    // ensure cross-platform consistency.
    const nextPageKey = key === 'PageDown' || key === ' ' || key === 'Spacebar';
    const prevPageKey = key === 'PageUp';

    if (!(jOrDown || kOrUp || enterOrO || markKey || delKey || nextPageKey || prevPageKey)) return;
    if (this.focusArea === 'nav') {
      this.handleNavKey(jOrDown, kOrUp, enterOrO);
      return;
    }

    // Prevent default to keep page from scrolling etc.
    e.preventDefault();

    if (nextPageKey) {
      this.nextPage();
      this.selectedIndex = 0;
      this.highlightSelected();
      return;
    }
    if (prevPageKey) {
      this.prevPage();
      this.selectedIndex = 0;
      this.highlightSelected();
      return;
    }

    const currentItems = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>('.fr-item'));
    if (currentItems.length === 0) return;

    if (this.selectedIndex < 0 || this.selectedIndex >= currentItems.length) {
      this.selectedIndex = 0;
    }

    if (jOrDown) {
      if (this.selectedIndex < currentItems.length - 1) {
        this.selectedIndex += 1;
        this.highlightSelected();
      } else {
        // end of list, advance page
        this.nextPage();
        this.selectedIndex = 0;
        this.highlightSelected();
      }
      return;
    }

    if (kOrUp) {
      if (this.selectedIndex > 0) {
        this.selectedIndex -= 1;
        this.highlightSelected();
      } else {
        // top of list, previous page
        const prevPage = this.currentPage;
        this.prevPage();
        if (this.currentPage !== prevPage) {
          const itemsAfter = Array.from(
            this.contentAreaEl.querySelectorAll<HTMLElement>('.fr-item')
          );
          this.selectedIndex = itemsAfter.length - 1;
          this.highlightSelected();
        }
      }
      return;
    }

    const selectedItemEl = currentItems[this.selectedIndex];
    const itemId = selectedItemEl?.dataset.itemId;

    // "Enter" / "o" should work even in mixed view where `currentFeed` is
    // intentionally `null`.  Other actions (mark, delete) still require an
    // active feed context.
    if (enterOrO) {
      if (itemId) this.toggleItemExpansion(itemId);
      return;
    }

    // The remaining actions operate on item metadata and need feed context
    if (!itemId) return;

    // Find which feed contains this item
    let feedName = this.currentFeed;
    let item: RssFeedItem | undefined;

    if (feedName) {
      // Single feed view
      item = this.plugin.feedsStore[feedName]?.items.find((i: RssFeedItem) => i.id === itemId);
    } else if (this.fsm.mixedView) {
      // Mixed view - search all feeds
      for (const [fname, feedContent] of Object.entries(this.plugin.feedsStore) as [
        string,
        RssFeedContent,
      ][]) {
        const found = feedContent.items.find((i: RssFeedItem) => i.id === itemId);
        if (found) {
          item = found;
          feedName = fname;
          break;
        }
      }
    }

    if (!item || !feedName) return;

    if (markKey) {
      const newReadState = item.read === '0';
      if (this.plugin.markItemReadState(feedName, itemId, newReadState)) {
        this.pushUndo({
          feedName,
          itemId: item.id!,
          action: newReadState ? 'unread' : 'read',
          previousState: newReadState ? '0' : item.read,
        });
        this.renderFeedContent();
        this.highlightSelected();
      }
      return;
    }

    if (delKey) {
      const newDeletedState = item.deleted === '0';
      if (this.plugin.markItemDeletedState(feedName, itemId, newDeletedState)) {
        this.pushUndo({
          feedName,
          itemId: item.id!,
          action: newDeletedState ? 'deleted' : 'undeleted',
          previousState: newDeletedState ? '0' : item.deleted,
        });
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
    const items = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>('.fr-item'));
    const idx = items.findIndex(el => el.dataset.itemId === itemId);
    if (idx !== -1) {
      this.selectedIndex = idx;
      this.highlightSelected();
    }
  }

  private highlightSelected(): void {
    const items = Array.from(this.contentAreaEl.querySelectorAll<HTMLElement>('.fr-item'));
    items.forEach((el, idx) => {
      if (idx === this.selectedIndex) el.classList.add('fr-item-selected');
      else el.classList.remove('fr-item-selected');
    });

    const selectedEl = items[this.selectedIndex];
    if (selectedEl) {
      // Ensure the element can receive focus and move actual DOM focus so
      // that assistive technologies pick up the change and standard
      // keyboard navigation (e.g. pressing Space on a button inside the
      // item) works without an extra click.
      if (!selectedEl.hasAttribute('tabindex')) {
        selectedEl.setAttribute('tabindex', '-1');
      }
      (selectedEl as HTMLElement).focus({ preventScroll: true });
      selectedEl.scrollIntoView({ block: 'nearest' });
      // Mark aria-selected for better SR support
      items.forEach(el => el.setAttribute('aria-selected', 'false'));
      selectedEl.setAttribute('aria-selected', 'true');
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
    const feeds = Array.from(this.navEl.querySelectorAll<HTMLElement>('.fr-feed-item'));
    if (feeds.length === 0) return;

    if (down) {
      this.navSelectedIndex = (this.navSelectedIndex + 1) % feeds.length;
      this.highlightNav();
      return;
    }
    if (up) {
      this.navSelectedIndex = (this.navSelectedIndex - 1 + feeds.length) % feeds.length;
      this.highlightNav();
      return;
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
    const feeds = Array.from(this.navEl.querySelectorAll<HTMLElement>('.fr-feed-item'));
    if (feeds.length === 0) return;
    if (this.navSelectedIndex >= feeds.length) this.navSelectedIndex = feeds.length - 1;
    if (this.navSelectedIndex < 0) this.navSelectedIndex = 0;

    feeds.forEach((el, idx) => {
      if (idx === this.navSelectedIndex) el.classList.add('fr-feed-item-selected');
      else el.classList.remove('fr-feed-item-selected');
    });
    feeds[this.navSelectedIndex].scrollIntoView({ block: 'nearest' });
  }

  private clearNavHighlight(): void {
    this.navEl
      .querySelectorAll<HTMLElement>('.fr-feed-item-selected')
      .forEach(el => el.classList.remove('fr-feed-item-selected'));
  }

  public resetToDefaultState(): void {
    // console.log("FeedsReaderView: Resetting to default state.");
    this.currentFeed = null;
    this.resetFeedSpecificViewState();
    if (!this.fsm.mixedView && this.contentAreaEl) {
      this.contentAreaEl.setText('Select a feed from the list.');
    }
    this.createControlButtons();
    this.renderFeedList();
  }

  public handleUndo(): void {
    if (this.undoList.length === 0) {
      new Notice('Nothing to undo.');
      return;
    }
    const lastAction = this.undoList.pop();
    this.updateUndoButtonState();

    // In mixed view, we don't have a single currentFeed context
    const isMixedView = this.fsm.mixedView;

    // For single feed view, validate feed context
    if (!isMixedView && lastAction?.feedName && this.currentFeed !== lastAction.feedName) {
      if (lastAction) this.pushUndo(lastAction); // Put it back if context is wrong
      new Notice('Cannot undo: Action is for a different feed.');
      return;
    }

    if (!lastAction) {
      new Notice('Cannot undo: Invalid action.');
      return;
    }

    let actionUndone = false;
    let noticeMessage = '';
    const affectedFeeds = new Set<string>();

    if (lastAction.action === 'markAllRead' && lastAction.previousStates) {
      // Handle markAllRead with enhanced previousStates that include feedName
      lastAction.previousStates.forEach(prevState => {
        const feedName = prevState.feedName || lastAction.feedName;
        if (!feedName) return;

        const itemToUndo = this.plugin.feedsStore[feedName]?.items.find(
          (i: RssFeedItem) => i.id === prevState.itemId
        );
        if (itemToUndo) {
          itemToUndo.read = prevState.readState;
          actionUndone = true;
          affectedFeeds.add(feedName);
        }
      });
      if (actionUndone) {
        noticeMessage = `Reverted "mark all read" for ${lastAction.previousStates.length} items.`;
      }
    } else if (lastAction.itemId) {
      // Single item undo - need to find which feed contains this item
      let targetFeedName = lastAction.feedName;
      let itemToUndo: RssFeedItem | undefined;

      if (targetFeedName && this.plugin.feedsStore[targetFeedName]) {
        // Try the specified feed first
        itemToUndo = this.plugin.feedsStore[targetFeedName].items.find(
          (i: RssFeedItem) => i.id === lastAction.itemId
        );
      }

      // If not found and we're in mixed view, search all feeds
      if (!itemToUndo && isMixedView) {
        for (const [feedName, feedContent] of Object.entries(this.plugin.feedsStore)) {
          const found = feedContent.items.find((i: RssFeedItem) => i.id === lastAction.itemId);
          if (found) {
            itemToUndo = found;
            targetFeedName = feedName;
            break;
          }
        }
      }

      if (itemToUndo && targetFeedName && lastAction.previousState !== undefined) {
        if (lastAction.action === 'read' || lastAction.action === 'unread') {
          itemToUndo.read = lastAction.previousState;
          noticeMessage = `Item "${itemToUndo.title?.substring(0, 20)}..." read state reverted.`;
          actionUndone = true;
        } else if (lastAction.action === 'deleted' || lastAction.action === 'undeleted') {
          itemToUndo.deleted = lastAction.previousState;
          noticeMessage = `Item "${itemToUndo.title?.substring(0, 20)}..." delete state reverted.`;
          actionUndone = true;
        }
        if (actionUndone) {
          affectedFeeds.add(targetFeedName);
        }
      }
    }

    if (actionUndone) {
      // Flag changes for all affected feeds
      affectedFeeds.forEach(feedName => this.plugin.flagChangeAndSave(feedName));
      this.refreshView();
      new Notice(noticeMessage || 'Action undone.');
    } else {
      if (lastAction) this.pushUndo(lastAction);
      new Notice('Could not undo: Item not found or context issue.');
    }
  }

  public updateReadingProgress(): void {
    // -------------------------------------------------------------------
    // Performance optimization – *throttle* expensive BoundingClientRect
    // calculations so that we run them at most every ~120 ms.  Continuous
    // scroll events can fire rapidly (~60 Hz).  Without throttling we were
    // doing a DOM query + rect maths for *every* event which caused heavy
    // main-thread work and – on large item lists – made the UI feel
    // sluggish and sometimes completely unresponsive to the mouse.  By
    // short-circuiting calls that happen within the cool-down window we keep
    // the progress indicator sufficiently up-to-date **while restoring
    // smooth pointer/scroll interaction**.
    // -------------------------------------------------------------------

    const THROTTLE_MS = 120;
    const now = performance.now();
    if (this._lastProgressUpdate && now - this._lastProgressUpdate < THROTTLE_MS) {
      return; // Skip – last update was recent enough.
    }
    this._lastProgressUpdate = now;

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
              Math.max(containerRect.top, contentRect.top)
          );

          percent = contentRect.height === 0 ? 0 : (intersectHeight / contentRect.height) * 100;
        }
        progressEl.textContent = `${Math.floor(percent)}%`;
      }
    });
  }
}
