import { Notice } from 'obsidian';
import { FRAddFeedModal } from './addFeedModal';
import { FRManageFeedsModal } from './manageFeedsModal';
import { FRSearchModal } from './searchModal';
import { IFeedsReaderPlugin } from './pluginTypes';
import { FeedsReaderView } from './view';

export function registerCommands(plugin: IFeedsReaderPlugin): void {
  plugin.addCommand({
    id: 'open-feeds-reader',
    name: 'Open Feeds Reader',
    callback: async (): Promise<void> => {
      // Ensure activateView exists and call it
      if (typeof plugin.activateView === 'function') {
        await plugin.activateView();
      } else {
        console.error('activateView method not found on plugin instance.');
        new Notice('Could not open Feeds Reader view.');
      }
    },
  });

  plugin.addCommand({
    id: 'add-new-feed',
    name: 'Add New Feed…',
    callback: (): void => {
      new FRAddFeedModal(plugin.app, plugin).open();
    },
  });

  plugin.addCommand({
    id: 'manage-feeds',
    name: 'Manage Subscriptions…',
    callback: (): void => {
      new FRManageFeedsModal(plugin.app, plugin).open();
    },
  });

  plugin.addCommand({
    id: 'search-current-feed',
    name: 'Search In Current Feed…',
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(FeedsReaderView);
      const currentFeedName = view?.currentFeed;
      // Check if the feed name exists AND has data loaded in the plugin's store
      const canSearch = !!(currentFeedName && plugin.feedsStore[currentFeedName]?.items);

      if (checking) return canSearch;

      if (canSearch) {
        new FRSearchModal(plugin.app, currentFeedName, plugin).open();
      } else {
        new Notice('Please select a feed with loaded items first to search within it.');
      }
      return canSearch; // Return true only if action was taken (or could be taken)
    },
  });

  plugin.addCommand({
    id: 'next-page',
    name: 'Next Page',
    hotkeys: [{ modifiers: [], key: 'j' }],
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(FeedsReaderView);
      // Enable only if view exists and a feed is selected
      const canPage = !!view?.currentFeed;
      if (checking) return canPage;
      if (view) {
        view.nextPage();
      } // Call method if view exists
      return true; // Command executed (or attempted)
    },
  });

  plugin.addCommand({
    id: 'prev-page',
    name: 'Previous Page',
    hotkeys: [{ modifiers: [], key: 'k' }],
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(FeedsReaderView);
      const canPage = !!view?.currentFeed;
      if (checking) return canPage;
      if (view) {
        view.prevPage();
      }
      return true;
    },
  });
}
