// Imports including new View and Platform
import { App, MarkdownRenderer, htmlToMarkdown, Modal, Notice, addIcon, Plugin, PluginSettingTab, Setting, sanitizeHTMLToDom, request, TFile, WorkspaceLeaf, Menu, Component, Vault, DataAdapter, Platform} from 'obsidian';
import { FRView, VIEW_TYPE_FEEDS_READER } from "./view";
import { FeedListView, VIEW_TYPE_FEED_LIST } from "./feed-list-view"; // Import new view
import { getFeedItems, RssFeedContent, RssFeedItem, nowdatetime, itemKeys, normalizeUrl } from "./getFeed";
import { GLB, FeedsReaderSettings } from "./globals";
import pako from 'pako';

// --- gzip related functions ---
async function compress(string: string): Promise<Uint8Array> {
    const encoder = new TextEncoder(); const data = encoder.encode(string); return pako.gzip(data);
}
async function decompress(byteArray: ArrayBuffer): Promise<string> {
    // Ensure input is ArrayBuffer
    if (!(byteArray instanceof ArrayBuffer)) {
        throw new Error("Decompression requires an ArrayBuffer.");
    }
    const data = pako.ungzip(new Uint8Array(byteArray)); const decoder = new TextDecoder(); return decoder.decode(data);
}


// --- default settings ---
const DEFAULT_SETTINGS: Partial<FeedsReaderSettings> = {
  feeds_reader_dir: 'feeds-reader', feeds_data_fname: 'feeds-data.json', subscriptions_fname: 'subscriptions.json',
  nItemPerPage: 20, saveContent: false, saveSnippetNewToOld: true,
  showJot: true, showSnippet: true, showRead: true, showSave: true, showMath: false, showGPT: false, showEmbed: true, showFetch: false, showLink: true, showDelete: true,
  defaultDisplayMode: 'card', cardWidth: 280, chatGPTAPIKey: '', chatGPTPrompt: 'Summarize the following text in 3 bullet points:',
};

// ============================================================
// --- Plugin Class Definition                              ---
// ============================================================
export default class FeedsReader extends Plugin {
	settings: FeedsReaderSettings;
    frViewInstance: FRView | null = null;
    feedListViewInstance: FeedListView | null = null; // Keep track of sidebar view
    isDataLoaded: boolean = false; // Flag to track initial data load

	async onload() {
		console.log('Loading Feeds Reader Plugin');
        await this.loadSettings();

        // --- Register BOTH views ---
        this.registerView(
            VIEW_TYPE_FEEDS_READER,
            (leaf) => {
                console.log("Creating FRView instance.");
                this.frViewInstance = new FRView(leaf);
                return this.frViewInstance;
            }
        );
        this.registerView(
            VIEW_TYPE_FEED_LIST,
            (leaf) => {
                 console.log("Creating FeedListView instance.");
                 this.feedListViewInstance = new FeedListView(leaf);
                 return this.feedListViewInstance;
            }
        );
        // --- End Register BOTH views ---

        this.app.workspace.onLayoutReady(async () => {
             console.log("Layout ready. Loading feed data.");
            // --- Ribbon icon logic ---
            if (!document.body.querySelector('div.app-container svg[data-icon-name="feeds-reader-icon"]')) {
                try {
                    addIcon("feeds-reader-icon", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M10 80 Q 50 80, 90 80" stroke="currentColor" stroke-width="8" fill="none"/><path fill="currentColor" d="M10 60 Q 35 60, 60 60" stroke="currentColor" stroke-width="8" fill="none"/><path fill="currentColor" d="M10 40 Q 20 40, 30 40" stroke="currentColor" stroke-width="8" fill="none"/><circle cx="15" cy="15" r="10" fill="currentColor"/></svg>`);
                    this.addRibbonIcon('feeds-reader-icon', 'Open Feeds Reader', () => this.activateView(true)); // Pass true to activate sidebar too
                 } catch (e) {
                     console.warn("Feeds Reader: Could not add ribbon icon.", e);
                 }
            } else {
                 this.addRibbonIcon('feeds-reader-icon', 'Open Feeds Reader', () => this.activateView(true)); // Pass true to activate sidebar too
            }
            // --- End Ribbon icon logic ---

            // Initial data loading after layout is ready
             await this.loadFeedsDataWithNotice(); // This now handles UI refresh
        });
        this.addSettingTab(new FeedReaderSettingTab(this.app, this));
        // Global listeners remain
        this.registerDomEvent(document, 'click', this.handleClick.bind(this));
        this.registerDomEvent(document, 'contextmenu', this.handleContextMenu.bind(this));
	}

	async onunload() {
        console.log('Unloading Feeds Reader Plugin');
        await this.saveFeedsData(); // Save data on unload
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_FEEDS_READER);
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_FEED_LIST); // Detach sidebar view too
        this.frViewInstance = null;
        this.feedListViewInstance = null;
        this.isDataLoaded = false; // Reset flag
    }

    // Modified activateView to handle both main and sidebar views
    async activateView(activateSidebar: boolean = true) {
        console.log("activateView called. Activate sidebar:", activateSidebar);
        let mainLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER)[0];
        if (!mainLeaf) {
            mainLeaf = this.app.workspace.getLeaf('tab'); // Get a leaf for the main area
             if (!mainLeaf) { console.error("Feeds Reader: Failed to get main leaf."); new Notice("Failed to open main view."); return; }
            console.log("Setting main leaf state.");
            await mainLeaf.setViewState({ type: VIEW_TYPE_FEEDS_READER, active: true });
        } else {
             console.log("Main leaf already exists.");
             // Ensure view inside existing leaf is loaded if deferred
             await mainLeaf.loadIfDeferred();
        }
        // Ensure main view is revealed and focused
        console.log("Revealing main leaf.");
        this.app.workspace.revealLeaf(mainLeaf);

        if (activateSidebar) {
            console.log("Ensuring side leaf.");
            // Use ensureSideLeaf for robust sidebar activation
            // Reveal but don't necessarily activate (focus) it
            await this.app.workspace.ensureSideLeaf(VIEW_TYPE_FEED_LIST, 'left', { active: false, reveal: true });
            console.log("Side leaf ensured.");
             // Ensure the sidebar view gets updated after activation
             if(this.feedListViewInstance) {
                 console.log("Updating sidebar highlighting.");
                 // A small delay might be needed for the DOM to be ready after reveal
                 await sleep(100); // Increased delay slightly
                 // Re-render the content if it wasn't loaded initially
                  if (this.feedListViewInstance.isLoading) {
                       await this.feedListViewInstance.renderContent(this.feedListViewInstance.contentEl);
                  } else {
                       this.feedListViewInstance.updateFeedHighlighting();
                  }
             } else {
                  console.warn("Sidebar instance (feedListViewInstance) not found after ensuring leaf.");
             }
        }

        // Ensure main display is also refreshed after activation, especially if data loaded late
        console.log("Refreshing main display after activation.");
        this.refreshDisplay();
    }

    // Helper function for initial data loading with notices
    async loadFeedsDataWithNotice() {
        console.log("loadFeedsDataWithNotice started.");
        if (this.isDataLoaded) {
             console.log("Data already loaded, skipping load.");
             // Still refresh UI in case views were opened after data load
             await this.refreshFeedListSidebar();
             this.refreshDisplay();
             return;
        }

        this.isDataLoaded = false; // Mark as loading
        const startTime = performance.now();
        let loadError = false;
        try {
             console.log("Loading subscriptions...");
             await this.loadSubscriptions();
             console.log("Subscriptions loaded.");
         } catch (e: any) {
            console.error("Failed to load subscriptions:", e);
            new Notice(`Failed to load subscriptions: ${e.message}`, 5000);
            loadError = true;
        }
        try {
             console.log("Loading stored feed data...");
             await this.loadFeedsStoredData();
             console.log("Stored feed data loaded.");
        } catch (e: any) {
            console.error("Failed to load stored feed data:", e);
            new Notice(`Failed to load feed data: ${e.message}`, 5000);
            loadError = true;
        }
        const endTime = performance.now();
        const timeSpent = (endTime - startTime) / 1e3;

        if(!loadError) {
             this.isDataLoaded = true; // Mark as loaded only if no errors
             console.log(`Feed data loaded successfully in ${timeSpent.toFixed(2)}s.`);
             if (timeSpent > 0.1) {
                 new Notice(`Feeds data loaded in ${timeSpent.toFixed(2)} seconds.`, 2000);
             }
        } else {
             console.error("Errors occurred during data loading.");
        }


        // Always attempt to refresh UI after load attempt, even if errors occurred
        // to show potentially partial data or error states.
        console.log("Refreshing UI after data load attempt.");
        await this.refreshFeedListSidebar(); // Update sidebar content
        this.refreshDisplay(); // Update main view content
    }

	async loadSettings() {
        this.settings=Object.assign({},DEFAULT_SETTINGS,await this.loadData());
        // Populate GLB from settings
        GLB.feeds_reader_dir=this.settings.feeds_reader_dir;
        GLB.feeds_data_fname=this.settings.feeds_data_fname; // Legacy filename
        GLB.subscriptions_fname=this.settings.subscriptions_fname;
        GLB.saved_snippets_fname='snippets.md';
        GLB.feeds_store_base='feeds-store'; // Base name for storage chunks
        GLB.nItemPerPage=this.settings.nItemPerPage > 0 ? this.settings.nItemPerPage : 20;
        // Assign the whole settings object to GLB.settings for easy access
        GLB.settings = this.settings;
        // Initialize GLB state based on settings
        GLB.displayMode=this.settings.defaultDisplayMode || 'card';
        GLB.cardWidth=this.settings.cardWidth > 100 ? this.settings.cardWidth : 280;
        GLB.itemOrder='New to old'; // Default sort order
        GLB.filterMode='all';      // Default filter mode
        GLB.titleOnly=false;       // Default state (currently unused in UI?)
        GLB.currentFeed=null;      // No feed selected initially
        GLB.currentFeedName='';
        // Default values for internal logic (could be made settings if needed)
        GLB.nMergeLookback=10000;
        GLB.lenStrPerFile=1024*1024*2; // 2MB chunk size target
        GLB.feedsStoreChange=false;
        GLB.feedsStoreChangeList=new Set<string>();
        GLB.maxTotalnumDisplayed=1e5; // Threshold for showing total count
        GLB.nThanksSep=16;          // Threshold for showing thanks link
        // Runtime state initialization
        GLB.undoList=[];
        GLB.idxItemStart=0;
        GLB.nPage=1;
        GLB.displayIndices=[];
        GLB.starredItemsList=[];
    }
	async saveSettings() {
        // Update settings object from GLB state before saving
        this.settings.nItemPerPage=GLB.nItemPerPage;
        // Make sure to update settings from GLB.settings where applicable
        this.settings.saveContent=GLB.settings.saveContent;
        this.settings.saveSnippetNewToOld=GLB.settings.saveSnippetNewToOld;
        this.settings.defaultDisplayMode=GLB.displayMode;
        this.settings.cardWidth=GLB.cardWidth;
        // Ensure API key and prompt are saved correctly
        this.settings.chatGPTAPIKey = GLB.settings.chatGPTAPIKey;
        this.settings.chatGPTPrompt = GLB.settings.chatGPTPrompt;
        // Save other settings managed by the settings tab
        this.settings.showJot = GLB.settings.showJot;
        this.settings.showSnippet = GLB.settings.showSnippet;
        this.settings.showRead = GLB.settings.showRead;
        this.settings.showSave = GLB.settings.showSave;
        this.settings.showMath = GLB.settings.showMath;
        this.settings.showGPT = GLB.settings.showGPT;
        this.settings.showEmbed = GLB.settings.showEmbed;
        this.settings.showFetch = GLB.settings.showFetch;
        this.settings.showLink = GLB.settings.showLink;
        this.settings.showDelete = GLB.settings.showDelete;


        await this.saveData(this.settings);
    }

    getNumFromId(idstr: string | null | undefined, pref: string): number {
        if(!idstr) return -1;
        const prefixLength = pref.length;
        const numStr = idstr.substring(prefixLength);
        // Use regex for robust check if it's purely digits
        return /^\d+$/.test(numStr) ? parseInt(numStr, 10) : -1;
    }

    // --- Event Handlers ---
    async handleClick(evt: MouseEvent) {
        const target = evt.target as HTMLElement;
        if (!target) return;

        const plugin = this; // Alias for clarity

        // --- Sidebar View Actions ---
        const feedListContainer = target.closest('.feeds-reader-feed-list-container');
        if (feedListContainer) {
            if (target.closest('#updateAll')) { await plugin.updateAllFeeds(); return; }
            if (target.closest('#saveFeedsData')) { await plugin.handleSaveData(); return; }
            if (target.closest('#addFeed')) { new AddFeedModal(plugin.app, plugin).open(); return; }
            if (target.closest('#manageFeeds')) { new ManageFeedsModal(plugin.app, plugin).open(); return; }
            if (target.closest('#search')) { plugin.handleSearch(); return; }
            if (target.closest('#undo')) { plugin.handleUndo(); return; }
            if (target.closest('#toggleOrder') && target instanceof HTMLElement) { plugin.handleToggleOrder(target); return; }
            if (target.closest('.filter-item')) { plugin.handleFilterChange(target.id); return; }
            if (target.closest('#showStarredItems')) { plugin.handleShowAllStarred(); return; }
            const feedStatsEl = target.closest<HTMLElement>('.feed-stats');
            if (feedStatsEl) { await plugin.handleRefreshSingleFeed(feedStatsEl); return; }
            const showFeedEl = target.closest<HTMLElement>('.showFeed');
            if (showFeedEl) { plugin.handleShowFeed(showFeedEl.id); return; }
        }

        // --- Main View Actions ---
        const mainViewContainer = target.closest('.feeds-reader-content-view');
        if (mainViewContainer) {
             if (target.closest('#toggleDisplayMode') && target instanceof HTMLElement) { plugin.handleToggleDisplayMode(target); return; }
             if (target.closest('#refreshCurrentFeed')) { await plugin.handleRefreshSingleFeed(target, true); return; }
             if (target.closest('#decreaseCardWidth')) { plugin.adjustCardWidth(-20); return; }
             if (target.closest('#increaseCardWidth')) { plugin.adjustCardWidth(20); return; }
             if (target.closest('.markPageRead')) { plugin.handleMarkPageReadOrDelete('read'); return; }
             if (target.closest('.markPageDeleted')) { plugin.handleMarkPageReadOrDelete('delete'); return; }
             if (target.closest('.removePageContent')) { plugin.handleRemovePageContent(); return; }
             if (target.closest('#nextPage')) { plugin.handlePageChange(1); return; }
             if (target.closest('#prevPage')) { plugin.handlePageChange(-1); return; }

             // Item specific actions
             const itemActionBtn = target.closest<HTMLElement>('.item-action-button, .item-action-star, .item-action-link');
             const itemElement = target.closest<HTMLElement>('[data-idx][data-feedurl]');
             if (itemElement) {
                 const idxStr = itemElement.getAttribute('data-idx');
                 const feedUrl = itemElement.getAttribute('data-feedurl');
                 if (idxStr === null || feedUrl === null) return;
                 const idx = parseInt(idxStr);

                 // Click on title/card itself (not buttons)
                 const titleOrCardClick = target.closest('.card-title a, .list-item-title a, .card-item:not(.card-actions *)');
                 if (titleOrCardClick && itemElement.contains(titleOrCardClick) && !itemActionBtn) {
                     evt.preventDefault();
                     plugin.showItemContentInModal(idx, feedUrl);
                     return;
                 }

                 // Click on action buttons (ensure itemActionBtn is HTMLElement)
                 if (itemActionBtn instanceof HTMLElement && itemElement.contains(itemActionBtn)) {
                     if (itemActionBtn.classList.contains('item-action-star')) { plugin.handleToggleStar(itemActionBtn, idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('toggleRead')) { plugin.handleToggleRead(itemActionBtn, idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('toggleDelete')) { plugin.handleToggleDelete(itemActionBtn, idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('jotNotes')) { plugin.handleJotNotes(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('saveSnippet')) { await plugin.handleSaveSnippet(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('noteThis')) { await plugin.handleNoteThis(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('renderMath')) { plugin.handleRenderMath(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('askChatGPT')) { await plugin.handleAskChatGPT(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('elEmbedButton')) { plugin.handleEmbed(idx, feedUrl); return; }
                     if (itemActionBtn.classList.contains('elFetch')) { await plugin.handleFetch(idx, feedUrl); return; }
                 }
             }
        }

        // Handle toggleNavi button if it exists outside the sidebar container (mobile fixed button)
        if (target.closest('#toggleNavi')) { plugin.handleToggleNavi(target); return; }
    }

    handleContextMenu(evt: MouseEvent) {
        const target = evt.target as HTMLElement;
         // Sidebar feed item context menu
         const showFeedEl = target.closest<HTMLElement>('.showFeed');
         if (showFeedEl) {
             evt.preventDefault();
             const url = showFeedEl.id;
             const feed = GLB.feedList.find(f => f.feedUrl === url);
             if (!feed) return;
             const menu = new Menu();
             menu.addItem(i => i.setTitle(`Update "${feed.name}"`).setIcon("refresh-cw").onClick(async () => {
                 const statsEl = showFeedEl.querySelector<HTMLElement>('.feed-stats');
                 if (statsEl) await this.handleRefreshSingleFeed(statsEl, false);
             }));
             menu.addItem(i => i.setTitle(`Mark all read`).setIcon("check-circle").onClick(async () => {
                 if (window.confirm(`Mark all items in ${feed.name} read?`)) {
                     this.markAllRead(url);
                     await this.refreshFeedListSidebar(); // Update sidebar UI
                     if (GLB.currentFeed === url) this.refreshDisplay(); // Update main view if current
                 }
             }));
             menu.addItem(i => i.setTitle(`Manage...`).setIcon("settings").onClick(() => {
                 new ManageFeedsModal(this.app, this).open();
             }));
             menu.addSeparator();
             menu.addItem(i => i.setTitle(`Copy URL`).setIcon("link").onClick(() => {
                 navigator.clipboard.writeText(url); new Notice("Copied!");
             }));
             menu.showAtMouseEvent(evt);
             return;
         }

         // Main view feed item context menu
         const itemElement = target.closest<HTMLElement>('[data-idx][data-feedurl]');
         if (itemElement) {
             evt.preventDefault();
             const idxStr = itemElement.getAttribute('data-idx');
             const url = itemElement.getAttribute('data-feedurl');
             if (idxStr === null || url === null) return;
             const idx = parseInt(idxStr);
             const item = GLB.feedsStore[url]?.items[idx];
             if (!item) return;
             const menu = new Menu();
             menu.addItem(i => i.setTitle(item.read ? "Unread" : "Read").setIcon(item.read ? "circle-off" : "check-circle").onClick(() => {
                 // Try finding button within the item element in the main view
                 const btn = this.frViewInstance?.contentEl.querySelector(`#toggleRead${idx}`);
                 if (btn instanceof HTMLElement) this.handleToggleRead(btn, idx, url);
             }));
             menu.addItem(i => i.setTitle(item.starred ? "Unstar" : "Star").setIcon(item.starred ? "star-off" : "star").onClick(() => {
                 const btn = itemElement.querySelector<HTMLElement>('.item-action-star'); // Check within item element
                 if (btn) this.handleToggleStar(btn, idx, url);
             }));
             if (item.link) {
                 menu.addItem(i => i.setTitle("Open Original").setIcon("external-link").onClick(() => window.open(item.link!, '_blank')));
                 menu.addItem(i => i.setTitle("Copy Link").setIcon("link").onClick(() => { navigator.clipboard.writeText(item.link!); new Notice("Copied!"); }));
             }
             menu.addSeparator();
             menu.addItem(i => i.setTitle(item.deleted ? "Undelete" : "Delete").setIcon(item.deleted ? "undo" : "trash").onClick(() => {
                  const btn = this.frViewInstance?.contentEl.querySelector(`#toggleDelete${idx}`);
                  if (btn instanceof HTMLElement) this.handleToggleDelete(btn, idx, url);
             }));
             menu.showAtMouseEvent(evt);
         }
     }

    // --- Specific Event Handler Implementations ---
    async handleSaveData() { try{const n=await this.saveFeedsData(); new Notice(n>0?`Saved ${n} chunk(s).`:"No changes.",1500);}catch(e){console.error("Save err:",e);new Notice("Save error.",2000);} }
    handleSearch() {
        if(!GLB.currentFeed) { new Notice("Select feed first.",3000); return; }
        if(GLB.currentFeed===GLB.STARRED_VIEW_ID) { new Notice("Search not available for Starred Items.",3000); return; }
        new SearchModal(this.app).open();
    }
    handleToggleNavi(target: HTMLElement) {
        // Find the mobile overlay panel specifically
        const mobilePanel = document.querySelector('body.is-mobile .feeds-reader-left-panel');
        if (mobilePanel instanceof HTMLElement) {
             // Toggle the class based on its current state
             const isHidden = mobilePanel.classList.contains('panel-hidden');
             // ★★★ Correctly use toggleClass with boolean argument ★★★
             mobilePanel.toggleClass('panel-hidden', !isHidden);
             if (target) target.setText(isHidden ? '>' : '<'); // Update button text
             return; // Handled mobile case
        }

        // Fallback for desktop or potentially other structures
        const leftPanel = document.getElementById('feedsReaderLeftPanel'); // Use the ID expected in desktop mode
        if (leftPanel instanceof HTMLElement) {
            const isHidden = leftPanel.classList.contains('panel-hidden');
             // ★★★ Correctly use toggleClass with boolean argument ★★★
            leftPanel.toggleClass('panel-hidden', !isHidden);
            if (target) target.setText(isHidden ? '>' : '<');

            // Desktop-only logic for right panel margin and aux button
            if (!Platform.isMobile) {
                const cb = document.getElementById('contentBox'); // Main content view div
                const tc = document.getElementById('toggleNaviContainer'); // Toggle container
                const aux = document.getElementById('toggleNaviAux'); // Aux button container

                if (cb && tc && aux) {
                    if (!isHidden) { // Hiding panel
                        cb.removeClass('contentBoxRightpage');
                        cb.addClass('contentBoxFullpage');
                        tc.addClass('fixed');
                        aux.empty();
                        const sb = aux.createEl('span', { text: 'Save', cls: 'save_data_toggling' });
                        sb.id = 'save_data_toggling';
                    } else { // Showing panel
                        cb.addClass('contentBoxRightpage');
                        cb.removeClass('contentBoxFullpage');
                        tc.removeClass('fixed');
                        aux.empty();
                    }
                }
            }
        } else {
            console.error("Could not find left panel element to toggle.");
        }
    }
    async handleRefreshSingleFeed(target: HTMLElement, forceCurrentViewUpdate: boolean = false) {
        const statsEl = target.classList.contains('feed-stats') ? target : target.closest('.feed-stats');
        const urlA = statsEl?.getAttribute('fdUrl') || target.getAttribute('fdUrl');
        const url = (urlA && urlA !== GLB.STARRED_VIEW_ID) ? urlA : (GLB.currentFeed && GLB.currentFeed !== GLB.STARRED_VIEW_ID ? GLB.currentFeed : null);

        if (url) {
            const nameA = statsEl?.getAttribute('fdName') || target.getAttribute('fdName') || GLB.currentFeedName;
            const name = nameA || url;
            new Notice(`Updating ${name}...`, 1000);
            try {
                const [nNew, _] = await this.updateOneFeed(url);
                new Notice(`${name}: ${nNew} new.`, 3000);
                await this.refreshFeedListSidebar();
                if (GLB.currentFeed === url || forceCurrentViewUpdate) {
                    this.makeDisplayList(); // Recalculate display indices
                    this.refreshDisplay(); // Update main display
                }
                // If starred view is active and new items came from ANY feed, refresh starred view potentially
                 if (GLB.currentFeed === GLB.STARRED_VIEW_ID && nNew > 0) {
                      this.makeDisplayList(); // Regenerate starred list
                      this.refreshDisplay(); // Refresh starred view
                 }
            } catch (e: any) {
                console.error(`Update err ${name}:`, e); new Notice(`Update failed ${name}: ${e.message}`, 3000);
            }
        } else if (target.closest('#refreshCurrentFeed') && GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            new Notice("Cannot refresh Starred Items view.", 3000);
        } else {
            new Notice("Cannot find feed URL to refresh.", 2000);
        }
    }

    handleShowFeed(feedUrl:string) {
        console.log(`handleShowFeed called with URL: ${feedUrl}`);
        if (feedUrl === GLB.STARRED_VIEW_ID) {
            this.handleShowAllStarred();
            return;
        }
        if(feedUrl === GLB.currentFeed) {
             console.log("Feed already selected, potentially closing sidebar if mobile.");
             // If on mobile and sidebar is open, close it even if feed doesn't change
             if (Platform.isMobile) {
                 this.closeMobileSidebar();
             }
             return;
        }

        const prev = GLB.currentFeed;
        GLB.currentFeed = feedUrl;
        if (!GLB.currentFeed) { console.error("handleShowFeed: currentFeed became null unexpectedly."); return; }

        const f = GLB.feedList.find(f => f.feedUrl === GLB.currentFeed);
        GLB.currentFeedName = f ? f.name : 'Unknown';
        console.log(`Set current feed to: ${GLB.currentFeedName} (${GLB.currentFeed})`);

        // Reset state only if feed actually changed
        if (prev !== GLB.currentFeed) {
             GLB.undoList = [];
             GLB.idxItemStart = 0;
             GLB.nPage = 1;
             console.log("Feed changed, reset undo list and pagination.");
        }

        // Reset filters/sort only if switching away from starred view
        if (prev === GLB.STARRED_VIEW_ID) {
            GLB.filterMode = 'all';
            GLB.itemOrder = 'New to old';
            console.log("Switched from starred, reset filter/sort.");
        }

        try {
            console.log("Making display list...");
            this.makeDisplayList();
            console.log("Refreshing main display...");
            this.refreshDisplay();
            console.log("Refreshing sidebar highlighting...");
            this.feedListViewInstance?.updateFeedHighlighting();

            // Close mobile sidebar after selection
            if (Platform.isMobile) {
                this.closeMobileSidebar();
            }

        } catch (error) {
            console.error("Error showing feed:", error);
            new Notice("Failed to display feed.", 3000);
        }
    }
    handleShowAllStarred(forceViewSwitch=true) {
        console.log("handleShowAllStarred called. Force switch:", forceViewSwitch);
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID && forceViewSwitch) {
             console.log("Starred view already active, potentially closing sidebar.");
              // If on mobile and sidebar is open, close it
             if (Platform.isMobile) {
                 this.closeMobileSidebar();
             }
             return;
        }

        const prev = GLB.currentFeed;
        GLB.currentFeed = GLB.STARRED_VIEW_ID;
        GLB.currentFeedName = 'Starred Items';
        console.log("Set current feed to Starred Items.");
        // Starred view implies these filters/sorts
        GLB.filterMode = 'starred'; // Force starred filter
        GLB.itemOrder = 'New to old'; // Reset sort order

        // Reset pagination only if view actually changed
        if (prev !== GLB.STARRED_VIEW_ID) {
            GLB.undoList = [];
            GLB.idxItemStart = 0;
            GLB.nPage = 1;
             console.log("Switched to starred, reset undo list and pagination.");
        }

        try {
            console.log("Making display list for starred...");
             this.makeDisplayList(); // Generate starredItemsList
             console.log("Refreshing main display for starred...");
             this.refreshDisplay(); // Render main view with starred items
             console.log("Refreshing sidebar highlighting for starred...");
             this.feedListViewInstance?.updateFeedHighlighting(); // Update sidebar highlights/filters

            console.log(`Show ${GLB.starredItemsList.length} starred.`);
            if (GLB.starredItemsList.length === 0 && forceViewSwitch) new Notice("No starred items found.", 2000);

             // Close mobile sidebar after selection
             if (Platform.isMobile) {
                 this.closeMobileSidebar();
             }

        } catch (error) {
            console.error("Error showing starred:", error);
            new Notice("Failed to display starred items.", 3000);
        }
    }

    // Helper to close mobile sidebar overlay
    closeMobileSidebar() {
        console.log("Attempting to close mobile sidebar.");
        const mobilePanel = document.querySelector('body.is-mobile .feeds-reader-left-panel');
        if (mobilePanel instanceof HTMLElement && !mobilePanel.classList.contains('panel-hidden')) {
            mobilePanel.addClass('panel-hidden');
            // Update toggle button text if needed
            const toggleButton = document.getElementById('toggleNavi');
            if (toggleButton) {
                toggleButton.setText('>'); // Or appropriate icon/text
            }
            console.log("Closed mobile sidebar.");
        } else {
             console.log("Mobile sidebar not found or already hidden.");
        }
    }


    handleToggleDisplayMode(target:HTMLElement) {
        GLB.displayMode = GLB.displayMode === 'list' ? 'card' : 'list';
        target.setText(GLB.displayMode === 'list' ? 'Card View' : 'List View');
        this.settings.defaultDisplayMode = GLB.displayMode;
        this.saveSettings();
        this.refreshDisplay(); // Refresh main view only
    }
    adjustCardWidth(delta:number) {
        if(GLB.displayMode !== 'card') return;
        const root=document.documentElement.style;
        let currentWidth = parseInt(root.getPropertyValue('--card-item-width') || this.settings.cardWidth.toString() || '280');
        let newWidth = Math.max(180, currentWidth + delta); // Min width 180
        newWidth = Math.min(800, newWidth); // Max width 800
        root.setProperty('--card-item-width', `${newWidth}px`);
        GLB.cardWidth = newWidth;
        this.settings.cardWidth = newWidth;
        this.saveSettings();
        // No need to call refreshDisplay just for width change, CSS handles it
    }

    handleFilterChange(filterId: string) {
        const newFilter = filterId.replace('filter', '').toLowerCase() as typeof GLB.filterMode;
        if (newFilter === GLB.filterMode) return;

        // Special handling for starred view
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            if (newFilter !== 'starred') {
                 new Notice(`Only 'Starred' filter available in Starred Items view.`, 3000);
                 // Ensure sidebar filter UI reflects this constraint
                 this.feedListViewInstance?.updateFeedHighlighting();
                 return;
            }
            // If already in starred view and clicking 'starred' filter, do nothing extra
            // GLB.filterMode is already 'starred' in handleShowAllStarred
        } else {
             // For regular feeds, update the filter mode
            GLB.filterMode = newFilter;
        }


        // Reset pagination and refresh display for the current feed (or starred items)
        GLB.idxItemStart = 0;
        GLB.nPage = 1;
        this.makeDisplayList(); // Re-filter the display list
        this.refreshDisplay(); // Re-render the main view
        this.feedListViewInstance?.updateFeedHighlighting(); // Update sidebar filter UI
    }

    handleToggleOrder(target: HTMLElement) {
        if (GLB.itemOrder === 'New to old') GLB.itemOrder = 'Old to new';
        else if (GLB.itemOrder === 'Old to new') GLB.itemOrder = 'Random';
        else GLB.itemOrder = 'New to old';

        // Reset pagination and refresh display
        GLB.idxItemStart = 0;
        GLB.nPage = 1;
        this.makeDisplayList(); // Re-sort the display list
        this.refreshDisplay(); // Re-render the main view
        this.feedListViewInstance?.updateFeedHighlighting(); // Update sidebar sort UI
    }

    handlePageChange(delta:number) {
        const totalItems = (GLB.currentFeed === GLB.STARRED_VIEW_ID) ? GLB.starredItemsList.length : GLB.displayIndices.length;
        const newStartIndex = GLB.idxItemStart + delta * GLB.nItemPerPage;

        if (newStartIndex >= 0 && newStartIndex < totalItems) {
            GLB.idxItemStart = newStartIndex;
            GLB.nPage += delta;
            this.refreshDisplay(); // Refresh main view to show new page
            // Scroll main content area to top
            this.frViewInstance?.contentEl.querySelector('.feed-content-area')?.scrollTo(0, 0);
        } else if (delta > 0 && GLB.idxItemStart + GLB.nItemPerPage >= totalItems) {
            new Notice("Last page.", 1500);
        } else if (delta < 0 && GLB.nPage <= 1) {
            new Notice("First page.", 1500);
        }
    }

    // --- Item Actions ---
    handleToggleStar(target: HTMLElement, idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item) return;
        const wasStarred = item.starred;
        item.starred = !item.starred;

        // Update button appearance
        target.setText(item.starred ? '★' : '☆');
        target.toggleClass('starred', item.starred);
        // Update item container appearance
        const itemElement = target.closest('[data-idx]');
        itemElement?.toggleClass('starred-item', item.starred);

        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);

        // Refresh views if necessary
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            // Re-generate starred list and refresh main view
            this.makeDisplayList();
            this.refreshDisplay();
        } else if (GLB.filterMode === 'starred') {
            // Re-filter and refresh main view if 'Starred' filter is active
             this.makeDisplayList();
             this.refreshDisplay();
        }

        this.refreshFeedListSidebar(); // Update counts in sidebar regardless
        this.addUndoAction(feedUrl, idx, { starred: wasStarred });
    }

    handleToggleRead(target: HTMLElement, idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item) return;
        const previousState = { read: item.read, deleted: item.deleted };
        let changed = false;

        if (!item.read) { // Mark as read
            if (item.deleted) item.deleted = null; // Undelete if marking as read
            item.read = nowdatetime();
            target.setText('Unread');
            const itemElement = target.closest('[data-idx]');
            if (itemElement) {
                 itemElement.addClass('read');
                 itemElement.removeClass('deleted'); // Ensure deleted class removed
            }
            // Update corresponding delete button text if it exists
            this.frViewInstance?.contentEl.querySelector(`#toggleDelete${idx}`)?.setText('Delete');
            changed = true;
        } else { // Mark as unread
            item.read = null;
            target.setText('Read');
            target.closest('[data-idx]')?.removeClass('read');
            changed = true;
        }

        if (changed) {
            GLB.feedsStoreChange = true;
            GLB.feedsStoreChangeList.add(feedUrl);
            this.updateItemVisibility(item, idx, feedUrl); // Update visibility in main view based on filters
            this.refreshFeedListSidebar(); // Update counts in sidebar
            this.addUndoAction(feedUrl, idx, previousState);
        }
    }

     handleToggleDelete(target: HTMLElement, idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item) return;
        const previousState = { read: item.read, deleted: item.deleted };
        let changed = false;

        if (!item.deleted) { // Mark as deleted
            if (item.read) item.read = null; // Unread if marking as deleted
            item.deleted = nowdatetime();
            target.setText('Undelete');
            const itemElement = target.closest('[data-idx]');
             if (itemElement) {
                 itemElement.addClass('deleted');
                 itemElement.removeClass('read'); // Ensure read class removed
            }
            // Update corresponding read button text if it exists
            this.frViewInstance?.contentEl.querySelector(`#toggleRead${idx}`)?.setText('Read');
            changed = true;
        } else { // Undelete
            item.deleted = null;
            target.setText('Delete');
            target.closest('[data-idx]')?.removeClass('deleted');
            changed = true;
        }

        if (changed) {
            GLB.feedsStoreChange = true;
            GLB.feedsStoreChangeList.add(feedUrl);

            if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
                // Regenerate starred list and refresh if item might be affected
                 this.makeDisplayList();
                 this.refreshDisplay();
            } else {
                 // Update visibility based on filters in the main view
                 this.updateItemVisibility(item, idx, feedUrl);
            }
            this.refreshFeedListSidebar(); // Update counts in sidebar
            this.addUndoAction(feedUrl, idx, previousState);
        }
    }

    handleJotNotes(idx:number, feedUrl:string) {
        const containerId = `shortNoteContainer_${feedUrl}_${idx}`;
        let noteContainer = document.getElementById(containerId);
        // Find the item element within the main view's content area
        const itemElement = this.frViewInstance?.contentEl.querySelector(`[data-idx="${idx}"][data-feedurl="${feedUrl}"]`);
        const actionContainer = this.frViewInstance?.contentEl.querySelector(`#actionContainer${idx}`);

        if (noteContainer) {
            // Toggle visibility
            noteContainer.style.display = noteContainer.style.display === 'none' ? 'block' : 'none';
            const textarea = noteContainer.querySelector('textarea');
            if (textarea && noteContainer.style.display === 'block') {
                textarea.focus();
            }
        } else if (itemElement) {
            // Create container and textarea
            noteContainer = itemElement.createDiv({ cls: 'short-note-container' });
            noteContainer.id = containerId;
            const shortNoteArea = noteContainer.createEl('textarea', { cls: 'shortNote' });
            shortNoteArea.id = `shortNote_${feedUrl}_${idx}`; // Keep ID for saving
            shortNoteArea.rows = 3;
            shortNoteArea.placeholder = 'Jot notes...';

            // Insert before action buttons if they exist, otherwise append
            if (actionContainer) {
                itemElement.insertBefore(noteContainer, actionContainer);
            } else {
                itemElement.appendChild(noteContainer);
            }
            shortNoteArea.focus();
        }
    }
    async handleSaveSnippet(idx:number, feedUrl:string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item) return;
        const snippetFilePath = `${GLB.feeds_reader_dir}/${GLB.saved_snippets_fname}`;
        try {
            if (!await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
                await this.app.vault.createFolder(GLB.feeds_reader_dir);
            }
            const itemLink = item.link || '';
            let shortNoteContent = (document.getElementById(`shortNote_${feedUrl}_${idx}`) as HTMLTextAreaElement)?.value.trim() || '';
            const dateStr = `\n> <small>${formatDate(item.pubDate || item.downloaded)}</small>`;
            const feedNameStr = GLB.feedsStore[feedUrl]?.name ? `\n> <small>${GLB.feedsStore[feedUrl].name}</small>` : '';
            let contentStr = '';
            if (this.settings.saveContent && item.content) {
                let authorStr = item.creator ? `\n> Author: ${htmlToMarkdown(item.creator)}` : '';
                try {
                    contentStr = remedyLatex(htmlToMarkdown(item.content)) + authorStr;
                } catch (e) {
                    contentStr = "[Content Error]" + authorStr;
                }
            }
            const title = item.title?.trim().replace(/(<([^>]+)>)/gi, " ") || 'No Title';
            const snippetContent: string = `${shortNoteContent ? shortNoteContent + '\n' : ''}> [!abstract]- [${title}](${itemLink})\n> ${contentStr}${dateStr}${feedNameStr}`;

            let fileExists = await this.app.vault.adapter.exists(snippetFilePath);
            let fileContent = fileExists ? await this.app.vault.adapter.read(snippetFilePath) : '';

            if (fileExists && fileContent.includes(itemLink)) {
                new Notice("URL already exists in snippets file.", 1500);
                return;
            }

            const contentToWrite = fileExists
                ? (this.settings.saveSnippetNewToOld ? `${snippetContent}\n\n<hr>\n\n${fileContent}` : `${fileContent}\n\n<hr>\n\n${snippetContent}`)
                : snippetContent;

            await this.app.vault.adapter.write(snippetFilePath, contentToWrite);
            new Notice(`Snippet ${fileExists ? 'appended' : 'saved'} to ${GLB.saved_snippets_fname}.`, 1500);
        } catch (e) {
            console.error("Save Snippet Error:", e);
            new Notice("Error saving snippet.", 2000);
        }
    }
    async handleNoteThis(idx:number, feedUrl:string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item) return;
        const notesDir = GLB.feeds_reader_dir;
        try {
            if (!await this.app.vault.adapter.exists(notesDir)) {
                await this.app.vault.createFolder(notesDir);
            }
            const itemLink = item.link || '';
            let dateForFilename: string = (item.pubDate || item.downloaded || nowdatetime()).substring(0, 10);
            const titleForFilename = item.title?.trim().replace(/(<([^>]+)>)/gi, " ").substring(0, 50) || 'No Title';
            const feedNameForFilename = GLB.feedsStore[feedUrl]?.name ? str2filename(GLB.feedsStore[feedUrl].name) + '-' : '';
            const baseFilename: string = str2filename(`${dateForFilename}-${feedNameForFilename}${titleForFilename}`);

            let noteFilename = `${baseFilename}.md`;
            let counter = 0;
            while (await this.app.vault.adapter.exists(`${notesDir}/${noteFilename}`)) {
                noteFilename = `${baseFilename}-${++counter}.md`;
            }
            const noteFilepath: string = `${notesDir}/${noteFilename}`;

            let shortNoteContent = (document.getElementById(`shortNote_${feedUrl}_${idx}`) as HTMLTextAreaElement)?.value.trim() || '';
            let contentStr = '';
             if (this.settings.saveContent && item.content) {
                let authorStr = item.creator ? `\n\nAuthor: ${htmlToMarkdown(item.creator)}` : '';
                try {
                    contentStr = remedyLatex(htmlToMarkdown(item.content)) + authorStr;
                } catch (e) {
                    contentStr = "[Content Error]" + authorStr;
                }
            }
            const title = item.title?.trim().replace(/(<([^>]+)>)/gi, " ") || 'No Title';
            const formattedDate = formatDate(item.pubDate || item.downloaded);
            const fileContent: string = `---
feed: ${GLB.feedsStore[feedUrl]?.name || 'Unknown'}
url: ${itemLink}
date: ${item.pubDate || item.downloaded}
starred: ${item.starred || false}
tags: [rss, feed]
---
# [${title}](${itemLink})

*Date: ${formattedDate}*
${item.creator ? `*Author: ${item.creator}*\n` : ''}
${shortNoteContent ? `## Notes\n\n${shortNoteContent}\n\n---\n` : ''}
${contentStr ? `## Content\n\n${contentStr}` : ''}
`;
            await this.app.vault.create(noteFilepath, fileContent);
            new Notice(`${noteFilename} saved.`, 1500);
        } catch (e) {
            console.error("Save Note Error:", e);
            new Notice("Error saving note.", 2000);
        }
    }
    handleRenderMath(idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item?.content) return;
        new MathRenderModal(this.app, item, this).open();
    }
    async handleAskChatGPT(idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item?.content) { new Notice("No content to send.", 1500); return; }
        const apiKey = this.settings.chatGPTAPIKey;
        const prompt = this.settings.chatGPTPrompt;
        if (!apiKey || !prompt) { new Notice("ChatGPT API Key or Prompt not set in settings.", 2000); return; }
        new ChatGPTInteractionModal(this.app, item, apiKey, prompt, this).open();
    }
    handleEmbed(idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item?.link) { new Notice("No link to embed.", 1500); return; }
        new EmbedModal(this.app, item.link, item.title).open();
    }
    async handleFetch(idx: number, feedUrl: string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        if (!item?.link) { new Notice("No link to fetch.", 1500); return; }
        new FetchContentModal(this.app, item.link, item.title).open();
    }

    // --- Undo Logic ---
    addUndoAction(feedUrl: string, index: number, previousState: Partial<RssFeedItem>) {
        GLB.undoList.unshift({ feedUrl, index, previousState });
        if (GLB.undoList.length > 50) GLB.undoList.pop(); // Limit undo history
    }
    handleUndo() {
        if (GLB.undoList.length === 0) { new Notice("Nothing to undo.", 1000); return; }
        const lastAction = GLB.undoList.shift();
        if (!lastAction) return;

        const { feedUrl, index, previousState } = lastAction;
        const feed = GLB.feedsStore[feedUrl];
        if (!feed?.items[index]) { console.warn("Undo: Item not found at index", index, "for feed", feedUrl); return; }

        const item = feed.items[index];
        let restored = false;
        // Apply previous state properties
        for (const key in previousState) {
            if (previousState.hasOwnProperty(key)) {
                (item as any)[key] = (previousState as any)[key];
                restored = true;
            }
        }

        if (restored) {
            GLB.feedsStoreChange = true;
            GLB.feedsStoreChangeList.add(feedUrl);
            new Notice("Action undone.", 1000);

            // Refresh UI
            this.refreshFeedListSidebar(); // Update sidebar counts/state
            // Refresh main view only if the undone action affects the current view
            if (GLB.currentFeed === feedUrl || GLB.currentFeed === GLB.STARRED_VIEW_ID) {
                 this.makeDisplayList(); // Remake list in case filter/sort/starred status changed visibility
                 this.refreshDisplay(); // Refresh main view content
            }
        } else {
            new Notice("Could not restore previous state.", 1500);
        }
    }

    // --- Page Actions ---
    handleMarkPageReadOrDelete(action: 'read' | 'delete') {
        let itemsToModify: { feedUrl: string, index: number }[] = [];
        const startIndex = GLB.idxItemStart;
        let endIndex: number;

        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            endIndex = Math.min(GLB.starredItemsList.length, startIndex + GLB.nItemPerPage);
            for (let i = startIndex; i < endIndex; i++) {
                // Ensure index exists before accessing
                 if(GLB.starredItemsList[i]) {
                     itemsToModify.push({ feedUrl: GLB.starredItemsList[i].feedUrl, index: GLB.starredItemsList[i].originalIndex });
                 }
            }
        } else if (GLB.currentFeed) {
            endIndex = Math.min(GLB.displayIndices.length, startIndex + GLB.nItemPerPage);
            for (let i = startIndex; i < endIndex; i++) {
                 // Ensure index exists before accessing
                 if(GLB.displayIndices[i] !== undefined) {
                    itemsToModify.push({ feedUrl: GLB.currentFeed, index: GLB.displayIndices[i] });
                 }
            }
        } else {
            // No feed selected, do nothing
            return;
        }

        if (itemsToModify.length === 0) {
             new Notice("No items on this page to mark.", 1000);
             return;
        }

        const now = nowdatetime();
        let changed = false;
        let numMarked = 0;
        const undoActions: { feedUrl: string, index: number, previousState: Partial<RssFeedItem> }[] = [];

        itemsToModify.forEach(({ feedUrl, index }) => {
            const item = GLB.feedsStore[feedUrl]?.items[index];
            if (!item) return;

            const currentState = { read: item.read, deleted: item.deleted };
            let itemChanged = false;

            if (action === 'read') {
                if (!item.read || item.deleted) { // Mark read only if unread or deleted
                    if(item.deleted) item.deleted = null; // Undelete if marking read
                    item.read = now;
                    itemChanged = true;
                }
            } else { // action === 'delete'
                if (!item.deleted || item.read) { // Mark deleted only if not deleted or if read
                    if(item.read) item.read = null; // Unread if marking deleted
                    item.deleted = now;
                    itemChanged = true;
                }
            }

            if (itemChanged) {
                changed = true;
                numMarked++;
                undoActions.push({ feedUrl, index, previousState: currentState });
                GLB.feedsStoreChange = true;
                GLB.feedsStoreChangeList.add(feedUrl);
            }
        });

        if (changed) {
            new Notice(`${numMarked} item(s) marked ${action}.`, 1500);
            // Add undo actions in reverse order they were applied
            undoActions.reverse().forEach(u => this.addUndoAction(u.feedUrl, u.index, u.previousState));

            // Refresh UI
            this.refreshFeedListSidebar(); // Update sidebar counts
            this.makeDisplayList(); // Update display list for potential visibility changes
            this.refreshDisplay(); // Refresh main view
        } else {
            new Notice(`No items on this page needed marking as ${action}.`, 1000);
        }
    }

    handleRemovePageContent() {
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
             new Notice("Cannot remove content from Starred Items view.", 2000);
             return;
        }
        if (!GLB.currentFeed || !GLB.feedsStore[GLB.currentFeed]) {
             new Notice("No feed selected to remove content from.", 2000);
             return;
        }
        if (!window.confirm(`Remove downloaded content (descriptions, authors) for items currently VISIBLE on THIS page of '${GLB.currentFeedName}'? Titles and links remain. This action cannot be easily undone.`)) {
            return;
        }

        const feedStore = GLB.feedsStore[GLB.currentFeed];
        let changed = false;
        const startIndex = GLB.idxItemStart;
        const endIndex = Math.min(GLB.displayIndices.length, startIndex + GLB.nItemPerPage);

        for (let i = startIndex; i < endIndex; i++) {
             // Ensure index exists
            if(GLB.displayIndices[i] === undefined) continue;
            const itemIndex = GLB.displayIndices[i];
            const item = feedStore.items[itemIndex];
            if (!item) continue;

            let itemChanged = false;
            // Use delete operator for optional properties
            if (item.hasOwnProperty('content')) {
                delete item.content;
                itemChanged = true;
            }
             if (item.hasOwnProperty('creator')) {
                delete item.creator;
                itemChanged = true;
            }
             if (item.hasOwnProperty('category')) {
                delete item.category;
                itemChanged = true;
            }
            // Keep imageUrl? Decide based on preference. Let's keep it for now.

            if (itemChanged) changed = true;
        }

        if (changed) {
            GLB.feedsStoreChange = true;
            GLB.feedsStoreChangeList.add(GLB.currentFeed);
            new Notice("Content removed for items on this page.", 1500);
            this.refreshDisplay(); // Re-render main view to reflect removed content
        } else {
            new Notice("No content found to remove on this page.", 1000);
        }
    }

    // --- UI Update Helpers ---
    updateItemVisibility(item: RssFeedItem, idx: number, feedUrl: string) {
        // This function now primarily targets elements within the main FRView
        const el = this.frViewInstance?.contentEl.querySelector(`[data-idx="${idx}"][data-feedurl="${feedUrl}"]`);
        if (!el) return; // Element not found in the main view

        let isVisible = true;

        // Filter logic
        if (GLB.filterMode === 'unread' && (item.read || item.deleted)) {
            isVisible = false;
        } else if (GLB.filterMode === 'starred' && !item.starred) {
            isVisible = false;
        } else if (item.deleted && GLB.filterMode !== 'all') {
            // Hide deleted unless 'all' filter is active
            isVisible = false;
        }

        // Apply visibility classes using boolean
        el.toggleClass('hidedItem', !isVisible);

        // Special class for visible deleted items in 'all' mode
        el.toggleClass('deleted-visible', !!(item.deleted && GLB.filterMode === 'all' && isVisible));

        // Ensure correct read/deleted classes are applied
        el.toggleClass('read', !!item.read && !item.deleted); // Only read if not deleted
        el.toggleClass('deleted', !!item.deleted);
    }

    updateFeedStatsUI() {
        // DEPRECATED
        console.warn("updateFeedStatsUI is deprecated. Use refreshFeedListSidebar.");
    }

    // New helper to refresh sidebar content and state
    async refreshFeedListSidebar() {
        console.log("Refreshing feed list sidebar...");
        if (this.feedListViewInstance) {
             // Rebuild the feed list in the sidebar
             const tableElement = this.feedListViewInstance.contentEl.querySelector('#feedTable') as HTMLTableElement | null;
             await this.createFeedBar(tableElement); // Pass target table
             // Update highlights, filter, sort display
             this.feedListViewInstance.updateFeedHighlighting();
             console.log("Sidebar refreshed.");
        } else {
             console.log("Sidebar instance not found, cannot refresh.");
        }
    }
    // New helper to refresh main display content
    refreshDisplay() {
        console.log("Refreshing main display...");
        // Rerender the main content view only if the instance exists
        if (this.frViewInstance) {
             this.frViewInstance.renderContent();
             console.log("Main display refreshed.");
        } else {
             console.log("Main view instance not found, cannot refresh display.");
        }
    }

    // --- Modal Window Launchers ---
    showItemContentInModal(idx:number, feedUrl:string) {
        const item = GLB.feedsStore[feedUrl]?.items[idx];
        const feedName = GLB.feedsStore[feedUrl]?.name || 'Unknown Feed';
        if (!item) {
            new Notice("Cannot find item data.", 2000);
            return;
        }
        new ItemContentModal(this.app, item, feedName, this).open();
    }

    // --- Feed Update ---
    async updateAllFeeds() {
         new Notice("Starting all feeds update...", 2000);
         let totalNew = 0;
         const promises = GLB.feedList.map(async (feed) => {
             try {
                 const [nNew, _] = await this.updateOneFeed(feed.feedUrl);
                 if (nNew > 0) totalNew += nNew;
             } catch (e: any) {
                 console.error(`Update fail ${feed.name}:`, e);
                 new Notice(`Update failed: ${feed.name}`, 2000);
             }
         });
         await Promise.allSettled(promises);
         new Notice(`Update finished. ${totalNew} new items found.`, totalNew > 0 ? 3000 : 1500);

         // Refresh UI after updates
         await this.refreshFeedListSidebar(); // Update sidebar counts and list
         // Refresh main view if it's relevant
         if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
             this.makeDisplayList(); // Regenerate starred list
             this.refreshDisplay(); // Refresh starred view
         } else if (GLB.currentFeed) {
             this.makeDisplayList(); // Regenerate display indices
             this.refreshDisplay(); // Refresh current feed view
         }
     }

    // --- Feed Data Handling ---
    async loadSubscriptions() { await loadSubscriptions(this.app.vault.adapter); }
    async saveSubscriptions() { await saveSubscriptions(this.app, this.app.vault.adapter); }
    async createFeedBar(targetTableElement: HTMLTableElement | null) {
        const t = targetTableElement; // Use passed element directly
        if (!t) { console.error("Target table element not provided for createFeedBar"); return; }
        t.empty(); // Clear previous content
        let currentFolder = "%%%NO_FOLDER_YET%%%";

        // Handle empty feed list
        if (!GLB.feedList?.length) {
             const row = t.createTBody().createEl('tr');
             row.createEl('td').setText('No feeds subscribed.');
             return;
        }

        const tbody = t.createTBody();
        GLB.feedList.forEach(feed => {
             if (!feed?.feedUrl || !feed.name) return; // Skip invalid entries
             const folder = feed.folder || ""; // Default to empty string if no folder

             // Add Folder Header Row if folder changes
             if (folder !== currentFolder) {
                 currentFolder = folder;
                 const row = tbody.createEl('tr', { cls: 'feedFolderRow' });
                 const cell = row.createEl('td'); cell.colSpan = 2; // Span full width
                 cell.createEl('span', { text: currentFolder || "Uncategorized", cls: 'feedFolder' });
             }

             // Add Feed Item Row
             const tr = tbody.createEl('tr');
             const nameTd = tr.createEl('td');
             const showFeedSpan = nameTd.createEl('span', { cls: 'showFeed' });
             showFeedSpan.id = feed.feedUrl; // ID for click handler and highlighting

             showFeedSpan.createSpan({ text: feed.name, cls: 'feed-name' }); // Feed Name

             // Stats Span (right-aligned)
             const statsSpan = showFeedSpan.createSpan({ cls: 'feed-stats' });
             statsSpan.setAttrs({ 'fdUrl': feed.feedUrl, 'fdName': feed.name }); // Attributes for refresh handler

             const stats = this.getFeedStats(feed.feedUrl); // Use class method

             // Unread Count
             const unreadSpan = statsSpan.createEl('span', { text: stats.unread.toString(), cls: 'unreadCount' });
             // Total Count (optional based on threshold)
             if (stats.total < GLB.maxTotalnumDisplayed) {
                 statsSpan.createEl('span', { text: '/', cls: 'unreadCountSep' }); // Separator
                 statsSpan.createEl('span', { text: stats.total.toString(), cls: 'totalCount' }); // Total
             }
        });
        // Highlighting is handled separately by FeedListView.updateFeedHighlighting
    }
    async saveFeedsData(): Promise<number> {
        let numSavedChunks = 0;
        if (!GLB.feedsStoreChange || GLB.feedsStoreChangeList.size === 0) return 0;

        const storeFolder = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
        try {
            if (!await this.app.vault.adapter.exists(storeFolder)) {
                await this.app.vault.createFolder(storeFolder);
            }
        } catch (e) {
            console.error(`Error ensuring feed store folder exists (${storeFolder}):`, e);
            new Notice("Error creating feed store directory. Cannot save data.", 5000);
            return 0;
        }

        const savePromises: Promise<number>[] = [];
        const changedFeedUrls = Array.from(GLB.feedsStoreChangeList);

        for (const feedUrl of changedFeedUrls) {
            const feedInfo = GLB.feedList.find(f => f.feedUrl === feedUrl);
            const feedName = feedInfo?.name;
            const feedData = GLB.feedsStore[feedUrl];

            if (!feedData) { console.warn(`Save Skip: Feed data missing for ${feedUrl}`); continue; }
            if (!feedName) { console.warn(`Save Skip (no name associated): ${feedUrl}`); continue; }

            try {
                const dataString = JSON.stringify(feedData);
                // Pass app instance down to saveStringSplitted
                savePromises.push(this.saveStringSplitted(dataString, storeFolder, feedName, GLB.lenStrPerFile));
            } catch (e) {
                console.error(`Stringify error for feed ${feedName} (${feedUrl}):`, e);
            }
        }

        const results = await Promise.allSettled(savePromises);
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                numSavedChunks += result.value;
            } else {
                console.error("Chunk save error:", result.reason);
            }
        });

        // Reset change flags only after attempting all saves
        GLB.feedsStoreChange = false;
        GLB.feedsStoreChangeList.clear();

        if (numSavedChunks > 0) console.log(`Saved ${numSavedChunks} data chunks.`);
        return numSavedChunks;
    }
    async loadFeedsStoredData() { await loadFeedsStoredData(this.app.vault.adapter); }
    async loadOldCombinedDataFile() { await loadOldCombinedDataFile(this.app.vault.adapter); }
    mergeStoreWithNewData(newdata: RssFeedContent, key: string): number { return mergeStoreWithNewData(newdata, key); }
    async updateOneFeed(feedUrl: string): Promise<[number, number]> { return updateOneFeed(this.app, feedUrl, this.app.vault.adapter); }

    // --- Display List & View Rendering ---
    makeDisplayList() { makeDisplayList(); } // Global function call
    show_feed() { // Deprecated wrapper
         console.warn("FeedsReader.show_feed() is deprecated, use FeedsReader.refreshDisplay()");
         this.refreshDisplay();
    }
    createPageActionButtons(container: HTMLElement, hasItems: boolean) { createPageActionButtons(container, hasItems); }
    createPagination(container: HTMLElement, totalItems: number) { createPagination(container, totalItems); }
    createCardItem(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) { createCardItem(this.app, container, item, originalIndex, feedUrl, isStarredView); }
    createListItem(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) { createListItem(this.app, container, item, originalIndex, feedUrl, isStarredView); }
    createActionButtons(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, viewType: 'list' | 'card') { createActionButtons(container, item, originalIndex, feedUrl, viewType); }

    // --- Statistics ---
    getFeedStats(feedUrl: string): { total: number; read: number; deleted: number; unread: number; starred: number } { return getFeedStats(feedUrl); }
    getFeedStorageInfo(feedUrl: string): [string, string, number, number] { return getFeedStorageInfo(feedUrl); }

    // --- Feed Management Actions ---
    markAllRead(feedUrl: string) { markAllRead(feedUrl); }
    purgeDeleted(feedUrl: string) { purgeDeleted(feedUrl); }
    removeContent(feedUrl: string) { removeContent(feedUrl); }
    removeEmptyFields(feedUrl: string) { removeEmptyFields(feedUrl); }
    removeContentOld(feedUrl: string) { removeContentOld(feedUrl); }
    purgeAll(feedUrl: string) { purgeAll(feedUrl); }
    purgeOldHalf(feedUrl: string) { purgeOldHalf(feedUrl); }
    deduplicate(feedUrl: string): number { return deduplicate(feedUrl); }
    async removeFeed(feedUrl: string) { await removeFeed(this.app, this.app.vault.adapter, feedUrl, this); }

    // --- File I/O Helpers ---
    makeFilename(fname_base: string, iPostfix: number): string { return makeFilename(fname_base, iPostfix); }
    async saveStringToFileGzip(s: string, folder: string, fname: string): Promise<boolean> { return saveStringToFileGzip(this.app, this.app.vault.adapter, s, folder, fname); }
    async saveStringToFile(s: string, folder: string, fname: string): Promise<boolean> { return saveStringToFile(this.app, this.app.vault.adapter, s, folder, fname); }
    async saveStringSplitted(s: string, folder: string, fname_base: string, nCharPerFile: number): Promise<number> { return saveStringSplitted(this.app, this.app.vault.adapter, s, folder, fname_base, nCharPerFile); }
    async loadStringSplitted_Gzip(folder: string, fname_base: string): Promise<string> { return loadStringSplitted_Gzip(this.app.vault.adapter, folder, fname_base); }
    async loadStringSplitted(folder: string, fname_base: string): Promise<string> { return loadStringSplitted(this.app.vault.adapter, folder, fname_base); }

} // --- End of FeedsReader class ---


// ============================================================
// --- Global Helper Functions & Modal Definitions          ---
// ============================================================
// These functions operate on GLB or require App/Adapter instances

// --- Feed Data Handling ---
async function loadSubscriptions(adapter: DataAdapter) {
    const path = `${GLB.feeds_reader_dir}/${GLB.subscriptions_fname}`;
    GLB.feedList = [];
    try {
        if (await adapter.exists(path)) {
            const data = await adapter.read(path);
            if (data) {
                const parsedData = JSON.parse(data);
                if (!Array.isArray(parsedData)) throw new Error("Subscriptions data is not an array.");
                // Filter for valid feed entries (basic check)
                GLB.feedList = parsedData.filter(f => f?.name && f.feedUrl);
            }
        }
    } catch (e: any) {
        console.error("Load Subscriptions Error:", e);
        new Notice(`Error loading subscriptions: ${e.message}`, 3000);
        GLB.feedList = []; // Reset on error
    }
    sort_feed_list(); // Sort after loading
}

async function saveSubscriptions(app: App, adapter: DataAdapter) {
    const dirPath = GLB.feeds_reader_dir;
    const filePath = `${dirPath}/${GLB.subscriptions_fname}`;
    try {
        if (!await adapter.exists(dirPath)) {
             await app.vault.createFolder(dirPath); // Use vault API for folder creation
        }
        // Filter for valid items before saving
        const validFeedList = GLB.feedList.filter(f => f?.name && f.feedUrl);
        await adapter.write(filePath, JSON.stringify(validFeedList, null, 2)); // Pretty print JSON
    } catch (e: any) {
        console.error("Save Subscriptions Error:", e);
        new Notice(`Error saving subscriptions: ${e.message}`, 2000);
    }
}

// createFeedBar is now a class method in FeedsReader

// saveFeedsData is now a class method in FeedsReader

async function loadFeedsStoredData(adapter: DataAdapter) {
    GLB.feedsStore = {}; // Initialize/clear the store
    if (!GLB.feedList) {
        console.warn("loadFeedsStoredData: feedList is not loaded.");
        return;
    }

    const loadPromises = GLB.feedList.map(async (feedInfo) => {
        const dir = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
        try {
            // Try loading gzipped first
            let dataString = await loadStringSplitted_Gzip(adapter, dir, feedInfo.name);
            let wasGzipped = true;
            if (dataString === '') { // If gzip load failed or returned empty
                dataString = await loadStringSplitted(adapter, dir, feedInfo.name); // Try plain text
                wasGzipped = false;
            }

            if (dataString) {
                try {
                    const feedContent: RssFeedContent = JSON.parse(dataString);
                    // Assign metadata from feedList
                    feedContent.name = feedInfo.name;
                    feedContent.folder = feedInfo.folder || '';

                    // Normalize items
                    if (feedContent?.items) {
                        feedContent.items.forEach(item => {
                            if (item) { // Ensure item is not null/undefined
                                item.starred ??= false; // Default starred to false
                                if (item.read === '') item.read = null; // Normalize empty read string
                                if (item.deleted === '') item.deleted = null; // Normalize empty deleted string
                                item.downloaded ??= nowdatetime(); // Default downloaded time
                            }
                        });
                        // Filter out any null/undefined items just in case
                        feedContent.items = feedContent.items.filter(Boolean);
                    } else {
                        feedContent.items = []; // Ensure items array exists
                    }

                    GLB.feedsStore[feedInfo.feedUrl] = feedContent;

                    // Mark for resaving as gzip if loaded as plain text
                    if (!wasGzipped) {
                        GLB.feedsStoreChange = true;
                        GLB.feedsStoreChangeList.add(feedInfo.feedUrl);
                    }

                } catch (e: any) {
                    console.error(`Parse Error for feed ${feedInfo.name}:`, e, "Data:", dataString.substring(0, 200));
                    new Notice(`Error parsing data for feed: ${feedInfo.name}`, 3000);
                }
            } else {
                // No data found, initialize empty store for this feed
                 console.log(`No stored data found for feed: ${feedInfo.name}, initializing empty store.`);
                 GLB.feedsStore[feedInfo.feedUrl] = {
                      name: feedInfo.name,
                      folder: feedInfo.folder || '',
                      title: feedInfo.name, // Use feed name as initial title
                      subtitle: '',
                      link: feedInfo.feedUrl, // Use feed URL as link
                      image: '',
                      description: '',
                      pubDate: '',
                      items: []
                 };
            }
        } catch (e: any) {
            console.error(`Load Error for feed ${feedInfo.name}:`, e);
            new Notice(`Error loading data for feed: ${feedInfo.name}`, 3000);
        }
    });

    await Promise.allSettled(loadPromises);
    console.log("Feed data loading process completed.");
    // After loading individual feeds, attempt to load legacy combined file
    await loadOldCombinedDataFile(adapter);
}

async function loadOldCombinedDataFile(adapter: DataAdapter) {
    const oldPath = `${GLB.feeds_reader_dir}/${GLB.feeds_data_fname}`;
    try {
        if (await adapter.exists(oldPath)) {
            new Notice(`Importing legacy data file ('${GLB.feeds_data_fname}')...`, 5000);
            const oldDataContent = await adapter.read(oldPath);
            if (oldDataContent) {
                const parsedOldData = JSON.parse(oldDataContent);
                let importedCount = 0;
                for (const feedUrl in parsedOldData) {
                    // Import only if not already loaded and data seems valid
                    if (!GLB.feedsStore[feedUrl] && parsedOldData.hasOwnProperty(feedUrl)) {
                        const feedInfo = GLB.feedList.find(f => f.feedUrl === feedUrl);
                        const oldFeedData = parsedOldData[feedUrl] as RssFeedContent;

                        if (oldFeedData?.items) {
                            // Assign metadata and normalize items
                            oldFeedData.name = feedInfo?.name || feedUrl; // Use name from feedList if possible
                            oldFeedData.folder = feedInfo?.folder || '';
                            oldFeedData.items.forEach(item => {
                                if (item) {
                                    item.starred ??= false;
                                    if (item.read === '') item.read = null;
                                    if (item.deleted === '') item.deleted = null;
                                    item.downloaded ??= nowdatetime();
                                }
                            });
                            oldFeedData.items = oldFeedData.items.filter(Boolean);

                            GLB.feedsStore[feedUrl] = oldFeedData;
                            // Mark for saving in new format
                            GLB.feedsStoreChange = true;
                            GLB.feedsStoreChangeList.add(feedUrl);
                            importedCount++;
                        } else {
                            console.warn(`Invalid legacy data structure for: ${feedUrl}`);
                        }
                    }
                }
                if (importedCount > 0) {
                     console.log(`Imported data for ${importedCount} feeds from legacy file.`);
                }

                // **Consider adding a setting before automatically removing the old file**
                // Example: if (this.settings.removeLegacyFileAfterImport) { ... }
                 try {
                     console.log("Attempting to remove legacy data file:", oldPath);
                     await adapter.remove(oldPath);
                     new Notice("Legacy data imported and old file removed.", 2000);
                 } catch (removeError) {
                      console.error("Failed to remove legacy data file:", removeError);
                      new Notice("Failed to remove legacy data file. Please remove it manually if desired.", 3000);
                 }
            }
        }
    } catch (e: any) {
        console.error("Error loading or processing legacy data file:", e);
        new Notice(`Error handling legacy data file: ${e.message}`, 3000);
    }
}

function mergeStoreWithNewData(newdata: RssFeedContent, feedUrl: string): number {
    if (!newdata?.items) return 0; // No new items to merge

    // If store doesn't exist for this feed, initialize it
    if (!GLB.feedsStore[feedUrl]) {
        const feedInfo = GLB.feedList.find(f => f.feedUrl === feedUrl);
        newdata.name = feedInfo?.name || feedUrl;
        newdata.folder = feedInfo?.folder || '';
        newdata.items.forEach(item => {
            if (item) {
                item.starred = false; // New items are never starred initially
                item.read = null;
                item.deleted = null;
                item.downloaded ??= nowdatetime();
            }
        });
        GLB.feedsStore[feedUrl] = newdata;
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        return newdata.items.length; // All items are new
    }

    // Store exists, merge new items
    const existingStore = GLB.feedsStore[feedUrl];
    // Update feed metadata (prefer new data if available)
    existingStore.title = newdata.title || existingStore.title;
    existingStore.subtitle = newdata.subtitle || existingStore.subtitle;
    existingStore.description = newdata.description || existingStore.description;
    existingStore.pubDate = newdata.pubDate || existingStore.pubDate;
    if (newdata.image) existingStore.image = newdata.image; // Only update image if new one exists

    let newItemsCount = 0;
    // Create a set of recent existing links for efficient lookup
    const existingLinks = new Set(
        existingStore.items.slice(0, GLB.nMergeLookback).map(item => item?.link).filter(Boolean)
    );

    const itemsToAdd: RssFeedItem[] = [];
    // Iterate new items from newest to oldest (assuming typical feed order)
    for (let i = 0; i < newdata.items.length; i++) {
        const newItem = newdata.items[i];
        if (!newItem) continue;

        // Check if the item link exists in recent items
        if (newItem.link && !existingLinks.has(newItem.link)) {
            // Item is considered new
            newItem.starred = false;
            newItem.read = null;
            newItem.deleted = null;
            newItem.downloaded ??= nowdatetime();
            itemsToAdd.push(newItem);
            newItemsCount++;
        } else if (!newItem.link) {
            // Handle items without links (e.g., log warning, skip, or use GUID if available)
            console.warn(`Skipping new item with no link in feed: ${feedUrl}`, newItem.title);
        }
        // If link exists, assume it's not new and skip
    }

    // Add new items to the beginning of the existing items array
    if (newItemsCount > 0) {
        existingStore.items.unshift(...itemsToAdd);
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        console.log(`Added ${newItemsCount} new items to feed: ${existingStore.name}`);
    }

    return newItemsCount;
}

async function updateOneFeed(app: App, feedUrl: string, adapter: DataAdapter): Promise<[number, number]> {
    let numNew = 0;
    let totalItems = 0;
    try {
        const feedContent = await getFeedItems(feedUrl); // Fetch new items
        if (feedContent?.items) {
            numNew = mergeStoreWithNewData(feedContent, feedUrl); // Merge with existing store
            totalItems = GLB.feedsStore[feedUrl]?.items?.length || 0;
            // Save data immediately if new items were added
            if (numNew > 0) {
                 // Use the class method for saving - Cast app to any to access plugins
                 const pluginInstance = (app as any).plugins?.plugins?.['feeds-reader'];
                 if (pluginInstance instanceof FeedsReader) {
                      await pluginInstance.saveFeedsData();
                 } else {
                      console.error("updateOneFeed: Could not get plugin instance to save data.");
                 }
            }
        } else {
            // Feed fetch might have failed or returned no items
            totalItems = GLB.feedsStore[feedUrl]?.items?.length || 0; // Get count from existing store
            // Optionally log this case, but don't treat as error
            // console.warn(`No new items found or fetch failed for ${feedUrl}`);
        }
    } catch (e: any) {
        console.error(`Error in updateOneFeed for ${feedUrl}:`, e);
        // Re-throw the error so the caller (e.g., updateAllFeeds) can handle it
        throw e;
    }
    return [numNew, totalItems];
}


// --- Display List Generation & Sorting ---
function makeDisplayList() {
    GLB.displayIndices = [];
    GLB.starredItemsList = [];

    if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
        // Generate list of starred items across all feeds
        for (const feedUrl in GLB.feedsStore) {
            if (GLB.feedsStore.hasOwnProperty(feedUrl)) {
                const feed = GLB.feedsStore[feedUrl];
                if (feed?.items) {
                    feed.items.forEach((item, index) => {
                        if (item?.starred && !item.deleted) { // Only include non-deleted starred items
                            GLB.starredItemsList.push({
                                feedUrl: feedUrl,
                                originalIndex: index,
                                item: item
                            });
                        }
                    });
                }
            }
        }
        // Sort starred items (default New to old based on pubDate/downloaded)
        GLB.starredItemsList.sort((a, b) => {
            const dateA = new Date(a.item.pubDate || a.item.downloaded || 0).getTime();
            const dateB = new Date(b.item.pubDate || b.item.downloaded || 0).getTime();
             // Assuming 'New to old' is default, 'Old to new' reverses
             return (GLB.itemOrder === 'Old to new') ? dateA - dateB : dateB - dateA;
        });

    } else if (GLB.currentFeed && GLB.feedsStore[GLB.currentFeed]) {
        // Generate list of indices for the current feed based on filters
        const currentFeedStore = GLB.feedsStore[GLB.currentFeed];
        if (!currentFeedStore?.items) return; // No items in this feed

        for (let i = 0; i < currentFeedStore.items.length; i++) {
            const item = currentFeedStore.items[i];
            if (!item) continue; // Skip null/undefined items

            let includeItem = false;
            switch (GLB.filterMode) {
                case 'all':
                    // Include all non-deleted items. Deleted handled by visibility check/CSS.
                    includeItem = true; // Include index, visibility check handles actual display
                    break;
                case 'unread':
                    includeItem = !item.read && !item.deleted;
                    break;
                case 'starred':
                    includeItem = !!item.starred && !item.deleted;
                    break;
                default: // Should not happen, but default to including non-deleted
                    includeItem = !item.deleted;
            }

            if (includeItem) {
                GLB.displayIndices.push(i);
            }
        }

        // Sort indices based on itemOrder (Default 'New to old' is already chronological)
        if (GLB.itemOrder === 'Old to new') {
            // Reverse the array of indices for 'Old to new'
            GLB.displayIndices.reverse();
        }
        // 'Random' sorting applied after initial filtering/sorting
    }

     // Apply Random sort if selected, AFTER filtering and initial sort
     if (GLB.itemOrder === 'Random') {
         const listToSort = (GLB.currentFeed === GLB.STARRED_VIEW_ID) ? GLB.starredItemsList : GLB.displayIndices;
         // Fisher-Yates shuffle algorithm
         for (let i = listToSort.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [listToSort[i], listToSort[j]] = [listToSort[j], listToSort[i]]; // Swap elements
         }
     }
}

function sort_feed_list() {
    if (!GLB.feedList) return;
    GLB.feedList.sort((a, b) => {
        const folderA = a.folder || "zzz"; // Place uncategorized last ('zzz' sorts after letters)
        const folderB = b.folder || "zzz";
        if (folderA < folderB) return -1;
        if (folderA > folderB) return 1;
        // If folders are the same, sort by name
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB); // Case-insensitive compare for names
    });
}

// --- Main View Rendering (Logic moved to FRView.renderContent) ---
// show_feed is deprecated

// --- Helper functions called by Views ---
function createPageActionButtons(container: HTMLElement, hasItems: boolean) {
     // Clear previous buttons if any
    // container.empty(); // Container should be emptied by caller if needed

    if (hasItems) {
        container.createEl('button', { text: 'Mark Page Read', cls: 'markPageRead page-action-button' });
        container.createEl('button', { text: 'Mark Page Delete', cls: 'markPageDeleted page-action-button' });
        // Only show "Remove Content" if not in starred view
        if (GLB.currentFeed !== GLB.STARRED_VIEW_ID) {
            container.createEl('button', { text: 'Remove Content', cls: 'removePageContent page-action-button' });
        }
        container.style.display = 'flex'; // Ensure container is visible
    } else {
        container.hide(); // Hide if no items
    }
}

function createPagination(container: HTMLElement, totalItems: number) {
    // Find or create pagination container
    let paginationContainer = container.querySelector('.pagination-container') as HTMLElement;
    if (paginationContainer) {
        paginationContainer.empty(); // Clear existing pagination
    } else {
        paginationContainer = container.createDiv({ cls: 'pagination-container' });
    }


    const totalPages = totalItems > 0 ? Math.ceil(totalItems / GLB.nItemPerPage) : 0;
    let hasPrev = false;
    let hasNext = false;

    // Previous Button
    if (GLB.nPage > 1) {
        const prevButton = paginationContainer.createEl('button', { text: "◀ Prev", cls: "prevPage pagination-button" });
        prevButton.id = "prevPage"; // ID for click handler
        hasPrev = true;
    }

    // Next Button
    if (GLB.idxItemStart + GLB.nItemPerPage < totalItems) {
        const nextButton = paginationContainer.createEl('button', { text: "Next ▶", cls: "nextPage pagination-button" });
        nextButton.id = "nextPage"; // ID for click handler
        hasNext = true;
    }

    // Page Info
    if (totalPages > 0) {
        const pageInfo = paginationContainer.createSpan({ cls: 'page-info' });
        pageInfo.setText(`Page ${GLB.nPage} of ${totalPages} (${totalItems} items)`);
    } else if (totalItems === 0 && !hasPrev && !hasNext) {
        // Hide container completely if no items and no buttons needed (e.g., empty feed)
        paginationContainer.hide();
    } else {
         // Show container if there are buttons, even with 0 total items (e.g., empty page > 1)
         paginationContainer.style.display = 'flex';
    }
}

function createCardItem(app: App, container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) {
    const cardElement = container.createDiv({ cls: 'card-item' });
    cardElement.setAttrs({
        'data-idx': originalIndex.toString(),
        'data-feedurl': feedUrl,
        'data-link': item.link || ''
    });

    // Thumbnail
    const thumbnailDiv = cardElement.createDiv({ cls: 'card-thumbnail' });
    const imageUrl = item.imageUrl || GLB.feedsStore[feedUrl]?.image; // Prefer item image, fallback to feed image
    const placeholderText = item.title?.substring(0, 1) || '?';

    if (imageUrl) {
        const img = thumbnailDiv.createEl('img');
        img.src = imageUrl;
        img.alt = `Thumbnail for ${item.title || 'feed item'}`;
        img.loading = 'lazy';
        img.onerror = () => {
            const parent = img.parentElement;
            if (parent) {
                img.remove();
                parent.addClass('no-thumbnail');
                parent.setText(placeholderText);
            }
        };
    } else {
        thumbnailDiv.addClass('no-thumbnail');
        thumbnailDiv.setText(placeholderText);
    }

    // Content
    const contentDiv = cardElement.createDiv({ cls: 'card-content' });
    const titleElement = contentDiv.createEl('h3', { cls: 'card-title' });
    titleElement.createEl('a', { href: item.link || '#', text: item.title || 'No Title', attr: { target: '_blank', rel: 'noopener noreferrer' } });

    const metaDiv = contentDiv.createDiv({ cls: 'card-meta' });
    if (isStarredView) {
        const feedName = GLB.feedsStore[feedUrl]?.name || feedUrl;
        metaDiv.createSpan({ cls: 'card-feed-name', text: feedName });
    }
    const dateStr = item.pubDate || item.downloaded || '';
    if (dateStr) {
        metaDiv.createSpan({ cls: 'card-date', text: formatDate(dateStr) });
    }

    // Actions (Buttons)
    const actionsDiv = contentDiv.createDiv({ cls: 'card-actions' });
    actionsDiv.id = `actionContainer${originalIndex}`; // Use originalIndex for unique ID
    createActionButtons(actionsDiv, item, originalIndex, feedUrl, 'card'); // Call helper

    // Apply state classes
    cardElement.toggleClass('read', !!item.read && !item.deleted);
    cardElement.toggleClass('deleted', !!item.deleted); // This class should hide the element via CSS
    cardElement.toggleClass('starred-item', !!item.starred);

    // Apply visibility based on current filters
    // Use 'app as any' to access plugins and get the plugin instance
     let plugin: FeedsReader | null = null;
     const anyApp = app as any;
     // ★★★ Safely access nested properties ★★★
     if (anyApp.plugins?.plugins?.['feeds-reader'] instanceof FeedsReader) {
         plugin = anyApp.plugins.plugins['feeds-reader'];
     }
    if (plugin) plugin.updateItemVisibility(item, originalIndex, feedUrl);
}

function createListItem(app: App, container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) {
    const itemElement = container.createDiv({ cls: 'list-item' });
    itemElement.setAttrs({
        'data-idx': originalIndex.toString(),
        'data-feedurl': feedUrl,
        'data-link': item.link || ''
    });

    const headerDiv = itemElement.createDiv({ cls: 'list-item-header' });

    // Star (as part of the header)
    const starSpan = headerDiv.createEl('span', { text: item.starred ? '★' : '☆', cls: 'item-action-star list-item-star' });
    starSpan.setAttrs({ 'data-idx': originalIndex.toString(), 'data-feedurl': feedUrl });
    if (item.starred) starSpan.addClass('starred');

    // Title container
    const titleContainer = headerDiv.createDiv({ cls: 'list-item-title-container' });
    const titleDiv = titleContainer.createEl('div', { cls: 'list-item-title' });
    titleDiv.createEl('a', { href: item.link || '#', text: item.title || 'No Title', attr: { target: '_blank', rel: 'noopener noreferrer' } });

    // Meta container (sibling to title container)
    const metaDiv = headerDiv.createDiv({ cls: 'list-item-meta' });
    if (isStarredView) {
        const feedName = GLB.feedsStore[feedUrl]?.name || feedUrl;
        metaDiv.createSpan({ cls: 'item-feed-name', text: `(${feedName})` });
    }
    if (item.creator) {
        metaDiv.createSpan({ cls: 'item-creator', text: item.creator });
    }
    const dateStr = item.pubDate || item.downloaded || '';
    if (dateStr) {
        metaDiv.createSpan({ cls: 'item-date', text: formatDate(dateStr) });
    }

    // Actions below header
    const actionsDiv = itemElement.createDiv({ cls: 'list-item-actions' });
    actionsDiv.id = `actionContainer${originalIndex}`; // Unique ID
    createActionButtons(actionsDiv, item, originalIndex, feedUrl, 'list'); // Call helper

    // Hidden content container (for jot notes, etc.)
    const contentContainer = itemElement.createDiv({ cls: 'item-content-container' });
    contentContainer.id = `itemContentContainer_${feedUrl}_${originalIndex}`;
    contentContainer.hide();

    // Apply state classes
    itemElement.toggleClass('read', !!item.read && !item.deleted);
    itemElement.toggleClass('deleted', !!item.deleted); // Should hide via CSS
    itemElement.toggleClass('starred-item', !!item.starred);

     // Apply visibility based on current filters
     // Use 'app as any' to access plugins
     let plugin: FeedsReader | null = null;
      const anyApp = app as any;
      // ★★★ Safely access nested properties ★★★
      if (anyApp.plugins?.plugins?.['feeds-reader'] instanceof FeedsReader) {
          plugin = anyApp.plugins.plugins['feeds-reader'];
      }
     if (plugin) plugin.updateItemVisibility(item, originalIndex, feedUrl);
}

function createActionButtons(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, viewType: 'list' | 'card') {
    const settings = GLB.settings;

    // Star button - Handled separately in list view header, added here for card view consistency if needed
    if (viewType === 'card') {
        const starBtn = container.createEl('button', { text: item.starred ? '★' : '☆', cls: `item-action-button item-action-star card-item-star` });
        starBtn.setAttrs({ 'data-idx': originalIndex.toString(), 'data-feedurl': feedUrl });
        if (item.starred) starBtn.addClass('starred');
    }

    // Other action buttons based on settings
    if (settings.showRead) {
        const btn = container.createEl('button', { text: item.read ? 'Unread' : 'Read', cls: 'item-action-button toggleRead' });
        btn.id = `toggleRead${originalIndex}`; // Use originalIndex
    }
    if (settings.showDelete) {
        const btn = container.createEl('button', { text: item.deleted ? 'Undelete' : 'Delete', cls: 'item-action-button toggleDelete' });
        btn.id = `toggleDelete${originalIndex}`; // Use originalIndex
    }
    if (settings.showJot) {
        const btn = container.createEl('button', { text: 'Jot', cls: 'item-action-button jotNotes' });
        btn.id = `jotNotes${originalIndex}`;
    }
    if (settings.showSnippet) {
        const btn = container.createEl('button', { text: 'Snippet', cls: 'item-action-button saveSnippet' });
        btn.id = `saveSnippet${originalIndex}`;
    }
    if (settings.showSave) {
        const btn = container.createEl('button', { text: 'Save Note', cls: 'item-action-button noteThis' });
        btn.id = `noteThis${originalIndex}`;
    }
    if (settings.showMath && item.content) { // Only show if content exists potentially
        const btn = container.createEl('button', { text: 'Math', cls: 'item-action-button renderMath' });
        btn.id = `renderMath${originalIndex}`;
    }
    if (settings.showGPT && settings.chatGPTAPIKey && settings.chatGPTPrompt && item.content) {
        const btn = container.createEl('button', { text: 'GPT', cls: 'item-action-button askChatGPT' });
        btn.id = `askChatGPT${originalIndex}`;
    }
    if (settings.showEmbed && item.link) { // Only show if link exists
        container.createEl('button', { text: 'Embed', cls: 'item-action-button elEmbedButton' });
    }
    if (settings.showFetch && item.link) { // Only show if link exists
        container.createEl('button', { text: 'Fetch', cls: 'item-action-button elFetch' });
    }
    if (settings.showLink && item.link) { // Only show if link exists
        container.createEl('a', { text: 'Link', href: item.link, cls: 'item-action-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
    }
}


// --- Utility & Formatting ---
function formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) return dateString; // Return original string if invalid

        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        const days = Math.floor(seconds / (60 * 60 * 24));

        if (seconds < 0) return date.toLocaleDateString(); // Future date? Show full date.
        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString(); // Older than a week, show full date
    } catch (e) {
        return dateString; // Return original string on error
    }
}
function str2filename(s: string): string {
    if (!s) return 'untitled';
    const illegalRe = /[\/\?<>\\:\*\|"]/g; // illegal characters for filenames
    const controlRe = /[\x00-\x1f\x80-\x9f]/g; // control characters
    const reservedRe = /^\.+$/; // filenames consisting only of dots
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i; // Windows reserved names
    const windowsTrailingRe = /[\. ]+$/; // trailing dots and spaces
    const replacement = '_'; // Character to replace illegal chars with

    let sanitized = s
        .replace(illegalRe, replacement)
        .replace(controlRe, replacement)
        .replace(reservedRe, replacement)
        .replace(windowsReservedRe, replacement)
        .replace(windowsTrailingRe, replacement)
        .replace(/[\[\]]/g, '') // Remove brackets commonly used in links
        .replace(/[#^;]/g, '') // Remove other potentially problematic chars
        .replace(/\s+/g, '_'); // Replace whitespace sequences with underscore

    // Limit filename length (e.g., to 100 chars)
    return sanitized.substring(0, 100);
}
function unEscape(htmlStr: string): string {
    if (!htmlStr) return '';
    // Basic unescaping, order matters for &amp;
    return htmlStr
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#0?39;/g, "'") // Handle &#39; and &#039;
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&"); // Ampersand must be last
}
function remedyLatex(s: string): string {
    if (!s) return '';
    // Apply specific LaTeX fixes, careful not to over-correct
    return s
        // Example fixes (adjust based on common issues in your feeds):
        // .replace(/\$(\\[a-zA-Z]+)\$([0-9+\-.]+)/g, '\${\$1}$2\$') // Fix like $e$2.718 -> ${e}$2.718$
        .replace(/\\micron/g, '\\mu{}m')
        .replace(/\\Msun/g, 'M_\\odot')
        .replace(/\\Mstar/g, 'M_\\ast')
        // Escape markdown chars that might conflict inside LaTeX if not already escaped
        .replace(/_(?![^$]*\$)/g, '\\_') // Escape underscore outside math
        .replace(/\*(?![^$]*\$)/g, '\\*'); // Escape asterisk outside math
}

// --- Markdown/HTML Helpers ---
// Basic replacements, consider a more robust library for complex HTML
function handle_img_tag(s: string): string {
    if (!s) return '';
    // Convert relative protocol // to https:// and basic img to markdown
    return s
        .replace(/<img src="\/\//g, "<img src=\"https://")
        .replace(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi, "\n![]($1)\n");
}
function handle_a_tag(s: string): string {
    if (!s) return '';
    // Convert relative protocol // to https:// and basic links to markdown
    return s
        .replace(/<a\s+[^>]*href="\/\//g, "<a href=\"https://")
        .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");
}
function handle_tags(s: string): string {
    if (!s) return '';
    // Basic removal of common block/inline tags, replace with space
    return s.replace(/<\/?(p|div|span|br|i|b|strong|em)\/?>/gi, ' ');
}

// --- Statistics ---
function getFeedStats(feedUrl: string): { total: number; read: number; deleted: number; unread: number; starred: number } {
    let total = 0, read = 0, deleted = 0, unread = 0, starred = 0;
    const feed = GLB.feedsStore[feedUrl];
    if (feed?.items) {
        total = feed.items.length;
        for (const item of feed.items) {
            if (!item) continue; // Skip if item is null/undefined
            if (item.read && !item.deleted) read++; // Count read only if not deleted
            if (item.deleted) deleted++;
            if (!item.read && !item.deleted) unread++; // Unread and not deleted
            if (item.starred && !item.deleted) starred++; // Starred and not deleted
        }
    }
    return { total, read, deleted, unread, starred };
}
function getFeedStorageInfo(feedUrl: string): [string, string, number, number] {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items || feed.items.length === 0) return ['0', '0B', 0, 0]; // Avg size, Size Str, raw length, blob size
    try {
        const dataString = JSON.stringify(feed);
        const rawLength = dataString.length;
        // Use Blob size for a potentially more accurate representation of storage cost
        const blobSize = new Blob([dataString]).size;
        const avgSizePerItem = feed.items.length === 0 ? 0 : Math.floor(rawLength / feed.items.length);
        const sizeString = getStoreSizeStr(blobSize); // Use blob size for display string
        return [avgSizePerItem.toString(), sizeString, rawLength, blobSize];
    } catch (e) {
        console.error(`Error calculating storage info for ${feedUrl}:`, e);
        return ['Err', 'Err', 0, 0];
    }
}
function getStoreSizeStr(sizeBytes: number): string {
    if (sizeBytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(sizeBytes) / Math.log(1024));
    // Show 1 decimal place for KB and MB, 0 for Bytes
    const precision = i === 0 ? 0 : 1;
    return `${(sizeBytes / Math.pow(1024, i)).toFixed(precision)}${units[i]}`;
}

// --- Feed Management Actions ---
function markAllRead(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items) return;
    const now = nowdatetime();
    let changed = false;
    feed.items.forEach(item => {
        if (item && !item.read) {
            item.read = now;
            item.deleted = null; // Undelete if marking read
            changed = true;
        }
    });
    if (changed) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller (e.g., refreshFeedListSidebar, refreshDisplay)
    }
}
function purgeDeleted(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items) return;
    const originalLength = feed.items.length;
    feed.items = feed.items.filter(item => item && !item.deleted); // Keep non-deleted items
    if (feed.items.length !== originalLength) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller
    }
}
function removeContent(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items) return;
    let changed = false;
    feed.items.forEach(item => {
        if (item) {
            if (item.hasOwnProperty('content')) { delete item.content; changed = true; }
            if (item.hasOwnProperty('creator')) { delete item.creator; changed = true; }
            if (item.hasOwnProperty('category')) { delete item.category; changed = true; }
        }
    });
    if (changed) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller (usually refreshDisplay)
    }
}
function removeEmptyFields(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items) return;
    let changed = false;
    feed.items.forEach(item => {
        if (item) {
            for (const key in item) {
                if ((item as any)[key] === '') { // Remove keys with empty string values
                    delete (item as any)[key];
                    changed = true;
                }
            }
        }
    });
    if (changed) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
    }
}
function removeContentOld(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items || feed.items.length < 2) return; // Need at least 2 items to remove older ones
    // Remove content from roughly the older two-thirds, capped at 200 items
    const startIndex = Math.max(0, Math.min(Math.floor(feed.items.length / 3), 200));
    let changed = false;
    for (let i = startIndex; i < feed.items.length; i++) {
        const item = feed.items[i];
        if (item) {
             if (item.hasOwnProperty('content')) { delete item.content; changed = true; }
             if (item.hasOwnProperty('creator')) { delete item.creator; changed = true; }
             if (item.hasOwnProperty('category')) { delete item.category; changed = true; }
        }
    }
    if (changed) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
    }
}
function purgeAll(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (feed?.items?.length > 0) {
        feed.items = []; // Clear all items
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller
    }
}
function purgeOldHalf(feedUrl: string) {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items || feed.items.length < 2) return;
    const numberToRemove = Math.floor(feed.items.length / 2);
    if (numberToRemove > 0) {
         // Remove items from the end (older items, assuming new items are added to the front)
        feed.items.splice(-numberToRemove);
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller
    }
}
function deduplicate(feedUrl: string): number {
    const feed = GLB.feedsStore[feedUrl];
    if (!feed?.items || feed.items.length < 2) return 0; // No duplicates possible

    const originalCount = feed.items.length;
    const seenLinks = new Set<string>();
    // Filter items, keeping only the first occurrence of each unique link
    feed.items = feed.items.filter(item => {
        if (!item?.link || seenLinks.has(item.link)) {
             return false; // Remove if no link or link already seen
        }
        seenLinks.add(item.link); // Add link to set
        return true; // Keep this item
    });

    const removedCount = originalCount - feed.items.length;
    if (removedCount > 0) {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(feedUrl);
        // UI update handled by caller
    }
    return removedCount; // Return the number of removed items
}

async function removeFeed(app: App, adapter: DataAdapter, feedUrl: string, plugin: FeedsReader) {
    const index = GLB.feedList.findIndex(f => f.feedUrl === feedUrl);
    if (index === -1) return; // Feed not found

    const feedName = GLB.feedList[index].name;

    // Remove from feedList
    GLB.feedList.splice(index, 1);

    // Remove from feedsStore
    if (GLB.feedsStore[feedUrl]) {
        delete GLB.feedsStore[feedUrl];
    }

    // Save updated subscriptions list
    await plugin.saveSubscriptions(); // Use class method

    // Remove stored data files (gzipped and plain)
    const storeFolder = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
    if (await adapter.exists(storeFolder)) {
        let i = 0;
        while (true) {
            const filenameBase = plugin.makeFilename(feedName, i); // Use class method
            const gzPath = `${storeFolder}/${filenameBase}.gzip`;
            const plainPath = `${storeFolder}/${filenameBase}`;
            let removedGz = false;
            let removedPlain = false;

            try { if (await adapter.exists(gzPath)) { await adapter.remove(gzPath); removedGz = true; } }
            catch (e) { console.warn(`Cannot remove ${gzPath}`, e); }

            try { if (await adapter.exists(plainPath)) { await adapter.remove(plainPath); removedPlain = true; } }
            catch (e) { console.warn(`Cannot remove ${plainPath}`, e); }

            // If neither file existed for this index, assume no more chunks
            if (!removedGz && !removedPlain) break;
            if (removedGz || removedPlain) console.log(`Removed stored data chunk ${i} for ${feedName}...`);
            i++;
        }
    }

    // Refresh sidebar UI
    await plugin.refreshFeedListSidebar();

    // If the removed feed was the current one, clear the main view
    if (GLB.currentFeed === feedUrl) {
        GLB.currentFeed = null;
        GLB.currentFeedName = '';
        plugin.refreshDisplay(); // Refresh main view to show default state
    }
}


// --- File I/O Helpers ---
function makeFilename (fname_base:string, iPostfix:number):string{
    const safeBase = str2filename(fname_base); // Ensure base name is safe
    return `${safeBase}-${iPostfix.toString().padStart(3, '0')}.json.frag`; // Pad index for sorting
}
async function saveStringToFileGzip(app: App, adapter: DataAdapter, s:string, folder:string, fname:string): Promise<boolean>{
    let writeSuccess = false;
    const gzipPath = `${folder}/${fname}.gzip`;
    try {
        // Ensure folder exists (redundant if checked before calling, but safe)
        // if (!await adapter.exists(folder)) await app.vault.createFolder(folder);
        const compressedData = await compress(s);
        await adapter.writeBinary(gzipPath, compressedData.buffer);
        writeSuccess = true;
        // Remove plain text version if it exists
        const plainPath = `${folder}/${fname}`;
        if (await adapter.exists(plainPath)) {
            try { await adapter.remove(plainPath); } catch (e) { console.warn(`Could not remove plain file ${plainPath}`, e); }
        }
    } catch (e) {
        console.error(`Gzip Save Error for ${fname}:`, e);
        // Fallback to plain text save
        writeSuccess = await saveStringToFile(app, adapter, s, folder, fname);
    }
    return writeSuccess;
}
async function saveStringToFile(app: App, adapter: DataAdapter, s:string, folder:string, fname:string): Promise<boolean>{
    let writeSuccess = false;
    const plainPath = `${folder}/${fname}`;
    try {
        // Ensure folder exists
        if (!await adapter.exists(folder)) await app.vault.createFolder(folder);
        const fileExists = await adapter.exists(plainPath);
        let currentContent = fileExists ? await adapter.read(plainPath) : null;
        // Write only if content differs or file doesn't exist
        if (currentContent !== s) {
            await adapter.write(plainPath, s);
            writeSuccess = true;
        } else {
            writeSuccess = true; // Considered success if content is already the same
        }
    } catch (e: any) {
        console.error(`Plain Text Save Error for ${fname}:`, e);
        writeSuccess = false;
    }
    return writeSuccess;
}
async function saveStringSplitted(app: App, adapter: DataAdapter, s:string, folder:string, fname_base:string, nCharPerFile:number): Promise<number>{
    const totalLength = s.length;
    let numSavedChunks = 0;
    const savePromises: Promise<boolean>[] = [];
    const requiredFragments = new Set<string>();

    // Determine required fragments and create save promises
    for (let i = 0; ; i++) {
        const startIndex = i * nCharPerFile;
        if (startIndex >= totalLength) break; // Reached end of string
        const endIndex = Math.min(startIndex + nCharPerFile, totalLength);
        const chunkContent = s.substring(startIndex, endIndex);
        const fragmentFilename = makeFilename(fname_base, i); // Get fragment filename
        requiredFragments.add(fragmentFilename);
        // Pass app instance down to save function
        savePromises.push(saveStringToFileGzip(app, adapter, chunkContent, folder, fragmentFilename));
    }

    // Execute all save operations concurrently
    const results = await Promise.allSettled(savePromises);
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value === true) {
            numSavedChunks++;
        } else if (result.status === 'rejected') {
            console.error("Chunk save error:", result.reason);
        }
    });

    // Clean up obsolete fragments
    try {
        if (await adapter.exists(folder)) {
            const { files } = await adapter.list(folder);
            const basePrefix = makeFilename(fname_base, 0).split('-000.')[0]; // Get prefix before index

            for (const filePath of files) {
                 const filenameWithExt = filePath.split('/').pop();
                 if (!filenameWithExt) continue;

                 const isGz = filenameWithExt.endsWith('.gzip');
                 const baseFilename = isGz ? filenameWithExt.slice(0, -5) : filenameWithExt; // Remove .gzip if present

                 // Check if it's a fragment for this feed and if it's obsolete
                 if (baseFilename.startsWith(basePrefix) && baseFilename.endsWith('.json.frag') && !requiredFragments.has(baseFilename)) {
                     console.log(`Removing obsolete chunk: ${filePath}`);
                     try { await adapter.remove(filePath); } catch (rmErr) { console.warn(`Cannot remove ${filePath}`, rmErr); }
                 }
            }
        }
    } catch (e) {
        console.error("Error cleaning up obsolete chunks:", e);
    }

    return numSavedChunks;
}
async function loadStringSplitted_Gzip(adapter: DataAdapter, folder:string, fname_base:string): Promise<string>{
    let contentChunks: string[] = [];
    try {
        if (await adapter.exists(folder)) {
            for (let i = 0; ; i++) {
                const fragmentFilename = makeFilename(fname_base, i);
                const filePath = `${folder}/${fragmentFilename}.gzip`;
                if (!await adapter.exists(filePath)) break; // No more fragments for this index

                try {
                    const binaryData = await adapter.readBinary(filePath);
                    contentChunks[i] = await decompress(binaryData); // Decompress chunk
                } catch (e: any) {
                    console.error(`Gzip Load/Decompress Error for ${fragmentFilename}:`, e);
                    // If one chunk fails, maybe stop loading this feed? Or try plain text?
                    // For now, break the loop for this feed.
                    contentChunks = []; // Reset to indicate failure
                    break;
                }
            }
        }
    } catch (e) {
        console.error(`Gzip Directory Error for ${fname_base}:`, e);
         contentChunks = []; // Reset on directory error
    }
    return contentChunks.join(''); // Join chunks or return empty if error occurred
}
async function loadStringSplitted(adapter: DataAdapter, folder:string, fname_base:string): Promise<string>{
    let contentChunks: string[] = [];
     try {
        if (await adapter.exists(folder)) {
            for (let i = 0; ; i++) {
                const fragmentFilename = makeFilename(fname_base, i);
                const filePath = `${folder}/${fragmentFilename}`; // Plain text path
                if (!await adapter.exists(filePath)) break;

                try {
                    contentChunks[i] = await adapter.read(filePath); // Read plain text chunk
                } catch (e: any) {
                    console.error(`Plain Text Load Error for ${fragmentFilename}:`, e);
                    contentChunks = [];
                    break;
                }
            }
        }
    } catch (e) {
        console.error(`Plain Text Directory Error for ${fname_base}:`, e);
        contentChunks = [];
    }
    return contentChunks.join('');
}

// --- External APIs ---
async function fetchChatGPT(apiKey:string, temperature:number, text:string): Promise<string>{
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // Specify model, adjust if needed
                temperature,
                messages: [{ role: "user", content: text }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to parse error details
            throw new Error(`ChatGPT API Error: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`);
        }

        const data = await response.json();
        const messageContent = data?.choices?.[0]?.message?.content;

        if (!messageContent) {
            console.error("Invalid response structure from ChatGPT:", data);
            throw new Error("Invalid response received from ChatGPT.");
        }
        return messageContent;

    } catch (e: any) {
        console.error("ChatGPT fetch error:", e);
        // Re-throw the error to be handled by the caller (modal)
        throw e;
    }
}

// --- Modal Window Class Definitions ---
class ItemContentModal extends Modal {
    item: RssFeedItem;
    feedName: string;
    // Store the component instance for Markdown rendering context
    pluginComponent: Component;

    constructor(app: App, item: RssFeedItem, feedName: string, pluginComponent: Component) {
        super(app);
        this.item = item;
        this.feedName = feedName;
        this.pluginComponent = pluginComponent; // Store parent component
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        contentEl.addClass('feed-item-modal-content');
        titleEl.setText(this.item.title || 'Item Detail');

        const headerInfo = contentEl.createDiv({ cls: 'modal-header-info' });
        headerInfo.createSpan({ cls: 'modal-feed-name', text: `Feed: ${this.feedName}` });
        headerInfo.createSpan({ cls: 'modal-item-date', text: `Date: ${formatDate(this.item.pubDate || this.item.downloaded)}` });
        if (this.item.link) {
             headerInfo.createEl('a', { href: this.item.link, text: 'Open Original', cls: 'modal-original-link', attr: { target: '_blank', rel: 'noopener noreferrer' }});
        }
        if (this.item.creator) {
             headerInfo.createSpan({cls: 'modal-item-author', text: `Author: ${this.item.creator}`});
        }

        contentEl.createEl('hr');

        const bodyDiv = contentEl.createDiv({ cls: 'modal-content-body' });
        if (this.item.content) {
            try {
                // Ensure relative // links are converted
                const contentWithHttps = this.item.content.replace(/ src="\/\//g, ' src="https://');
                // Convert HTML to Markdown, then fix LaTeX
                const markdownContent = htmlToMarkdown(contentWithHttps);
                const latexFixedContent = remedyLatex(markdownContent);
                // Render Markdown using the plugin component as context
                MarkdownRenderer.render(this.app, latexFixedContent, bodyDiv, this.item.link || this.feedName, this.pluginComponent);
            } catch (renderError) {
                console.error("Markdown rendering error in modal:", renderError);
                // Fallback 1: Try sanitizing and appending HTML directly
                try {
                    const sanitizedFragment = sanitizeHTMLToDom(this.item.content.replace(/ src="\/\//g, ' src="https://'));
                    bodyDiv.empty(); // Clear potential error message
                    bodyDiv.appendChild(sanitizedFragment);
                } catch (sanitizeError) {
                    console.error("HTML sanitization error in modal fallback:", sanitizeError);
                    // Fallback 2: Display plain text error
                    bodyDiv.empty();
                    bodyDiv.setText('Failed to display content.');
                }
            }
        } else {
            bodyDiv.setText('No content available for this item.');
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

class EmbedModal extends Modal {
    url: string;
    itemTitle?: string;

    constructor(app: App, url: string, itemTitle?: string){
        super(app);
        this.url = url;
        this.itemTitle = itemTitle;
    }

    onOpen(){
        this.titleEl.setText(this.itemTitle || "Embed");
        this.contentEl.addClass('feed-embed-modal');
        const iframe = this.contentEl.createEl('iframe');
        iframe.src = this.url;
        // Restrictive sandbox for security
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
        iframe.addClass('embedded-modal-iframe');
    }

    onClose(){
        this.contentEl.empty();
    }
}

class FetchContentModal extends Modal {
    url: string;
    itemTitle?: string;

    constructor(app: App, url: string, itemTitle?: string){
        super(app);
        this.url = url;
        this.itemTitle = itemTitle;
    }

    async onOpen(){
        this.titleEl.setText(this.itemTitle || "Fetched Content");
        this.contentEl.addClass('feed-fetch-modal');
        const loadingIndicator = this.contentEl.createEl('p',{text:`Fetching content from ${this.url}...`});
        try{
            // Use Obsidian's request function for network requests
            const htmlSource = await request({url: this.url, method: "GET"});
            loadingIndicator.remove(); // Remove loading message
            const contentContainer = this.contentEl.createDiv({cls:'fetch-modal-container'});
            // Sanitize the fetched HTML before appending
            const sanitizedFragment = sanitizeHTMLToDom(htmlSource);
            contentContainer.appendChild(sanitizedFragment);
        } catch(e:any){
            loadingIndicator.setText(`Fetch Failed: ${e.message}`);
            console.error("Fetch content error:",e);
        }
    }
    onClose(){
        this.contentEl.empty();
    }
}

class MathRenderModal extends Modal {
    item: RssFeedItem;
    pluginComponent: Component;

    constructor(app: App, item: RssFeedItem, pluginComponent: Component) {
        super(app);
        this.item = item;
        this.pluginComponent = pluginComponent;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(`Math Preview: ${this.item.title || ''}`);
        contentEl.addClass('feed-math-modal');

        if (this.item.content) {
            try {
                const markdownContent = htmlToMarkdown(this.item.content);
                const latexFixedContent = remedyLatex(markdownContent);
                // Render potentially math-heavy content
                MarkdownRenderer.render(this.app, latexFixedContent, contentEl, this.item.link || '', this.pluginComponent);
            } catch (e) {
                contentEl.setText("Error rendering math content.");
                console.error("Math render error in modal:", e);
            }
        } else {
            contentEl.setText("No content available to render.");
        }
    }
    onClose(){
        this.contentEl.empty();
    }
}

class ChatGPTInteractionModal extends Modal {
    item: RssFeedItem;
    apiKey: string;
    promptText: string;
    textArea: HTMLTextAreaElement;
    responseArea: HTMLElement;
    pluginComponent: Component;

    constructor(app: App, item: RssFeedItem, apiKey: string, promptText: string, pluginComponent: Component){
        super(app);
        this.item = item;
        this.apiKey = apiKey;
        this.promptText = promptText;
        this.pluginComponent = pluginComponent;
    }

    async onOpen(){
        const { contentEl, titleEl } = this;
        titleEl.setText(`Ask GPT: ${this.item.title || ''}`);
        contentEl.addClass('feed-gpt-modal');

        contentEl.createEl('h4', { text: 'Content Snippet (for context):' });
        // Extract and display a snippet of the content
        const contentSnippet = (this.item.content ? htmlToMarkdown(this.item.content) : '').substring(0, 300);
        contentEl.createEl('p', { text: contentSnippet + (contentSnippet.length === 300 ? '...' : '') });

        contentEl.createEl('h4', { text: 'Your Prompt:' });
        this.textArea = contentEl.createEl('textarea');
        this.textArea.rows = 4;
        this.textArea.value = this.promptText; // Pre-fill with default prompt
        this.textArea.placeholder = "Enter your prompt here...";

        const buttonContainer = contentEl.createDiv({ cls: 'gpt-button-container' });
        const submitButton = buttonContainer.createEl('button', { text: 'Send to GPT' });
        const loadingIndicator = buttonContainer.createSpan({ cls: 'gpt-loading', text: ' Sending...' });
        loadingIndicator.style.display = 'none'; // Hide initially

        contentEl.createEl('h4', { text: 'GPT Response:' });
        this.responseArea = contentEl.createDiv({ cls: 'gpt-response-area' });
        this.responseArea.setText('Awaiting prompt submission...');

        submitButton.onclick = async () => {
            const userPrompt = this.textArea.value.trim();
            if (!userPrompt) {
                new Notice("Prompt cannot be empty.");
                return;
            }
            // Combine user prompt with item content for context
            const fullPrompt = `${userPrompt}\n\n---\n\n${this.item.content ? htmlToMarkdown(this.item.content) : ''}`;

            // Disable button, show loading
            submitButton.disabled = true;
            loadingIndicator.style.display = 'inline-block';
            this.responseArea.setText('Waiting for response from OpenAI...');

            try {
                const reply = await fetchChatGPT(this.apiKey, 0.5, fullPrompt); // Use helper function
                this.responseArea.empty(); // Clear waiting message
                // Render the response as Markdown
                MarkdownRenderer.render(this.app, reply, this.responseArea, '', this.pluginComponent);
            } catch (e: any) {
                this.responseArea.setText(`Error: ${e.message || 'Failed to get response.'}`);
                console.error("ChatGPT interaction error:", e);
            } finally {
                // Re-enable button, hide loading
                submitButton.disabled = false;
                loadingIndicator.style.display = 'none';
            }
        };
    }

    onClose(){
        this.contentEl.empty();
    }
}

class AddFeedModal extends Modal {
    plugin: FeedsReader; // Reference to the main plugin instance

    constructor(app: App, plugin: FeedsReader) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        this.titleEl.innerText = "Add New Feed";

        const form = contentEl.createEl('form');
        const table = form.createEl('table', { cls: 'addFeedTable' });
        const tbody = table.createTBody();

        // Feed Name Input
        let row = tbody.createEl('tr');
        row.createEl('td', { text: "Name" });
        const nameInput = row.createEl('td').createEl('input', { attr: { required: true } });
        nameInput.id = 'newFeedName';
        nameInput.type = 'text';
        nameInput.placeholder = 'e.g., My Favorite Blog';

        // Feed URL Input
        row = tbody.createEl('tr');
        row.createEl('td', { text: "URL" });
        const urlInput = row.createEl('td').createEl('input', { attr: { required: true } });
        urlInput.id = 'newFeedUrl';
        urlInput.type = 'url'; // Use 'url' type for basic validation
        urlInput.placeholder = 'https://example.com/feed';

        // Folder Input (Optional)
        row = tbody.createEl('tr');
        row.createEl('td', { text: "Folder (Optional)" });
        const folderInput = row.createEl('td').createEl('input');
        folderInput.id = 'newFeedFolder';
        folderInput.type = 'text';
        folderInput.placeholder = 'e.g., News';

        // Submit Button
        row = tbody.createEl('tr');
        row.createEl('td'); // Empty cell for alignment
        const buttonTd = row.createEl('td');
        const saveButton = buttonTd.createEl('button', { text: "Add Feed" });
        saveButton.type = 'submit';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            const folder = folderInput.value.trim();

            // Validation
            if (!name || !url) {
                new Notice("Feed Name and URL are required.", 2000);
                return;
            }
            try {
                new URL(url); // Basic URL format validation
            } catch (_) {
                new Notice("The entered URL is invalid.", 2000);
                return;
            }
            if (GLB.feedList.some(f => f.feedUrl === url)) {
                new Notice("This feed URL already exists.", 2000);
                return;
            }
            if (GLB.feedList.some(f => f.name === name)) {
                // Consider making this a warning instead of error? Or allow duplicates?
                 new Notice(`A feed named "${name}" already exists. Please choose a unique name.`, 2500);
                return;
            }

            // Add to global list
            GLB.feedList.push({ name, feedUrl: url, folder, unread: 0, updated: 0 }); // Initial counts
            sort_feed_list(); // Keep the list sorted

            // Save and update UI
            await this.plugin.saveSubscriptions(); // Save the updated list
            await this.plugin.refreshFeedListSidebar(); // Update the sidebar view
            new Notice(`Feed "${name}" added successfully!`, 2000);
            this.close(); // Close the modal
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}

class SearchModal extends Modal {
    // Store app instance, passed in constructor
    app: App;

    constructor(app: App){
        super(app);
        this.app = app; // Store app reference
    }

    onOpen(){
        const { contentEl } = this;
        this.titleEl.innerText = "Search Current Feed";

        const form = contentEl.createEl('form');
        const table = form.createEl('table', { cls: 'searchForm' });
        const tbody = table.createTBody();

        // Search Terms Input
        let row = tbody.createEl('tr');
        row.createEl('td', { text: 'Search Terms' });
        const inputEl = row.createEl('td').createEl('input', { cls: 'searchTerms' });
        inputEl.id = 'searchTerms';
        inputEl.type = 'search';
        inputEl.placeholder = 'Enter keywords...';

        // Whole Word Checkbox
        row = tbody.createEl('tr');
        row.createEl('td', { text: "Whole Word Only" });
        const checkboxEl = row.createEl('td').createEl('input', { attr: { type: 'checkbox' } });
        checkboxEl.id = 'checkBoxWordwise';

        // Submit Button
        row = tbody.createEl('tr');
        row.createEl('td'); // Empty cell for alignment
        const submitButton = row.createEl('td').createEl('button', { text: "Search" });
        submitButton.type = 'submit';

        form.onsubmit = (e) => {
            e.preventDefault();
            const wholeWord = checkboxEl.checked;
            // Process search terms: lowercase, split, unique, non-empty, sort by length desc
            const terms = [...new Set(inputEl.value.toLowerCase().split(/[ ,;\t\n]+/).filter(term => term))].sort((a, b) => b.length - a.length);

            if (terms.length === 0) {
                new Notice("Please enter search terms.");
                return;
            }
            if (!GLB.currentFeed || GLB.currentFeed === GLB.STARRED_VIEW_ID) {
                 new Notice("Search is not available for this view.", 3000);
                 return;
            }

            const items = GLB.feedsStore[GLB.currentFeed]?.items;
            if (!items) {
                new Notice("Current feed data not loaded.", 3000);
                return;
            }

            const spaceSeparator = /\s+/;
            GLB.displayIndices = []; // Reset previous search results

            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                const item = items[itemIndex];
                if (!item) continue;

                let haystack: string | string[];
                const title = item.title?.toLowerCase() || '';
                const creator = item.creator?.toLowerCase() || '';
                // Convert content to markdown before searching
                const content = item.content ? htmlToMarkdown(item.content).toLowerCase() : '';

                if (wholeWord) {
                    // Combine fields, split into words, filter empty
                    haystack = [...title.split(spaceSeparator), ...creator.split(spaceSeparator), ...content.split(spaceSeparator)].filter(s => s);
                } else {
                    // Combine fields into a single string
                    haystack = `${title} ${creator} ${content}`;
                }

                // Check if ALL terms are found
                let allTermsFound = terms.every(term => {
                    if (wholeWord && Array.isArray(haystack)) {
                        return haystack.includes(term);
                    } else if (!wholeWord && typeof haystack === 'string') {
                        return haystack.includes(term);
                    }
                    return false; // Should not happen
                });

                if (allTermsFound) {
                    GLB.displayIndices.push(itemIndex); // Add index if all terms match
                }
            }

            // Reset pagination and refresh the main view
            GLB.idxItemStart = 0;
            GLB.nPage = 1;
            new Notice(`Found ${GLB.displayIndices.length} matching items.`);

            // Use the stored app instance to get the plugin instance (with 'any' cast)
            let pluginInstance: FeedsReader | null = null;
             const anyApp = this.app as any;
             // ★★★ Safely access nested properties ★★★
             if (anyApp.plugins?.plugins?.['feeds-reader'] instanceof FeedsReader) {
                 pluginInstance = anyApp.plugins.plugins['feeds-reader'];
             }

            if (pluginInstance) {
                pluginInstance.refreshDisplay(); // Call the new refresh method
            } else {
                console.error("Could not find FeedsReader plugin instance in SearchModal");
            }
            this.close(); // Close the search modal
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}

class ManageFeedsModal extends Modal {
    plugin: FeedsReader;
    sortBy: string = 'name'; // Track current sort column
    asc: boolean = true; // Track sort direction

    constructor(app: App, plugin: FeedsReader) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        this.titleEl.innerText = "Manage Feeds";
        contentEl.empty(); // Clear previous content on open/re-open
        contentEl.addClass('manageFeedsModal');

        contentEl.createDiv({cls:'manage-feeds-warning'}).innerHTML = '<b>CAUTION:</b> Actions take effect immediately. Refresh may be needed.<br>N:Name, U:URL, F:Folder, T:Total, R:Read, D:Del, A:Avg Size, S:Storage';
        contentEl.createEl('hr');

        const actionsContainer = contentEl.createDiv({ cls: 'manage-feeds-actions' });
        actionsContainer.createEl('button', { text: 'Apply Name/Folder Changes' }).addEventListener('click', async () => { await this.applyNameUrlFolderChanges(); });
        actionsContainer.createEl('button', { text: 'Mark Selected Read' }).addEventListener('click', () => { this.runActionOnSelected('Mark all items in selected feeds read?', this.plugin.markAllRead.bind(this.plugin)); });
        actionsContainer.createEl('button', { text: 'Purge Deleted' }).addEventListener('click', () => { this.runActionOnSelected('Permanently purge deleted items from selected feeds?', this.plugin.purgeDeleted.bind(this.plugin)); });
        actionsContainer.createEl('button', { text: 'Remove Content' }).addEventListener('click', () => { this.runActionOnSelected('Remove ALL downloaded content (title, link etc. remain) from selected feeds?', this.plugin.removeContent.bind(this.plugin)); });
        actionsContainer.createEl('button', { text: 'Deduplicate Links' }).addEventListener('click', () => { this.runActionOnSelected('Deduplicate items by link in selected feeds?', this.plugin.deduplicate.bind(this.plugin), true); });
        actionsContainer.createEl('button', { text: 'Remove Selected Feeds', cls: 'mod-warning' }).addEventListener('click', async () => { await this.removeSelectedFeeds(); });

        contentEl.createEl('br');

        const tableContainer = contentEl.createEl('div');
        this.renderTable(tableContainer); // Render the table initially
    }

    renderTable(container: HTMLElement) {
        container.empty(); // Clear previous table if re-rendering
        const form = container.createEl('table', { cls: 'manageFeedsForm' });

        // --- Table Header ---
        const head = form.createTHead().createEl('tr');
        const headers = [
            { text: "N/U", key: 'name' },
            { text: "F", key: 'folder' },
            { text: "T", key: 'total' },
            { text: "R", key: 'read' },
            { text: "D", key: 'deleted' },
            { text: "A", key: 'avgSize' },
            { text: "S", key: 'size' }
        ];
        headers.forEach((header, index) => {
            const th = head.createEl('th', { text: header.text });
            th.setAttribute('data-column-key', header.key);
            th.addEventListener('click', () => {
                if (this.sortBy === header.key) {
                    this.asc = !this.asc; // Toggle direction if same column
                } else {
                    this.sortBy = header.key; // Set new sort column
                    this.asc = true; // Default to ascending
                }
                this.renderTable(container); // Re-render table with new sort
            });
            // Add sort indicator
            if (this.sortBy === header.key) {
                th.addClass(this.asc ? 'sort-asc' : 'sort-desc');
                th.setText(header.text + (this.asc ? ' ▲' : ' ▼'));
            }
        });
        const checkAllTh = head.createEl('th'); // Checkbox column header
        const checkAll = checkAllTh.createEl('input', { attr: { type: 'checkbox' } });
        checkAll.id = 'checkAllManage'; // More specific ID
        checkAll.onchange = () => {
            const isChecked = checkAll.checked;
            container.querySelectorAll<HTMLInputElement>('.checkThis').forEach(el => el.checked = isChecked);
        };

        // --- Table Body ---
        const tbody = form.createTBody();
        let totalItems = 0, totalRead = 0, totalDeleted = 0, totalRawLength = 0, totalBlobSize = 0;

        // Prepare data with stats for sorting
        const feedDataForTable = GLB.feedList.map((item, i) => {
            const stats = this.plugin.getFeedStats(item.feedUrl);
            const storeInfo = this.plugin.getFeedStorageInfo(item.feedUrl);
            totalItems += stats.total;
            totalRead += stats.read;
            totalDeleted += stats.deleted;
            totalRawLength += storeInfo[2];
            totalBlobSize += storeInfo[3];
            return {
                originalIndex: i, // To map back to GLB.feedList if needed
                name: item.name,
                feedUrl: item.feedUrl,
                folder: item.folder || '',
                total: stats.total,
                read: stats.read,
                deleted: stats.deleted,
                avgSize: stats.total === 0 ? 0 : storeInfo[2] / stats.total, // Raw length avg
                size: storeInfo[3], // Blob size
                sizeStr: storeInfo[1] // Formatted size string
            };
        });

        // Sort the data
        feedDataForTable.sort(this.comparer(this.sortBy, this.asc));

        // Render sorted rows
        feedDataForTable.forEach(data => {
            const tr = tbody.createEl('tr');
            // Name/URL Cell
            const nameCell = tr.createEl('td', { cls: 'cellNameContainer' });
            const nameInput = nameCell.createEl('input', { value: data.name });
            nameInput.id = `manageFdName${data.originalIndex}`; // Link to original index
            nameInput.type = 'text';
            const urlInput = nameCell.createEl('input', { value: data.feedUrl, type: 'text', attr: { readonly: true } }); // Readonly URL
            urlInput.id = `manageFdUrl${data.originalIndex}`;
            // Folder Cell
            const folderCell = tr.createEl('td', { cls: 'cellFolderContainer' });
            const folderInput = folderCell.createEl('input', { value: data.folder });
            folderInput.id = `manageFdFolder${data.originalIndex}`;
            folderInput.type = 'text';
            // Stats Cells
            tr.createEl('td', { text: data.total.toString() });
            tr.createEl('td', { text: data.read.toString() });
            tr.createEl('td', { text: data.deleted.toString() });
            tr.createEl('td', { text: Math.floor(data.avgSize).toString() }); // Display average size
            tr.createEl('td', { text: data.sizeStr }); // Display formatted size
            // Checkbox Cell
            const checkTd = tr.createEl('td');
            const check = checkTd.createEl('input', { attr: { type: 'checkbox' }, cls: 'checkThis' });
            check.setAttribute('value', data.feedUrl); // Use value attribute
            check.setAttribute('data-feed-name', data.name); // Keep name for confirmation dialogs
        });

        // --- Table Footer ---
        const foot = form.createTFoot().createEl('tr');
        foot.createEl('td', { text: `Total: ${GLB.feedList.length}` });
        foot.createEl('td'); // Folder
        foot.createEl('td', { text: totalItems.toString() }); // Total items
        foot.createEl('td', { text: totalRead.toString() }); // Total read
        foot.createEl('td', { text: totalDeleted.toString() }); // Total deleted
        foot.createEl('td', { text: Math.floor(totalRawLength / (totalItems || 1)).toString() }); // Avg size overall
        foot.createEl('td', { text: getStoreSizeStr(totalBlobSize) }); // Total size overall
        foot.createEl('td'); // Checkbox column
    }

    comparer = (key: string, asc: boolean) => (a: any, b: any) => {
        const valA = a[key];
        const valB = b[key];
        let comparison = 0;

        if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
            comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        } else {
            // Handle mixed types or other types if necessary
             if (valA < valB) comparison = -1;
             if (valA > valB) comparison = 1;
        }
        return asc ? comparison : comparison * -1;
    };

    getCellValue = (tr: Element, idx: number): string => {
        // This function is less useful now with direct data sorting
        // Kept for potential future use or reference
        const cell = tr.children[idx];
        if (!cell) return '';
        const input = cell.querySelector('input');
        if (input) return input.value;
        return cell.getAttribute('sortBy') || cell.textContent || '';
    };

    async applyNameUrlFolderChanges() {
        let changed = false;
        const renameOps: { oldName: string, newName: string, oldUrl: string }[] = [];
        const folderChanges: { url: string, newFolder: string }[] = [];

        for (let i = 0; i < GLB.feedList.length; i++) {
            const nameInput = document.getElementById(`manageFdName${i}`) as HTMLInputElement;
            const folderInput = document.getElementById(`manageFdFolder${i}`) as HTMLInputElement;
            if (!nameInput || !folderInput) continue;

            const newName = nameInput.value.trim();
            const newFolder = folderInput.value.trim();
            const oldItem = GLB.feedList[i];

            const nameChanged = oldItem.name !== newName;
            const folderChanged = (oldItem.folder || '') !== (newFolder || '');

            // Validation
            if (nameChanged && !newName) { new Notice(`Name cannot be empty for original feed: ${oldItem.name}.`, 2000); continue; } // Skip this change
            if (nameChanged && GLB.feedList.some((f, j) => j !== i && f.name === newName)) { new Notice(`Name "${newName}" already used by another feed.`, 2000); continue; }

            if (nameChanged) {
                renameOps.push({ oldName: oldItem.name, newName, oldUrl: oldItem.feedUrl });
                changed = true;
            }
            if (folderChanged) {
                folderChanges.push({ url: oldItem.feedUrl, newFolder });
                 changed = true;
            }
        }

        if (changed) {
            try {
                // 1. Rename physical files first (using old names)
                await Promise.all(renameOps.map(op => this.renameFeedFiles(op.oldName, op.newName)));

                // 2. Update GLB.feedList and GLB.feedsStore in memory
                renameOps.forEach(op => {
                    const feedInList = GLB.feedList.find(f => f.feedUrl === op.oldUrl);
                    if (feedInList) feedInList.name = op.newName;
                    const feedInData = GLB.feedsStore[op.oldUrl];
                    if (feedInData) {
                         feedInData.name = op.newName; // Update name inside stored data object
                         GLB.feedsStoreChange = true;
                         GLB.feedsStoreChangeList.add(op.oldUrl); // Mark for saving
                    }
                });
                folderChanges.forEach(op => {
                     const feedInList = GLB.feedList.find(f => f.feedUrl === op.url);
                     if (feedInList) feedInList.folder = op.newFolder;
                      const feedInData = GLB.feedsStore[op.url];
                     if (feedInData) {
                          feedInData.folder = op.newFolder; // Update folder inside stored data object
                          GLB.feedsStoreChange = true;
                          GLB.feedsStoreChangeList.add(op.url); // Mark for saving
                     }
                });

                // 3. Re-sort the global list
                sort_feed_list();

                // 4. Save subscriptions and potentially changed feed data
                await this.plugin.saveSubscriptions();
                await this.plugin.saveFeedsData(); // Save feed data if names/folders inside changed

                // 5. Refresh UI
                await this.plugin.refreshFeedListSidebar(); // Update sidebar list
                new Notice("Changes applied successfully.", 1500);
                this.close(); // Close modal on success
            } catch (e: any) {
                new Notice(`Error applying changes: ${e.message}`, 3000);
                console.error("Error applying name/folder changes:", e);
                // Optionally re-render the table to show current state after error
                const tableContainer = this.contentEl.querySelector('div'); // Find the container
                 if(tableContainer) this.renderTable(tableContainer);
            }
        } else {
            new Notice("No valid changes detected.", 1000);
        }
    }

    async renameFeedFiles(oldName:string, newName:string){
        const folder = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
        const adapter = this.plugin.app.vault.adapter;
        if (!await adapter.exists(folder)) return; // No folder, nothing to rename

        let i = 0;
        while (true) {
            const oldFnBase = this.plugin.makeFilename(oldName, i);
            const newFnBase = this.plugin.makeFilename(newName, i);
            const oldGz = `${folder}/${oldFnBase}.gzip`;
            const oldPl = `${folder}/${oldFnBase}`; // Plain filename without .gzip
            const newGz = `${folder}/${newFnBase}.gzip`;
            const newPl = `${folder}/${newFnBase}`;
            let foundOldFile = false;

            try {
                if (await adapter.exists(oldGz)) {
                    console.log(`Renaming ${oldGz} to ${newGz}`);
                    await adapter.rename(oldGz, newGz);
                    foundOldFile = true;
                } else if (await adapter.exists(oldPl)) { // Check for plain file if gzip not found
                     console.log(`Renaming ${oldPl} to ${newPl}`); // Rename plain to plain
                     await adapter.rename(oldPl, newPl);
                    foundOldFile = true;
                }
            } catch (e) {
                 console.warn(`Rename failed for index ${i} (Old: ${oldName}, New: ${newName})`, e);
                 // Decide whether to continue or stop on error
            }
            if (!foundOldFile) break; // Stop if no file (gz or plain) exists for this index
            i++;
        }
    }

    runActionOnSelected(confirmMsg:string, actionFn:(feedUrl:string)=>any, noticeResult=false){
        const checkedBoxes = Array.from(this.contentEl.querySelectorAll<HTMLInputElement>('.checkThis:checked'));
        if (checkedBoxes.length === 0) {
            new Notice("No feeds selected.", 1500);
            return;
        }
        if (!window.confirm(confirmMsg)) return;

        let changed = false;
        let results: { name: string, result: any }[] = [];

        checkedBoxes.forEach(checkbox => {
            const url = checkbox.getAttribute('value');
            const name = checkbox.getAttribute('data-feed-name');
            if (url) {
                try {
                    const result = actionFn(url); // Execute the action (e.g., markAllRead)
                    if (result !== undefined && result !== false && result !== null) {
                         results.push({ name: name || url, result });
                    }
                    changed = true; // Assume change occurred if function didn't throw
                } catch (e: any) {
                    new Notice(`Error applying action to ${name || url}: ${e.message}`, 2000);
                    console.error(`Error during selected action on ${url}:`, e);
                }
            }
        });

        if (changed) {
             // Refresh sidebar immediately to reflect changes (e.g., unread counts)
             this.plugin.refreshFeedListSidebar();
             // If the current feed was affected, refresh the main display too
             const currentFeedUrl = GLB.currentFeed;
             if (currentFeedUrl && checkedBoxes.some(cb => cb.getAttribute('value') === currentFeedUrl)) {
                  this.plugin.makeDisplayList(); // Update display indices/starred list
                  this.plugin.refreshDisplay(); // Refresh main view
             }

            new Notice("Action applied to selected feeds.", 1500);
            if (noticeResult && results.length > 0) {
                results.forEach(r => new Notice(`${r.name}: ${r.result}`));
            }
            // Re-render the modal table to show updated stats
            const tableContainer = this.contentEl.querySelector('div'); // Adjust selector if needed
            if(tableContainer) this.renderTable(tableContainer);
            // Do not close the modal automatically
        }
    }

    async removeSelectedFeeds(){
        const checkedBoxes = Array.from(this.contentEl.querySelectorAll<HTMLInputElement>('.checkThis:checked'));
        if (checkedBoxes.length === 0) {
            new Notice("No feeds selected.", 1500);
            return;
        }
        const feedNames = checkedBoxes.map(cb => cb.getAttribute('data-feed-name') || cb.getAttribute('value')).join(', ');
        if (!window.confirm(`PERMANENTLY REMOVE ${checkedBoxes.length} feed(s) (${feedNames}) and ALL associated data? This CANNOT BE UNDONE.`)) return;

        const urlsToRemove = checkedBoxes.map(cb => cb.getAttribute('value')).filter(Boolean) as string[];

        await Promise.all(urlsToRemove.map(url => this.plugin.removeFeed(url)));

        new Notice(`${checkedBoxes.length} feed(s) removed.`, 2000);
        // Re-render the modal table after removal
         const tableContainer = this.contentEl.querySelector('div'); // Adjust selector if needed
         if(tableContainer) this.renderTable(tableContainer);
         // Do not close automatically
    }

    async onClose() {
        // No need for explicit refresh calls here if modal re-renders on open
        // and main plugin handles UI updates based on GLB changes triggered by actions.
    }
}

// --- Setting Tab ---
class FeedReaderSettingTab extends PluginSettingTab {
	plugin: FeedsReader;

	constructor(app: App, plugin: FeedsReader) {
        super(app, plugin);
        this.plugin = plugin;
    }

	display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Settings for Feeds Reader' });

        // --- ChatGPT Settings ---
        containerEl.createEl('h3', { text: 'ChatGPT (Optional)' });
        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your OpenAI API Key for ChatGPT features.')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.chatGPTAPIKey || '')
                .onChange(async (value) => {
                    this.plugin.settings.chatGPTAPIKey = value;
                    GLB.settings.chatGPTAPIKey = value; // Update global settings object too
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Default Prompt')
            .setDesc('The default instruction prepended to content sent to ChatGPT.')
            .addTextArea(text => text
                .setPlaceholder(DEFAULT_SETTINGS.chatGPTPrompt || '')
                .setValue(this.plugin.settings.chatGPTPrompt || '')
                .onChange(async (value) => {
                    this.plugin.settings.chatGPTPrompt = value;
                    GLB.settings.chatGPTPrompt = value;
                    await this.plugin.saveSettings();
                }));

        // --- Appearance Settings ---
        containerEl.createEl('h3', { text: 'Appearance' });
        new Setting(containerEl)
            .setName('Default Display Mode')
            .setDesc('Choose how feed items are initially displayed in the main view.')
            .addDropdown(dropdown => dropdown
                .addOption('card', 'Card View')
                .addOption('list', 'List View')
                .setValue(this.plugin.settings.defaultDisplayMode)
                .onChange(async (value: 'card' | 'list') => {
                    this.plugin.settings.defaultDisplayMode = value;
                    GLB.displayMode = value; // Update global state
                    await this.plugin.saveSettings();
                    this.plugin.refreshDisplay(); // Refresh the main view
                }));
        new Setting(containerEl)
            .setName('Card Width (pixels)')
            .setDesc('Set the target width for items in Card View (min 180, max 800). Actual width adapts to available space.')
            .addText(text => text
                .setPlaceholder('280')
                .setValue(this.plugin.settings.cardWidth.toString())
                .onChange(async (value) => {
                    let width = parseInt(value);
                    if (isNaN(width)) width = 280; // Default if invalid input
                    width = Math.max(180, Math.min(800, width)); // Clamp value
                    this.plugin.settings.cardWidth = width;
                    GLB.cardWidth = width;
                    document.documentElement.style.setProperty('--card-item-width', `${width}px`); // Update CSS variable
                    await this.plugin.saveSettings();
                     // No need to refresh display just for width change
                }));
        new Setting(containerEl)
            .setName('Items Per Page')
            .setDesc('Number of feed items shown per page in the main view.')
            .addText(text => text
                .setPlaceholder('20')
                .setValue(this.plugin.settings.nItemPerPage.toString())
                .onChange(async (value) => {
                    const num = parseInt(value) || 20; // Default to 20 if invalid
                    this.plugin.settings.nItemPerPage = num > 0 ? num : 20; // Ensure positive number
                    GLB.nItemPerPage = this.plugin.settings.nItemPerPage;
                    await this.plugin.saveSettings();
                    if (GLB.currentFeed) this.plugin.refreshDisplay(); // Refresh view if a feed is active
                }));

        // --- Action Button Visibility ---
        containerEl.createEl('h4', { text: 'Show Action Buttons On Items' });
        const buttonToggles: { key: keyof FeedsReaderSettings; name: string; desc: string }[] = [
            { key: 'showRead', name: 'Read/Unread', desc: 'Mark items as read or unread.' },
            { key: 'showDelete', name: 'Delete/Undelete', desc: 'Mark items as deleted or restore them.' },
            { key: 'showJot', name: 'Jot Notes', desc: 'Quickly jot down temporary notes associated with an item.' },
            { key: 'showSnippet', name: 'Save Snippet', desc: 'Save item details to a dedicated snippets file.' },
            { key: 'showSave', name: 'Save as Note', desc: 'Create a new Obsidian note from the feed item.' },
            { key: 'showMath', name: 'Render Math', desc: 'Attempt to render LaTeX math in item content (requires MathJax).' },
            { key: 'showGPT', name: 'Ask GPT', desc: 'Send item content to ChatGPT (requires API key & prompt).' },
            { key: 'showEmbed', name: 'Embed Link', desc: 'Open the item link in an embedded iframe modal.' },
            { key: 'showFetch', name: 'Fetch Full Page', desc: 'Attempt to fetch and display the linked page content.' },
            { key: 'showLink', name: 'Open Link', desc: 'Show a direct link to open the original item URL.' },
        ];
        buttonToggles.forEach(setting => {
            new Setting(containerEl)
                .setName(setting.name)
                .setDesc(setting.desc)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings[setting.key] as boolean) // Assume boolean
                    .onChange(async (value) => {
                        (this.plugin.settings[setting.key] as boolean) = value;
                        (GLB.settings[setting.key] as boolean) = value; // Update global settings object
                        await this.plugin.saveSettings();
                        if (GLB.currentFeed) this.plugin.refreshDisplay(); // Refresh view to show/hide buttons
                    }));
        });

        // --- Saving Behavior ---
        containerEl.createEl('h3', { text: 'Saving Behavior' });
        new Setting(containerEl)
            .setName('Save Content in Notes/Snippets')
            .setDesc('If enabled, includes the full downloaded item content when using "Save Snippet" or "Save as Note".')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.saveContent)
                .onChange(async (value) => {
                    this.plugin.settings.saveContent = value;
                    GLB.settings.saveContent = value;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Prepend New Snippets')
            .setDesc('ON: Add new snippets to the top of the snippets file. OFF: Append to the bottom.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.saveSnippetNewToOld)
                .onChange(async (value) => {
                    this.plugin.settings.saveSnippetNewToOld = value;
                    GLB.settings.saveSnippetNewToOld = value;
                    await this.plugin.saveSettings();
                }));
    }
}