import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { App, type Plugin } from 'obsidian';
import { FeedReaderSettingTab } from '../../src/settings';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import type { FeedsReaderSettings } from '../../src/types';

// settings.spec.ts doesn't need to mock obsidian because 
// the mock is already provided by tests/__mocks__/obsidian.ts

// Create properly typed mock components
type MockTextComponent = {
  inputEl: { type: string; min: string };
  setValue: (value: string) => MockTextComponent;
  setPlaceholder: (placeholder: string) => MockTextComponent;
  onChange: (handler: (value: string) => void) => MockTextComponent;
};

type MockToggleComponent = {
  setValue: (value: boolean) => MockToggleComponent;
  onChange: (handler: (value: boolean) => void) => MockToggleComponent;
};

type MockDropdownComponent = {
  addOption: (value: string, display: string) => MockDropdownComponent;
  setValue: (value: string) => MockDropdownComponent;
  onChange: (handler: (value: string) => void) => MockDropdownComponent;
};

type MockSetting = {
  settingEl: HTMLElement;
  descEl: HTMLElement;
  setName: (name: string) => MockSetting;
  setDesc: (desc: string) => MockSetting;
  addText: (cb: (text: MockTextComponent) => void) => MockSetting;
  addToggle: (cb: (toggle: MockToggleComponent) => void) => MockSetting;
  addTextArea: (cb: (text: MockTextComponent) => void) => MockSetting;
  addDropdown: (cb: (dropdown: MockDropdownComponent) => void) => MockSetting;
  addButton: (cb: (button: HTMLButtonElement) => void) => MockSetting;
  then: (cb: (setting: MockSetting) => void) => MockSetting;
};

// Store callbacks for testing
const settingCallbacks: {
  text: Map<string, (value: string) => void>;
  toggle: Map<string, (value: boolean) => void>;
  dropdown: Map<string, (value: string) => void>;
} = {
  text: new Map(),
  toggle: new Map(),
  dropdown: new Map(),
};

// Create mock Setting class
const createMockSetting = (): MockSetting => {
  let currentName = '';

  const setting: MockSetting = {
    settingEl: document.createElement('div'),
    descEl: document.createElement('div'),
    setName: (name: string) => {
      currentName = name;
      return setting;
    },
    setDesc: () => setting,
    then: (cb: (setting: MockSetting) => void) => {
      cb(setting);
      return setting;
    },
    addText: cb => {
      const textComponent: MockTextComponent = {
        inputEl: { type: '', min: '' },
        setValue: () => textComponent,
        setPlaceholder: () => textComponent,
        onChange: handler => {
          settingCallbacks.text.set(currentName, handler);
          return textComponent;
        },
      };
      cb(textComponent);
      return setting;
    },
    addToggle: cb => {
      const toggleComponent: MockToggleComponent = {
        setValue: () => toggleComponent,
        onChange: handler => {
          settingCallbacks.toggle.set(currentName, handler);
          return toggleComponent;
        },
      };
      cb(toggleComponent);
      return setting;
    },
    addDropdown: cb => {
      const dropdownComponent: MockDropdownComponent = {
        addOption: () => dropdownComponent,
        setValue: () => dropdownComponent,
        onChange: handler => {
          settingCallbacks.dropdown.set(currentName, handler);
          return dropdownComponent;
        },
      };
      cb(dropdownComponent);
      return setting;
    },
    addTextArea: cb => {
      const textComponent: MockTextComponent = {
        inputEl: { type: '', min: '' },
        setValue: () => textComponent,
        setPlaceholder: () => textComponent,
        onChange: handler => {
          settingCallbacks.text.set(currentName, handler);
          return textComponent;
        },
      };
      cb(textComponent);
      return setting;
    },
    addButton: () => setting,
  };

  return setting;
};

// Mock Obsidian with enhanced Setting functionality for testing callbacks
vi.mock('obsidian', async () => {
  // Import the actual mock to extend it
  const actual = await vi.importActual<typeof import('../../__mocks__/obsidian')>('../../tests/__mocks__/obsidian.ts');
  
  return {
    ...actual,
    Setting: vi.fn().mockImplementation(() => createMockSetting()),
    // Keep other exports from the actual mock
  };
});

describe('FeedReaderSettingTab', () => {
  let settingTab: FeedReaderSettingTab;
  let mockPlugin: IFeedsReaderPlugin;
  let mockApp: App;
  let containerEl: HTMLElement;

  beforeEach(() => {
    // Clear callbacks
    settingCallbacks.text.clear();
    settingCallbacks.toggle.clear();
    settingCallbacks.dropdown.clear();

    // Create mock plugin with settings
    mockPlugin = {
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
        defaultTitleOnly: true,
        enableHtmlCache: false,
        htmlCacheDurationMinutes: 60,
        enableAssetDownload: false,
        assetDownloadPath: '',
        enableVirtualScrolling: false,
        searchDebounceMs: 300,
        scrollThrottleMs: 100,
        maxItemsPerPage: 100,
        enableSearchIndex: false,
        enableReadingProgress: false,
      } as FeedsReaderSettings,
      saveSettings: vi.fn().mockResolvedValue(undefined),
      loadSettings: vi.fn(),
      refreshView: vi.fn(),
    } as unknown as IFeedsReaderPlugin;

    mockApp = new App();

    // Create setting tab
    settingTab = new FeedReaderSettingTab(mockApp, mockPlugin);
    ({ containerEl } = settingTab);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with plugin reference', () => {
      expect(settingTab.plugin).toBe(mockPlugin);
    });
  });

  describe('display', () => {
    it('should create main heading', () => {
      settingTab.display();

      const heading = containerEl.querySelector('h1');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toBe('Feeds Reader Settings');
    });

    it('should create section headings', () => {
      settingTab.display();

      const headings = containerEl.querySelectorAll('h3');
      const headingTexts = Array.from(headings).map(h => h.textContent);

      expect(headingTexts).toContain('General');
      expect(headingTexts).toContain('Display Options');
      expect(headingTexts).toContain('Item Action Buttons Visibility');
      expect(headingTexts).toContain('Content Fetching & Caching');
      expect(headingTexts).toContain('ChatGPT Integration');
      expect(headingTexts).toContain('Advanced ChatGPT Settings');
      expect(headingTexts).toContain('Performance Settings');
    });

    it('should clear container before displaying', () => {
      // Add some content first
      containerEl.innerHTML = '<div>Old content</div>';

      settingTab.display();

      // Old content should be gone
      expect(containerEl.querySelector('div:first-child')?.textContent).not.toBe('Old content');
    });

    it('should create settings with correct configurations', async () => {
      const { Setting } = await import('obsidian');

      settingTab.display();

      // Verify Setting was called multiple times
      expect(Setting).toHaveBeenCalled();
      expect(vi.mocked(Setting).mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Settings callbacks', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should update nItemPerPage when valid number is entered', () => {
      const callback = settingCallbacks.text.get('Items per page');
      expect(callback).toBeDefined();

      if (callback) {
        callback('30');
        expect(mockPlugin.settings.nItemPerPage).toBe(30);
        expect(mockPlugin.saveSettings).toHaveBeenCalled();
      }
    });

    it('should not update nItemPerPage for invalid input', () => {
      const callback = settingCallbacks.text.get('Items per page');
      const originalValue = mockPlugin.settings.nItemPerPage;

      if (callback) {
        callback('abc');
        expect(mockPlugin.settings.nItemPerPage).toBe(originalValue);

        callback('0');
        expect(mockPlugin.settings.nItemPerPage).toBe(originalValue);

        callback('-5');
        expect(mockPlugin.settings.nItemPerPage).toBe(originalValue);
      }
    });

    it('should toggle mixed feed view', () => {
      const callback = settingCallbacks.toggle.get('Unified Feed View');
      expect(callback).toBeDefined();

      if (callback) {
        callback(true);
        expect(mockPlugin.settings.mixedFeedView).toBe(true);
        expect(mockPlugin.saveSettings).toHaveBeenCalled();
      }
    });

    it('should toggle show read button', () => {
      const callback = settingCallbacks.toggle.get('Show Mark Read/Unread Button');
      expect(callback).toBeDefined();

      if (callback) {
        callback(false);
        expect(mockPlugin.settings.showRead).toBe(false);
        expect(mockPlugin.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update view style', () => {
      const callback = settingCallbacks.dropdown.get('Display style');
      expect(callback).toBeDefined();

      if (callback) {
        callback('list');
        expect(mockPlugin.settings.viewStyle).toBe('list');
        expect(mockPlugin.saveSettings).toHaveBeenCalled();
      }
    });
  });
});
