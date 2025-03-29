// --- START OF FILE view.ts ---

import { ItemView, WorkspaceLeaf, Notice, App } from "obsidian"; // Import App type
import { GLB } from "./globals";
// Removed direct imports of functions, will use plugin instance methods
// import { saveFeedsData, loadSubscriptions, loadFeedsStoredData, createFeedBar, show_feed, makeDisplayList } from "./main";
import FeedsReader from "./main"; // Import the plugin class itself

export const VIEW_TYPE_FEEDS_READER = "feeds-reader-view";
// ★★★ Constant Plugin ID ★★★
const PLUGIN_ID = 'feeds-reader';

export class FRView extends ItemView {
  // Explicitly declare app property (inherited from ItemView)
  // app: App; // This is inherited, no need to redeclare if types are correct

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    // Ensure app is assigned (though it's usually done by Obsidian's framework)
    // this.app is automatically assigned by the superclass (ItemView)
  }

  // Helper to get the plugin instance
  private getPlugin(): FeedsReader | null {
    // Access plugins via this.app (inherited from ItemView)
    // ★★★ Check if this.app exists first ★★★
    if (!this.app) {
        console.error("Feeds Reader: this.app is not available in FRView.getPlugin().");
        return null;
    }
    // ★★★ Since App.plugins is not defined, use (this.app as any) to avoid errors ★★★
    const pluginsObject = (this.app as any).plugins;
    if (!pluginsObject) { // ?.plugins は使わず、まず pluginsObject の存在を確認
        console.error("Feeds Reader: Cannot access internal plugins object on app instance.");
        return null;
    }

    // Get plugin from internal plugins object
    // ★★★ Use hardcoded plugin ID ★★★
    const plugin = pluginsObject.plugins?.[PLUGIN_ID] as FeedsReader | undefined;

    if (plugin instanceof FeedsReader) {
        return plugin;
    }

    // Check enabled plugins (if they exist)
    // ★★★ Use hardcoded plugin ID ★★★
    const enabledPlugins = pluginsObject.enabledPlugins;
    if (enabledPlugins instanceof Set && enabledPlugins.has(PLUGIN_ID)) {
         console.error(`Feeds Reader: Plugin instance with ID '${PLUGIN_ID}' is enabled but not found or has incorrect type!`);
         new Notice("Feeds Reader plugin instance type error.", 3000);
    } else if (!plugin) {
         console.warn(`Feeds Reader: Plugin with ID '${PLUGIN_ID}' not found among loaded plugins.`);
         // console.log("Available plugins:", pluginsObject.plugins); // For debugging
    }


    return null; // Return null if not found or wrong type
  }


  getViewType() {
    return VIEW_TYPE_FEEDS_READER;
  }

  getDisplayText() {
    // Dynamically update display text based on current view
    if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
        return "Starred Items";
    } else if (GLB.currentFeedName) {
        // Truncate long feed names if necessary for display
        const maxLength = 30;
        const name = GLB.currentFeedName.length > maxLength
                   ? GLB.currentFeedName.substring(0, maxLength) + "..."
                   : GLB.currentFeedName;
        return `Feed: ${name}`;
    }
    return "Feeds Reader";
  }

  // Method to update the display text of the view header
  updateHeaderText() {
    const newTitle = this.getDisplayText();
    // Try to find the title element within the view's container
    // Obsidian 1.5+ uses .view-header-title-container .view-header-title
    const titleEl = this.containerEl.querySelector('.view-header-title-container .view-header-title')
                 || this.containerEl.querySelector('.view-header-title'); // Fallback for older versions
    if (titleEl) {
      titleEl.textContent = newTitle;
    }
    // Setting leaf display text might cause issues or be inconsistent,
    // rely on getDisplayText() for automatic updates by Obsidian if possible.
    // this.leaf.setDisplayText(newTitle); // Avoid if causing errors or not working reliably
  }


  async onOpen() {
    const plugin = this.getPlugin();
    if (!plugin) {
        console.error('Feeds Reader: Could not get plugin instance in onOpen.');
        new Notice('Feeds Reader plugin instance error.', 3000);
        return; // Stop initialization if plugin isn't available
    }

    const startTime = performance.now();
    // Load data with error handling using plugin methods
    try { await plugin.loadSubscriptions(); } catch (e: any) {
        console.error("Failed to load subscriptions:", e);
        new Notice(`Failed to load subscriptions: ${e.message}`, 5000);
    }
    try { await plugin.loadFeedsStoredData(); } catch (e: any) {
        console.error("Failed to load stored feed data:", e);
        new Notice(`Failed to load feed data: ${e.message}`, 5000);
    }

    // Performance notice
    const endTime = performance.now();
    const timeSpent = (endTime - startTime) / 1e3;
     if (timeSpent > 0.1) { // Show notice only if loading takes noticeable time
        const tStr = timeSpent.toFixed(2);
        new Notice(`Feeds data loaded in ${tStr} seconds.`, 2000);
     }


    const container = this.containerEl.children[1];
    if (!container) {
      console.error('Feeds Reader: Failed to get container element.');
      new Notice('Failed to initialize Feeds Reader view.', 3000);
      return;
    }

    container.empty();
    container.addClass('feeds-reader-container');

    // Set initial CSS variable for card width from loaded settings
    document.documentElement.style.setProperty('--card-item-width', `${GLB.settings?.cardWidth || 280}px`);

    // --- Left Panel ---
    const leftPanel = container.createEl('div', { cls: 'feeds-reader-left-panel' });
    leftPanel.id = 'feedsReaderLeftPanel';

    // Toggle Button Container
    const toggleNaviContainer = leftPanel.createEl('div', { cls: 'toggleNaviContainer' });
    toggleNaviContainer.id = 'toggleNaviContainer';
    const toggleNavi = toggleNaviContainer.createEl('span', { text: ">", cls: 'toggleNavi' });
    toggleNavi.id = 'toggleNavi';
    const toggleNaviAux = toggleNaviContainer.createEl('span', { cls: 'toggleNaviAux' });
    toggleNaviAux.id = 'toggleNaviAux';

    // Navigation Bar
    const navigation = leftPanel.createEl("div", { cls: 'navigation naviBarShown' }); // Corrected 'class' to 'cls'
    navigation.id = 'naviBar';

    // --- Top Management Menu ---
    const manage = navigation.createEl('div', { cls: 'manage' });

    // Starred Items Link
    const starredItemsDiv = manage.createEl('div', { cls: 'starred-items-section nav-item' });
    const starredLink = starredItemsDiv.createEl('span', { text: '★ Starred Items', cls: 'nav-item-link' });
    starredLink.id = 'showStarredItems';
    if (GLB.currentFeed === GLB.STARRED_VIEW_ID) starredLink.addClass('showingFeed');

    manage.createEl('hr');

    // Filter Menu
    const filterGroup = manage.createEl('div', { cls: 'filter-group' });
    filterGroup.createEl('span', { text: 'View:', cls: 'filter-label' });
    const filterAll = filterGroup.createEl('span', { text: "All", cls: 'filter-item' }); filterAll.id = 'filterAll';
    const filterUnread = filterGroup.createEl('span', { text: "Unread", cls: 'filter-item' }); filterUnread.id = 'filterUnread';
    const filterStarred = filterGroup.createEl('span', { text: "Starred", cls: 'filter-item' }); filterStarred.id = 'filterStarred';
    // Set initial active filter based on GLB state
    const activeFilterId = `filter${GLB.filterMode.charAt(0).toUpperCase() + GLB.filterMode.slice(1)}`;
    // Wait for elements to be in DOM before adding class (or use direct reference)
    // queueMicrotask(() => { document.getElementById(activeFilterId)?.addClass('filter-active'); });
    if (GLB.filterMode === 'all') filterAll.addClass('filter-active');
    else if (GLB.filterMode === 'unread') filterUnread.addClass('filter-active');
    else if (GLB.filterMode === 'starred') filterStarred.addClass('filter-active');


    manage.createEl('hr');

    // Other Management Buttons
    const search = manage.createEl('div').createEl('span', { text: "Search Feed", cls: 'nav-item-link' }); search.id = 'search';
    const toggleOrder = manage.createEl('div').createEl('span', { text: `Sort: ${GLB.itemOrder}`, cls: 'nav-item-link' }); toggleOrder.id = 'toggleOrder';
    const saveFeedsDataBtn = manage.createEl('div').createEl('span', { text: "Save Data", cls: 'nav-item-link' }); saveFeedsDataBtn.id = 'saveFeedsData';
    const updateAll = manage.createEl('div').createEl('span', { text: "Update All Feeds", cls: 'nav-item-link' }); updateAll.id = 'updateAll';
    const undo = manage.createEl('div').createEl('span', { text: "Undo Last Action", cls: 'nav-item-link' }); undo.id = 'undo';
    const add = manage.createEl('div').createEl('span', { text: "Add Feed", cls: 'nav-item-link' }); add.id = 'addFeed';
    const manageFeeds = manage.createEl('div').createEl('span', { text: "Manage Feeds", cls: 'nav-item-link' }); manageFeeds.id = 'manageFeeds';
    manage.createEl('hr');

    // --- Feed List Section ---
    navigation.createEl('h3', {text: 'Feeds', cls: 'feed-list-header'});
    const feedTableDiv = navigation.createEl('div', { cls: 'feedTableDiv' });
    const feedTable = feedTableDiv.createEl('table');
    feedTable.id = 'feedTable';
    await plugin.createFeedBar(); // Await the creation using plugin method

    // Thanks/Complain Link
    if (GLB.feedList && GLB.feedList.length > 0) {
      const thanksDiv = navigation.createDiv({cls: 'thanks-complain'});
      thanksDiv.createEl('hr');
      const thanksTable = thanksDiv.createEl('table');
      const thanks = thanksTable.createEl('tr', {cls: 'thanks'});
      // Corrected: Use attr for target attribute
      thanks.createEl('td').createEl('a', { text: "Buy me a coffee", href: "https://www.buymeacoffee.com/fjdu", attr: { target: '_blank', rel: 'noopener noreferrer'} });
      thanks.createEl('td').createEl('span', { text: "|" });
      thanks.createEl('td').createEl('a', { text: "Report Issue", href: "https://github.com/fjdu/obsidian-feed/issues", attr: { target: '_blank', rel: 'noopener noreferrer'} });
    }

    // --- Right Panel ---
    const rightPanel = container.createEl('div', { cls: 'feeds-reader-right-panel contentBoxRightpage' });
    rightPanel.id = 'contentBox';

    // Content Header (placeholder)
    const contentHeader = rightPanel.createEl('div', { cls: 'content-header' });
    contentHeader.id = 'contentHeader';

    // Feed Content Area (placeholder)
    const feed_content = rightPanel.createEl('div', { cls: 'feed-content-area' });
    feed_content.id = 'feed_content';

    // --- Initial Display Logic ---
    if (GLB.currentFeed) {
        plugin.makeDisplayList(); // Use plugin method
        plugin.show_feed();      // Use plugin method
        document.getElementById(GLB.currentFeed)?.addClass('showingFeed');
    } else {
      feed_content.setText('Select a feed or "Starred Items" from the left panel.');
    }
     this.updateHeaderText(); // Set initial header text
  }

  async onClose() {
    const plugin = this.getPlugin();
    try {
        if (plugin) {
            await plugin.saveFeedsData(); // Use plugin method
        } else {
            console.warn("Feeds Reader: Plugin instance not found during onClose, data might not be saved.");
        }
    } catch(e) {
        console.error("Error saving data on close:", e);
    }
    // Clean up DOM modifications
    document.documentElement.style.removeProperty('--card-item-width');
    this.containerEl.empty(); // Empty the container
  }
}