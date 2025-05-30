import { MarkdownRenderer, setIcon } from 'obsidian';
import { IFeedsReaderPlugin } from '../../pluginTypes';
import { RssFeedItem } from '../../types';
import { generateDeterministicItemId, generateRandomUUID } from '../../utils';
import { IFeedsReaderView } from '../types';
import { createItemActionButtons } from './ItemActionButtons';

export interface FeedItemBaseElements {
  itemDiv: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  progressEl: HTMLElement;
  isExpanded: boolean;
  isRecommended: boolean;
}

/**
 * Builds the DOM skeleton shared between card- and list-style renderers.
 * The caller may freely append additional, layout-specific elements such
 * as the thumbnail afterwards.
 */
export function createFeedItemBase(
  item: RssFeedItem,
  parentEl: HTMLElement,
  view: IFeedsReaderView,
  plugin: IFeedsReaderPlugin,
  extraRootClasses: string[] = []
): FeedItemBaseElements {
  const { settings } = plugin;

  // -------------------------------------------------------------------
  // Stable, deterministic item ID – required for keyboard navigation
  // -------------------------------------------------------------------
  if (!item.id) {
    item.id = item.link ? generateDeterministicItemId(item.link) : generateRandomUUID();
  }

  const isExpanded = view.expandedItems.has(item.id);

  // Root element (.fr-item) --------------------------------------------------
  const itemDiv = parentEl.createEl('div', {
    cls: ['fr-item', ...extraRootClasses].join(' ').trim(),
    attr: { 'data-item-id': item.id },
  });
  if (isExpanded) itemDiv.addClass('expanded');

  // Title & content container ------------------------------------------------
  // -------------------------------------------------------------------
  // Title ----------------------------------------------------------------
  // -------------------------------------------------------------------
  const titleEl = itemDiv.createEl('div', {
    cls: 'fr-item-title',
    text: item.title || 'Untitled Item',
  });

  // -------------------------------------------------------------------
  // Meta information  (source label + publication date)
  // -------------------------------------------------------------------
  //  We render meta info *right after* the title so that both list and
  //  card layouts share the same, predictable visual hierarchy:
  //  Title  ->  Meta row  ->  Content  ->  Progress  ->  Actions
  //  -----------------------------------------------------------------

  const metaRowEl = itemDiv.createEl('div', { cls: 'fr-item-info' });

  if (item.__sourceFeed) {
    metaRowEl.createEl('div', {
      cls: 'fr-item-source',
      text: `Source: ${item.__sourceFeed}`,
    });
  }

  metaRowEl.createEl('div', {
    cls: 'fr-item-meta',
    text: item.pubDate || 'No date',
  });

  // -------------------------------------------------------------------
  // Content body
  // -------------------------------------------------------------------

  const contentEl = itemDiv.createEl('div', { cls: 'fr-item-content' });

  // Unique IDs so that aria-controls / aria-labelledby wire up correctly
  const safeId = item.id.replace(/[^\w-]/g, '_');
  titleEl.id = `fr-item-title-${safeId}`;
  contentEl.id = `fr-item-content-${safeId}`;

  // Initial collapsed / expanded state
  contentEl.hidden = view.titleOnly && !isExpanded;

  // ARIA --------------------------------------------------------------------
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('tabindex', '0');
  titleEl.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  titleEl.setAttribute('aria-controls', contentEl.id);

  contentEl.setAttribute('role', 'region');
  contentEl.setAttribute('aria-labelledby', titleEl.id);
  contentEl.setAttribute('aria-hidden', contentEl.hidden ? 'true' : 'false');

  // Reading progress placeholder -------------------------------------------
  const progressEl = itemDiv.createEl('div', { cls: 'fr-item-progress', text: '0%' });
  progressEl.hidden = contentEl.hidden;
  contentEl.after(progressEl);

  // Simple keyboard accessibility
  view.registerDomEvent(titleEl, 'keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      view.toggleItemExpansion(item.id!);
    }
  });

  // -------------------------------------------------------------------
  // Recommendation score & badge
  // -------------------------------------------------------------------
  const MAX_SCORE = 30;
  let score = 0;
  if (item.pubDate) {
    const pubTime = Date.parse(item.pubDate);
    if (!Number.isNaN(pubTime)) {
      const ageHours = (Date.now() - pubTime) / 3.6e6;
      if (ageHours < 24) {
        score += 20;
      } else if (ageHours < 168) {
        score += 10;
      }
    }
  }
  if (item.read === '0') score += 10;
  if (item.deleted !== '0') score -= 50;
  score = Math.min(Math.max(score, 0), MAX_SCORE);

  const isRecommended = score >= 25;
  if (isRecommended) {
    titleEl.classList.add('fr-recommendation');
    const starSpan = titleEl.createSpan({ cls: 'fr-recommend-badge' });
    titleEl.prepend(starSpan);
    setIcon(starSpan, 'star');
    starSpan.setAttribute('aria-label', 'Recommended');
  }

  // Action buttons ----------------------------------------------------------
  const actionsEl = itemDiv.createEl('div', { cls: 'fr-item-actions' });
  createItemActionButtons(actionsEl, item, settings);

  // Link internal action metadata ------------------------------------------
  titleEl.dataset.action = 'toggle-item-content';
  titleEl.dataset.itemId = item.id;

  return { itemDiv, titleEl, contentEl, progressEl, isExpanded, isRecommended };
}

// ---------------------------------------------------------------------------
// Convenience: shared Markdown renderer
// ---------------------------------------------------------------------------
export async function renderItemMarkdown(
  item: RssFeedItem,
  contentEl: HTMLElement,
  plugin: IFeedsReaderPlugin
): Promise<void> {
  try {
    contentEl.empty();
    if (item.content && item.content.trim() !== '') {
      await MarkdownRenderer.render(
        plugin.app,
        item.content,
        contentEl,
        item.link || plugin.app.vault.getRoot().path,
        plugin
      );
    } else {
      contentEl.setText('No content available.');
    }
  } catch (e: unknown) {
    const msg = `Error rendering content for "${item.title?.substring(0, 20)}..."`;
    contentEl.setText(msg);
    console.error(msg, e);
  }
}
