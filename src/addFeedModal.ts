import { App, Modal, Notice } from 'obsidian';
import FeedsReaderPlugin, { PluginOperationError, FeedValidationError } from './main';

export class FRAddFeedModal extends Modal {
  private plugin: FeedsReaderPlugin;

  constructor(app: App, plugin: FeedsReaderPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: 'Add New Feed' });

    const form = contentEl.createEl('form');

    const nameDiv = form.createDiv({ cls: 'setting-item' });
    nameDiv.createEl('label', { text: 'Feed Name:', attr: { for: 'feed-name-input' } });
    const nameInput = nameDiv.createEl('input', {
      type: 'text',
      attr: { id: 'feed-name-input', required: true },
    });
    nameInput.style.marginLeft = '0.5em';

    const urlDiv = form.createDiv({ cls: 'setting-item' });
    urlDiv.createEl('label', { text: 'Feed URL:', attr: { for: 'feed-url-input' } });
    const urlInput = urlDiv.createEl('input', {
      type: 'url',
      attr: { id: 'feed-url-input', required: true, placeholder: 'https://example.com/rss' },
    });
    urlInput.style.marginLeft = '0.5em';
    urlInput.style.width = 'min(100%, 300px)';

    const buttonContainer = form.createDiv({ cls: 'modal-button-container' });
    const addButton = buttonContainer.createEl('button', {
      text: 'Add Feed',
      type: 'submit',
      cls: 'mod-cta',
    });
    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel', type: 'button' });

    cancelButton.addEventListener('click', () => this.close());

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const url = urlInput.value.trim();
      // Validation is now primarily handled by plugin.addNewFeed, which throws errors with Notices

      if (!name || !url) {
        new Notice('Name and URL required.');
        return;
      }
      if (this.plugin.feedList.find(f => f.name === name)) {
        new Notice('Feed name must be unique.');
        return;
      }
      try {
        new URL(url);
      } catch {
        new Notice('Invalid URL format.');
        return;
      }

      addButton.disabled = true;
      addButton.textContent = 'Adding...';
      try {
        await this.plugin.addNewFeed(name, url); // Use plugin method
        // Success notice is now consistently handled by plugin.addNewFeed
        this.close();
      } catch (err: unknown) {
        addButton.disabled = false;
        addButton.textContent = 'Add Feed';

        let userMessageForNotice: string =
          'An unexpected error occurred while adding the feed. Please try again or check the console for details.';
        const consoleLogItems: string[] = ['FRAddFeedModal: Error during this.plugin.addNewFeed:'];

        if (err instanceof PluginOperationError) {
          // Our custom error base class
          userMessageForNotice = err.userFacingMessage; // Get user-friendly message from error
          consoleLogItems.push(`(${err.name}) ${err.message}`); // Log internal message

          if (!err.isOperational) {
            consoleLogItems.push('This was marked as a non-operational (unexpected) error.');
          }

          // Handle specific custom errors for UI adjustments (e.g., focus)
          if (err instanceof FeedValidationError) {
            if (err.message.toLowerCase().includes('name')) {
              nameInput.focus();
            } else if (err.message.toLowerCase().includes('url')) {
              urlInput.focus();
            }
          }
          // Add more 'else if' blocks here for other custom error types if needed
          // e.g., else if (err instanceof FeedFetchError) { /* specific UI hints */ }
        } else if (err instanceof Error) {
          // Standard JavaScript Error
          console.error('Error adding new feed:', err.message, err.stack);
          consoleLogItems.push('Error:', err.message, 'Stack:', err.stack || 'N/A');
        } else {
          // Non-Error object thrown
          console.error('An unexpected non-Error value was thrown:', err);
          consoleLogItems.push('A non-Error value was thrown:', String(err)); // Convert err to string
          userMessageForNotice =
            'A very unusual error occurred. Please report this if it persists.';
        }

        console.error(...consoleLogItems, err); // Log details and the full error object
        new Notice(userMessageForNotice, 7000); // Display user-friendly notice
      }
    });
    // Set focus on the first input field
    window.setTimeout(() => nameInput.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}
