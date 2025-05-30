import { load, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { ContentBlock, FeedsReaderSettings } from './types';
import { AssetService } from './assetService'; // For potential future direct use if needed
import { absolute } from './utils';

/**
 * This service will be responsible for parsing HTML content into structured blocks
 * (ContentBlock[]) and converting those blocks into Markdown for display.
 */
export class ContentParserService {
  constructor(
    private assetService: AssetService, // Passed for potential future direct use
    private settings: FeedsReaderSettings
  ) {}

  private pickRoot($: CheerioAPI): Element {
    const selectors = [
      '.entry-content,.post-content,.article-content,.post-body', // More specific first
      '.post-article,.post-full-content,.gh-content',
      '.blog-post-content',
      '.Article-body,.rich-text',
      'article,[role=article],main,#main-content,.content', // Broader tags
    ];
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0 && element.text().trim().length > 100) {
        // Basic check for content length
        return element.get(0) as Element;
      }
    }
    // Fallback to longest block logic if no selector matches well
    return this.longestBlock($, $('body').get(0) as Element);
  }

  // Replicated from analyze.ts
  private longestBlock($: CheerioAPI, body: Element): Element {
    let best = body;
    let bestScore = 0;
    $('body *').each((_, el) => {
      const tag = (el as Element).tagName.toLowerCase();
      if (/^(header|nav|footer|aside|script|style)$/.test(tag)) return;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 200) return;
      const score = text.length + $(el).find('p').length * 50;
      if (score > bestScore) {
        bestScore = score;
        best = el as Element;
      }
    });
    return best;
  }

  // Rewritten htmlToContentBlocks based on analyze.ts collectBlocks, now async
  async htmlToContentBlocks(html: string, baseHref: string): Promise<ContentBlock[]> {
    if (!html) return []; // Handle empty input
    const $: CheerioAPI = load(html);
    const root = this.pickRoot($);
    const blocks: ContentBlock[] = [];

    const walk = async (el: Element): Promise<void> => {
      if (!el || el.type !== 'tag') return; // Ensure it's a tag element

      const tag = el.tagName.toLowerCase();
      const $el = $(el);

      // Skip common non-content elements explicitly
      if (
        /^(header|nav|footer|aside|script|style|noscript|button|form|input|select|textarea)$/.test(
          tag
        )
      ) {
        return;
      }

      // Prioritize structural elements over simple recursion
      if (/^h[1-6]$/.test(tag)) {
        blocks.push({ type: 'heading', level: +tag[1], text: $el.text().trim() });
        return;
      }
      if (tag === 'p') {
        let markdownContent = '';
        $el.contents().each((_, node) => {
          if (node.type === 'text') {
            markdownContent += $(node).text();
          } else if (node.type === 'tag') {
            const tagName = node.tagName.toLowerCase();
            const $node = $(node);
            const nodeText = $node.text().trim();

            switch (tagName) {
              case 'a': // Ensure baseHref is used for resolving relative URLs
                markdownContent += `[${nodeText}](${absolute(baseHref, $node.attr('href') ?? '')})`;
                break;
              case 'em':
              case 'i':
                markdownContent += `*${nodeText}*`;
                break;
              case 'strong':
              case 'b':
                markdownContent += `**${nodeText}**`;
                break;
              case 'code':
                markdownContent += `\`${nodeText}\``;
                break;
              case 'br':
                markdownContent += '  \n'; // Markdown line break
                break;
              default:
                markdownContent += nodeText; // Append text content of other inline tags
                break;
            }
          }
        });
        const cleanedContent = markdownContent.replace(/\s+/g, ' ').trim();
        if (cleanedContent) blocks.push({ type: 'text', content: cleanedContent });
        return;
      }
      if (tag === 'img') {
        const src =
          $el.attr('src') ??
          $el.attr('data-src') ??
          $el.attr('data-original') ??
          $el.attr('srcset')?.split(',')[0].split(' ')[0] ??
          '';
        if (src) {
          // Ensure src is not empty
          const absoluteSrc = absolute(baseHref, src); // Resolve URL before pushing
          blocks.push({
            type: 'image',
            src: absoluteSrc,
            alt: $el.attr('alt') ?? '',
            width: Number($el.attr('width')) || undefined,
            height: Number($el.attr('height')) || undefined,
          });
        }
        return;
      }
      if (
        tag === 'video' ||
        (tag === 'iframe' && /youtube|vimeo|twitter/.test($el.attr('src') ?? ''))
      ) {
        // Prioritize source tag for video if present
        const src =
          tag === 'video'
            ? ($el.find('source').first().attr('src') ?? $el.attr('src'))
            : $el.attr('src');
        if (src) {
          // Ensure src is not empty
          const absoluteSrc = absolute(baseHref, src); // Resolve URL
          if (tag === 'video') {
            blocks.push({
              type: 'video',
              src: absoluteSrc,
              poster: $el.attr('poster') ?? undefined,
            });
          } else {
            // iframe for youtube/vimeo/twitter
            // For embeds, ensure the src in the HTML is absolute if it was relative
            $el.attr('src', absolute(baseHref, $el.attr('src') ?? ''));
            blocks.push({ type: 'embed', html: $.html($el) });
          }
        }
        return;
      }
      if (tag === 'iframe') {
        // Other iframes (e.g., generic embeds)
        $el.attr('src', absolute(baseHref, $el.attr('src') ?? ''));
        blocks.push({ type: 'embed', html: $.html($el) });
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = $el
          .children('li')
          .map((_, li) => $(li).text().trim())
          .get()
          .filter(Boolean); // Filter out empty items
        if (items.length > 0) blocks.push({ type: 'list', ordered: tag === 'ol', items });
        return; // Don't process children of list items individually if we captured the list
      }
      // Default: Recursively process children
      // Use Promise.all for concurrent processing of children if needed, but sequential might be safer for block order
      const children = el.children ?? [];
      for (const child of children) {
        if (child.type === 'tag') await walk(child as Element);
        else if (child.type === 'text' && $(child).text().trim()) {
          // Handle potential top-level text nodes if not within a <p> or similar
          // blocks.push({ type: "text", content: $(child).text().trim() }); // Option: Uncomment to capture stray text
        }
      }
    };

    // Start walking from the root element's children
    const children = root.children ?? [];
    // Need to handle async nature correctly if walk becomes async (e.g., for direct asset downloading here)
    // Use Promise.all to allow potential future async operations within walk
    await Promise.all(children.map(child => walk(child as Element)));

    return blocks;
  }

  // Rewritten contentBlocksToMarkdown based on analyze.ts blocksToMD
  contentBlocksToMarkdown(blocks: ContentBlock[] | undefined): string {
    if (!blocks || blocks.length === 0) return '';
    return blocks
      .map(block => {
        switch (block.type) {
          case 'text':
            return block.content;
          case 'heading':
            return `${'#'.repeat(block.level)} ${block.text}`;
          case 'image':
            // Use localSrc if available (downloaded asset), otherwise original src
            return `![${block.alt || ''}](${block.localSrc || block.src})`;
          case 'video': {
            // Represent video as a simple link or embed-like syntax
            // Obsidian might not render <video> tags well in Markdown preview directly
            const videoSrc = block.localSrc || block.src;
            return `<video src="${videoSrc}" controls ${block.poster ? `poster="${block.poster}"` : ''}></video>`;
          }
          case 'list':
            return block.items.map(item => `${block.ordered ? '1.' : '-'} ${item}`).join('\n');
          case 'embed':
            return block.html; // Render embed HTML directly
        }
        // Add more block types as needed
        return '';
      })
      .join('\n\n');
  }
}
