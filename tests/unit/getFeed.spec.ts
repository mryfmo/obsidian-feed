import { describe, it, expect, beforeEach, vi } from 'vitest';

// Types from the plugin
import type { FeedInfo } from '../../src/types';
import type { IFeedsReaderPlugin } from '../../src/pluginTypes';
import type { NetworkService } from '../../src/networkService';
import type { ContentParserService } from '../../src/contentParserService';
import type { AssetService } from '../../src/assetService';

/* -------------------------------------------------------------------------- */
/* Mock the Obsidian module BEFORE we import the implementation under test.   */
/* The `vi.mock` call is hoisted by Vitest so it effectively runs first.      */
/* -------------------------------------------------------------------------- */

vi.mock('obsidian', () => ({
  // Minimal subset of the API used by the code under test.
  request: vi.fn(),
  Notice: vi.fn(),
  sanitizeHTMLToDom: vi.fn(() => document.createDocumentFragment()),
}));

// Now we can safely import the function under test – it will receive the
// mocked `obsidian` module defined above.

// The function under test will be imported *dynamically* after the Obsidian
// mock above is in place.  Doing so avoids the situation where the real module
// resolution runs before the mock is registered.
let getFeedItems: typeof import('../../src/getFeed').getFeedItems;

// We will retrieve the mocked `obsidian.request` function lazily because the
// ESM import needs to happen *after* the Vitest module graph is up and the
// mock is registered.
let request: ReturnType<typeof vi.fn>;

/* -------------------------------------------------------------------------- */
/* Test data                                                                  */
/* -------------------------------------------------------------------------- */

const RSS_SAMPLE = `<?xml version="1.0"?><rss version="2.0"><channel><title>RSS Sample</title><link>https://example.com</link><item><title>Hello</title><link>https://example.com/1</link><description>Body</description></item></channel></rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Sample</title><id>urn:id</id><updated>2024-01-01T00:00:00Z</updated><entry><title>Entry</title><id>urn:entry</id><link href="https://example.com/entry"/><updated>2024-01-01T00:00:00Z</updated></entry></feed>`;

/* -------------------------------------------------------------------------- */
/* Minimal plugin & service mocks                                              */
/* -------------------------------------------------------------------------- */

function createPlugin(): IFeedsReaderPlugin {
  return {
    settings: {
      enableHtmlCache: false,
      enableAssetDownload: false,
    },
    manifest: { id: 'test-plugin' },
  } as unknown as IFeedsReaderPlugin;
}

const createNetworkMock = (): NetworkService =>
  ({
    fetchHtml: vi.fn().mockResolvedValue(null),
    fetchText: vi.fn().mockResolvedValue(''),
    fetchBinary: vi.fn().mockResolvedValue(null),
  }) as unknown as NetworkService;

const createParserMock = (): ContentParserService =>
  ({
    htmlToContentBlocks: vi.fn().mockResolvedValue([]),
    contentBlocksToMarkdown: vi.fn().mockReturnValue(''),
  }) as unknown as ContentParserService;

const createAssetMock = (): AssetService =>
  ({
    downloadAssetsForBlocks: vi.fn(async blocks => blocks),
  }) as unknown as AssetService;

/* -------------------------------------------------------------------------- */
/* Utility to wire the mocked HTTP response based on the requested URL        */
/* -------------------------------------------------------------------------- */

function mockHttpResponse(url: string, xml: string) {
  // The mocked "request" created above is a Vitest spy instance (vi.fn()). We
  // therefore cast to the generic spy interface that exposes
  // `mockImplementationOnce`.
  (
    request as unknown as {
      mockImplementationOnce: (fn: (opts: unknown) => Promise<string>) => void;
    }
  ).mockImplementationOnce(async (opts: unknown) => {
    const u = typeof opts === 'string' ? opts : (opts as { url: string }).url;
    if (u === url) return xml;
    throw new Error(`Unexpected URL in mock: ${u}`);
  });
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe('getFeedItems', () => {
  let plugin: IFeedsReaderPlugin;
  let net: NetworkService;
  let parser: ContentParserService;
  let asset: AssetService;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = createPlugin();
    net = createNetworkMock();
    parser = createParserMock();
    asset = createAssetMock();
  });

  // Dynamically import the implementation once the mocks are ready.
  // We do this in a `beforeEach` with `async/await` so that each test gets a
  // *fresh* copy (Vitest caches modules, but mocking state is reset via
  // `clearAllMocks` above).
  beforeEach(async () => {
    const mod = await import('../../src/getFeed');
    ({ getFeedItems } = mod);

    // Obtain the mocked request function from the mocked obsidian module.
    request = (await import('obsidian')).request as unknown as ReturnType<typeof vi.fn>;
  });

  it('parses a minimal RSS feed', async () => {
    const url = 'https://example.com/rss.xml';
    mockHttpResponse(url, RSS_SAMPLE);

    const info: FeedInfo = { name: 'sample', feedUrl: url, folder: 'fs', unread: 0, updated: 0 };
    const feed = await getFeedItems(plugin, info, net, parser, asset);

    expect(feed.title).toBe('RSS Sample');
    expect(feed.link).toBe('https://example.com');

    // The item list should contain the single <item> from the XML.
    expect(feed.items.length).toBe(1);
    const [item] = feed.items;
    expect(item.title).toBe('Hello');
    expect(item.link).toBe('https://example.com/1');
    // Ensure a deterministic ID was assigned.
    expect(item.id).toBeDefined();
  });

  it('parses a minimal Atom feed', async () => {
    const url = 'https://example.com/atom.xml';
    mockHttpResponse(url, ATOM_SAMPLE);

    const info: FeedInfo = { name: 'atom', feedUrl: url, folder: 'fs', unread: 0, updated: 0 };
    const feed = await getFeedItems(plugin, info, net, parser, asset);

    expect(feed.title).toBe('Atom Sample');
    // Should carry at least one item (the single <entry>).
    expect(feed.items.length).toBe(1);
    const [item] = feed.items;
    expect(item.title).toBe('Entry');
    expect(item.link).toBe('https://example.com/entry');
  });
});
