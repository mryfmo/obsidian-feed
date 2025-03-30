// Imports including RssFeed types and necessary Obsidian types
import { ItemView, WorkspaceLeaf, Notice, App, Component } from "obsidian";
import { GLB } from "./globals";
import FeedsReader from "./main";
import { RssFeedContent, RssFeedItem } from './getFeed'; // ★★★ Import RssFeed types ★★★

export const VIEW_TYPE_FEEDS_READER = "feeds-reader-view";
const PLUGIN_ID = 'feeds-reader'; // Ensure consistent Plugin ID

export class FRView extends ItemView {
    plugin: FeedsReader | null = null; // Store plugin instance

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.plugin = this.getPluginInstance();
    }

    // Helper to get the plugin instance
    private getPluginInstance(): FeedsReader | null {
        // Use type assertion as App.plugins is not in official obsidian.d.ts
        const plugins = (this.app as any).plugins;
        if (!plugins) {
             console.error("FRView: Cannot access plugins object.");
             return null;
        }
        const pluginInstance = plugins.plugins?.[PLUGIN_ID];
        if (pluginInstance instanceof FeedsReader) {
            return pluginInstance;
        } else {
            console.error(`FRView: Plugin instance '${PLUGIN_ID}' not found or invalid type.`);
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
        // ★★★ Removed this.leaf.setDisplayText(newTitle); as it's not a valid method ★★★
        // ItemView automatically uses getDisplayText for the leaf's title.
    }


    async onOpen() {
        if (!this.plugin) {
            console.error('Feeds Reader View: Could not get plugin instance in onOpen.');
            this.contentEl.setText("Error: Feeds Reader plugin instance not found.");
            return; // Stop initialization
        }

        // --- Container setup ---
        const container = this.contentEl; // Use contentEl for ItemView
        container.empty();
        container.addClass('feeds-reader-content-view'); // Add main class for styling

        // Set initial CSS variable for card width
        document.documentElement.style.setProperty('--card-item-width', `${GLB.settings?.cardWidth || 280}px`);

        // --- Create Structure for Header and Content Area ---
        // Content Header (will be populated by renderContent)
        const contentHeader = container.createEl('div', { cls: 'content-header' });
        contentHeader.id = 'contentHeader';

        // Feed Content Area (will be populated by renderContent)
        const feed_content = container.createEl('div', { cls: 'feed-content-area' });
        feed_content.id = 'feed_content';

        // --- Initial Display ---
        // Show a loading message or initial prompt
        feed_content.setText('Select a feed or "Starred Items" from the sidebar.');

        // Trigger initial rendering *after* data is potentially loaded by the plugin
        // The plugin's onload/onLayoutReady should call refreshDisplay after loading data.
        this.plugin.refreshDisplay(); // Initial render based on current state

        this.updateHeaderText(); // Set initial title
    }

    // Method called by the main plugin to render/update the content area
    renderContent() {
        if (!this.plugin) {
            console.error("FRView.renderContent: Plugin instance not available.");
            return;
        }
        if (!this.contentEl) {
            console.error("FRView.renderContent: contentEl not available.");
            return;
        }


        const contentHeader = this.contentEl.querySelector('#contentHeader') as HTMLElement;
        const feed_content = this.contentEl.querySelector('#feed_content') as HTMLElement;

        if (!contentHeader || !feed_content) {
            console.error("Feeds Reader View: Header or content area not found during render.");
            // Attempt to recreate if missing? Or just return.
            // For now, return to avoid further errors.
            return;
        }

        // --- Clear previous content ---
        contentHeader.empty();
        feed_content.empty();

        // --- Determine what to display based on GLB state ---
        const isStarredView = GLB.currentFeed === GLB.STARRED_VIEW_ID;
        // Use displayIndices for regular feeds, starredItemsList for starred view
        const itemsToDisplay = isStarredView ? GLB.starredItemsList : GLB.displayIndices;
        // ★★★ Ensure RssFeedContent type is available ★★★
        let feedData: RssFeedContent | null = null;
        if (!isStarredView && GLB.currentFeed && GLB.feedsStore) {
            feedData = GLB.feedsStore[GLB.currentFeed];
        }

        // --- Render Header ---
        const titleH2 = contentHeader.createEl('h2');
        titleH2.addClass('feed-title-header');
        if (isStarredView) {
            titleH2.setText('★ Starred Items');
        } else if (feedData) {
            // Use feed title or name, provide link if available
            const titleText = feedData.title || GLB.currentFeedName || "Feed";
            if (feedData.link) {
                titleH2.createEl('a', { href: feedData.link, text: titleText, attr: { target: '_blank', rel: 'noopener noreferrer' } });
            } else {
                titleH2.setText(titleText);
            }
        } else {
            // Show default text if no feed is selected
            titleH2.setText('Select a Feed');
        }

        // Header Actions
        const headerActions = contentHeader.createDiv({ cls: 'header-actions' });
        // Refresh button only for non-starred feeds
        if (!isStarredView && GLB.currentFeed) {
            const refreshBtn = headerActions.createEl('button', { text: 'Refresh' });
            refreshBtn.id = 'refreshCurrentFeed'; // ID for click handler in main.ts
        }
        // Display mode toggle
        const viewToggleBtn = headerActions.createEl('button', { text: GLB.displayMode === 'list' ? 'Card View' : 'List View' });
        viewToggleBtn.id = 'toggleDisplayMode'; // ID for click handler
        // Card width controls (only in card mode)
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
        if (itemsToDisplay.length === 0) {
            itemsContainer.setText(isStarredView ? 'No starred items found.' : `No items match the current filter ('${GLB.filterMode}').`);
        } else if (startIndex >= itemsToDisplay.length) {
            itemsContainer.setText('No more items on this page.'); // Should ideally not happen with pagination logic
        } else {
            for (let i = startIndex; i < endIndex; i++) {
                 // ★★★ Ensure RssFeedItem type is available ★★★
                let item: RssFeedItem | null = null;
                let feedUrl: string | null = null;
                let originalIndex = -1;

                if (isStarredView) {
                    // itemsToDisplay is GLB.starredItemsList here
                    const starredInfo = itemsToDisplay[i] as { feedUrl: string; originalIndex: number; item: RssFeedItem };
                    if (starredInfo) {
                        item = starredInfo.item;
                        feedUrl = starredInfo.feedUrl;
                        originalIndex = starredInfo.originalIndex;
                    }
                } else if (GLB.currentFeed) {
                    // itemsToDisplay is GLB.displayIndices here
                    originalIndex = itemsToDisplay[i] as number;
                     // Check bounds before accessing
                     if (originalIndex >= 0 && originalIndex < GLB.feedsStore[GLB.currentFeed]?.items.length) {
                         item = GLB.feedsStore[GLB.currentFeed].items[originalIndex];
                         feedUrl = GLB.currentFeed;
                     } else {
                          console.warn(`Invalid index ${originalIndex} encountered for feed ${GLB.currentFeed}`);
                     }
                }

                // Ensure we have valid data before rendering
                if (item && feedUrl !== null && originalIndex !== -1) {
                    // Call plugin methods to create item elements
                    if (GLB.displayMode === 'card') {
                        this.plugin.createCardItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                    } else {
                        this.plugin.createListItem(itemsContainer, item, originalIndex, feedUrl, isStarredView);
                    }
                    itemsDisplayedCount++;
                } else {
                     console.warn("Skipping item render due to missing data at index:", i, "Feed:", feedUrl, "Original Index:", originalIndex);
                }
            }
        }

        // --- Render Bottom Actions & Pagination ---
        if (itemsDisplayedCount > 0) { // Only show if items were actually rendered
            // Render bottom actions only if enough items displayed (e.g., 5 or more)
            if (itemsDisplayedCount >= 5) {
                const bottomPageActions = feed_content.createDiv({ cls: 'page-actions bottom-page-actions' });
                this.plugin.createPageActionButtons(bottomPageActions, true);
            }
            // Render pagination controls
            this.plugin.createPagination(feed_content, itemsToDisplay.length);
        }

        // Update the header text (title) after rendering
        this.updateHeaderText();
    }

    async onClose() {
        // Cleanup related to this view if necessary
        this.contentEl.empty(); // Clear content when view closes
    }
}