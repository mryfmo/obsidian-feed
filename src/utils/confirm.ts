import { Modal, App } from 'obsidian';

/**
 * Show a confirmation dialog and return the user's choice
 */
export async function showConfirmDialog(
  app: App,
  message: string,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
): Promise<boolean> {
  return new Promise(resolve => {
    const modal = new ConfirmModal(app, message, confirmText, cancelText, resolve);
    modal.open();
  });
}

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private confirmText: string,
    private cancelText: string,
    private resolve: (value: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.setText(this.message);

    // Create button container
    const buttonContainer = contentEl.createDiv('modal-button-container');

    // Cancel button
    buttonContainer.createEl('button', { text: this.cancelText }).addEventListener('click', () => {
      this.close();
      this.resolve(false);
    });

    // Confirm button
    buttonContainer
      .createEl('button', { text: this.confirmText, cls: 'mod-cta' })
      .addEventListener('click', () => {
        this.close();
        this.resolve(true);
      });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
