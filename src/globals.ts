import { RssFeedContent, RssFeedItem } from './getFeed';

// --- Settings Interface ---
// Defines the structure of the data saved by saveSettings/loadSettings
export interface FeedsReaderSettings {
	feeds_reader_dir: string; // Base directory for plugin data
	feeds_data_fname: string; // Filename for old combined data (legacy)
	subscriptions_fname: string; // Filename for subscriptions list
    nItemPerPage: number; // Items displayed per page
    saveContent: boolean; // Whether to include full content when saving notes/snippets
    saveSnippetNewToOld: boolean; // Order for appending to snippet file
    // --- Button Visibility Toggles ---
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
    // --- Appearance Settings ---
    defaultDisplayMode: 'list' | 'card'; // Initial display mode
    cardWidth: number; // Default width for cards in pixels
    // --- API Keys & Prompts ---
    chatGPTAPIKey?: string; // Optional API key for ChatGPT
    chatGPTPrompt?: string; // Default prompt for ChatGPT interaction
}

// --- Global State Namespace ---
// Holds the runtime state of the plugin
export namespace GLB {
  // --- File Paths & Names (Consider making these constants) ---
  export var feeds_reader_dir: string;
  export var feeds_data_fname: string; // Legacy data file name
  export var feeds_store_base: string; // Base name for feed data chunks
  export var subscriptions_fname: string;
  export var saved_snippets_fname: string; // Fixed name for snippets file

  // --- Current View State ---
  export var currentFeed: string | null = null; // feedUrl or STARRED_VIEW_ID or null
  export var currentFeedName: string = ''; // Display name for the current view
  // References to UI elements for quick updates
  export var elUnreadCount: HTMLElement | null = null;
  export var elTotalCount: HTMLElement | null = null;
  export var elSepUnreadTotal: HTMLElement | null = null;

  // --- Core Data Structures ---
  // List of subscribed feeds with basic info
  export var feedList: { name: string; feedUrl: string; unread: number; updated: number; folder: string }[] = [];
  // Main store holding all fetched feed content (keyed by feedUrl)
  export var feedsStore: { [id: string]: RssFeedContent } = {};
  // Flags indicating if feed data needs saving
  export var feedsStoreChange: boolean = false;
  export var feedsStoreChangeList: Set<string> = new Set(); // Tracks which feeds changed

  // --- Data Handling Settings ---
  export var nMergeLookback: number = 10000; // How many old items to check for duplicates on update
  export var lenStrPerFile: number = 1024 * 1024 * 2; // Target size for data chunks (2MB)

  // --- Display & Interaction Settings (Reflects FeedsReaderSettings) ---
  export var displayMode: 'list' | 'card' = 'card';
  export var itemOrder: string = 'New to old'; // Sort order: 'New to old', 'Old to new', 'Random'
  export var filterMode: 'all' | 'unread' | 'starred' = 'all'; // Item filter
  export var nItemPerPage: number = 20;
  export var titleOnly: boolean = false; // List view only: Show only titles initially
  export var cardWidth: number = 280; // Current card width (used by CSS variable)
  export var settings: FeedsReaderSettings; // Reference to the loaded settings object

  // --- Undo & Pagination & Display Lists ---
  // Stores previous state for undo operations
  export var undoList: { feedUrl: string, index: number, previousState: Partial<RssFeedItem> }[] = [];
  export var nPage: number = 1; // Current page number
  export var idxItemStart: number = 0; // Starting index for the current page
  // Holds indices of items to display for the *current single feed* based on filters/sort
  export var displayIndices: number[] = [];
  // Holds aggregated starred items for the *starred view*
  export var starredItemsList: { feedUrl: string; originalIndex: number; item: RssFeedItem }[] = [];

  // --- Constants ---
  export var maxTotalnumDisplayed: number = 1e5; // Threshold for showing total item count
  export var nThanksSep: number = 16; // Threshold for showing thanks/complain links
  export const STARRED_VIEW_ID = '__starred__'; // Special ID for the cross-feed starred view
}