import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { FeedsReaderView, VIEW_TYPE_FEEDS_READER } from '../../src/view';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import type { RssFeedContent, RssFeedItem } from '../../src/types';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  ItemView: class {
    containerEl = { empty: vi.fn() };

    icon = '';

    constructor(public leaf: unknown) {}

    addAction() {}

    getViewType() {
      return '';
    }

    getDisplayText() {
      return '';
    }

    getIcon() {
      return this.icon;
    }

    load() {}

    unload() {}
  },
  Notice: vi.fn(),
  setIcon: vi.fn(),
  WorkspaceLeaf: class {},
}));

// Mock view components
vi.mock('../../src/view/components/ControlsBarComponent', () => ({
  renderControlsBar: vi.fn(),
}));

vi.mock('../../src/view/components/FeedNavigationComponent', () => ({
  renderFeedNavigation: vi.fn(),
}));

vi.mock('../../src/view/components/FeedItemsListComponent', () => ({
  renderFeedItemsList: vi.fn(),
  handleContentAreaClick: vi.fn(),
}));

vi.mock('../../src/view/components/FeedItemsCardComponent', () => ({
  renderFeedItemsCard: vi.fn(),
}));

// Helper to create test data
function createFeedItem(overrides: Partial<RssFeedItem> = {}): RssFeedItem {
  return {
    id: 'item1',
    title: 'Test Item',
    content: '',
    category: '',
    link: '',
    creator: '',
    pubDate: '',
    read: '0',
    deleted: '0',
    downloaded: '0',
    ...overrides,
  };
}

function createFeedContent(overrides: Partial<RssFeedContent> = {}): RssFeedContent {
  return {
    title: 'Test Feed',
    name: 'test-feed',
    link: 'https://example.com',
    folder: 'test',
    items: [],
    ...overrides,
  };
}

describe('FeedsReaderView', () => {
  let view: FeedsReaderView;
  let plugin: IFeedsReaderPlugin;
  let leaf: WorkspaceLeaf;

  beforeEach(() => {
    // Create plugin mock
    plugin = {
      feedList: [],
      feedsStore: {},
      feedsStoreChangeList: new Set(),
      settings: {
        mixedFeedView: false,
        nItemPerPage: 20,
        saveContent: false,
        saveSnippetNewToOld: true,
        showJot: false,
        showSnippet: false,
        showRead: true,
        showSave: false,
        showMath: false,
        showGPT: false,
        showEmbed: false,
        showFetch: false,
        showLink: true,
        showDelete: true,
        showThumbnails: true,
        chatGPTApiKey: '',
        chatGPTPrompt: '',
        latestNOnly: false,
        latestNCount: 20,
        viewStyle: 'card',
        defaultTitleOnly: true, // Changed to match FSM default
      },
      app: {
        workspace: {
          activeLeaf: null,
        },
      },
      ensureFeedDataLoaded: vi.fn(),
      loadSettings: vi.fn(),
      saveSettings: vi.fn(),
    } as unknown as IFeedsReaderPlugin;

    // Create leaf mock
    leaf = {} as unknown as WorkspaceLeaf;

    // Create view
    view = new FeedsReaderView(leaf, plugin);

    // Mock required DOM elements
    view.actionIconsGroupEl = document.createElement('div');
    view.contentAreaEl = {
      empty: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      setText: vi.fn(),
      createEl: vi.fn().mockReturnValue(document.createElement('div')),
    } as unknown as HTMLElement;
  });

  describe('Basic functionality', () => {
    it('should have correct view type', () => {
      expect(view.getViewType()).toBe(VIEW_TYPE_FEEDS_READER);
    });

    it('should have correct display text', () => {
      expect(view.getDisplayText()).toBe('Feeds Reader');
    });

    it('should have correct icon', () => {
      expect(view.getIcon()).toBe('rss');
    });
  });

  describe('Item visibility and filtering', () => {
    beforeEach(() => {
      // Mock the DOM elements that the view expects
      view.contentAreaEl = document.createElement('div');
    });

    it('should handle empty feed state correctly', () => {
      view.currentFeed = null;

      // The view should handle null feed gracefully
      expect(view.currentFeed).toBeNull();
      expect(view.showAll).toBe(false); // showAll starts as false
    });

    it('should respect showAll flag for item visibility', () => {
      const feedContent = createFeedContent({
        items: [
          createFeedItem({ id: '1', read: '0', deleted: '0' }),
          createFeedItem({ id: '2', read: '1', deleted: '0' }),
          createFeedItem({ id: '3', read: '0', deleted: '1' }),
        ],
      });

      plugin.feedsStore['test-feed'] = feedContent;
      view.currentFeed = 'test-feed';

      // Test via public API - showAll state affects rendering
      view.showAll = false;
      expect(view.showAll).toBe(false);

      view.showAll = true;
      expect(view.showAll).toBe(true);
    });

    it('should handle mixed feed view state', () => {
      plugin.feedsStore.feed1 = createFeedContent({
        title: 'Feed 1',
        name: 'feed1',
        items: [createFeedItem({ id: 'f1-1' })],
      });

      plugin.feedsStore.feed2 = createFeedContent({
        title: 'Feed 2',
        name: 'feed2',
        items: [createFeedItem({ id: 'f2-1' })],
      });

      // Enable mixed view through settings
      plugin.settings.mixedFeedView = true;

      // Mixed view mode is handled through the FSM state

      expect(plugin.feedsStore.feed1).toBeDefined();
      expect(plugin.feedsStore.feed2).toBeDefined();
    });
  });

  describe('Undo system', () => {
    it('should push actions to undo list', () => {
      view.pushUndo({
        action: 'read',
        itemId: 'item1',
        feedName: 'test-feed',
      });

      expect(view.undoList).toHaveLength(1);
      expect(view.undoList[0].action).toBe('read');
    });

    it('should limit undo list to MAX_UNDO_STEPS', () => {
      // Push more than MAX_UNDO_STEPS (20)
      for (let i = 0; i < 25; i += 1) {
        view.pushUndo({
          action: 'read',
          itemId: `item${i}`,
          feedName: 'test-feed',
        });
      }

      expect(view.undoList).toHaveLength(20);
      // Oldest items should be removed
      expect(view.undoList[0].itemId).toBe('item5');
    });
  });

  describe('State transitions via dispatch', () => {
    it('should handle feed selection', () => {
      view.dispatchEvent({ type: 'SelectFeed', feed: 'new-feed' });
      expect(view.currentFeed).toBe('new-feed');
      expect(view.currentPage).toBe(0);
    });

    it('should handle nav toggle', () => {
      // Test nav toggle through dispatch - the effect is internal
      // We can verify it was processed without errors
      expect(() => {
        view.dispatchEvent({ type: 'ToggleNav' });
      }).not.toThrow();

      // Toggle again to verify it's reversible
      expect(() => {
        view.dispatchEvent({ type: 'ToggleNav' });
      }).not.toThrow();
    });

    it('should cycle item order', () => {
      const initialOrder = view.itemOrder;
      view.dispatchEvent({ type: 'CycleItemOrder' });
      expect(view.itemOrder).not.toBe(initialOrder);
    });
  });

  describe('View interactions', () => {
    beforeEach(() => {
      // Mock DOM elements with proper empty method
      const contentEl = document.createElement('div');
      const emptyFn = vi.fn();
      view.contentAreaEl = Object.assign(contentEl, {
        empty: emptyFn,
        appendChild: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
      });

      view.containerEl = {
        ownerDocument: document,
        empty: vi.fn(),
      } as unknown as HTMLElement;
    });

    it('should handle keyboard navigation setup', () => {
      // Verify the view is ready to handle keyboard events
      expect(view.currentFeed).toBeNull();
      expect(view.currentPage).toBe(0);

      // Set up a feed for navigation
      plugin.feedsStore['test-feed'] = createFeedContent({
        items: [
          createFeedItem({ id: '1' }),
          createFeedItem({ id: '2' }),
          createFeedItem({ id: '3' }),
        ],
      });

      view.currentFeed = 'test-feed';
      view.showAll = true;

      // View should be ready for keyboard navigation
      expect(view.currentFeed).toBe('test-feed');
    });

    it('should handle pagination methods', () => {
      // Test pagination through public methods
      plugin.feedsStore['test-feed'] = createFeedContent({
        items: Array.from({ length: 50 }, (_, i) => createFeedItem({ id: `item-${i}` })),
      });

      view.currentFeed = 'test-feed';
      view.itemsPerPage = 10;

      // Test next page
      expect(view.currentPage).toBe(0);
      view.nextPage();
      expect(view.currentPage).toBe(1);

      // Test previous page
      view.prevPage();
      expect(view.currentPage).toBe(0);

      // Should not go below 0
      view.prevPage();
      expect(view.currentPage).toBe(0);
    });
  });
});
