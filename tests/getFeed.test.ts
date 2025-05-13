import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { getFeedItems } from '../src/getFeed';
import type { FeedInfo, ContentBlock } from '../src/types'; // RssFeedContent removed
import type FeedsReaderPlugin from '../src/main'; // Changed to default import
import type { NetworkService } from '../src/networkService';
import type { ContentParserService } from '../src/contentParserService';
import type { AssetService } from '../src/assetService';
import type { RequestUrlParam } from 'obsidian'; // Added import for RequestUrlParam

// Mock Obsidian API
vi.mock('obsidian', async (importOriginal) => {
    const original = await importOriginal() as typeof import('obsidian');
    return {
        ...original,
        request: vi.fn(), // Initialize request as a Vitest mock function here
        Notice: vi.fn(),
        // Basic sanitizeHTMLToDom mock if needed by chance (usually not in getFeed)
        sanitizeHTMLToDom: vi.fn((html) => {
            const frag = document.createDocumentFragment();
            const div = document.createElement('div');
            div.innerHTML = html || "";
            while(div.firstChild) frag.appendChild(div.firstChild);
            return frag;
        })
    };
});
// request will be a mock function when imported
const { request } = await import('obsidian');

// Define interfaces for mocks (simplified, using Mock without explicit generics for now)
interface MockFeedsReaderPlugin {
  settings: { enableHtmlCache: boolean, enableAssetDownload: boolean };
  manifest: { id: string };
}

interface MockNetworkService {
  fetchHtml: Mock; // Simplified Mock type
  fetchText: Mock;
  fetchBinary: Mock;
}

interface MockContentParserService {
  htmlToContentBlocks: Mock;
  contentBlocksToMarkdown: Mock;
}

interface MockAssetService {
  downloadAssetsForBlocks: Mock;
}

const mockPlugin: MockFeedsReaderPlugin = {
  settings: { enableHtmlCache: false, enableAssetDownload: false },
  manifest: { id: 'test-plugin' },
};

const mockNetworkService: MockNetworkService = {
  fetchHtml: vi.fn(),
  fetchText: vi.fn(),
  fetchBinary: vi.fn(),
};

const mockContentParserService: MockContentParserService = {
  htmlToContentBlocks: vi.fn(),
  contentBlocksToMarkdown: vi.fn(),
};

const mockAssetService: MockAssetService = {
  downloadAssetsForBlocks: vi.fn(async (blocks: ContentBlock[]) => blocks), // Use ContentBlock[]
};

// --- Sample Feed Data ---
const RSS_SAMPLE = `<?xml version="1.0"?><rss version="2.0"><channel><title>RSS Sample</title><link>http://example.com/rss</link><description>Minimal RSS</description><item><title>RSS Item 1</title><link>http://example.com/rss/1</link><description>Desc 1</description><pubDate>Wed, 02 Oct 2002 08:00:00 EST</pubDate></item></channel></rss>`;
const ATOM_SAMPLE = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Sample</title><link href="http://example.com/atom" rel="alternate"/><link href="http://example.com/atom/feed.xml" rel="self"/><id>urn:uuid:some-id</id><updated>2003-12-13T18:30:02Z</updated><logo>http://example.com/logo.png</logo><author><name>Author Name</name></author><entry><title>Atom Entry 1</title><link href="http://example.com/atom/1" rel="alternate"/><id>urn:uuid:entry-1-id</id><updated>2003-12-13T18:30:02Z</updated><published>2003-12-13T18:00:00Z</published><summary>Summary 1</summary></entry></feed>`;
const RSS_WITH_DC_CREATOR = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>DC Creator</title><item><title>Item with DC Creator</title><link>http://example.com/dc/1</link><dc:creator>DC Author</dc:creator></item></channel></rss>`;
const RSS_WITH_GUID_PERMALINK = `<?xml version="1.0"?><rss version="2.0"><channel><title>GUID Permalink</title><item><title>Item with GUID Permalink</title><guid isPermaLink="true">http://example.com/guid/1</guid></item></channel></rss>`;
const ATOM_WITH_CATEGORIES = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Categories</title><id>urn:id</id><updated>2024-01-01T00:00:00Z</updated><entry><title>Categorized</title><id>urn:entry</id><updated>2024-01-01T00:00:00Z</updated><category term="Tech"/><category term="Software Development" label="Dev Label"/></entry></feed>`;
const ATOM_WITH_HTML_CONTENT = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>HTML Content</title><id>urn:id</id><updated>2024-01-01T00:00:00Z</updated><entry><title>HTML</title><id>urn:entry</id><updated>2024-01-01T00:00:00Z</updated><content type="html"><p>This is <strong>HTML</strong> content.</p></content></entry></feed>`;
const INVALID_XML_SAMPLE = `<?xml version="1.0"?><rss><channel><title>Broken XML</title><item><title>Item</title><description>Missing closing tag</description></item></channel></rss>`; // Fixed unterminated item
const INVALID_XML_PARSERERROR = `<?xml version="1.0"?><rss><channel><title>Broken XML</title><item><title>Item</title><description>Text</description></item`; // Unterminated channel/rss, might trigger parsererror
const EMPTY_FEED_SAMPLE = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
const RSS_EMPTY_ITEM_FIELDS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty Fields</title><item><title></title><link></link><description></description><pubDate></pubDate><guid isPermaLink="false">gid</guid></item></channel></rss>`;
const ATOM_COMPLEX_AUTHOR = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Complex Author</title><id>urn:id</id><updated>2024-01-01T00:00:00Z</updated><entry><title>Entry</title><id>urn:entry</id><updated>2024-01-01T00:00:00Z</updated><author><name>John Doe</name><uri>http://example.com/johndoe</uri><email>jdoe@example.com</email></author></entry></feed>`;
const ATOM_WITH_SUMMARY_AND_CONTENT = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Summary and Content</title><id>urn:id</id><updated>2024-01-01T00:00:00Z</updated><entry><title>Entry</title><id>urn:entry</id><updated>2024-01-01T00:00:00Z</updated><summary type="text">This is the summary.</summary><content type="text">This is the full content.</content></entry></feed>`;
const RSS_WITH_ENCLOSURE = `<?xml version="1.0"?><rss version="2.0"><channel><title>Enclosure</title><item><title>Podcast Episode</title><enclosure url="http://example.com/podcast.mp3" length="123456" type="audio/mpeg"/></item></channel></rss>`;
const NO_ID_RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>No ID</title><item><title>Item Lacking ID</title></item></channel></rss>`;

// --- Test Suite ---
describe("getFeedItems", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // request is already a mock function due to vi.mock above.
    // We can type it as Mock to satisfy TypeScript and access .mockImplementation
    (request as Mock).mockImplementation(async (options: RequestUrlParam) => { 
        const urlToTest = typeof options === 'string' ? options : options.url;
        if (urlToTest.includes("rss_sample.xml")) return RSS_SAMPLE;
        if (urlToTest.includes("atom_sample.xml")) return ATOM_SAMPLE;
        if (urlToTest.includes("rss_with_dc.xml")) return RSS_WITH_DC_CREATOR;
        if (urlToTest.includes("rss_with_guid_permalink.xml")) return RSS_WITH_GUID_PERMALINK;
        if (urlToTest.includes("atom_with_categories.xml")) return ATOM_WITH_CATEGORIES;
        if (urlToTest.includes("atom_with_html_content.xml")) return ATOM_WITH_HTML_CONTENT;
        if (urlToTest.includes("invalid_xml.xml")) return INVALID_XML_SAMPLE;
        if (urlToTest.includes("invalid_parsererror.xml")) return INVALID_XML_PARSERERROR;
        if (urlToTest.includes("empty_feed.xml")) return EMPTY_FEED_SAMPLE;
        if (urlToTest.includes("rss_empty_fields.xml")) return RSS_EMPTY_ITEM_FIELDS;
        if (urlToTest.includes("atom_complex_author.xml")) return ATOM_COMPLEX_AUTHOR;
        if (urlToTest.includes("atom_summary_content.xml")) return ATOM_WITH_SUMMARY_AND_CONTENT;
        if (urlToTest.includes("rss_enclosure.xml")) return RSS_WITH_ENCLOSURE;
        if (urlToTest.includes("no_id.xml")) return NO_ID_RSS;
        if (urlToTest.includes("network_error")) throw new Error("Simulated network error");
        return RSS_SAMPLE; // Default fallback
    });
    // Reset specific service mocks
    mockNetworkService.fetchHtml.mockClear().mockResolvedValue(null);
    mockNetworkService.fetchText.mockClear().mockResolvedValue("");
    mockNetworkService.fetchBinary.mockClear().mockResolvedValue(null); // Added mockClear for fetchBinary
    mockContentParserService.htmlToContentBlocks.mockClear().mockResolvedValue([]);
    mockContentParserService.contentBlocksToMarkdown.mockClear().mockReturnValue("");
    mockAssetService.downloadAssetsForBlocks.mockClear().mockImplementation(async (blocks: ContentBlock[]) => blocks); // Use ContentBlock[]
  });

  it("parses minimal RSS feed correctly", async () => {
    const feedUrl = "http://example.com/rss_sample.xml";
    const feedName = "TestRSS";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.name).toBe("TestRSS");
    expect(feed.title).toBe("RSS Sample");
    expect(feed.link).toBe("http://example.com/rss");
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].title).toBe("RSS Item 1");
    expect(feed.items[0].link).toBe("http://example.com/rss/1");
    expect(feed.items[0].content).toBe("Desc 1");
    expect(feed.items[0].pubDate).toBe("Wed, 02 Oct 2002 08:00:00 EST");
    expect(feed.items[0].id).toBe("http://example.com/rss/1");
  });

  it("parses minimal Atom feed correctly", async () => {
    const feedUrl = "http://example.com/atom_sample.xml";
    const feedName = "TestAtom";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.name).toBe("TestAtom");
    expect(feed.title).toBe("Atom Sample");
    expect(feed.link).toBe("http://example.com/atom");
    expect(feed.image).toBe("http://example.com/logo.png");
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].title).toBe("Atom Entry 1");
    expect(feed.items[0].link).toBe("http://example.com/atom/1");
    expect(feed.items[0].content).toBe("Summary 1");
    expect(feed.items[0].creator).toBe("Author Name");
    expect(feed.items[0].pubDate).toBe("2003-12-13T18:30:02Z");
    expect(feed.items[0].id).toBe("urn:uuid:entry-1-id");
  });

   it("parses RSS item with dc:creator", async () => {
    const feedUrl = "http://example.com/rss_with_dc.xml";
    const feedName = "TestDC";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].creator).toBe("DC Author");
  });

  it("parses RSS item with guid as permalink", async () => {
    const feedUrl = "http://example.com/rss_with_guid_permalink.xml";
    const feedName = "TestGUID";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].link).toBe("http://example.com/guid/1");
    expect(feed.items[0].id).toBe("http://example.com/guid/1");
  });

  it("parses Atom entry with multiple categories", async () => {
    const feedUrl = "http://example.com/atom_with_categories.xml";
    const feedName = "TestCategories";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].category).toBe("Tech, Software Development");
  });

   it("parses Atom entry with HTML content", async () => {
    const feedUrl = "http://example.com/atom_with_html_content.xml";
    const feedName = "TestHTML";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].content).toBe("<p>This is <strong>HTML</strong> content.</p>");
  });

  it("handles empty feed gracefully", async () => {
    const feedUrl = "http://example.com/empty_feed.xml";
    const feedName = "TestEmpty";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.title).toBe("Empty");
    expect(feed.items.length).toBe(0);
  });

  it("throws error on network failure", async () => {
    const feedUrl = "http://example.com/network_error";
    const feedName = "TestNetworkError";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    await expect(getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    )).rejects.toThrow(/Failed to get or parse feed "TestNetworkError"/);
  });

  it("throws error on invalid XML structure", async () => {
    const feedUrl = "http://example.com/invalid_xml.xml";
    const feedName = "TestInvalidXML";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    await expect(getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    )).rejects.toThrow(/Failed to get or parse feed "TestInvalidXML"/);
  });

   it("throws error on XML parser error", async () => {
    const feedUrl = "http://example.com/invalid_parsererror.xml";
    const feedName = "TestParserError";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    await expect(getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    )).rejects.toThrow(/Failed to get or parse feed "TestParserError"/);
  });

  it("handles RSS items with empty fields gracefully", async () => {
    const feedUrl = "http://example.com/rss_empty_fields.xml";
    const feedName = "TestEmptyFields";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    const item = feed.items[0];
    expect(item.title).toBe("Untitled Item");
    expect(item.link).toBe("");
    expect(item.content).toBe("");
    expect(item.pubDate).toBe("");
    expect(item.id).toBe("gid");
  });

  it("parses Atom entry with complex author tag", async () => {
    const feedUrl = "http://example.com/atom_complex_author.xml";
    const feedName = "TestComplexAuthor";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].creator).toBe("John Doe");
  });

  it("prefers Atom content over summary", async () => {
    const feedUrl = "http://example.com/atom_summary_content.xml";
    const feedName = "TestSummaryContent";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].content).toBe("This is the full content.");
  });

  it("parses feed with RSS enclosure tag without error", async () => {
    const feedUrl = "http://example.com/rss_enclosure.xml";
    const feedName = "TestEnclosure";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    await expect(getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    )).resolves.toBeDefined();
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
  });

  it("assigns a generated ID if no suitable guid/id/link is found", async () => {
    const feedUrl = "http://example.com/no_id.xml";
    const feedName = "TestNoID";
    const feedInfo: FeedInfo = { name: feedName, feedUrl: feedUrl, folder: "test", unread: 0, updated: 0 };
    const feed = await getFeedItems(
      mockPlugin as unknown as FeedsReaderPlugin, 
      feedInfo, 
      mockNetworkService as unknown as NetworkService, 
      mockContentParserService as unknown as ContentParserService, 
      mockAssetService as unknown as AssetService
    );
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].id).toBeDefined();
    expect(feed.items[0].id).not.toBe("");
    expect(feed.items[0].id).toMatch(/([0-9a-f-]{36})/);
  });
});
