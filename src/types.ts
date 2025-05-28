import { z } from 'zod';

/** Metadata for a subscribed feed (stored in subscription list). */
export interface FeedInfo {
  name: string;
  feedUrl: string;
  unread: number;
  updated: number;
  folder: string;
}

/** Plugin settings structure. */
export interface FeedsReaderSettings {
  mixedFeedView: boolean;
  nItemPerPage: number;
  saveContent: boolean;
  saveSnippetNewToOld: boolean;
  showJot: boolean;
  showSnippet: boolean;
  showRead: boolean;
  showSave: boolean;
  showMath: boolean;
  showGPT: boolean;
  showEmbed: boolean;
  showFetch: boolean;
  showLink: boolean;
  showDelete: boolean;
  showThumbnails: boolean;
  chatGPTApiKey: string;
  chatGPTPrompt: string;
  chatGPTModel?: string;
  enableHtmlCache?: boolean;
  htmlCacheDurationMinutes?: number;
  enableAssetDownload?: boolean;
  assetDownloadPath?: string;
  latestNOnly: boolean;
  latestNCount: number;
  viewStyle: 'card' | 'list';

  /**
   * Persisted UI preference: whether the reader starts in *title-only*
   * (collapsed) mode (`true`) or shows full cards (`false`).  Updated every
   * time the user toggles the layout so that the next session resumes the
   * preferred view automatically.
   */
  defaultTitleOnly?: boolean;
}

/** Schema for individual feed item entries. */
export const RssFeedItemSchema = z.object({
  id: z.string().optional(), // Added for unique identification
  title: z.string(),
  content: z.string(),
  category: z.string(),
  link: z.string(),
  image: z
    .union([
      z.string(),
      z.object({ url: z.string() }).passthrough(),
      z.array(z.object({ url: z.string() }).passthrough()),
    ])
    .optional(),
  creator: z.string(),
  pubDate: z.string(),
  read: z.string(),
  deleted: z.string(),
  downloaded: z.string(),
  __sourceFeed: z.string().optional(), // Source feed name
});
export type RssFeedItem = z.infer<typeof RssFeedItemSchema>;

/** Schema for feed content (feed metadata and all items). */
export const RssFeedContentSchema = z.object({
  subtitle: z.string().optional(),
  title: z.string(),
  name: z.string(),
  link: z.string(),
  image: z
    .union([
      z.string(),
      z.object({ url: z.string() }).passthrough(),
      z.array(z.object({ url: z.string() }).passthrough()),
    ])
    .optional(),
  folder: z.string(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
  items: z.array(RssFeedItemSchema),
});
export type RssFeedContent = z.infer<typeof RssFeedContentSchema>;

/** Schema for the feed list (array of FeedInfo objects). */
export const FeedInfoSchema = z.object({
  name: z.string(),
  feedUrl: z.string().url(),
  unread: z.number(),
  updated: z.number(),
  folder: z.string(),
});
export const FeedListSchema = z.array(FeedInfoSchema);

/** Schema for feed metadata (without items). */
export const RssFeedMetaSchema = RssFeedContentSchema.omit({ items: true });
export type RssFeedMeta = z.infer<typeof RssFeedMetaSchema>;

/* Example of how RssFeedContent can be constructed from Meta and Items if needed, though direct use of RssFeedContentSchema is often simpler
export const RssFeedContentFromPartsSchema = RssFeedMetaSchema.extend({
  items: z.array(RssFeedItemSchema)
});
*/

export type ContentBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'text'; content: string } // Markdown or plain text content
  | { type: 'link'; href: string; text: string } // Explicit link block if not part of text
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number; localSrc?: string }
  | { type: 'video'; src: string; poster?: string; localSrc?: string }
  | { type: 'list'; ordered: boolean; items: string[] } // Items are simple strings for now
  | { type: 'embed'; html: string }; // For iframes or complex embeds

/** Extended RssFeedItem to potentially hold structured content */
export interface RssFeedItemWithBlocks extends RssFeedItem {
  blocks?: ContentBlock[];
  sourceHtml?: string; // To store the fetched HTML for caching or re-processing
}
