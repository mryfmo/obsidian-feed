// Imports including RssFeed types and necessary Obsidian types
import { ItemView, WorkspaceLeaf, Notice, App, Component } from "obsidian";
import { GLB } from "./globals";
import FeedsReader from "./main";
import { RssFeedContent, RssFeedItem } from './getFeed'; // Import RssFeed types

export const VIEW_TYPE_FEEDS_READER = "feeds-reader-view";
const PLUGIN_ID = 'feeds-reader'; // Ensure consistent Plugin ID

export class FRView extends ItemView {
    plugin: FeedsReader | null = null; // Store plugin instance
    isLoading: boolean = false; // Optional loading state for main view

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.plugin = this.getPluginInstance();
         if (!this.plugin) {
             console.error("FRView: Failed to get plugin instance during construction.");
         }
    }

    private getPluginInstance(): FeedsReader | null {
         try {
            const plugins = (this.app as any).plugins;
            if (!plugins || !plugins.plugins) {
                 console.error("FRView: Cannot access plugins object or plugins map.");
                 return null;
            }
            const pluginInstance = plugins.plugins[PLUGIN_ID];
            if (pluginInstance instanceof FeedsReader) {
                return pluginInstance;
            } else {
                console.error(`FRView: Plugin instance '${PLUGIN_ID}' not found or invalid type.`);
                return null;
            }
        } catch (error) {
             console.error("FRView: Error getting plugin instance:", error);
             return null;
        }
    }

    getViewType(): string {
        return VIEW_TYPE_FEEDS_READER;
    }

    getDisplayText(): string {
        const currentFeedInfo = (GLB.currentFeed && GLB.currentFeed !== GLB.STARRED_VIEW_ID)
                                ? GLB.feedList.find(f => f.feedUrl === GLB.currentFeed) : null;
        const errorSuffix = currentFeedInfo?.lastError ? ' (Error)' : '';

        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            return "Starred Items";
        } else if (GLB.currentFeedName) {
            const maxLength = 30;
            const name = GLB.currentFeedName.length > maxLength
                       ? GLB.currentFeedName.substring(0, maxLength) + "..."
                       : GLB.currentFeedName;
            return `Feed: ${name}${errorSuffix}`; // Add error suffix
        }
        return "Feeds Reader";
    }

    updateHeaderText() {
        const newTitle = this.getDisplayText();
        const titleEl = this.containerEl.querySelector('.view-header-title-container .view-header-title')
                     || this.containerEl.querySelector('.view-header-title');
        if (titleEl) {
            titleEl.textContent = newTitle;
        }
    }


    async onOpen() {
        console.log("FRView: onOpen triggered.");
        const container = this.contentEl;
        container.empty();
        container.addClass('feeds-reader-content-view');

        if (!this.plugin) {
            console.error('Feeds Reader View: Could not get plugin instance in onOpen.');
            container.setText("Error: Feeds Reader plugin instance not found.");
            return;
        }

        document.documentElement.style.setProperty('--card-item-width', `${GLB.settings?.cardWidth || 280}px`);

        const contentHeader = container.createEl('div', { cls: 'content-header' });
        contentHeader.id = 'contentHeader';

        const feed_content = container.createEl('div', { cls: 'feed-content-area' });
        feed_content.id = 'feed_content';

        feed_content.setText('Select a feed or "Starred Items" from the sidebar, or wait for data to load.');
        this.updateHeaderText();

         console.log("FRView: onOpen complete, waiting for refreshDisplay call.");
    }

    renderContent() {
        console.log("FRView: renderContent called. Current feed:", GLB.currentFeed);
        // 1. Check plugin instance
        if (!this.plugin) {
            console.error("FRView.renderContent: Plugin instance not available.");
            // Display error in the view content area
            this.contentEl.empty();
            this.contentEl.setText("Error: Plugin instance missing. Cannot render content.");
            return;
         }
        // 2. Check contentEl
        if (!this.contentEl) {
             console.error("FRView.renderContent: contentEl not available.");
             // Cannot display error if contentEl is missing, just log and return.
             return;
        }

        const contentHeader = this.contentEl.querySelector('#contentHeader') as HTMLElement;
        const feed_content = this.contentEl.querySelector('#feed_content') as HTMLElement;

        // 3. Check required DOM elements
        if (!contentHeader || !feed_content) {
             console.error("Feeds Reader View: Header or content area not found during render.");
             // Attempt to display error within contentEl if possible
             this.contentEl.empty();
             this.contentEl.setText("Error: UI structure incomplete. Cannot render content.");
             return;
        }

        contentHeader.empty();
        feed_content.empty();

        const isStarredView = GLB.currentFeed === GLB.STARRED_VIEW_ID;
        // Get error info for current feed
        const currentFeedInfo = (!isStarredView && GLB.currentFeed)
                                ? GLB.feedList.find(f => f.feedUrl === GLB.currentFeed)
                                : null;
        const currentFeedError = currentFeedInfo?.lastError || null;

        let feedData: RssFeedContent | null = null;
        if (!isStarredView && GLB.currentFeed && GLB.feedsStore && GLB.feedsStore[GLB.currentFeed]) {
            feedData = GLB.feedsStore[GLB.currentFeed];
        }

        // --- Render Header ---
        const titleH2 = contentHeader.createEl('h2');
        titleH2.addClass('feed-title-header');
        let baseTitleText = 'Select a Feed'; // Default

        if (isStarredView) {
            baseTitleText = '★ Starred Items';
        } else if (feedData) {
            baseTitleText = feedData.title || GLB.currentFeedName || "Feed";
        } else if (GLB.currentFeedName) {
             // If no feedData but a name exists, it might be loading or an error occurred
             baseTitleText = `Feed: ${GLB.currentFeedName}`;
             if (!currentFeedError) { // If no specific error, indicate loading state
                  baseTitleText += ' (Loading...)';
             }
        }

        // Add error icon to title
        if (currentFeedError) {
             titleH2.addClass('feed-title-error');
             titleH2.createSpan({ text: '⚠️ ', cls: 'feed-title-error-icon' });
        }

        // Add title text/link
        if (feedData?.link && !isStarredView && !currentFeedError) { // Only add link if no error and link exists
             titleH2.createEl('a', { href: feedData.link, text: baseTitleText, attr: { target: '_blank', rel: 'noopener noreferrer' } });
        } else {
             titleH2.appendText(baseTitleText);
        }

        // Header Actions
        const headerActions = contentHeader.createDiv({ cls: 'header-actions' });
        if (!isStarredView && GLB.currentFeed) {
            const refreshBtn = headerActions.createEl('button', { text: 'Refresh' });
            refreshBtn.id = 'refreshCurrentFeed';
             if (currentFeedError) refreshBtn.addClass('mod-warning'); // Highlight refresh on error
        }
        const viewToggleBtn = headerActions.createEl('button', { text: GLB.displayMode === 'list' ? 'Card View' : 'List View' });
        viewToggleBtn.id = 'toggleDisplayMode';
        if (GLB.displayMode === 'card') {
            const widthDecBtn = headerActions.createEl('button', { text: 'W-' }); widthDecBtn.id = 'decreaseCardWidth';
            const widthIncBtn = headerActions.createEl('button', { text: 'W+' }); widthIncBtn.id = 'increaseCardWidth';
        }

        // --- Render Content Area ---
        const itemsContainer = feed_content.createDiv(); // Items container first
        itemsContainer.addClass(`items-container-${GLB.displayMode}`);

        // Error display takes priority
        if (currentFeedError) {
            itemsContainer.empty();
            itemsContainer.addClass('feed-error-message');
            itemsContainer.createEl('h4', { text: 'Failed to Load Feed' });
            itemsContainer.createEl('p', { text: `Status: ${currentFeedError.status || 'N/A'}` });
            itemsContainer.createEl('p', { text: `Message: ${currentFeedError.message || 'No details available.'}` });
            itemsContainer.createEl('p', { text: `Last attempt: ${new Date(currentFeedError.timestamp || '').toLocaleString()}` });
            itemsContainer.createEl('p', { text: 'Please check the feed URL in Manage Feeds or your network connection. Try refreshing the feed.' });
            // Hide pagination if error exists
             const paginationContainer = feed_content.querySelector('.pagination-container');
             if (paginationContainer) paginationContainer.empty();

        } else {
            // Only execute page actions, item display, and pagination if there is no error
            const itemsToDisplay = isStarredView ? GLB.starredItemsList : GLB.displayIndices;

            const topPageActions = feed_content.createDiv({ cls: 'page-actions top-page-actions' });
            // Ensure plugin and method exist before calling
            if (this.plugin?.createPageActionButtons) {
                 this.plugin.createPageActionButtons(topPageActions, itemsToDisplay.length > 0);
            }


            const startIndex = GLB.idxItemStart;
            const endIndex = Math.min(itemsToDisplay.length, startIndex + GLB.nItemPerPage);
            let itemsDisplayedCount = 0;

            // Render Items
            console.log(`FRView: Rendering items from ${startIndex} to ${endIndex-1}. Total displayable: ${itemsToDisplay.length}`);
            if (itemsToDisplay.length === 0) {
                if(GLB.currentFeed && GLB.currentFeed !== GLB.STARRED_VIEW_ID && (!GLB.feedsStore || !GLB.feedsStore[GLB.currentFeed]?.items?.length)) {
                    itemsContainer.setText(`No items found for feed '${GLB.currentFeedName}'. Try refreshing the feed.`);
                } else {
                    itemsContainer.setText(isStarredView ? 'No starred items found.' : `No items match the current filter ('${GLB.filterMode}').`);
                }
            } else if (startIndex >= itemsToDisplay.length) {
                itemsContainer.setText('No more items on this page.');
            } else {
                for (let i = startIndex; i < endIndex; i++) {
                    let item: RssFeedItem | null = null;
                    let feedUrl: string | null = null;
                    let originalIndex = -1;

                    if (isStarredView) {
                        const starredInfo = itemsToDisplay[i] as { feedUrl: string; originalIndex: number; item: RssFeedItem };
                        if (starredInfo && starredInfo.item) {
                            item = starredInfo.item; feedUrl = starredInfo.feedUrl; originalIndex = starredInfo.originalIndex;
                        }
                    } else if (GLB.currentFeed) {
                        originalIndex = itemsToDisplay[i] as number;
                        if (GLB.feedsStore?.[GLB.currentFeed]?.items?.[originalIndex]) {
                            item = GLB.feedsStore[GLB.currentFeed].items[originalIndex]; feedUrl = GLB.currentFeed;
                        } else { console.warn(`Invalid index ${originalIndex} or missing feed store for feed ${GLB.currentFeed}`); }
                    }

                    if (item && feedUrl !== null && originalIndex !== -1) {
                        try {
                            // Ensure plugin and methods exist
                            if (this.plugin?.createCardItem && this.plugin?.createListItem) {
                                if (GLB.displayMode === 'card') {
                                    this.plugin.createCardItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                                } else {
                                    this.plugin.createListItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                                }
                                itemsDisplayedCount++;
                            } else { console.error("Plugin rendering methods not found"); }
                        } catch (itemRenderError){
                             console.error("Error rendering specific item:", itemRenderError, item);
                             itemsContainer.createDiv({cls: 'item-render-error', text:`Error rendering item: ${item.title || 'Unknown'}`});
                        }
                    } else { console.warn("Skipping item render due to missing data at index:", i, "Feed:", feedUrl, "Original Index:", originalIndex); }
                }
            }

            // Render Bottom Actions & Pagination (only if no error and items were displayed)
            if (itemsDisplayedCount > 0) {
                if (itemsDisplayedCount >= 5) {
                    const bottomPageActions = feed_content.createDiv({ cls: 'page-actions bottom-page-actions' });
                    if (this.plugin?.createPageActionButtons) this.plugin.createPageActionButtons(bottomPageActions, true);
                }
                if (this.plugin?.createPagination) this.plugin.createPagination(feed_content, itemsToDisplay.length);
            } else {
                 const paginationContainer = feed_content.querySelector('.pagination-container');
                 if (paginationContainer) paginationContainer.empty();
            }
        } // End of if (!currentFeedError) block

        this.updateHeaderText();
        console.log("FRView: renderContent finished.");
    }

    async onClose() {
        console.log("FRView: onClose triggered.");
        this.contentEl.empty();
    }
}

// Auxiliary functions (sleep) if used elsewhere
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }