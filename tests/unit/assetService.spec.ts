import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';

import { AssetService } from '../../src/assetService';
import type { NetworkService } from '../../src/networkService';
import type { FileSystemAdapter } from 'obsidian';
import type { FeedsReaderSettings, ContentBlock } from '../../src/types';

// Define an extended ContentBlock type that might include localSrc
// interface ProcessedContentBlock extends ContentBlock {
//   localSrc?: string;
// }
type ProcessedContentBlock = ContentBlock & { localSrc?: string };

/* -------------------------------------------------------------------------- */
/* Shared mocks                                                               */
/* -------------------------------------------------------------------------- */

const createAdapter = (): Mocked<FileSystemAdapter> => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  writeBinary: vi.fn(),
  getBasePath: vi.fn().mockReturnValue('/vault'),
} as unknown as Mocked<FileSystemAdapter>);

// NetworkService only uses fetchBinary, so a minimal mock is enough.
// Explicitly type the mock to match NetworkService or a compatible subset.
const createNetworkMock = (): Mocked<Pick<NetworkService, 'fetchBinary'>> => ({
  fetchBinary: vi.fn(),
});

const baseSettings: FeedsReaderSettings = {
  mixedFeedView: false,
  nItemPerPage: 10,
  saveContent: false,
  saveSnippetNewToOld: false,
  showJot: false,
  showSnippet: false,
  showRead: false,
  showSave: false,
  showMath: false,
  showGPT: false,
  showEmbed: false,
  showFetch: false,
  showLink: false,
  showDelete: false,
  showThumbnails: false,
  chatGPTApiKey: '',
  chatGPTPrompt: '',
  chatGPTModel: 'gpt-3.5-turbo',
  enableHtmlCache: false,
  htmlCacheDurationMinutes: 60,
  enableAssetDownload: true,
  assetDownloadPath: 'feeds_assets',
  latestNOnly: false,
  latestNCount: 0,
  viewStyle: 'card',
};

/* -------------------------------------------------------------------------- */
/* Helper                                                                    */
/* -------------------------------------------------------------------------- */

function imgBlock(src: string): ContentBlock {
  return { type: 'image', src } as unknown as ContentBlock;
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('AssetService', () => {
  let adapter: Mocked<FileSystemAdapter>;
  let net: ReturnType<typeof createNetworkMock>;
  let svc: AssetService;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createAdapter();
    net = createNetworkMock();
    svc = new AssetService(adapter, baseSettings, 'test-plugin', net as unknown as NetworkService);
  });

  it('returns immediately when asset download is disabled', async () => {
    svc = new AssetService(adapter, { ...baseSettings, enableAssetDownload: false }, 'test-plugin', net as unknown as NetworkService);
    const blocks = [imgBlock('https://x.com/a.png')];
    const res = await svc.downloadAssetsForBlocks(blocks, 'https://x.com');
    expect(res[0]).not.toHaveProperty('localSrc');
    expect(net.fetchBinary).not.toHaveBeenCalled();
  });

  it('downloads image and rewrites src', async () => {
    adapter.exists.mockResolvedValue(false); // first call – folder; second call – file
    net.fetchBinary.mockResolvedValue(new ArrayBuffer(10));

    const blocks = [imgBlock('/img/pic.png')];
    const res = await svc.downloadAssetsForBlocks(blocks, 'https://example.com/post/') as ProcessedContentBlock[];

    expect(net.fetchBinary).toHaveBeenCalledWith('https://example.com/img/pic.png');
    expect(adapter.mkdir).toHaveBeenCalled();
    expect(adapter.writeBinary).toHaveBeenCalled();
    expect(res[0]).toHaveProperty('localSrc');
    // localSrc should be a relative path inside feeds_assets/
    expect(res[0].localSrc).toMatch(/^feeds_assets\/.*pic\.png$/);
  });

  it('skips download when file already cached', async () => {
    // adapter.exists: first call (assets dir) => true, second call (file) => true
    adapter.exists.mockResolvedValue(true);
    const blocks = [imgBlock('https://site.com/a.jpg')];
    const res = await svc.downloadAssetsForBlocks(blocks, 'https://site.com/');

    expect(net.fetchBinary).not.toHaveBeenCalled();
    expect(res[0]).toHaveProperty('localSrc');
  });
});
