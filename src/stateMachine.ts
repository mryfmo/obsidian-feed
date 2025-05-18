/*
 * Feeds Reader – Finite-State Machine (FSM)
 * ---------------------------------------------------------------
 * A single authority that governs UI state transitions.  The view
 * layer dispatches high-level events; the FSM mutates immutable
 * state and emits pure *Effects* that the host (FeedsReaderView)
 * performs (DOM render, open modal, fetch network, …).
 *
 *   state, effects = reducer(prevState, event)
 *
 * Keeping the reducer pure and deterministic enables time-travel
 * debugging, easily exercised unit tests and future persistence of
 * UI session state if desired.
 * ------------------------------------------------------------- */

export type ViewStyle = "card" | "list";
export type ItemOrder = "New to old" | "Old to new" | "Random";

/* --------------------------------------------------------------------
 * State definition
 * ------------------------------------------------------------------ */
export interface ViewState {
  currentFeed: string | null;
  mixedView: boolean;
  navHidden: boolean;
  viewStyle: ViewStyle;
  titleOnly: boolean;
  showAll: boolean;
  itemOrder: ItemOrder;
  currentPage: number;
  expandedItems: Set<string>;
  selectedIndex: number;
  navSelectedIndex: number;
}

export const createInitialState = (defaults?: Partial<ViewState>): ViewState => ({
  currentFeed: null,
  mixedView: false,
  navHidden: false,
  viewStyle: "card",
  titleOnly: true,
  showAll: false,
  itemOrder: "New to old",
  currentPage: 0,
  expandedItems: new Set<string>(),
  selectedIndex: 0,
  navSelectedIndex: 0,
  ...defaults,
});

/* --------------------------------------------------------------------
 * Events – discrete, high-level user or system interactions
 * ------------------------------------------------------------------ */
export type Event =
  | { type: "ToggleNav" }
  | { type: "ToggleMixedView" }
  | { type: "ToggleTitleOnly" }
  | { type: "SetViewStyle"; style: ViewStyle }
  | { type: "SelectFeed"; feed: string | null }
  | { type: "ToggleShowAll" }
  | { type: "CycleItemOrder" }
  | { type: "NextPage"; hasMore: boolean }
  | { type: "PrevPage" }
  | { type: "ExpandItem"; id: string }
  | { type: "CollapseItem"; id: string };

/* --------------------------------------------------------------------
 * Effects – side-effects the host environment must execute *after*
 *   the state transition has been accepted.
 * ------------------------------------------------------------------ */
export type Effect =
  | { type: "Render" }
  | { type: "ResetFeedSpecificState" }
  | { type: "OpenModal"; modal: "Add" | "Manage" | "Search" | "Help" }
  | { type: "FetchFeeds" }
  | { type: "SaveFeeds" };

/* --------------------------------------------------------------------
 * Reducer – pure function (state, event) → [newState, effects[]]
 * ------------------------------------------------------------------ */
export function reducer(prev: ViewState, event: Event): [ViewState, Effect[]] {
  // Clone shallowly – sets/maps need explicit copy.
  const state: ViewState = { ...prev, expandedItems: new Set(prev.expandedItems) };
  const effects: Effect[] = [];

  const render = () => {
    if (!effects.find(e => e.type === "Render")) effects.push({ type: "Render" });
  };

  switch (event.type) {
    case "ToggleNav": {
      state.navHidden = !state.navHidden;
      render();
      break;
    }
    case "ToggleMixedView": {
      state.mixedView = !state.mixedView;
      state.currentFeed = null;
      state.currentPage = 0;
      effects.push({ type: "ResetFeedSpecificState" });
      render();
      break;
    }
    case "ToggleTitleOnly": {
      state.titleOnly = !state.titleOnly;
      if (state.titleOnly) {
        // Keep only currently selected item (by index) expanded – assumed to
        // be handled by host; here we just clear the set.
        state.expandedItems.clear();
      }
      render();
      break;
    }
    case "SetViewStyle": {
      if (state.viewStyle !== event.style) {
        state.viewStyle = event.style;
        render();
      }
      break;
    }
    case "ToggleShowAll": {
      state.showAll = !state.showAll;
      render();
      break;
    }
    case "SelectFeed": {
      if (state.currentFeed !== event.feed) {
        state.currentFeed = event.feed;
        state.currentPage = 0;
        state.expandedItems.clear();
        state.selectedIndex = 0;
        effects.push({ type: "ResetFeedSpecificState" });
        render();
      }
      break;
    }
    case "CycleItemOrder": {
      state.itemOrder = state.itemOrder === "New to old" ? "Old to new" : state.itemOrder === "Old to new" ? "Random" : "New to old";
      render();
      break;
    }
    case "NextPage": {
      if (event.hasMore) {
        state.currentPage += 1;
        state.selectedIndex = 0;
        render();
      }
      break;
    }
    case "PrevPage": {
      if (state.currentPage > 0) {
        state.currentPage -= 1;
        state.selectedIndex = 0;
        render();
      }
      break;
    }
    case "ExpandItem": {
      state.expandedItems.add(event.id);
      render();
      break;
    }
    case "CollapseItem": {
      state.expandedItems.delete(event.id);
      render();
      break;
    }
  }

  return [state, effects];
}

/* --------------------------------------------------------------------
 * Convenience helper the host can use to query read-only flags.
 * ------------------------------------------------------------------ */
export const selectors = {
  isItemExpanded: (state: ViewState, id: string) => state.expandedItems.has(id),
};
