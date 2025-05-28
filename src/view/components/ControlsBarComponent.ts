import { Notice, setIcon } from 'obsidian';
import { FeedsReaderView } from '../../view';
import FeedsReaderPlugin from '../../main';
import { FRAddFeedModal } from '../../addFeedModal';
import { FRManageFeedsModal } from '../../manageFeedsModal';
import { FRSearchModal } from '../../searchModal';
import { FRHelpModal } from '../../helpModal';

/**
 * Renders a dynamic controls bar with interactive buttons for managing RSS feeds in the FeedsReader plugin view.
 *
 * Populates the provided container element with buttons for adding, managing, updating, and saving feeds. When a feed is selected, additional controls for searching, filtering, toggling content display, changing sort order, and undoing actions are shown. Button actions trigger modals, update feed data, and refresh the view as appropriate.
 *
 * @param controlsEl - The HTML element to populate with control buttons.
 * @param view - The current FeedsReader view instance.
 * @param plugin - The FeedsReader plugin instance.
 */
export function renderControlsBar(
  controlsEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  controlsEl.empty(); // Clear existing buttons

  const addBtn = controlsEl.createEl('button', {
    cls: 'clickable-icon',
    attr: { 'aria-label': 'Add new feed', title: 'Add new feed' },
  });
  setIcon(addBtn, 'plus');
  view.registerDomEvent(addBtn, 'click', () => new FRAddFeedModal(view.app, plugin).open());

  const manageBtn = controlsEl.createEl('button', {
    cls: 'clickable-icon',
    attr: { 'aria-label': 'Manage feeds', title: 'Manage feeds' },
  });
  setIcon(manageBtn, 'settings-2');
  view.registerDomEvent(manageBtn, 'click', () => new FRManageFeedsModal(view.app, plugin).open());

  const updateBtn = controlsEl.createEl('button', {
    cls: 'clickable-icon',
    attr: { 'aria-label': 'Update all feeds', title: 'Update all feeds' },
  });
  setIcon(updateBtn, 'refresh-ccw');
  // Delegate the heavy lifting to controller layer to keep UI lean
  view.registerDomEvent(updateBtn, 'click', async () => {
    const { updateAllFeeds } = await import('../../controller/updateAllFeeds');

    const progressNotice = new Notice('Fetching updates for all feeds…', 0);
    await updateAllFeeds(plugin, view, (m, t) => new Notice(m, t));
    progressNotice.hide();

    view.refreshView();
  });

  const saveBtn = controlsEl.createEl('button', {
    cls: 'clickable-icon',
    attr: { 'aria-label': 'Save feed data', title: 'Save feed data' },
  });
  setIcon(saveBtn, 'save');
  view.registerDomEvent(saveBtn, 'click', async () => {
    if (plugin.feedsStoreChange) {
      const savingNotice = new Notice('Saving data...', 0);
      try {
        await plugin.savePendingChanges(true);
      } catch (error: unknown) {
        new Notice(
          `Manual save failed. ${error instanceof Error ? error.message : String(error)}`,
          7000
        );
      } finally {
        savingNotice.hide();
      }
    } else {
      new Notice('No changes to save.');
    }
  });

  if (view.currentFeed && plugin.feedsStore[view.currentFeed]) {
    const searchBtn = controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Search in feed', title: 'Search in feed' },
    });
    setIcon(searchBtn, 'search');
    view.registerDomEvent(searchBtn, 'click', () => {
      if (view.currentFeed && plugin.feedsStore[view.currentFeed]) {
        new FRSearchModal(view.app, view.currentFeed, plugin).open();
      } else {
        new Notice('Please select a valid feed first.');
      }
    });

    const unreadBtn = controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Toggle unread / all', title: 'Toggle unread / all' },
    });
    const syncUnreadIcon = () => setIcon(unreadBtn, view.showAll ? 'filter' : 'filter-x');
    syncUnreadIcon();
    view.registerDomEvent(unreadBtn, 'click', () => {
      view.dispatchEvent({ type: 'ToggleShowAll' });
      syncUnreadIcon();
      view.renderFeedContent();
    });

    const contentBtn = controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Toggle title / content', title: 'Toggle title / content' },
    });
    const syncContentIcon = () =>
      setIcon(contentBtn, view.titleOnly ? 'layout-list' : 'layout-grid');
    syncContentIcon();
    view.registerDomEvent(contentBtn, 'click', () => {
      view.toggleTitleOnlyMode();
      syncContentIcon();
    });

    const orderBtn = controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Change sort order', title: 'Change sort order' },
    });
    const syncOrderIcon = () => {
      setIcon(
        orderBtn,
        view.itemOrder === 'New to old'
          ? 'sort-desc'
          : view.itemOrder === 'Old to new'
            ? 'sort-asc'
            : 'shuffle'
      );
    };
    syncOrderIcon();
    view.registerDomEvent(orderBtn, 'click', () => {
      view.dispatchEvent({ type: 'CycleItemOrder' });
      syncOrderIcon();
      view.renderFeedContent();
    });

    const undoBtn = controlsEl.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': 'Undo last action', title: 'Undo last action' },
    });
    setIcon(undoBtn, 'rotate-ccw');
    undoBtn.disabled = view.undoList.length === 0;
    view.registerDomEvent(undoBtn, 'click', () => view.handleUndo());
  }

  // ---------------------------------------------------------------------
  // Help button (keyboard shortcut guide) – always visible on the far right
  // ---------------------------------------------------------------------
  const helpBtn = controlsEl.createEl('button', {
    cls: 'clickable-icon',
    attr: { 'aria-label': 'Help / Shortcuts', title: 'Help / Shortcuts' },
  });
  setIcon(helpBtn, 'help-circle');
  view.registerDomEvent(helpBtn, 'click', () => {
    new FRHelpModal(view.app).open();
  });
}
