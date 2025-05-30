import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Imports (after mocks) ----------------------------------------------

import type {
  PluginManifest,
  App,
  FileSystemAdapter,
  Vault,
  Workspace,
  WorkspaceLeaf,
} from 'obsidian';
import FeedsReaderPlugin from '../../src/main';

// --- Mock lower-level helpers that perform network / disk I/O ------------

// Use vi.hoisted to ensure mockFeedContent is initialized before vi.mock is evaluated.
const { mockFeedContent } = vi.hoisted(() => {
  return {
    mockFeedContent: {
      name: 'blog',
      title: 'Blog',
      link: 'https://example.com',
      folder: 'feeds-store/blog',
      items: [],
    },
  };
});

vi.mock('../../src/getFeed', () => ({
  getFeedItems: vi.fn().mockResolvedValue(mockFeedContent),
}));

// Pass-through mock that calls saveFeedsData in savePendingChanges.
// In the success path, resolve is enough.
vi.mock('../../src/data', async importOriginal => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    saveFeedsData: vi.fn().mockResolvedValue(new Set(['blog'])),
    saveSubscriptions: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock Obsidian's FileSystemAdapter & Notice
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  FileSystemAdapter: class {},
  Vault: class {},
  Workspace: class {},
  WorkspaceLeaf: class {},
  Modal: class {},
  ItemView: class {},
  Plugin: class {
    app: App;

    manifest: PluginManifest;

    constructor(app: App, manifest: PluginManifest) {
      this.app = app;
      this.manifest = manifest;
    }

    // Add other methods/properties if FeedsReaderPlugin calls them on `super`
    registerView = vi.fn();

    addRibbonIcon = vi.fn().mockReturnValue({ addClass: vi.fn() }); // addRibbonIcon returns an element with addClass

    addCommand = vi.fn(); // Likely to be called

    addSettingTab = vi.fn(); // Likely to be called

    register = vi.fn(); // Added register method
  },
  PluginSettingTab: class {},
  // Other properties that the plugin doesn't access are omitted
}));

// Define an interface for the mocked data module
interface MockDataModule {
  saveFeedsData: ReturnType<typeof vi.fn>;
  saveSubscriptions: ReturnType<typeof vi.fn>;
  // Add other functions from the original module if they are used and spread via ...original
}

function createMockApp(): App {
  const adapter: Partial<FileSystemAdapter> & {
    createFolder: ReturnType<typeof vi.fn>;
    getBasePath: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    rmdir: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  } = {
    exists: vi.fn().mockResolvedValue(false),
    createFolder: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
    getBasePath: vi.fn().mockReturnValue('/vault'),
  };

  return {
    vault: {
      adapter,
      configDir: '/vault/.obsidian',
      createFolder: adapter.createFolder,
    } as Partial<Vault>,
    workspace: {
      getLeavesOfType: vi.fn(() => []),
      getLeaf: vi.fn(() => ({}) as WorkspaceLeaf),
      revealLeaf: vi.fn(),
      detachLeavesOfType: vi.fn(),
      getActiveViewOfType: vi.fn(() => null),
    } as unknown as Partial<Workspace>,
  } as App;
}

const manifest: PluginManifest = {
  id: 'test-plugin',
  name: 'Feeds Reader',
  version: '0.0.0',
  minAppVersion: '0.0.0',
  author: 'Test Author',
  description: 'Test Description',
  dir: '/plugin',
};

// --- Test ----------------------------------------------------------------

describe('integration – addNewFeed flow', () => {
  let plugin: FeedsReaderPlugin;

  beforeEach(async () => {
    vi.clearAllMocks();
    plugin = new FeedsReaderPlugin(createMockApp(), manifest);
    plugin.loadData = vi.fn().mockResolvedValue({}); // skip disk read
    plugin.saveData = vi.fn();
    await plugin.onload();
  });

  it('adds a new feed and persists data', async () => {
    await plugin.addNewFeed('blog', 'https://example.com/rss');

    // feedList is updated
    expect(plugin.feedList.find(f => f.name === 'blog')).toBeDefined();
    // feedsStore is updated
    expect(plugin.feedsStore.blog).toEqual(mockFeedContent);

    // saveFeedsData was called (data mock)
    const data = (await import('../../src/data')) as unknown as MockDataModule;
    expect(data.saveFeedsData).toHaveBeenCalled();
  });

  it('throws when feed name already exists', async () => {
    // First insert a feed with the same name into feedList
    plugin.feedList.push({
      name: 'dup',
      feedUrl: 'https://x.com/rss',
      unread: 0,
      updated: 0,
      folder: 'feeds-store/dup',
    });

    await expect(plugin.addNewFeed('dup', 'https://example.com/rss')).rejects.toMatchObject({
      name: 'FeedValidationError',
    });

    // feedList size is unchanged
    expect(plugin.feedList.filter(f => f.name === 'dup').length).toBe(1);
    expect(plugin.feedsStore.dup).toBeUndefined();
  });

  it('throws when URL is invalid', async () => {
    await expect(plugin.addNewFeed('bad', 'notaurl')).rejects.toMatchObject({
      name: 'FeedValidationError',
    });
    expect(plugin.feedList.find(f => f.name === 'bad')).toBeUndefined();
  });

  it('propagates FeedFetchError from getFeedItems', async () => {
    const { getFeedItems } = await import('../../src/getFeed');
    const { FeedFetchError } = await import('../../src/errors');

    // Mock getFeedItems to throw FeedFetchError
    vi.mocked(getFeedItems).mockRejectedValueOnce(new FeedFetchError('network-fail'));

    await expect(plugin.addNewFeed('news', 'https://x.com/rss')).rejects.toBeInstanceOf(
      FeedFetchError
    );

    expect(plugin.feedList.find(f => f.name === 'news')).toBeUndefined();
    expect(plugin.feedsStore.news).toBeUndefined();
  });
});
