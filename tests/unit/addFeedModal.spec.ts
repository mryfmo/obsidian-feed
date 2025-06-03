import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App } from 'obsidian';
import { FRAddFeedModal } from '../../src/addFeedModal';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import { FeedError, FeedErrorType, ErrorSeverity } from '../../src/errors';
import { flushPromises } from '../helpers/testUtils';

// Mock Obsidian's Notice
vi.mock('obsidian');

// Create a focused mock plugin for these specific tests
const createMockPlugin = (): IFeedsReaderPlugin => {
  const plugin = {
    feedList: [],
    feedsStore: {},
    app: {} as App,
    addNewFeed: vi.fn(),
    ensureFeedDataLoaded: vi.fn(),
    markAllRead: vi.fn(),
  } as Partial<IFeedsReaderPlugin>;

  return plugin as IFeedsReaderPlugin;
};

describe('FRAddFeedModal', () => {
  let modal: FRAddFeedModal;
  let mockPlugin: IFeedsReaderPlugin;
  let mockApp: App;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear Notice mock
    const { Notice } = await import('obsidian');
    vi.mocked(Notice).mockClear();

    // Create mocks
    mockPlugin = createMockPlugin();
    mockApp = {} as App;

    // Create modal instance
    modal = new FRAddFeedModal(mockApp, mockPlugin);
  });

  describe('Constructor', () => {
    it('should initialize modal instance', () => {
      expect(modal).toBeDefined();
      expect(modal).toBeInstanceOf(FRAddFeedModal);
    });
  });

  describe('onOpen', () => {
    beforeEach(() => {
      // Since Modal is mocked, we need to ensure contentEl exists for tests
      if (!modal.contentEl) {
        // Create a minimal DOM structure for testing
        const contentEl = document.createElement('div');
        Object.assign(contentEl, {
          empty: vi.fn(() => contentEl),
          createEl: vi.fn(
            (
              tag: string,
              options?: {
                text?: string;
                cls?: string;
                attr?: Record<string, string>;
                type?: string;
              }
            ) => {
              const el = document.createElement(tag);
              if (options?.text) el.textContent = options.text;
              if (options?.cls) el.className = options.cls;
              if (options?.attr) {
                Object.entries(options.attr).forEach(([key, value]) => {
                  el.setAttribute(key, value);
                });
              }
              if (options?.type && 'type' in el) {
                (el as HTMLInputElement).type = options.type;
              }
              // Add createDiv to created elements
              Object.assign(el, {
                createDiv: contentEl.createDiv,
                createEl: contentEl.createEl,
              });
              contentEl.appendChild(el);
              return el;
            }
          ),
          createDiv: vi.fn((options?: { cls?: string }) => {
            return contentEl.createEl('div', options);
          }),
        });
        Object.defineProperty(modal, 'contentEl', {
          value: contentEl,
          writable: true,
        });
      }
    });

    it('should create form elements', () => {
      modal.onOpen();

      const content = modal.contentEl;
      expect(content.querySelector('h3')?.textContent).toBe('Add New Feed');

      const form = content.querySelector('form');
      expect(form).toBeTruthy();

      const nameInput = content.querySelector('#feed-name-input') as HTMLInputElement;
      expect(nameInput).toBeTruthy();
      expect(nameInput.type).toBe('text');
      expect(nameInput.required).toBe(true);

      const urlInput = content.querySelector('#feed-url-input') as HTMLInputElement;
      expect(urlInput).toBeTruthy();
      expect(urlInput.type).toBe('url');
      expect(urlInput.required).toBe(true);
      expect(urlInput.placeholder).toBe('https://example.com/rss');
    });

    it('should create action buttons', () => {
      modal.onOpen();

      const addButton = modal.contentEl.querySelector('button[type="submit"]');
      expect(addButton).toBeTruthy();
      expect(addButton?.textContent).toBe('Add Feed');
      expect(addButton?.classList.contains('mod-cta')).toBe(true);

      const cancelButton = modal.contentEl.querySelector('button[type="button"]');
      expect(cancelButton).toBeTruthy();
      expect(cancelButton?.textContent).toBe('Cancel');
    });

    it('should close modal on cancel button click', () => {
      const closeSpy = vi.spyOn(modal, 'close');
      modal.onOpen();

      const cancelButton = modal.contentEl.querySelector(
        'button[type="button"]'
      ) as HTMLButtonElement;
      cancelButton.click();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Form submission', () => {
    beforeEach(() => {
      // Ensure contentEl exists
      if (!modal.contentEl) {
        const contentEl = document.createElement('div');
        Object.assign(contentEl, {
          empty: vi.fn(() => contentEl),
          createEl: vi.fn(
            (
              tag: string,
              options?: {
                text?: string;
                cls?: string;
                attr?: Record<string, string>;
                type?: string;
              }
            ) => {
              const el = document.createElement(tag);
              if (options?.text) el.textContent = options.text;
              if (options?.cls) el.className = options.cls;
              if (options?.attr) {
                Object.entries(options.attr).forEach(([key, value]) => {
                  el.setAttribute(key, value);
                });
              }
              if (options?.type && 'type' in el) {
                (el as HTMLInputElement).type = options.type;
              }
              Object.assign(el, {
                createDiv: contentEl.createDiv,
                createEl: contentEl.createEl,
              });
              contentEl.appendChild(el);
              return el;
            }
          ),
          createDiv: vi.fn((options?: { cls?: string }) => {
            return contentEl.createEl('div', options);
          }),
        });
        Object.defineProperty(modal, 'contentEl', {
          value: contentEl,
          writable: true,
        });
      }
      modal.onOpen();
    });

    function fillForm(name: string, url: string): void {
      const nameInput = modal.contentEl.querySelector('#feed-name-input') as HTMLInputElement;
      const urlInput = modal.contentEl.querySelector('#feed-url-input') as HTMLInputElement;

      nameInput.value = name;
      urlInput.value = url;
    }

    function submitForm(): void {
      const form = modal.contentEl.querySelector('form') as HTMLFormElement;
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
    }

    it('should validate empty fields', async () => {
      const { Notice } = await import('obsidian');

      fillForm('', '');
      submitForm();

      await flushPromises();

      expect(Notice).toHaveBeenCalledWith('Name and URL required.');
    });

    it('should validate duplicate feed name', async () => {
      const { Notice } = await import('obsidian');

      mockPlugin.feedList = [
        {
          name: 'Existing Feed',
          feedUrl: 'https://example.com/feed',
          unread: 0,
          updated: 0,
          folder: 'test',
        },
      ];

      fillForm('Existing Feed', 'https://newsite.com/feed');
      submitForm();

      await flushPromises();

      expect(Notice).toHaveBeenCalledWith('Feed name must be unique.');
    });

    it('should successfully add new feed', async () => {
      const closeSpy = vi.spyOn(modal, 'close');

      vi.mocked(mockPlugin.addNewFeed).mockResolvedValue(undefined);

      fillForm('New Feed', 'https://example.com/feed.xml');
      submitForm();

      await flushPromises();

      expect(mockPlugin.addNewFeed).toHaveBeenCalledWith(
        'New Feed',
        'https://example.com/feed.xml'
      );
      // Success notice is handled by plugin.addNewFeed, not in the modal
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should disable button during submission', async () => {
      // Create a controlled promise for testing async behavior
      let resolveAddFeed: (() => void) | undefined;
      vi.mocked(mockPlugin.addNewFeed).mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveAddFeed = resolve;
          })
      );

      // Spy on close method
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});

      fillForm('Test Feed', 'https://example.com/feed');

      const addButton = modal.contentEl.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(addButton.disabled).toBe(false);

      submitForm();

      // Button should be disabled immediately
      expect(addButton.disabled).toBe(true);

      // Resolve the promise to complete the operation
      resolveAddFeed!();
      await flushPromises();

      // Modal should be closed on success
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const { Notice } = await import('obsidian');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new FeedError(
        'Network request failed',
        FeedErrorType.FEED_FETCH,
        ErrorSeverity.HIGH
      );
      vi.mocked(mockPlugin.addNewFeed).mockRejectedValue(error);

      fillForm('Test Feed', 'https://example.com/feed');
      submitForm();

      await flushPromises();

      // Verify user-facing Notice shows appropriate message
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('Network request failed'),
        7000
      );

      // Verify error was logged to console with correct details
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'FRAddFeedModal: Error during this.plugin.addNewFeed:',
        '(FeedError) Network request failed',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle parsing errors', async () => {
      const { Notice } = await import('obsidian');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new FeedError('Invalid XML', FeedErrorType.FEED_PARSE, ErrorSeverity.HIGH);
      vi.mocked(mockPlugin.addNewFeed).mockRejectedValue(error);

      fillForm('Test Feed', 'https://example.com/feed');
      submitForm();

      await flushPromises();

      // Verify user-facing Notice shows appropriate message
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('Invalid XML'),
        7000
      );

      // Verify error was logged to console with correct details
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'FRAddFeedModal: Error during this.plugin.addNewFeed:',
        '(FeedError) Invalid XML',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle generic errors', async () => {
      const { Notice } = await import('obsidian');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Something went wrong');
      vi.mocked(mockPlugin.addNewFeed).mockRejectedValue(error);

      fillForm('Test Feed', 'https://example.com/feed');
      submitForm();

      await flushPromises();

      // Verify user-facing Notice shows generic message for non-FeedError
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('An unexpected error occurred'),
        7000
      );

      // Verify error was logged to console twice for generic errors
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      
      // First call: line 103 in addFeedModal.ts
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(1,
        'Error adding new feed:',
        'Something went wrong',
        error.stack
      );
      
      // Second call: line 113 in addFeedModal.ts
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(2,
        'FRAddFeedModal: Error during this.plugin.addNewFeed:',
        'Error:',
        'Something went wrong',
        'Stack:',
        expect.any(String),
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should trim input values', async () => {
      vi.mocked(mockPlugin.addNewFeed).mockResolvedValue(undefined);

      fillForm('  Test Feed  ', '  https://example.com/feed  ');
      submitForm();

      await flushPromises();

      expect(mockPlugin.addNewFeed).toHaveBeenCalledWith('Test Feed', 'https://example.com/feed');
    });

  });
});
