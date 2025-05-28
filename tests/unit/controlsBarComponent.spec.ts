import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RssFeedContent } from '../../src/types';

import { renderControlsBar } from '../../src/view/components/ControlsBarComponent';

// -------------------- Mock Obsidian helpers --------------------
vi.mock('obsidian', () => ({
  setIcon: vi.fn(),
  Notice: vi.fn(),
  ItemView: class {},
  PluginSettingTab: class {},
  Modal: class {},
  Plugin: class {},
}));

// Mock modal classes so that `new Modal().open()` can be asserted without
// touching real DOM APIs.
vi.mock('../src/addFeedModal', () => ({
  FRAddFeedModal: vi.fn().mockImplementation(() => ({ open: vi.fn() })),
}));
vi.mock('../src/manageFeedsModal', () => ({
  FRManageFeedsModal: vi.fn().mockImplementation(() => ({ open: vi.fn() })),
}));
vi.mock('../src/searchModal', () => ({
  FRSearchModal: vi.fn().mockImplementation(() => ({ open: vi.fn() })),
}));
vi.mock('../src/helpModal', () => ({
  FRHelpModal: vi.fn().mockImplementation(() => ({ open: vi.fn() })),
}));

// --- Augment HTMLElement for Obsidian's methods in JSDOM ---
interface TestDomElementInfo {
  cls?: string | string[];
  attr?: Record<string, string | number | boolean | null | undefined>;
  text?: string | DocumentFragment;
  title?: string;
  type?: string;
  placeholder?: string;
}

declare global {
  interface HTMLElement {
    empty(): void;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: TestDomElementInfo | string,
      cb?: (el: HTMLElementTagNameMap[K]) => void
    ): HTMLElementTagNameMap[K];
    createEl(
      tag: string,
      o?: TestDomElementInfo | string,
      cb?: (el: HTMLElement) => void
    ): HTMLElement;
  }
}
// --- End Augmentation ---

function createView() {
  return {
    currentFeed: null,
    showAll: false,
    titleOnly: true,
    itemOrder: 'New to old',
    undoList: [] as unknown[],
    dispatchEvent: vi.fn(),
    renderFeedContent: vi.fn(),
    toggleTitleOnlyMode() {
      // 'this' will be the view object
      // @ts-ignore
      this.titleOnly = !this.titleOnly;
    },
    registerDomEvent: (el: Element, ev: string, cb: EventListener) => el.addEventListener(ev, cb),
  } as unknown as import('../../src/view').FeedsReaderView;
}

function createPlugin() {
  return {
    feedsStore: {},
    feedsStoreChange: false,
    savePendingChanges: vi.fn(),
  } as unknown as import('../../src/main').default;
}

describe('ControlsBarComponent', () => {
  let container: HTMLElement;
  let view: ReturnType<typeof createView>;
  let plugin: ReturnType<typeof createPlugin>;

  beforeEach(() => {
    // Provide Obsidian-style DOM helpers for the JSDOM environment.
    if (!HTMLElement.prototype.empty) {
      HTMLElement.prototype.empty = function (): void {
        this.innerHTML = '';
      };
    }
    if (!HTMLElement.prototype.createEl) {
      HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
        this: HTMLElement,
        tag: K | string,
        options?: TestDomElementInfo | string
      ): HTMLElementTagNameMap[K] | HTMLElement {
        const el = document.createElement(tag as K) as HTMLElementTagNameMap[K] | HTMLElement;

        if (typeof options === 'string') {
          el.className = options;
        } else if (options) {
          if (options.cls) {
            if (Array.isArray(options.cls)) el.className = options.cls.join(' ');
            else el.className = options.cls;
          }
          if (options.attr) {
            Object.entries(options.attr).forEach(([k, v]) => {
              if (v !== null && v !== undefined) {
                el.setAttribute(k, String(v));
              }
            });
          }
          if (options.text) {
            if (typeof options.text === 'string') el.textContent = options.text;
            else el.appendChild(options.text.cloneNode(true));
          }
          if (options.title) {
            el.title = options.title;
          }
        }
        this.appendChild(el);
        return el;
      };
    }

    container = document.createElement('div');
    view = createView();
    plugin = createPlugin();
  });

  it('renders basic buttons when no feed selected', () => {
    renderControlsBar(container, view, plugin);

    // Expect 4 primary buttons + help = 5
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(5);

    const labels = Array.from(buttons).map(b => b.getAttribute('aria-label'));
    expect(labels).toEqual(
      expect.arrayContaining([
        'Add new feed',
        'Manage feeds',
        'Update all feeds',
        'Save feed data',
        'Help / Shortcuts',
      ])
    );
  });

  it('renders feed-specific controls when a feed is selected', () => {
    view.currentFeed = 'blog';
    plugin.feedsStore.blog = {
      title: 'Blog Feed Title',
      link: 'https://example.com/blog',
      name: 'blog',
      folder: 'feeds/blog',
      items: [],
    } as RssFeedContent;

    renderControlsBar(container, view, plugin);

    const searchBtn = container.querySelector('button[aria-label="Search in feed"]');
    expect(searchBtn).not.toBeNull();
    const unreadBtn = container.querySelector('button[aria-label="Toggle unread / all"]');
    expect(unreadBtn).not.toBeNull();
  });

  it('dispatches ToggleShowAll when unread button clicked', () => {
    view.currentFeed = 'tech';
    plugin.feedsStore.tech = {
      title: 'Tech Feed Title',
      link: 'https://example.com/tech',
      name: 'tech',
      folder: 'feeds/tech',
      items: [],
    } as RssFeedContent;

    renderControlsBar(container, view, plugin);
    const unreadBtn = container.querySelector(
      'button[aria-label="Toggle unread / all"]'
    )! as HTMLButtonElement;

    unreadBtn.click();
    expect(view.dispatchEvent).toHaveBeenCalledWith({ type: 'ToggleShowAll' });
  });
});
