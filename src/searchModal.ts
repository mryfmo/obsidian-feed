import { App, Modal, sanitizeHTMLToDom } from 'obsidian';
import FeedsReaderPlugin from './main';

export class FRSearchModal extends Modal {
  private currentFeedName: string | null;

  private plugin: FeedsReaderPlugin;

  constructor(app: App, currentFeedName: string | null, plugin: FeedsReaderPlugin) {
    super(app);
    this.currentFeedName = currentFeedName;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fr-search-modal');
    contentEl.createEl('h3', { text: 'Search Feed' });

    if (!this.currentFeedName || !this.plugin.feedsStore[this.currentFeedName]) {
      contentEl.createEl('p', { text: 'No feed selected or feed data not loaded.' });
      const closeButton = contentEl.createEl('button', { text: 'Close' });
      closeButton.addEventListener('click', () => this.close());
      return;
    }

    contentEl.createEl('p', { text: `Searching in: ${this.currentFeedName}` });
    const searchInput = contentEl.createEl('input', {
      type: 'search',
      placeholder: 'Enter keywords...',
    } as Partial<HTMLInputElement>);
    searchInput.style.width = '100%';
    searchInput.style.marginBottom = '0.5rem';

    const resultsDiv = contentEl.createEl('div', { cls: 'fr-search-results' });
    resultsDiv.style.maxHeight = '40vh';
    resultsDiv.style.overflowY = 'auto';
    resultsDiv.style.border = '1px solid var(--background-modifier-border)';
    resultsDiv.style.padding = '0.5em';

    const doSearch = () => {
      const query = searchInput.value.trim();
      resultsDiv.empty();
      if (!query) {
        resultsDiv.createEl('p', { text: 'Please enter keywords.' });
        return;
      }
      if (!this.currentFeedName || !this.plugin.feedsStore[this.currentFeedName]) {
        resultsDiv.createEl('p', { text: 'Error: Feed data unavailable.' });
        return;
      }
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 0);
      if (terms.length === 0) {
        resultsDiv.createEl('p', { text: 'Invalid keywords.' });
        return;
      }

      const feedData = this.plugin.feedsStore[this.currentFeedName];
      if (!feedData.items) {
        resultsDiv.createEl('p', { text: 'No items in feed.' });
        return;
      }

      const results = feedData.items.filter(item => {
        const titleText = (item.title || '').toLowerCase();
        const contentText = (sanitizeHTMLToDom(item.content || '').textContent || '').toLowerCase();
        const itemFullText = `${titleText} ${contentText}`;
        return terms.every(term => itemFullText.includes(term));
      });

      if (results.length === 0) {
        resultsDiv.createEl('p', { text: `No results found for "${query}".` });
      } else {
        resultsDiv.createEl('p', {
          text: `${results.length} result(s) found for "${query}":`,
          cls: 'fr-search-summary',
        });
        results.forEach(item => {
          const resItemContainer = resultsDiv.createEl('div', { cls: 'fr-search-result' });
          resItemContainer.createEl('b', { text: item.title || 'Untitled' });
          let contentSnippet = (sanitizeHTMLToDom(item.content || '').textContent || '').substring(
            0,
            150
          );
          if ((item.content || '').length > 150) contentSnippet += '...';
          resItemContainer.createEl('p', { text: contentSnippet });
        });
      }
    };

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const searchButton = buttonContainer.createEl('button', { text: 'Search', cls: 'mod-cta' });
    searchButton.addEventListener('click', doSearch);

    const closeButtonModal = buttonContainer.createEl('button', { text: 'Close' });
    closeButtonModal.addEventListener('click', () => this.close());

    searchInput.focus();
    searchInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
