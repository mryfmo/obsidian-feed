import { ItemView, WorkspaceLeaf, Notice, App, Platform } from "obsidian";
import { GLB } from "./globals";
import FeedsReader from "./main"; // Import the plugin class itself
import { getFeedStats } from "./getFeed"; // Import getFeedStats

export const VIEW_TYPE_FEED_LIST = "feed-list-view";
const PLUGIN_ID = 'feeds-reader'; // Ensure consistent Plugin ID

export class FeedListView extends ItemView {
    plugin: FeedsReader | null = null; // Store plugin instance
    isLoading: boolean = true; // Flag to indicate loading state

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.plugin = this.getPluginInstance();
        if (!this.plugin) {
             console.error("FeedListView: Failed to get plugin instance during construction.");
        }
    }

    private getPluginInstance(): FeedsReader | null {
        try {
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
        return "Feeds Reader"; // Sidebar tab title
    }

    getIcon(): string {
        return "rss"; // Sidebar icon
    }

    async onOpen() {
        console.log("FeedListView: onOpen triggered.");
        const container = this.contentEl;
        container.empty();
        container.addClass('feeds-reader-feed-list-container');

        if (!this.plugin) {
            console.error('FeedListView: Could not get plugin instance during onOpen.');
            container.setText("Error: Feeds Reader plugin instance not found.");
            return;
        }

        this.renderLoadingState(container);

        // Rely on plugin's loadFeedsDataWithNotice and refresh calls
        // Wait a bit for data loading triggered elsewhere
        await sleep(100); // Small delay to allow potential data load
        if (GLB.feedList && (GLB.feedList.length > 0 || this.plugin.isDataLoaded)) { // Check if loaded or data exists
            console.log("FeedListView: Data seems available or loading finished, rendering initial content.");
            await this.renderContent(container);
        } else {
            console.log("FeedListView: Waiting for data load and refresh call from plugin.");
            // Optionally add a timeout or a message if data doesn't load
        }
    }

    renderLoadingState(container: HTMLElement) {
        this.isLoading = true;
        container.empty();
        container.addClass('feeds-reader-feed-list-container');
        const manage = container.createEl('div', { cls: 'manage-section' });
        manage.createEl('p', { text: "Loading controls..."});
        manage.createEl('hr');
        container.createEl('h3', {text: 'Feeds', cls: 'feed-list-header'});
        const feedTableDiv = container.createEl('div', { cls: 'feedTableDiv' });
        feedTableDiv.createEl('p', { text: "Loading feeds..."});
        console.log("FeedListView: Rendered loading state.");
    }

    async renderContent(container: HTMLElement) {
         console.log("FeedListView: renderContent called.");
         if (!this.plugin) {
             console.error("FeedListView.renderContent: Plugin instance missing.");
             container.setText("Error rendering feed list.");
             return;
         }
        this.isLoading = false;
        container.empty();
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
        feedTable.id = 'feedTable';

        // Call createFeedBar directly
        if (GLB.feedList && GLB.feedList.length > 0) {
             console.log(`FeedListView: Calling createFeedBar with ${GLB.feedList.length} feeds.`);
             await this.createFeedBar(feedTable); // Pass the table element
        } else {
             console.log("FeedListView: No feeds in GLB.feedList to display.");
             feedTable.createTBody().createEl('tr').createEl('td').setText('No feeds subscribed.');
        }

        this.renderThanksLink(container);
        this.updateFeedHighlighting();
        console.log("FeedListView: Content rendered.");
    }

    sort_feed_list() {
        if (!GLB.feedList) return;
        GLB.feedList.sort((a, b) => {
            const folderA = a.folder || "zzz";
            const folderB = b.folder || "zzz";
            if (folderA < folderB) return -1;
            if (folderA > folderB) return 1;
            const nameA = a.name || "";
            const nameB = b.name || "";
            return nameA.localeCompare(nameB);
        });
    }    

    async createFeedBar(targetTableElement: HTMLTableElement | null) {
        const t = targetTableElement;
        if (!t) { console.error("Target table element not provided for createFeedBar"); return; }
        t.empty();
        let currentFolder = "%%%NO_FOLDER_YET%%%";

        if (!GLB.feedList?.length) {
             const row = t.createTBody().createEl('tr');
             row.createEl('td').setText('No feeds subscribed.');
             return;
        }

        const tbody = t.createTBody();
        // Ensure list is sorted before rendering
        this.sort_feed_list(); // Call sort function

        GLB.feedList.forEach(feed => {
             if (!feed?.feedUrl || !feed.name) return;
             const folder = feed.folder || "";

             if (folder !== currentFolder) {
                 currentFolder = folder;
                 const row = tbody.createEl('tr', { cls: 'feedFolderRow' });
                 const cell = row.createEl('td'); cell.colSpan = 2;
                 cell.createEl('span', { text: currentFolder || "Uncategorized", cls: 'feedFolder' });
             }

             const tr = tbody.createEl('tr');
             // Add error class if applicable
             if (feed.lastError) {
                 tr.addClass('feed-has-error');
             }

             const nameTd = tr.createEl('td');
             const showFeedSpan = nameTd.createEl('span', { cls: 'showFeed' });
             showFeedSpan.id = feed.feedUrl;

             // Add error icon if applicable
             if (feed.lastError) {
                const errorIcon = showFeedSpan.createSpan({ cls: 'feed-error-icon', text: '⚠️' });
                errorIcon.setAttribute('title', `Error ${feed.lastError.status || 'Fetch Failed'}: ${feed.lastError.message}\n(Last attempt: ${new Date(feed.lastError.timestamp || '').toLocaleString()})`);
             }

             showFeedSpan.createSpan({ text: feed.name, cls: 'feed-name' });

             const statsSpan = showFeedSpan.createSpan({ cls: 'feed-stats' });
             statsSpan.setAttrs({ 'fdUrl': feed.feedUrl, 'fdName': feed.name });

             // Show stats or error indicator
             if (feed.lastError) {
                 statsSpan.createEl('span', { text: '-- / --', cls: 'feed-error-stats' });
             } else {
                 // Use imported getFeedStats
                 const stats = getFeedStats(feed.feedUrl);
                 const unreadSpan = statsSpan.createEl('span', { text: stats.unread.toString(), cls: 'unreadCount' });
                 if (stats.total < GLB.maxTotalnumDisplayed) {
                     statsSpan.createEl('span', { text: '/', cls: 'unreadCountSep' });
                     statsSpan.createEl('span', { text: stats.total.toString(), cls: 'totalCount' });
                 }
             }
        });
    }

    async onClose() {
        console.log("FeedListView: onClose triggered.");
        this.contentEl.empty();
    }

     renderThanksLink(container: HTMLElement) {
         container.querySelector('.thanks-complain')?.remove();
         if (GLB.feedList && GLB.feedList.length > GLB.nThanksSep) {
           const thanksDiv = container.createDiv({cls: 'thanks-complain'});
           thanksDiv.createEl('hr');
           const thanksTable = thanksDiv.createEl('table');
           const thanks = thanksTable.createEl('tr', {cls: 'thanks'});
           thanks.createEl('td').createEl('a', { text: "Buy me a coffee", href: "https://www.buymeacoffee.com/fjdu", attr: { target: '_blank', rel: 'noopener noreferrer'} });
           thanks.createEl('td').createEl('span', { text: "|" });
           thanks.createEl('td').createEl('a', { text: "Report Issue", href: "https://github.com/fjdu/obsidian-feed/issues", attr: { target: '_blank', rel: 'noopener noreferrer'} });
         }
     }

    updateFilterHighlight() {
        if (!this.contentEl) return;
        this.contentEl.querySelectorAll('.filter-item').forEach(el => el.removeClass('filter-active'));
        const activeFilterId = `filter${GLB.filterMode.charAt(0).toUpperCase() + GLB.filterMode.slice(1)}`;
        this.contentEl.querySelector(`#${activeFilterId}`)?.addClass('filter-active');
    }

    updateFeedHighlighting() {
        if (!this.contentEl || this.isLoading) return;

        this.contentEl.querySelectorAll('.showFeed, #showStarredItems').forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.id === GLB.currentFeed || (GLB.currentFeed === GLB.STARRED_VIEW_ID && htmlEl.id === 'showStarredItems')) {
                htmlEl.addClass('showingFeed');
            } else {
                htmlEl.removeClass('showingFeed');
            }
        });

        this.updateFilterHighlight();

         const toggleOrderEl = this.contentEl.querySelector('#toggleOrder');
         if (toggleOrderEl instanceof HTMLElement) {
              toggleOrderEl.setText(`Sort: ${GLB.itemOrder}`);
         }

         this.renderThanksLink(this.contentEl);
    }

    async refreshFeedListDisplay() {
        console.log("FeedListView: refreshFeedListDisplay called.");
         if (!this.plugin || !this.contentEl || this.isLoading) return;
         await this.renderContent(this.contentEl); // Re-render content
    }
}

// Auxiliary functions (sleep, sort_feed_list) if used elsewhere
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
// Assuming sort_feed_list is defined globally in main.ts or imported
declare function sort_feed_list(): void;