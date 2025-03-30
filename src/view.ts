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

    // Helper to get the plugin instance
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
        // Generate title based on current feed state in GLB
        if (GLB.currentFeed === GLB.STARRED_VIEW_ID) {
            return "Starred Items";
        } else if (GLB.currentFeedName) {
            // Simple truncation, adjust as needed
            const maxLength = 30;
            const name = GLB.currentFeedName.length > maxLength
                       ? GLB.currentFeedName.substring(0, maxLength) + "..."
                       : GLB.currentFeedName;
            return `Feed: ${name}`;
        }
        return "Feeds Reader"; // Default/Initial title when no feed is selected
    }

    // Method to update the display text of the view header
    updateHeaderText() {
        const newTitle = this.getDisplayText();
        // Find the title element using Obsidian's recommended selectors
        const titleEl = this.containerEl.querySelector('.view-header-title-container .view-header-title')
                     || this.containerEl.querySelector('.view-header-title'); // Fallback
        if (titleEl) {
            titleEl.textContent = newTitle;
        }
        // ItemView automatically uses getDisplayText for the leaf's title.
    }


    async onOpen() {
        console.log("FRView: onOpen triggered.");
        const container = this.contentEl; // Use contentEl for ItemView
        container.empty();
        container.addClass('feeds-reader-content-view');

        if (!this.plugin) {
            console.error('Feeds Reader View: Could not get plugin instance in onOpen.');
            container.setText("Error: Feeds Reader plugin instance not found.");
            return;
        }


        // Set initial CSS variable for card width
        document.documentElement.style.setProperty('--card-item-width', `${GLB.settings?.cardWidth || 280}px`);

        // --- Create Structure for Header and Content Area ---
        const contentHeader = container.createEl('div', { cls: 'content-header' });
        contentHeader.id = 'contentHeader';

        const feed_content = container.createEl('div', { cls: 'feed-content-area' });
        feed_content.id = 'feed_content';

        // --- Initial Display ---
        // Show prompt, actual content rendering is triggered by refreshDisplay
        feed_content.setText('Select a feed or "Starred Items" from the sidebar, or wait for data to load.');
        this.updateHeaderText(); // Set initial title

        // The plugin should call refreshDisplay after data is ready.
         console.log("FRView: onOpen complete, waiting for refreshDisplay call.");
    }

    // Method called by the main plugin to render/update the content area
    renderContent() {
        console.log("FRView: renderContent called. Current feed:", GLB.currentFeed);
        if (!this.plugin) {
            console.error("FRView.renderContent: Plugin instance not available.");
            return;
        }
        // Ensure contentEl exists (should always exist after onOpen)
        if (!this.contentEl) {
            console.error("FRView.renderContent: contentEl not available.");
            return;
        }

        // Find header and content areas, check if they exist
        const contentHeader = this.contentEl.querySelector('#contentHeader') as HTMLElement;
        const feed_content = this.contentEl.querySelector('#feed_content') as HTMLElement;

        if (!contentHeader || !feed_content) {
            console.error("Feeds Reader View: Header or content area not found during render. Attempting to rebuild structure.");
            // Attempt to recreate structure if missing (defensive programming)
            this.contentEl.empty(); // Clear potentially broken state
            this.contentEl.addClass('feeds-reader-content-view');
            const newHeader = this.contentEl.createEl('div', { cls: 'content-header' }); newHeader.id = 'contentHeader';
            const newContent = this.contentEl.createEl('div', { cls: 'feed-content-area' }); newContent.id = 'feed_content';
             // Retry rendering after structure recreation
             // Use setTimeout to allow DOM update cycle
             setTimeout(() => this.renderContent(), 0);
            return; // Exit current render attempt
        }

        // --- Clear previous content ---
        contentHeader.empty();
        feed_content.empty();

        // --- Determine what to display based on GLB state ---
        const isStarredView = GLB.currentFeed === GLB.STARRED_VIEW_ID;
        const itemsToDisplay = isStarredView ? GLB.starredItemsList : GLB.displayIndices;
        let feedData: RssFeedContent | null = null;
        if (!isStarredView && GLB.currentFeed && GLB.feedsStore && GLB.feedsStore[GLB.currentFeed]) {
            feedData = GLB.feedsStore[GLB.currentFeed];
        }

        // --- Render Header ---
        const titleH2 = contentHeader.createEl('h2');
        titleH2.addClass('feed-title-header');
        if (isStarredView) {
            titleH2.setText('★ Starred Items');
        } else if (feedData) {
            const titleText = feedData.title || GLB.currentFeedName || "Feed";
            if (feedData.link) {
                titleH2.createEl('a', { href: feedData.link, text: titleText, attr: { target: '_blank', rel: 'noopener noreferrer' } });
            } else {
                titleH2.setText(titleText);
            }
        } else if (GLB.currentFeed) {
             // If currentFeed is set but no feedData found (e.g., still loading or error)
             titleH2.setText(`Feed: ${GLB.currentFeedName || 'Loading...'}`);
        }
         else {
            // Default state when no feed selected
            titleH2.setText('Select a Feed');
        }

        // Header Actions
        const headerActions = contentHeader.createDiv({ cls: 'header-actions' });
        if (!isStarredView && GLB.currentFeed) {
            const refreshBtn = headerActions.createEl('button', { text: 'Refresh' });
            refreshBtn.id = 'refreshCurrentFeed';
        }
        const viewToggleBtn = headerActions.createEl('button', { text: GLB.displayMode === 'list' ? 'Card View' : 'List View' });
        viewToggleBtn.id = 'toggleDisplayMode';
        if (GLB.displayMode === 'card') {
            const widthDecBtn = headerActions.createEl('button', { text: 'W-' });
            widthDecBtn.id = 'decreaseCardWidth';
            const widthIncBtn = headerActions.createEl('button', { text: 'W+' });
            widthIncBtn.id = 'increaseCardWidth';
        }

        // --- Render Content Area ---
        const topPageActions = feed_content.createDiv({ cls: 'page-actions top-page-actions' });
        this.plugin.createPageActionButtons(topPageActions, itemsToDisplay.length > 0); // Render top page actions

        // Items Container
        const itemsContainer = feed_content.createDiv();
        itemsContainer.addClass(`items-container-${GLB.displayMode}`); // Apply class based on mode

        const startIndex = GLB.idxItemStart;
        const endIndex = Math.min(itemsToDisplay.length, startIndex + GLB.nItemPerPage);
        let itemsDisplayedCount = 0;

        // --- Render Items ---
        console.log(`FRView: Rendering items from ${startIndex} to ${endIndex-1}. Total displayable: ${itemsToDisplay.length}`);
        if (itemsToDisplay.length === 0) {
             // Check if a feed is selected but store might be empty
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
                    // Add checks for starredInfo and item validity
                    if (starredInfo && starredInfo.item) {
                        item = starredInfo.item;
                        feedUrl = starredInfo.feedUrl;
                        originalIndex = starredInfo.originalIndex;
                    }
                } else if (GLB.currentFeed) {
                    originalIndex = itemsToDisplay[i] as number;
                    // Add checks for feed store and item index validity
                    if (GLB.feedsStore && GLB.feedsStore[GLB.currentFeed] && originalIndex >= 0 && originalIndex < GLB.feedsStore[GLB.currentFeed].items.length) {
                        item = GLB.feedsStore[GLB.currentFeed].items[originalIndex];
                        feedUrl = GLB.currentFeed;
                    } else {
                         console.warn(`Invalid index ${originalIndex} or missing feed store for feed ${GLB.currentFeed}`);
                    }
                }

                // Ensure we have valid data before rendering
                if (item && feedUrl !== null && originalIndex !== -1) {
                    try { // Add try-catch around item creation
                        if (GLB.displayMode === 'card') {
                            this.plugin.createCardItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                        } else {
                            this.plugin.createListItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                        }
                        itemsDisplayedCount++;
                    } catch (itemRenderError){
                         console.error("Error rendering specific item:", itemRenderError, item);
                         // Optionally render a placeholder for the broken item
                         itemsContainer.createDiv({cls: 'item-render-error', text:`Error rendering item: ${item.title || 'Unknown'}`});
                    }
                } else {
                     console.warn("Skipping item render due to missing data at index:", i, "Feed:", feedUrl, "Original Index:", originalIndex);
                }
            }
        }

        // --- Render Bottom Actions & Pagination ---
        if (itemsDisplayedCount > 0) { // Only show if items were actually rendered
            if (itemsDisplayedCount >= 5) { // Threshold for bottom actions
                const bottomPageActions = feed_content.createDiv({ cls: 'page-actions bottom-page-actions' });
                this.plugin.createPageActionButtons(bottomPageActions, true);
            }
            // Render pagination controls
            this.plugin.createPagination(feed_content, itemsToDisplay.length);
        }

        // Update the header text (title) after rendering is complete
        this.updateHeaderText();
        console.log("FRView: renderContent finished.");
    }

    async onClose() {
        console.log("FRView: onClose triggered.");
        // Cleanup related to this view if necessary
        this.contentEl.empty(); // Clear content when view closes
    }
}