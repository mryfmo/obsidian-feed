import { ItemView, WorkspaceLeaf, Notice, App, Platform } from "obsidian";
import { GLB } from "./globals";
import FeedsReader from "./main"; // Import the plugin class itself

export const VIEW_TYPE_FEED_LIST = "feed-list-view";
const PLUGIN_ID = 'feeds-reader'; // Ensure consistent Plugin ID

export class FeedListView extends ItemView {
    plugin: FeedsReader | null = null; // Store plugin instance
    isLoading: boolean = true; // Flag to indicate loading state

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        // Get plugin instance early, but check validity before use
        this.plugin = this.getPluginInstance();
        if (!this.plugin) {
             console.error("FeedListView: Failed to get plugin instance during construction.");
             // Optionally handle this error, e.g., by showing an error message in onOpen
        }
    }

    // Helper to get the plugin instance
    private getPluginInstance(): FeedsReader | null {
        try {
            // Use type assertion as App.plugins is not in official obsidian.d.ts
            const plugins = (this.app as any).plugins;
            if (!plugins || !plugins.plugins) {
                 console.error("FeedListView: Cannot access plugins object or plugins map.");
                 return null;
            }
            const pluginInstance = plugins.plugins[PLUGIN_ID];
            if (pluginInstance instanceof FeedsReader) {
                return pluginInstance;
            } else {
                console.error(`FeedListView: Plugin instance '${PLUGIN_ID}' not found or has invalid type.`);
                return null;
            }
        } catch (error) {
             console.error("FeedListView: Error getting plugin instance:", error);
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
        return "rss"; // Sidebar icon
    }

    // Called when the view is first opened/activated
    async onOpen() {
        console.log("FeedListView: onOpen triggered.");
        const container = this.contentEl;
        container.empty(); // Clear any previous content
        container.addClass('feeds-reader-feed-list-container');

        if (!this.plugin) {
            console.error('FeedListView: Could not get plugin instance during onOpen.');
            container.setText("Error: Feeds Reader plugin instance not found.");
            return;
        }

        // Show initial loading state
        this.renderLoadingState(container);

        // Data loading and initial rendering are now handled by the plugin's
        // loadFeedsDataWithNotice and subsequent refresh calls.
        // We might trigger a refresh here if needed, but generally rely on the plugin's flow.
        // Check if data seems loaded already, otherwise wait for plugin's refresh call.
        if (GLB.feedList && GLB.feedList.length > 0) {
            console.log("FeedListView: Data seems available, rendering initial content.");
            this.renderContent(container);
        } else {
            console.log("FeedListView: Waiting for data load and refresh call from plugin.");
            // Optionally trigger load if it hasn't started? Risky.
            // await this.plugin.loadFeedsDataWithNotice(); // Avoid potentially double-loading
        }
    }

    // Renders the basic structure and loading message
    renderLoadingState(container: HTMLElement) {
        this.isLoading = true;
        container.empty(); // Clear previous content
        container.addClass('feeds-reader-feed-list-container');
        // Add basic structure (manage section, feed list area) but show loading text
        const manage = container.createEl('div', { cls: 'manage-section' });
        manage.createEl('p', { text: "Loading controls..."});
        manage.createEl('hr');
        container.createEl('h3', {text: 'Feeds', cls: 'feed-list-header'});
        const feedTableDiv = container.createEl('div', { cls: 'feedTableDiv' });
        feedTableDiv.createEl('p', { text: "Loading feeds..."});
        console.log("FeedListView: Rendered loading state.");
    }

    // Renders the actual content once data is available (called by plugin.refreshFeedListSidebar)
    async renderContent(container: HTMLElement) {
         console.log("FeedListView: renderContent called.");
         if (!this.plugin) {
             console.error("FeedListView.renderContent: Plugin instance missing.");
             container.setText("Error rendering feed list.");
             return;
         }
        this.isLoading = false; // Mark as loaded
        container.empty(); // Clear loading state
        container.addClass('feeds-reader-feed-list-container');


        // --- Top Management Menu ---
        const manage = container.createEl('div', { cls: 'manage-section' });
        const starredItemsDiv = manage.createEl('div', { cls: 'starred-items-section', attr: {'nav-item':''} });
        const starredLink = starredItemsDiv.createEl('span', { text: '★ Starred Items', cls: 'nav-item-link' });
        starredLink.id = 'showStarredItems';
        manage.createEl('hr');
        const filterGroup = manage.createEl('div', { cls: 'filter-group' });
        filterGroup.createEl('span', { text: 'View:', cls: 'filter-label' });
        const filterAll = filterGroup.createEl('span', { text: "All", cls: 'filter-item' }); filterAll.id = 'filterAll';
        const filterUnread = filterGroup.createEl('span', { text: "Unread", cls: 'filter-item' }); filterUnread.id = 'filterUnread';
        const filterStarred = filterGroup.createEl('span', { text: "Starred", cls: 'filter-item' }); filterStarred.id = 'filterStarred';
        manage.createEl('hr');
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

        // Call plugin method to populate the table
        // Ensure feedList is actually populated before calling
        if (GLB.feedList && GLB.feedList.length > 0) {
             console.log(`FeedListView: Calling createFeedBar with ${GLB.feedList.length} feeds.`);
             await this.plugin.createFeedBar(feedTable); // Pass the table element
        } else {
             console.log("FeedListView: No feeds in GLB.feedList to display.");
             feedTable.createTBody().createEl('tr').createEl('td').setText('No feeds subscribed.');
        }

        // Thanks/Complain Link
        this.renderThanksLink(container);

        // Update highlights based on current state AFTER rendering elements
        this.updateFeedHighlighting();
        console.log("FeedListView: Content rendered.");
    }


    async onClose() {
        console.log("FeedListView: onClose triggered.");
        // No specific cleanup needed here usually, main plugin handles saving
        this.contentEl.empty();
    }

     // Helper to render the thanks/complain link section
     renderThanksLink(container: HTMLElement) {
         // Remove existing link if present
         container.querySelector('.thanks-complain')?.remove();

         if (GLB.feedList && GLB.feedList.length > GLB.nThanksSep) { // Use threshold from GLB
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
        if (!this.contentEl) return;
        this.contentEl.querySelectorAll('.filter-item').forEach(el => el.removeClass('filter-active'));
        const activeFilterId = `filter${GLB.filterMode.charAt(0).toUpperCase() + GLB.filterMode.slice(1)}`;
        this.contentEl.querySelector(`#${activeFilterId}`)?.addClass('filter-active');
    }

    // Method to update highlighting and state (called from main plugin)
    updateFeedHighlighting() {
        if (!this.contentEl || this.isLoading) return; // Don't update if not ready or still loading

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
         if (toggleOrderEl instanceof HTMLElement) { // Check if it's an HTMLElement
              toggleOrderEl.setText(`Sort: ${GLB.itemOrder}`);
         }

         // Re-render thanks link (in case feed list becomes empty/populated)
         this.renderThanksLink(this.contentEl);
    }

    // Method to refresh the feed list itself (e.g., after adding/removing/updating feeds)
    async refreshFeedListDisplay() {
        console.log("FeedListView: refreshFeedListDisplay called.");
         if (!this.plugin || !this.contentEl) return;
         // Re-render the whole content
         this.renderContent(this.contentEl);
    }
}