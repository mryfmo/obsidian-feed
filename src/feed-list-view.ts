// --- START OF FILE feed-list-view.ts ---

import { ItemView, WorkspaceLeaf, Notice, App, Platform } from "obsidian";
import { GLB } from "./globals";
import FeedsReader from "./main"; // Import the plugin class itself

export const VIEW_TYPE_FEED_LIST = "feed-list-view";
const PLUGIN_ID = 'feeds-reader'; // Ensure consistent Plugin ID

export class FeedListView extends ItemView {
    plugin: FeedsReader | null = null; // Store plugin instance

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        // Get plugin instance (consider moving getPlugin logic here or a shared utility)
        this.plugin = this.getPluginInstance();
    }

    // Helper to get the plugin instance (similar to FRView)
    private getPluginInstance(): FeedsReader | null {
        // Use type assertion as App.plugins is not in official obsidian.d.ts
        const plugins = (this.app as any).plugins;
        if (!plugins) {
             console.error("FeedListView: Cannot access plugins object.");
             return null;
        }
        // Access the specific plugin instance
        const pluginInstance = plugins.plugins?.[PLUGIN_ID];
        if (pluginInstance instanceof FeedsReader) {
            return pluginInstance;
        } else {
            console.error(`FeedListView: Plugin instance '${PLUGIN_ID}' not found or invalid type.`);
            return null;
        }
    }


    getViewType(): string {
        return VIEW_TYPE_FEED_LIST;
    }

    getDisplayText(): string {
        return "Feeds"; // Sidebar tab title
    }

    getIcon(): string {
        // Using a built-in icon as an example, replace if you have a custom one
        return "rss";
    }

    async onOpen() {
        if (!this.plugin) {
            console.error('Feeds List View: Could not get plugin instance during onOpen.');
            // Optionally display a message in the view itself
            this.contentEl.setText("Error: Feeds Reader plugin instance not found.");
            return; // Stop initialization
        }

        const container = this.contentEl; // Use contentEl directly for ItemView
        container.empty();
        container.addClass('feeds-reader-feed-list-container'); // Add specific class for styling

        // --- Top Management Menu ---
        const manage = container.createEl('div', { cls: 'manage-section' });

        // Starred Items Link
        const starredItemsDiv = manage.createEl('div', { cls: 'starred-items-section', attr: {'nav-item':''} }); // Use attribute for simpler styling/selection
        const starredLink = starredItemsDiv.createEl('span', { text: '★ Starred Items', cls: 'nav-item-link' });
        starredLink.id = 'showStarredItems'; // Keep ID for click handling
        // Highlight if starred view is active in the main view
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) starredLink.addClass('showingFeed');

        manage.createEl('hr');

        // Filter Menu
        const filterGroup = manage.createEl('div', { cls: 'filter-group' });
        filterGroup.createEl('span', { text: 'View:', cls: 'filter-label' });
        const filterAll = filterGroup.createEl('span', { text: "All", cls: 'filter-item' }); filterAll.id = 'filterAll';
        const filterUnread = filterGroup.createEl('span', { text: "Unread", cls: 'filter-item' }); filterUnread.id = 'filterUnread';
        const filterStarred = filterGroup.createEl('span', { text: "Starred", cls: 'filter-item' }); filterStarred.id = 'filterStarred';
        // Set initial active filter
        this.updateFilterHighlight(); // Use helper


        manage.createEl('hr');

        // Other Management Buttons - Structure as divs containing spans for consistency
        const createManageButton = (id: string, text: string, cls: string = 'nav-item-link') => {
             const div = manage.createEl('div', {attr: {'nav-item': ''}});
             const span = div.createEl('span', { text, cls });
             span.id = id;
             return span;
        };

        createManageButton('search', "Search Feed");
        createManageButton('toggleOrder', `Sort: ${GLB.itemOrder}`);
        createManageButton('saveFeedsData', "Save Data");
        createManageButton('updateAll', "Update All Feeds");
        createManageButton('undo', "Undo Last Action");
        createManageButton('addFeed', "Add Feed");
        createManageButton('manageFeeds', "Manage Feeds");

        manage.createEl('hr');

        // --- Feed List Section ---
        container.createEl('h3', {text: 'Feeds', cls: 'feed-list-header'});
        const feedTableDiv = container.createEl('div', { cls: 'feedTableDiv' });
        const feedTable = feedTableDiv.createEl('table');
        feedTable.id = 'feedTable'; // Keep the ID for targeting
        // Ensure plugin data is loaded before creating the bar
        if (GLB.feedList && this.plugin) {
            await this.plugin.createFeedBar(feedTable); // Pass the table element
        } else {
            feedTable.createTBody().createEl('tr').createEl('td').setText('Loading feeds...');
            // Trigger data load if not already loaded (might happen if sidebar opens before main view)
            if (this.plugin && !GLB.feedList?.length) {
                 await this.plugin.loadFeedsDataWithNotice(); // Use the loading helper
            }
        }


        // Thanks/Complain Link
        this.renderThanksLink(container); // Use helper


        // The main plugin's global click listener handles clicks via event delegation
    }

    async onClose() {
        // No specific cleanup needed here usually, main plugin handles saving
        this.contentEl.empty();
    }

     // Helper to render the thanks/complain link section
     renderThanksLink(container: HTMLElement) {
         // Remove existing link if present
         container.querySelector('.thanks-complain')?.remove();

         if (GLB.feedList && GLB.feedList.length > 0) {
           const thanksDiv = container.createDiv({cls: 'thanks-complain'});
           thanksDiv.createEl('hr');
           const thanksTable = thanksDiv.createEl('table');
           const thanks = thanksTable.createEl('tr', {cls: 'thanks'});
           thanks.createEl('td').createEl('a', { text: "Buy me a coffee", href: "https://www.buymeacoffee.com/fjdu", attr: { target: '_blank', rel: 'noopener noreferrer'} });
           thanks.createEl('td').createEl('span', { text: "|" });
           thanks.createEl('td').createEl('a', { text: "Report Issue", href: "https://github.com/fjdu/obsidian-feed/issues", attr: { target: '_blank', rel: 'noopener noreferrer'} });
         }
     }


    // Helper to update filter highlights based on GLB state
    updateFilterHighlight() {
        this.contentEl.querySelectorAll('.filter-item').forEach(el => el.removeClass('filter-active'));
        const activeFilterId = `filter${GLB.filterMode.charAt(0).toUpperCase() + GLB.filterMode.slice(1)}`;
        this.contentEl.querySelector(`#${activeFilterId}`)?.addClass('filter-active');
    }

    // Method to update highlighting and state (called from main plugin)
    updateFeedHighlighting() {
        if (!this.contentEl) return; // Ensure view is loaded

        // Update Feed/Starred Item highlighting
        this.contentEl.querySelectorAll('.showFeed, #showStarredItems').forEach(el => {
            const htmlEl = el as HTMLElement; // Cast for id access
            if (htmlEl.id === GLB.currentFeed || (GLB.currentFeed === GLB.STARRED_VIEW_ID && htmlEl.id === 'showStarredItems')) {
                htmlEl.addClass('showingFeed');
            } else {
                htmlEl.removeClass('showingFeed');
            }
        });

        // Update Filter highlights
        this.updateFilterHighlight();

        // Update Sort order text
         const toggleOrderEl = this.contentEl.querySelector('#toggleOrder');
         if (toggleOrderEl) toggleOrderEl.setText(`Sort: ${GLB.itemOrder}`);

         // Re-render thanks link (in case feed list becomes empty/populated)
         this.renderThanksLink(this.contentEl);
    }

    // Method to refresh the feed list itself (e.g., after adding/removing/updating feeds)
    async refreshFeedListDisplay() {
         if (!this.plugin || !this.contentEl) return;
         const feedTable = this.contentEl.querySelector('#feedTable') as HTMLTableElement | null;
         if (feedTable) {
             await this.plugin.createFeedBar(feedTable); // Re-create the feed bar
         }
          this.renderThanksLink(this.contentEl); // Update thanks link visibility
          this.updateFeedHighlighting(); // Ensure highlights are correct
    }
}
// --- END OF FILE feed-list-view.ts ---