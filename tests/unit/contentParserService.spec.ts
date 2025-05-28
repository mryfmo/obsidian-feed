import { describe, it, expect } from 'vitest';

import { ContentParserService } from '../../src/contentParserService';
import type { AssetService } from '../../src/assetService';
import type { FeedsReaderSettings, ContentBlock } from '../../src/types';

// AssetService is currently only used for downloadAssetsForBlocks, so a dummy is enough.
const dummyAssetService: Pick<AssetService, 'downloadAssetsForBlocks'> = {
  downloadAssetsForBlocks: async (blocks: ContentBlock[]) => blocks,
};

const settings: FeedsReaderSettings = {
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
  enableAssetDownload: false,
  assetDownloadPath: '',
  latestNOnly: false,
  latestNCount: 0,
  viewStyle: 'card',
};

const svc = new ContentParserService(dummyAssetService as unknown as AssetService, settings);

describe('ContentParserService', () => {
  it('extracts heading, paragraph and list', async () => {
    const html = `
      <article>
        <h1>Title</h1>
        <p>Hello <strong>world</strong> and <a href="/more">more</a>.</p>
        <ul><li>One</li><li>Two</li></ul>
      </article>`;

    const blocks = await svc.htmlToContentBlocks(html, 'https://example.com/post');

    // heading
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Title' });

    // paragraph should resolve link and strong
    expect(blocks[1]).toEqual({
      type: 'text',
      content: 'Hello **world** and [more](https://example.com/more).',
    });

    // list
    expect(blocks[2]).toEqual({ type: 'list', ordered: false, items: ['One', 'Two'] });
  });

  it('creates markdown from blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 2, text: 'Sub' },
      { type: 'text', content: 'Plain' },
      { type: 'list', ordered: true, items: ['A', 'B'] },
      { type: 'image', src: 'https://x.com/y.png', alt: 'alt' },
    ];

    const md = svc.contentBlocksToMarkdown(blocks);
    expect(md).toBe(['## Sub', 'Plain', '1. A\n1. B', '![alt](https://x.com/y.png)'].join('\n\n'));
  });
});
