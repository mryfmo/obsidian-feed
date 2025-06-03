import { vi } from 'vitest';
import type { Plugin, App } from 'obsidian';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';

/**
 * Creates a mock plugin with all required properties and methods.
 * This provides type safety while allowing easy mocking of specific methods.
 */
export function createMockPlugin(overrides: Partial<IFeedsReaderPlugin> = {}): IFeedsReaderPlugin {
  // Create a base mock app
  const mockApp: App = {
    workspace: {
      activeLeaf: null,
    },
  } as App;

  // Create base plugin properties from Plugin interface
  const basePluginProps: Partial<Plugin> = {
    app: mockApp,
    manifest: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.12.0',
      description: 'Test plugin',
      author: 'Test Author',
      authorUrl: '',
      isDesktopOnly: false,
    },
    addCommand: vi.fn(),
    addRibbonIcon: vi.fn(),
    addStatusBarItem: vi.fn(),
    addSettingTab: vi.fn(),
    registerView: vi.fn(),
    registerExtensions: vi.fn(),
    registerMarkdownPostProcessor: vi.fn(),
    registerMarkdownCodeBlockProcessor: vi.fn(),
    registerEditorExtension: vi.fn(),
    registerObsidianProtocolHandler: vi.fn(),
    registerEditorSuggest: vi.fn(),
    loadData: vi.fn(),
    saveData: vi.fn(),
  };

  // Create the full mock plugin with IFeedsReaderPlugin properties
  const mockPlugin: IFeedsReaderPlugin = {
    ...basePluginProps,

    // IFeedsReaderPlugin specific properties
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
    },
    feedList: [],
    feedsStore: {},
    feedsStoreChange: false,
    feedsStoreChangeList: new Set<string>(),
    feeds_reader_dir: '.obsidian/plugins/contents-feeds-reader',
    lenStrPerFile: 1000000,

    // Services
    networkService: {} as IFeedsReaderPlugin['networkService'],
    contentParserService: {} as IFeedsReaderPlugin['contentParserService'],
    assetService: {} as IFeedsReaderPlugin['assetService'],

    // Methods
    activateView: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    savePendingChanges: vi.fn().mockResolvedValue(undefined),
    requestSave: vi.fn(),
    addNewFeed: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    purgeDeletedItems: vi.fn().mockResolvedValue(undefined),
    purgeAllItems: vi.fn().mockResolvedValue(undefined),
    unsubscribeFeed: vi.fn().mockResolvedValue(undefined),
    refreshView: vi.fn(),
    ensureFeedDataLoaded: vi.fn().mockResolvedValue(null),
    flagChangeAndSave: vi.fn(),
    markItemReadState: vi.fn().mockReturnValue(false),
    markItemDeletedState: vi.fn().mockReturnValue(false),
    getFeedItem: vi.fn().mockResolvedValue(null),
    saveItemAsMarkdown: vi.fn().mockResolvedValue(null),
    saveSnippet: vi.fn().mockResolvedValue(undefined),
    fetchFullContent: vi.fn().mockResolvedValue(false),
    updateFeedData: vi.fn(),

    // Apply any overrides
    ...overrides,
  } as IFeedsReaderPlugin;

  return mockPlugin;
}
