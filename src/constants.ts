/** Base directory name for storing all feed data. */
export const FEEDS_STORE_BASE = "feeds_store";
/** Base filename for old feed data files (fragments) - used for migration. */
export const OLD_FEEDS_DATA_FNAME_BASE = "feeds-data";
/** Filename for feed metadata. */
export const FEEDS_META_FNAME = "meta.json.gzip";
/** Base filename prefix for feed item chunks. */
export const FEEDS_ITEMS_CHUNK_FNAME_PREFIX = "items.";
/** Filename suffix for feed item chunks. */
export const FEEDS_ITEMS_CHUNK_FNAME_SUFFIX = ".json.gzip";
/** Filename for the subscriptions list. */
export const SUBSCRIPTIONS_FNAME = "subscriptions.json";
/** Filename for saved snippets. */
export const SAVED_SNIPPETS_FNAME = "snippets.md";
/** Maximum length of JSON string per fragment file before splitting. */
export const LEN_STR_PER_FILE = 1024 * 1024;
/** Subdirectory for caching HTML responses. */
export const HTML_CACHE_DIR = "html_cache";