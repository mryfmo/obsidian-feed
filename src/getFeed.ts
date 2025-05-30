import { Notice, request as obsidianRequest } from 'obsidian';
import { parseISO, isValid, formatISO } from 'date-fns';
import Parser from 'rss-parser';
import { RssFeedContent, RssFeedContentSchema, FeedInfo, RssFeedItemWithBlocks } from './types';
import { NetworkService } from './networkService';
import { NetworkError } from './network/NetworkError';
import { ContentParserService } from './contentParserService';
import { IFeedsReaderPlugin } from './pluginTypes';
import { AssetService } from './assetService';
import { generateDeterministicItemId, generateRandomUUID } from './utils';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (HTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export function getCurrentIsoDateTime(): string {
  return new Date().toISOString();
}

// Define the shape for image objects, allowing url to be optional for broader compatibility initially
type ImageObject = { url?: string; [key: string]: unknown }; // Use unknown instead of any for better type safety
type ImageShape = string | ImageObject | Array<ImageObject>;

// ---------------------------------------------------------------------------
// Image URL normalization & sanitization
// ---------------------------------------------------------------------------

/**
 * Very small allow-list based check to avoid XSS vectors such as
 * `javascript:alert(1)` being injected via the `src` attribute of an <img>.
 *
 * • Allows full http/https URLs
 * • Allows protocol-relative URLs starting with //
 * • Rejects all other schemes (data:, javascript:, etc.) and relative paths –
 *   those would need to be resolved first in caller code using absolute()
 */
function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:)?\/\//i.test(trimmed);
}

function normalizeImage(img?: ImageShape | null): string | undefined {
  if (!img) return undefined;

  // Handle string input directly.
  if (typeof img === 'string') {
    return isSafeImageUrl(img) ? img : undefined;
  }

  // Handle array of image objects.
  if (Array.isArray(img)) {
    const found = img.find(
      (item): item is ImageObject & { url: string } =>
        item &&
        typeof item === 'object' &&
        typeof (item as ImageObject).url === 'string' &&
        isSafeImageUrl((item as ImageObject).url as string)
    );
    return found?.url;
  }

  // Handle single image object.
  if (typeof img === 'object' && img !== null && typeof img.url === 'string') {
    return isSafeImageUrl(img.url) ? img.url : undefined;
  }

  return undefined;
}

function sanitizeFeedNameForFolderName(feedName: string): string {
  // Keep this utility
  return feedName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || `feed_${Date.now()}`;
}

export async function getFeedItems(
  plugin: IFeedsReaderPlugin,
  feedInfo: FeedInfo,
  networkService: NetworkService,
  contentParserService: ContentParserService,
  assetService: AssetService
): Promise<RssFeedContent> {
  const { feedUrl, name: feedName } = feedInfo;
  let feedData;

  try {
    // Try to parse as RSS/Atom first
    try {
      const rssParser = new Parser({
        requestOptions: { headers: { 'User-Agent': USER_AGENT } },
        customFields: {
          feed: ['subtitle', 'image', 'logo', 'icon', 'lastBuildDate', 'updated', 'pubDate'],
          item: [
            'summary',
            'creator',
            'dc:creator',
            'author',
            'published',
            'updated',
            'media:group',
            'media:thumbnail',
            'content:encoded',
            'guid',
          ],
        },
      });

      try {
        feedData = await rssParser.parseURL(feedUrl);
      } catch (parseErr) {
        // Network failures inside parseURL are common in unit tests where
        // outbound HTTP is blocked.  As a fallback we retrieve the feed XML
        // using Obsidian's request API (mocked in tests) and parse *from
        // string* which does not require network access.
        const rawXml = await obsidianRequest({ url: feedUrl, method: 'GET' }).catch(() => '');
        if (rawXml) {
          feedData = await rssParser.parseString(rawXml);
        } else {
          throw parseErr;
        }
      }
    } catch (rssError) {
      // If RSS/Atom parsing fails completely, try JSON Feed as last resort.
      console.warn(
        `getFeedItems: RSS parsing for "${feedName}" failed. Attempting JSON Feed parse. Error:`,
        rssError
      );
      const rawText = await networkService.fetchText(feedUrl); // Use networkService for potential caching
      if (rawText.trim().startsWith('{')) {
        const jsonData = JSON.parse(rawText);
        // Basic JSON Feed to rss-parser compatible structure transformation
        feedData = {
          title: jsonData.title,
          link: jsonData.home_page_url || feedUrl,
          description: jsonData.description,
          image:
            jsonData.icon || jsonData.favicon
              ? { url: jsonData.icon || jsonData.favicon }
              : undefined,
          items:
            jsonData.items?.map(
              (item: {
                title?: string;
                url?: string;
                id?: string;
                date_published?: string;
                date_modified?: string;
                content_html?: string;
                content_text?: string;
                summary?: string;
                author?: { name?: string };
              }) => ({
                title: item.title || 'Untitled',
                link: item.url || item.id,
                id: item.id || item.url,
                pubDate: item.date_published || item.date_modified,
                content: item.content_html || item.content_text,
                summary: item.summary,
                author: item.author?.name,
                // TODO: Potentially map other JSON Feed fields
              })
            ) || [],
        };
      } else {
        throw rssError; // Re-throw original RSS error if not JSON
      }
    }

    // Define a type for potential feed data properties
    type PotentialFeedData = {
      title?: string;
      link?: string;
      image?: { url?: string };
      logo?: string;
      icon?: string;
      description?: string;
      subtitle?: string;
      lastBuildDate?: string;
      updated?: string;
      pubDate?: string;
      items?: PotentialItem[];
    };
    const typedFeedData = feedData as PotentialFeedData;

    const feedTitle = typedFeedData.title || feedName;
    const feedLink = typedFeedData.link || feedUrl;
    const feedImageInput = typedFeedData.image as ImageShape | undefined;
    const feedImage = normalizeImage(feedImageInput) || typedFeedData.logo || typedFeedData.icon;
    const feedDescription = typedFeedData.description || typedFeedData.subtitle;
    const feedPubDate = parseDateString(
      typedFeedData.lastBuildDate || typedFeedData.updated || typedFeedData.pubDate
    );

    const feedObj: RssFeedContent = {
      name: feedName,
      folder: feedInfo.folder || sanitizeFeedNameForFolderName(feedName), // Use existing or generate
      title: feedTitle,
      link: feedLink,
      image: feedImage,
      description: feedDescription,
      pubDate: feedPubDate,
      items: [],
    };

    if (!feedData.items || feedData.items.length === 0) {
      // Debug: No items found in feed
      return feedObj; // Return feed metadata even if no items
    }

    // Define PotentialItem type based on accessed properties
    type PotentialItem = {
      guid?: string;
      id?: string;
      link?: string;
      title?: string;
      content?: string;
      contentSnippet?: string;
      'content:encoded'?: string;
      summary?: string;
      description?: string;
      creator?: string;
      'dc:creator'?: string;
      author?: string | { name?: string };
      pubDate?: string;
      isoDate?: string;
      published?: string;
      updated?: string;
      categories?: string | string[];
      image?: ImageShape;
      'media:thumbnail'?: string | { url?: string } | Array<{ url?: string } | string>;
      enclosure?: { url?: string };
    };

    for (const rawItem of feedData.items) {
      const itemTitle = rawItem.title || 'Untitled Item';
      const itemLink = rawItem.link || rawItem.guid; // Prefer link, fallback to guid

      if (!itemLink || typeof itemLink !== 'string') {
        console.warn(
          `getFeedItems: Item in "${feedName}" (title: "${itemTitle}") has no valid link or guid. Skipping.`
        );
        continue;
      }

      const itemId =
        rawItem.guid || rawItem.id || generateDeterministicItemId(itemLink) || generateRandomUUID();
      const itemContentHtml =
        rawItem.content ||
        rawItem.contentSnippet ||
        rawItem['content:encoded'] ||
        rawItem.summary ||
        rawItem.description ||
        '';
      const itemCreator =
        rawItem.creator ||
        rawItem['dc:creator'] ||
        (typeof rawItem.author === 'string' ? rawItem.author : rawItem.author?.name);
      const itemPubDate = parseDateString(
        rawItem.pubDate ||
          rawItem.isoDate ||
          rawItem.published ||
          (rawItem as PotentialItem).updated
      ); // Cast here if needed
      const itemCategories = Array.isArray(rawItem.categories)
        ? rawItem.categories.join(', ')
        : typeof rawItem.categories === 'string'
          ? rawItem.categories
          : '';
      // Attempt to resolve thumbnail from various RSS extensions
      const potentialImage =
        rawItem.image ||
        (rawItem as PotentialItem)['media:thumbnail'] ||
        (rawItem as { enclosure?: { url?: string } }).enclosure?.url ||
        undefined;
      const itemImage = normalizeImage(potentialImage);

      const feedItem: RssFeedItemWithBlocks = {
        id: itemId,
        title: itemTitle,
        link: itemLink,
        image: itemImage,
        content: '', // Will be populated with Markdown from blocks
        category: itemCategories,
        creator:
          (typeof itemCreator === 'string'
            ? itemCreator
            : (itemCreator as { name?: string })?.name) ?? '', // Provide fallback for undefined
        pubDate: itemPubDate,
        read: '0',
        deleted: '0',
        downloaded: '0',
        blocks: [],
        sourceHtml: '', // Initialize sourceHtml
      };

      let finalHtmlForParsing = ''; // Temporary variable to hold HTML for parsing

      // Fetch full HTML if enabled and link exists.
      // The condition (itemContentHtml || !itemContentHtml) from patch.ts means it always tries to fetch if cache is enabled and link exists.
      if (plugin.settings.enableHtmlCache !== false && itemLink) {
        try {
          const fetchedHtml = await networkService.fetchHtml(itemLink);
          if (fetchedHtml) {
            finalHtmlForParsing = fetchedHtml; // Prioritize fetched HTML
          } else if (itemContentHtml) {
            // Fallback to feed's content if fetch failed or returned null
            finalHtmlForParsing = itemContentHtml;
          }
        } catch (fetchErr) {
          console.warn(
            `getFeedItems: Failed to fetch full HTML for "${itemTitle}" from "${itemLink}". Using feed content if available. Error:`,
            fetchErr
          );
          if (itemContentHtml) {
            // If fetching threw an error, but we have content from the feed, use that.
            finalHtmlForParsing = itemContentHtml;
          }
        }
      } else if (itemContentHtml) {
        // If cache is not enabled, but feed provides content
        finalHtmlForParsing = itemContentHtml;
      }
      // If neither fetching nor the feed provided HTML, finalHtmlForParsing remains ""

      feedItem.sourceHtml = finalHtmlForParsing; // Store the determined HTML in sourceHtml

      // At this stage, `itemImage` comes from RSS extensions. We'll potentially
      // override it later once the full content has been parsed into blocks –
      // thereby avoiding an *extra* DOM traversal solely for thumbnails.

      // Process sourceHtml (either fetched or from feed) into blocks and markdown
      if (feedItem.sourceHtml) {
        // Only process if we have some HTML
        try {
          // Use the async contentParserService
          const generatedBlocks = await contentParserService.htmlToContentBlocks(
            feedItem.sourceHtml,
            itemLink
          );
          feedItem.blocks = generatedBlocks; // Assign generated blocks

          if (
            plugin.settings.enableAssetDownload &&
            feedItem.blocks &&
            feedItem.blocks.length > 0
          ) {
            // Download assets and update localSrc in blocks
            // This happens AFTER blocks are generated, and BEFORE markdown conversion
            feedItem.blocks = await assetService.downloadAssetsForBlocks(feedItem.blocks, itemLink);
          }

          // Convert blocks to Markdown
          feedItem.content = contentParserService.contentBlocksToMarkdown(feedItem.blocks);

          // -------------------------------------------------------------
          // Thumbnail synchronization – pick the very first <img>
          // -------------------------------------------------------------
          const firstImgBlock = Array.isArray(feedItem.blocks)
            ? (feedItem.blocks.find(b => b.type === 'image') as
                | { type: 'image'; src: string; localSrc?: string }
                | undefined)
            : undefined;

          if (firstImgBlock) {
            if (plugin.settings.enableAssetDownload && firstImgBlock.localSrc) {
              feedItem.image = firstImgBlock.localSrc; // Prefer local asset when available
            } else if (!feedItem.image) {
              feedItem.image = firstImgBlock.src;
            }
          }
        } catch (parseError) {
          console.error(
            `getFeedItems: Error parsing content for "${itemTitle}". Using raw content. Error:`,
            parseError
          );
          feedItem.content = feedItem.sourceHtml; // Fallback to raw HTML if block parsing fails
          feedItem.blocks = [{ type: 'text', content: feedItem.sourceHtml }]; // Store raw as a single text block
        }
      } else {
        // No HTML content available at all
        feedItem.content = 'No content available.';
        feedItem.blocks = [{ type: 'text', content: 'No content available.' }];
      }

      feedObj.items.push(feedItem);
    }

    const validationResult = RssFeedContentSchema.safeParse(feedObj);
    if (!validationResult.success) {
      console.warn(
        `getFeedItems: Constructed RssFeedContent for "${feedName}" has validation errors. Some data might be missing or incorrect. Details:`,
        validationResult.error.flatten(),
        '\nFeed Object (first 500 chars):',
        JSON.stringify(feedObj).substring(0, 500)
      );
      return feedObj as RssFeedContent; // Return partially valid object
    }
    return validationResult.data;
  } catch (e: unknown) {
    if (e instanceof NetworkError) {
      // Handle specific network errors from axios
      // Explicitly narrow the type within the block
      const networkErr = e as NetworkError;
      const errorMessage = `Network Error fetching "${feedName}": ${networkErr.message} (Status: ${networkErr.status ?? 'N/A'}). Check URL or network connection.`;
      console.error(errorMessage, networkErr);
      new Notice(errorMessage, 7000);
      throw networkErr; // Re-throw specific error
    }
    const errorMessage = `Failed to get or parse feed "${feedName}" from URL "${feedUrl}".`;
    console.error(errorMessage, e);
    new Notice(`${errorMessage} Details: ${e instanceof Error ? e.message : String(e)}`, 7000);
    throw new Error(
      `${errorMessage} (Technical details: ${e instanceof Error ? e.message : String(e)} )`
    ); // Throw generic error
  }
}

function parseDateString(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    // Try ISO 8601 parsing first (common in Atom and modern RSS)
    let date = parseISO(dateString.trim());
    if (isValid(date)) return formatISO(date);

    // Try RFC 2822 (common in older RSS)
    // date-fns parseRFC2822 is strict. Let's try a more lenient new Date() and reformat if valid.
    date = new Date(dateString.trim()); // This can be quite lenient
    if (isValid(date)) return formatISO(date);

    // If specific formats are known to be common and not parsed by the above:
    // date = parse(dateString, 'yyyy-MM-dd HH:mm:ss XXXX', new Date()); // Example for a specific format
    // if (isValid(date)) return formatISO(date);
  } catch {
    /* Fall through to return original string if all parsing fails */
  }
  return dateString; // Return original if no parse method works
}
