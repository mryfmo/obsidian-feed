import { App, Modal } from 'obsidian';

/**
 * Simple modal displaying keyboard shortcuts and basic usage tips.  Designed
 * to be tiny and dependency-free so that it can be invoked from anywhere
 * without pulling in extra code.
 */
export class FRHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Feeds Reader – Keyboard Shortcuts' });

    const list = contentEl.createEl('ul');

    const addItem = (kbd: string, desc: string) => {
      const li = list.createEl('li');
      li.createEl('kbd', { text: kbd });
      li.appendText(`  ${desc}`);
    };

    addItem('j / ↓', 'Next item');
    addItem('k / ↑', 'Previous item');
    addItem('Enter / o', 'Expand / collapse item content');
    addItem('r', 'Mark read / unread');
    addItem('d', 'Delete / restore');
    addItem('Tab', 'Toggle focus between sidebar and content list');
    addItem('PageDown / Space', 'Next page');
    addItem('PageUp', 'Previous page');

    contentEl.createEl('hr');
    contentEl.createEl('p', {
      text: 'Tip: All shortcuts work only when the Feeds Reader pane is focused and no input field is active.',
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
