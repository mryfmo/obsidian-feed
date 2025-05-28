import FeedsReaderPlugin from '../../main';
import { RssFeedItem } from '../../types';
import { pickImageUrl } from '../../utils';
import { FeedsReaderView } from '../../view';

import { createFeedItemBase, renderItemMarkdown } from './FeedItemBase';

// ---------------------------------------------------------------------------
// Card-style renderer – shows a larger 16:9 thumbnail floated right
// ---------------------------------------------------------------------------

export function renderFeedItemCard(
  item: RssFeedItem,
  parentEl: HTMLElement,
  view: FeedsReaderView,
  plugin: FeedsReaderPlugin
): void {
  // Build the shared skeleton and flag this instance as "card" layout so that
  // CSS can align it using the dedicated .fr-item-card grid rules.
  const { itemDiv, contentEl, isExpanded } = createFeedItemBase(item, parentEl, view, plugin, [
    'fr-item-card',
  ]);

  // -----------------------------------------------------------------------
  // Thumbnail (card view uses the bigger 160×90 version floated right)
  // -----------------------------------------------------------------------
  const imageUrl = pickImageUrl(item.image);
  // Card view always shows thumbnails if an image is available.
  if (imageUrl) {
    const thumbEl = itemDiv.createEl('img', {
      attr: { src: imageUrl, alt: item.title ?? 'thumbnail' },
      cls: 'fr-thumbnail',
    });

    // Remove broken images to avoid layout shift
    thumbEl.onerror = () => {
      thumbEl.remove();
    };

    itemDiv.appendChild(thumbEl);
  }

  // -----------------------------------------------------------------------
  // Markdown body (only when visible)
  // -----------------------------------------------------------------------
  if (!view.titleOnly || isExpanded) {
    renderItemMarkdown(item, contentEl, plugin).catch(err =>
      console.error('CardView: Failed to render content', err)
    );
  }
}
