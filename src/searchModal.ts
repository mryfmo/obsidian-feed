import { App, Modal, sanitizeHTMLToDom } from 'obsidian';
import { IFeedsReaderPlugin } from './pluginTypes';
import { SearchService } from './services/searchService';
import { debounce } from './utils/debounce';

export class FRSearchModal extends Modal {
  private currentFeedName: string | null;

  private plugin: IFeedsReaderPlugin;

  private searchService: SearchService;

  constructor(app: App, currentFeedName: string | null, plugin: IFeedsReaderPlugin) {
    super(app);
    this.currentFeedName = currentFeedName;
    this.plugin = plugin;
    this.searchService = new SearchService();
  }

  onOpen(): void {
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

    // Build search index when modal opens
    const feedData = this.plugin.feedsStore[this.currentFeedName];
    if (feedData?.items) {
      this.searchService.buildIndex(feedData.items);
    }

    const doSearch = (): void => {
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

      const currentFeedData = this.plugin.feedsStore[this.currentFeedName];
      if (!currentFeedData.items) {
        resultsDiv.createEl('p', { text: 'No items in feed.' });
        return;
      }

      // Use the search service for efficient searching
      const results = this.searchService.searchInFeed(query, this.currentFeedName);

      if (results.length === 0) {
        resultsDiv.createEl('p', { text: `No results found for "${query}".` });
      } else {
        resultsDiv.createEl('p', {
          text: `${results.length} result(s) found for "${query}":`,
          cls: 'fr-search-summary',
        });
        results.forEach((item): void => {
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

    // Create debounced version of search
    const debouncedSearch = debounce(doSearch, this.plugin.settings.searchDebounceMs ?? 300);

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const searchButton = buttonContainer.createEl('button', { text: 'Search', cls: 'mod-cta' });
    searchButton.addEventListener('click', (): void => doSearch());

    const closeButtonModal = buttonContainer.createEl('button', { text: 'Close' });
    closeButtonModal.addEventListener('click', (): void => this.close());

    searchInput.focus();

    // Add input event for real-time search with debounce
    if (this.plugin.settings.enableSearchIndex) {
      searchInput.addEventListener('input', (): void => {
        debouncedSearch();
      });
    }

    searchInput.addEventListener('keypress', (e): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
