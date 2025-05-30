import { App, Modal, Notice } from 'obsidian';
import { IFeedsReaderPlugin } from './pluginTypes';
import { showConfirmDialog } from './utils/confirm';

export class FRManageFeedsModal extends Modal {
  private plugin: IFeedsReaderPlugin;

  constructor(app: App, plugin: IFeedsReaderPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: 'Manage Subscriptions' });
    contentEl.createEl('p', {
      text: 'CAUTION: Actions like Purge and Unsubscribe take effect immediately and cannot be easily undone!',
    });

    if (this.plugin.feedList.length === 0) {
      contentEl.createEl('p', { text: 'No feeds subscribed yet.' });
      return;
    }

    const listEl = contentEl.createEl('div', { cls: 'fr-manage-list' });

    // Use a copy of the list to avoid issues if list is modified during iteration (e.g. by unsubscribe)
    const feedListCopy = [...this.plugin.feedList];

    feedListCopy.forEach((feed): void => {
      const feedDiv = listEl.createEl('div', { cls: 'fr-manage-feed' });
      feedDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
      feedDiv.style.padding = '0.5em 0';
      feedDiv.style.display = 'flex';
      feedDiv.style.alignItems = 'center';
      feedDiv.style.flexWrap = 'wrap';

      const feedInfoSpan = feedDiv.createEl('span', {
        text: `${feed.name} (Unread: ${feed.unread})`,
      });
      feedInfoSpan.style.flexGrow = '1';
      feedInfoSpan.style.marginRight = '1em';
      const feedInfoId = `feed-info-${feed.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      feedInfoSpan.id = feedInfoId;

      const buttonGroup = feedDiv.createEl('div', { cls: 'fr-manage-buttons' });
      buttonGroup.style.display = 'flex';
      buttonGroup.style.gap = '0.5em';
      buttonGroup.style.flexWrap = 'wrap';

      const markAllBtn = buttonGroup.createEl('button', {
        text: 'Mark all read',
        title: `Mark all items in ${feed.name} as read`,
      });
      markAllBtn.addEventListener('click', async (): Promise<void> => {
        // Use standard listener
        markAllBtn.disabled = true;
        markAllBtn.textContent = 'Marking...';
        try {
          await this.plugin.markAllRead(feed.name); // Use plugin method
          // Notice handled by plugin method
          const infoSpan = listEl.querySelector(`#${feedInfoId}`); // Query within listEl
          const updatedFeedMeta = this.plugin.feedList.find(f => f.name === feed.name);
          if (infoSpan && updatedFeedMeta) {
            infoSpan.textContent = `${feed.name} (Unread: ${updatedFeedMeta.unread})`;
          } else if (infoSpan) {
            // Fallback if meta not found (should not happen)
            infoSpan.textContent = `${feed.name} (Unread: 0)`;
          }
        } catch (error: unknown) {
          console.error(
            `FRManageFeedsModal (Mark All Read): Error for feed "${feed.name}". Details:`,
            error
          );
          new Notice(`Error marking all read for "${feed.name}".`);
        } finally {
          markAllBtn.disabled = false;
          markAllBtn.textContent = 'Mark all read';
        }
      });

      const purgeDelBtn = buttonGroup.createEl('button', {
        text: 'Purge deleted',
        title: `Permanently remove deleted items from ${feed.name}`,
      });
      purgeDelBtn.addEventListener('click', async (): Promise<void> => {
        const confirmed = await showConfirmDialog(
          this.app,
          `PERMANENTLY remove deleted items from "${feed.name}"?`
        );
        if (!confirmed) return;
        purgeDelBtn.disabled = true;
        purgeDelBtn.textContent = 'Purging...';
        try {
          await this.plugin.purgeDeletedItems(feed.name); // Use plugin method
          const updatedFeedMeta = this.plugin.feedList.find(f => f.name === feed.name);
          const newUnread = updatedFeedMeta?.unread ?? 0;
          const infoSpan = listEl.querySelector(`#${feedInfoId}`);
          if (infoSpan) infoSpan.textContent = `${feed.name} (Unread: ${newUnread})`;
          this.plugin.refreshView(); // Moved into try block
        } catch (error: unknown) {
          // Consolidated catch block
          // Errors from plugin method should already have a Notice (comment from original code)
          console.error(
            `FRManageFeedsModal (Purge Deleted): Error for feed "${feed.name}". Details:`,
            error
          );
          // Optionally, add a generic notice if the plugin method might not show one
          // new Notice(`Failed to purge deleted items from "${feed.name}".`);
        } finally {
          purgeDelBtn.disabled = false;
          purgeDelBtn.textContent = 'Purge deleted';
        }
      });

      const purgeAllBtn = buttonGroup.createEl('button', {
        text: 'Purge all items',
        title: `Permanently remove ALL items from ${feed.name} (keeps subscription)`,
      });
      purgeAllBtn.addEventListener('click', async (): Promise<void> => {
        const confirmed = await showConfirmDialog(
          this.app,
          `PERMANENTLY remove ALL items from "${feed.name}"? Subscription remains.`
        );
        if (!confirmed) return;
        purgeAllBtn.disabled = true;
        purgeAllBtn.textContent = 'Purging...';
        try {
          await this.plugin.purgeAllItems(feed.name); // Use plugin method
          const infoSpan = listEl.querySelector(`#${feedInfoId}`);
          if (infoSpan) infoSpan.textContent = `${feed.name} (Unread: 0)`;
        } catch (error: unknown) {
          console.error(
            `FRManageFeedsModal (Purge All): Error for feed "${feed.name}". Details:`,
            error
          );
          new Notice(`Error purging all items for "${feed.name}".`);
        } finally {
          purgeAllBtn.disabled = false;
          purgeAllBtn.textContent = 'Purge all items';
        }
      });

      const removeBtn = buttonGroup.createEl('button', {
        text: 'Unsubscribe',
        title: `Unsubscribe and remove all data for ${feed.name}`,
      });
      removeBtn.style.color = 'var(--text-error)';
      removeBtn.addEventListener('click', async (): Promise<void> => {
        const confirmed = await showConfirmDialog(
          this.app,
          `PERMANENTLY unsubscribe from "${feed.name}" and delete all its data?`
        );
        if (!confirmed) return;
        removeBtn.disabled = true;
        removeBtn.textContent = 'Unsubscribing...';
        try {
          await this.plugin.unsubscribeFeed(feed.name); // Use plugin method
          feedDiv.detach(); // Remove UI element
          // Main view refresh is handled by plugin.unsubscribeFeed if current feed changes
        } catch (error: unknown) {
          // Errors from plugin method should already have a Notice
          console.error(
            `FRManageFeedsModal (Unsubscribe): Error for feed "${feed.name}". Details:`,
            error
          );
          // new Notice(`Error unsubscribing from "${feed.name}".`); // Optional: if plugin doesn't always show one
          removeBtn.disabled = false;
          removeBtn.textContent = 'Unsubscribe'; // Ensure button is re-enabled on error
        }
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
