import { App, PluginSettingTab, Setting, Notice, TextComponent } from 'obsidian';
import { IFeedsReaderPlugin } from './pluginTypes';
import { FeedsReaderSettings } from './types';
import { SAVED_SNIPPETS_FNAME } from './constants';

// Define a type for the keys of boolean settings used in toggles
type BooleanSettingKey = keyof Pick<
  FeedsReaderSettings,
  | 'showJot'
  | 'showSnippet'
  | 'showRead'
  | 'showSave'
  | 'showMath'
  | 'showGPT'
  | 'showEmbed'
  | 'showFetch'
  | 'showLink'
  | 'showDelete'
>;

export class FeedReaderSettingTab extends PluginSettingTab {
  plugin: IFeedsReaderPlugin;

  constructor(app: App, plugin: IFeedsReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h1', { text: 'Feeds Reader Settings' });

    /* General Settings */
    containerEl.createEl('h3', { text: 'General' });
    new Setting(containerEl)
      .setName('Items per page')
      .setDesc('Number of feed items to display per page.')
      .addText(text => {
        text.inputEl.type = 'number'; // Ensure it's a number input
        text.inputEl.min = '1'; // Minimum 1 item per page
        text.setValue(this.plugin.settings.nItemPerPage.toString());
        text.onChange(async value => {
          // Add async for saveSettings
          const num = parseInt(value, 10);
          if (!Number.isNaN(num) && num > 0) {
            this.plugin.settings.nItemPerPage = num;
            await this.plugin.saveSettings();
          } else {
            // Optionally, reset to a default or previous valid value if input is invalid
            new Notice('Please enter a valid number greater than 0 for items per page.');
            text.setValue(this.plugin.settings.nItemPerPage.toString()); // Revert to old value
          }
        });
      });

    // -------------------------------------------------------------
    // Startup layout preference – Title-only vs Full card
    // -------------------------------------------------------------
    new Setting(containerEl)
      .setName('Start in title-only mode')
      .setDesc(
        'When enabled, items are collapsed to titles on startup. Disable to show full cards by default.'
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.defaultTitleOnly ?? true);
        toggle.onChange(async value => {
          this.plugin.settings.defaultTitleOnly = value;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Auto-save content (Not Implemented)') // Clarify if not implemented
      .setDesc(
        'Automatically save new feed items content to markdown files. (This feature is not yet fully implemented).'
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.saveContent);
        toggle.onChange(async value => {
          this.plugin.settings.saveContent = value;
          await this.plugin.saveSettings();
          if (value)
            new Notice('Auto-save content enabled (Note: Full functionality might be pending).');
        });
      });
    new Setting(containerEl)
      .setName('Save snippet new-to-old')
      .setDesc(
        `When saving snippets, place new items at the top of the "${SAVED_SNIPPETS_FNAME}" file if enabled (otherwise append at bottom).`
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.saveSnippetNewToOld);
        toggle.onChange(async value => {
          this.plugin.settings.saveSnippetNewToOld = value;
          await this.plugin.saveSettings();
        });
      });

    /* UI Buttons Settings */
    containerEl.createEl('h3', { text: 'Display Options' });

    // ---------------------------------------------------------------------
    // Latest-N auto-expand settings
    // ---------------------------------------------------------------------

    // We need a mutable reference because the toggle is defined *before* the
    // numeric input; initialize with null to satisfy definite-assignment.
    let latestNCountSetting: Setting | null = null;

    new Setting(containerEl)
      .setName('Only expand latest N articles')
      .setDesc(
        'When enabled, only the most recent N articles will be auto-expanded. Others remain collapsed.'
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.latestNOnly);
        toggle.onChange(async value => {
          this.plugin.settings.latestNOnly = value;
          await this.plugin.saveSettings();
          if (latestNCountSetting) {
            latestNCountSetting.settingEl.style.display = value ? '' : 'none';
          }
        });
      });

    latestNCountSetting = new Setting(containerEl)
      .setName('Number of articles to auto-expand')
      .setDesc('Specify how many recent articles to expand automatically.')
      .addText(text => {
        text.inputEl.type = 'number';
        text.setValue(this.plugin.settings.latestNCount.toString());
        text.onChange(async value => {
          const num = parseInt(value, 10);
          if (!Number.isNaN(num) && num >= 0) {
            this.plugin.settings.latestNCount = num;
            await this.plugin.saveSettings();
          }
        });
      });
    latestNCountSetting.settingEl.style.display = this.plugin.settings.latestNOnly ? '' : 'none';

    new Setting(containerEl)
      .setName('Display style')
      .setDesc('Choose between card or list view.')
      .addDropdown(drop => {
        drop
          .addOption('card', 'Card View')
          .addOption('list', 'List View')
          .setValue(this.plugin.settings.viewStyle)
          .onChange(async value => {
            // Persist the new preference and immediately refresh any open
            // Feeds Reader panes so the layout switch becomes visible
            // without requiring a manual reload or tab change.
            this.plugin.settings.viewStyle = value as FeedsReaderSettings['viewStyle'];
            await this.plugin.saveSettings();

            // While `saveSettings()` already triggers a refresh on **all**
            // reader views, it does so *asynchronously* after the settings
            // file has been written to disk.  Calling `refreshView()`
            // right away guarantees that the active pane updates its
            // content before the user even closes the settings tab,
            // providing a snappier, more predictable UX.
            this.plugin.refreshView();
          });
      });

    new Setting(containerEl)
      .setName('Unified Feed View')
      .setDesc('If enabled, displays items from all feeds in a single timeline.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.mixedFeedView);
        toggle.onChange(async value => {
          this.plugin.settings.mixedFeedView = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl('h3', { text: 'Item Action Buttons Visibility' });
    const buttonSettings: Array<{ key: BooleanSettingKey; name: string; desc: string }> = [
      { key: 'showJot', name: 'Show Jot Button', desc: "Show 'Jot' quick note button." },
      {
        key: 'showSnippet',
        name: 'Show Snippet Button',
        desc: "Show 'Snippet' button to save item to snippets note.",
      },
      {
        key: 'showRead',
        name: 'Show Mark Read/Unread Button',
        desc: "Show 'Mark as Read/Unread' button.",
      },
      {
        key: 'showSave',
        name: 'Show Save Button',
        desc: "Show 'Save' button to save item as markdown.",
      },
      {
        key: 'showMath',
        name: 'Enable Math Rendering (Experimental)',
        desc: 'Attempt to render LaTeX math in feed content if present.',
      },
      {
        key: 'showGPT',
        name: 'Show ChatGPT Button',
        desc: "Show 'Ask GPT' button (requires API Key).",
      },
      {
        key: 'showEmbed',
        name: 'Show Embed Button (Experimental)',
        desc: "Show 'Embed' button for item content.",
      },
      { key: 'showFetch', name: 'Show Fetch Button', desc: "Show 'Fetch Full Content' button." },
      { key: 'showLink', name: 'Show Open Link Button', desc: "Show 'Open Link' button." },
      {
        key: 'showDelete',
        name: 'Show Delete/Restore Button',
        desc: "Show 'Delete/Restore' button.",
      },
    ];
    buttonSettings.forEach(settingDef => {
      // Renamed 'setting' to 'settingDef' to avoid conflict
      new Setting(containerEl)
        .setName(settingDef.name)
        .setDesc(settingDef.desc)
        .addToggle(toggle => {
          const { key } = settingDef;
          toggle.setValue(this.plugin.settings[key]);
          toggle.onChange(async value => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          });
        });
    });

    /* Content Fetching & Caching Settings */
    containerEl.createEl('h3', { text: 'Content Fetching & Caching' });
    // ---------------------------------------------------------------------
    // HTML cache settings – toggle + duration input
    // ---------------------------------------------------------------------

    let cacheDurationSetting: Setting | null = null;

    new Setting(containerEl)
      .setName('Enable HTML Cache')
      .setDesc(
        'Cache fetched HTML content locally to reduce redundant requests and improve loading speed.'
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableHtmlCache ?? true); // Default to true if undefined
        toggle.onChange(async value => {
          this.plugin.settings.enableHtmlCache = value;
          await this.plugin.saveSettings();
          if (cacheDurationSetting) {
            cacheDurationSetting.settingEl.style.display = value ? '' : 'none';
          }
        });
      });

    cacheDurationSetting = new Setting(containerEl)
      .setName('HTML Cache Duration (minutes)')
      .setDesc(
        'How long to keep cached HTML content before re-fetching. Default is 1440 minutes (24 hours).'
      )
      .addText(text => {
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.setValue((this.plugin.settings.htmlCacheDurationMinutes ?? 1440).toString());
        text.onChange(async value => {
          const num = parseInt(value, 10);
          if (!Number.isNaN(num) && num > 0) {
            this.plugin.settings.htmlCacheDurationMinutes = num;
          } else {
            this.plugin.settings.htmlCacheDurationMinutes = 1440; // Fallback to default
            new Notice(
              'Cache duration reset to default (1440 minutes). Please enter a valid number.'
            );
          }
          await this.plugin.saveSettings();
          text.setValue((this.plugin.settings.htmlCacheDurationMinutes ?? 1440).toString()); // Reflect validated value
        });
      });
    // Initially hide cache duration if caching is disabled
    cacheDurationSetting.settingEl.style.display =
      (this.plugin.settings.enableHtmlCache ?? true) ? '' : 'none';

    // ---------------------------------------------------------------------
    // Asset download settings – toggle + path input
    // ---------------------------------------------------------------------

    let assetPathSetting: Setting | null = null;

    new Setting(containerEl)
      .setName('Enable Asset Downloading')
      .setDesc(
        "Download images and videos found in feed items to your vault (within plugin's data folder). URLs in content will be updated to local paths."
      )
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableAssetDownload ?? false);
        toggle.onChange(async value => {
          this.plugin.settings.enableAssetDownload = value;
          await this.plugin.saveSettings();
          if (assetPathSetting) {
            assetPathSetting.settingEl.style.display = value ? '' : 'none';
          }
        });
      });

    assetPathSetting = new Setting(containerEl)
      .setName('Asset Download Path')
      .setDesc(
        "Subdirectory within the plugin's data folder to store downloaded assets (e.g., 'feeds_assets')."
      )
      .addText(text =>
        text
          .setPlaceholder('feeds_assets')
          .setValue(this.plugin.settings.assetDownloadPath ?? 'feeds_assets')
          .onChange(async value => {
            this.plugin.settings.assetDownloadPath = value.trim() || 'feeds_assets';
            await this.plugin.saveSettings();
            text.setValue(this.plugin.settings.assetDownloadPath ?? 'feeds_assets');
          })
      );
    assetPathSetting.settingEl.style.display =
      (this.plugin.settings.enableAssetDownload ?? false) ? '' : 'none';

    /* ChatGPT Integration Settings */
    containerEl.createEl('h3', { text: 'ChatGPT Integration' });
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('') // Initialize description container
      .then(setting => {
        // Access descEl after initialization
        const { descEl } = setting;
        descEl.appendText('Provide your OpenAI API Key to enable ChatGPT features. ');
        descEl.createEl('strong', {
          text: 'Note: This key is stored locally in plain text in your Obsidian plugin settings.',
        });
        descEl.createEl('br');
        descEl.appendText('Ensure you understand the security implications.');
      })
      .addText((text: TextComponent) => {
        // Add type TextComponent
        text.inputEl.type = 'password'; // Mask the input
        text.setPlaceholder('sk-XXXXXXXXXXXXXXXXXXXXX');
        text.setValue(this.plugin.settings.chatGPTApiKey); // Use renamed property
        text.onChange(async (value: string) => {
          // Add type string
          this.plugin.settings.chatGPTApiKey = value.trim(); // Use renamed property
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('ChatGPT Prompt Template')
      .setDesc(
        "Prompt template for ChatGPT. Use {{content}} as placeholder for the item content. The content sent will be the first ~4000 characters of the item's text (after HTML removal)."
      )
      .addTextArea(text => {
        text.inputEl.rows = 5; // Make textarea larger
        text.setValue(this.plugin.settings.chatGPTPrompt);
        text.onChange(async value => {
          this.plugin.settings.chatGPTPrompt = value;
          await this.plugin.saveSettings();
        });
      });

    // Add a setting for ChatGPT model (Addresses problem 5.1)
    containerEl.createEl('h3', { text: 'Advanced ChatGPT Settings' });
    new Setting(containerEl)
      .setName('ChatGPT Model')
      .setDesc(
        'Specify the ChatGPT model to use (e.g., gpt-4.1-nano, gpt-4o-mini). Default is gpt-4.1-nano.'
      )
      .addText(text => {
        text
          .setPlaceholder('gpt-4.1-nano')
          .setValue(this.plugin.settings.chatGPTModel || 'gpt-4.1-nano') // Provide default if not set
          .onChange(async value => {
            this.plugin.settings.chatGPTModel = value.trim() || 'gpt-4.1-nano'; // Ensure it's not empty
            await this.plugin.saveSettings();
          });
      });
  }
}

// Ensure FeedsReaderSettings in types.ts includes chatGPTModel
// export interface FeedsReaderSettings {
//   // ... other settings
//   chatGPTModel?: string; // Added for model selection
// }
// And update DEFAULT_SETTINGS in main.ts
// const DEFAULT_SETTINGS: FeedsReaderSettings = {
//   // ... other defaults
//   chatGPTModel: "gpt-4o-mini"
// };
