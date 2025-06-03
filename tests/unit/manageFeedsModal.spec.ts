import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from 'obsidian';
import { FRManageFeedsModal } from '../../src/manageFeedsModal';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import type { FeedInfo } from '../../src/types';
import { createMockPlugin } from '../helpers/mockPlugin';

// Mock showConfirmDialog
vi.mock('../../src/utils/confirm', () => ({
  showConfirmDialog: vi.fn(),
}));

    contentEl: HTMLElement;

    constructor(app: unknown) {
      this.app = app;
      this.contentEl = document.createElement('div');
    }

    open() {}

    close() {}
  },
  Notice: vi.fn(),
}));

describe('FRManageFeedsModal', () => {
  let modal: FRManageFeedsModal;
  let mockPlugin: IFeedsReaderPlugin;
  let mockApp: App;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a complete mock plugin using the helper
    mockPlugin = createMockPlugin({
      feedList: [],
      feedsStore: {},
      feedsStoreChangeList: new Set<string>(),
    });

    // Create a mock app instance
    mockApp = new App();

    // Create modal
    modal = new FRManageFeedsModal(mockApp, mockPlugin);
  });

  describe('Constructor', () => {
    it('should initialize with plugin reference', () => {
      expect(modal).toBeDefined();
      expect(modal).toBeInstanceOf(FRManageFeedsModal);
    });
  });

  describe('onOpen', () => {
    it('should display empty state when no feeds', () => {
      modal.onOpen();

      const content = modal.contentEl;
      expect(content.querySelector('h3')?.textContent).toBe('Manage Subscriptions');
      expect(content.querySelector('p:last-child')?.textContent).toBe('No feeds subscribed yet.');
    });

    it('should display warning message', () => {
      mockPlugin.feedList = [
        {
          name: 'Test Feed',
          feedUrl: 'https://example.com/feed',
          unread: 5,
          updated: 0,
          folder: 'test',
        },
      ];

      modal.onOpen();

      const warning = modal.contentEl.querySelector('p');
      expect(warning?.textContent).toContain('CAUTION');
      expect(warning?.textContent).toContain('cannot be easily undone');
    });

    it('should display feed list with correct information', () => {
      const feeds: FeedInfo[] = [
        { name: 'Feed 1', feedUrl: 'https://feed1.com', unread: 3, updated: 0, folder: 'test' },
        { name: 'Feed 2', feedUrl: 'https://feed2.com', unread: 7, updated: 0, folder: 'test' },
      ];
      mockPlugin.feedList = feeds;

      modal.onOpen();

      const feedElements = modal.contentEl.querySelectorAll('.fr-manage-feed');
      expect(feedElements).toHaveLength(2);

      const feedInfo1 = feedElements[0].querySelector('span');
      expect(feedInfo1?.textContent).toBe('Feed 1 (Unread: 3)');

      const feedInfo2 = feedElements[1].querySelector('span');
      expect(feedInfo2?.textContent).toBe('Feed 2 (Unread: 7)');
    });

    it('should create action buttons for each feed', () => {
      mockPlugin.feedList = [
        {
          name: 'Test Feed',
          feedUrl: 'https://example.com/feed',
          unread: 5,
          updated: 0,
          folder: 'test',
        },
      ];

      modal.onOpen();

      const buttonGroup = modal.contentEl.querySelector('.fr-manage-buttons');
      expect(buttonGroup).toBeTruthy();

      const buttons = buttonGroup?.querySelectorAll('button');
      expect(buttons).toHaveLength(3);

      const buttonTexts = Array.from(buttons || []).map(b => b.textContent);
      expect(buttonTexts).toContain('Purge');
      expect(buttonTexts).toContain('Mark all as read');
      expect(buttonTexts).toContain('Unsubscribe');
    });
  });

  describe('Button actions', () => {
    beforeEach(() => {
      mockPlugin.feedList = [
        {
          name: 'Test Feed',
          feedUrl: 'https://example.com/feed',
          unread: 5,
          updated: 0,
          folder: 'test',
        },
      ];
    });

    it('should handle purge action with confirmation', async () => {
      const { showConfirmDialog } = await import('../../src/utils/confirm');
      vi.mocked(showConfirmDialog).mockResolvedValue(true);

      modal.onOpen();

      // Find the "Purge all items" button (not "Purge deleted")
      const buttons = modal.contentEl.querySelectorAll('button');
      const purgeAllButton = Array.from(buttons).find(
        b => b.textContent === 'Purge all items'
      ) as HTMLButtonElement;
      expect(purgeAllButton).toBeTruthy();

      // Click purge all button
      purgeAllButton.click();

      // Wait for async operations
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });

      expect(showConfirmDialog).toHaveBeenCalledWith(
        mockApp,
        'PERMANENTLY remove ALL items from "Test Feed"? Subscription remains.'
      );
      expect(mockPlugin.purgeAllItems).toHaveBeenCalledWith('Test Feed');
    });

    it('should handle mark all as read action', async () => {
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll('button');
      const markReadButton = Array.from(buttons).find(
        b => b.textContent === 'Mark all read'
      ) as HTMLButtonElement;
      expect(markReadButton).toBeTruthy();

      // Click mark all as read button
      markReadButton.click();

      // Wait for async operations
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });

      expect(mockPlugin.markAllRead).toHaveBeenCalledWith('Test Feed');
    });

    it('should handle unsubscribe action with confirmation', async () => {
      const { showConfirmDialog } = await import('../../src/utils/confirm');
      vi.mocked(showConfirmDialog).mockResolvedValue(true);

      modal.onOpen();

      const unsubscribeButton = modal.contentEl.querySelector(
        'button[aria-label*="Unsubscribe"]'
      ) as HTMLButtonElement;
      expect(unsubscribeButton).toBeTruthy();

      // Click unsubscribe button
      unsubscribeButton.click();

      // Wait for async operations
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });

      expect(showConfirmDialog).toHaveBeenCalledWith(
        mockApp,
        'PERMANENTLY unsubscribe from "Test Feed" and delete all its data?'
      );
      expect(mockPlugin.unsubscribeFeed).toHaveBeenCalledWith('Test Feed');
    });

    it('should not perform action when confirmation is cancelled', async () => {
      const { showConfirmDialog } = await import('../../src/utils/confirm');
      vi.mocked(showConfirmDialog).mockResolvedValue(false);

      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll('button');
      const purgeAllButton = Array.from(buttons).find(
        b => b.textContent === 'Purge all items'
      ) as HTMLButtonElement;
      purgeAllButton.click();

      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });

      expect(mockPlugin.purgeAllItems).not.toHaveBeenCalled();
    });

    it('should update display after unsubscribe', async () => {
      const { showConfirmDialog } = await import('../../src/utils/confirm');
      vi.mocked(showConfirmDialog).mockResolvedValue(true);

      // Mock unsubscribeFeed to actually remove the feed
      vi.mocked(mockPlugin.unsubscribeFeed).mockImplementation(async (feedName: string) => {
        mockPlugin.feedList = mockPlugin.feedList.filter(f => f.name !== feedName);
      });

      modal.onOpen();

      const unsubscribeButton = modal.contentEl.querySelector(
        'button[aria-label*="Unsubscribe"]'
      ) as HTMLButtonElement;
      unsubscribeButton.click();

      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });

      // Content should be updated to show empty state
      const emptyMessage = modal.contentEl.querySelector('p:last-child');
      expect(emptyMessage?.textContent).toBe('No feeds subscribed yet.');
    });
  });
});
