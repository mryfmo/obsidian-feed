import { FileSystemAdapter } from 'obsidian';
import { FeedsReaderSettings, ContentBlock } from './types';
import { NetworkService } from './networkService';
import { basename, join } from 'path';
import { safeGetPluginFeedsReaderDir, safePathJoin } from './view/utils'; // Correct import path
import { HTML_CACHE_DIR } from './constants'; // Import HTML_CACHE_DIR

/**
  * This service will be responsible for downloading assets (images, videos)
  * from feed item content and replacing their URLs with local paths.
  */
export class AssetService {
  private cacheBasePath: string; // Declare cacheBasePath property

  constructor(
    private adapter: FileSystemAdapter,
    private settings: FeedsReaderSettings,
    private pluginId: string,
    private networkService: NetworkService
  ) {
    const pluginDataDir = safeGetPluginFeedsReaderDir(this.pluginId, this.adapter.getBasePath()); // Should now work
    this.cacheBasePath = safePathJoin(pluginDataDir, HTML_CACHE_DIR);
  }

  private getAssetBasePath(): string {
    const pluginDataDir = safeGetPluginFeedsReaderDir(this.pluginId, this.adapter.getBasePath());
    return join(pluginDataDir, this.settings.assetDownloadPath || "feeds_assets");
  }

  async downloadAsset(assetUrl: string, baseArticleUrl: string): Promise<string | null> {
    if (!this.settings.enableAssetDownload) return null;

    let absoluteAssetUrl: string;
    try {
      absoluteAssetUrl = new URL(assetUrl, baseArticleUrl).href;
    } catch {
      console.warn(`AssetService: Invalid asset URL "${assetUrl}" relative to "${baseArticleUrl}". Skipping download.`);
      return null;
    }

    const assetsDir = this.getAssetBasePath();
    if (!await this.adapter.exists(assetsDir)) {
      await this.adapter.mkdir(assetsDir);
    }

    try {
      const fileName = basename(new URL(absoluteAssetUrl).pathname) || `asset_${Date.now()}`;
      // Sanitize filename further if needed
      const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 100);
      const localPathRelative = join(this.settings.assetDownloadPath || "feeds_assets", safeFileName); // Path relative to plugin data dir
      const localPathAbsolute = join(assetsDir, safeFileName);

      if (await this.adapter.exists(localPathAbsolute)) {
        console.log(`AssetService: Asset "${safeFileName}" already exists. Using cached.`);
        return localPathRelative; // Return path relative to plugin data dir for Obsidian links
      }

      const assetData = await this.networkService.fetchBinary(absoluteAssetUrl);
      if (!assetData) {
        console.warn(`AssetService: Failed to fetch binary data for asset "${absoluteAssetUrl}". Skipping download.`);
        return null;
      }
      await this.adapter.writeBinary(localPathAbsolute, assetData);
      console.log(`AssetService: Downloaded "${absoluteAssetUrl}" to "${localPathAbsolute}"`);
      return localPathRelative;
    } catch (error) {
      console.error(`AssetService: Failed to download asset "${absoluteAssetUrl}":`, error);
      return null;
    }
  }

  async downloadAssetsForBlocks(blocks: ContentBlock[], baseArticleUrl: string): Promise<ContentBlock[]> {
    if (!this.settings.enableAssetDownload) return blocks;

    for (const block of blocks) {
      if ((block.type === "image" || block.type === "video") && block.src && !block.src.startsWith('data:')) {
        const localSrc = await this.downloadAsset(block.src, baseArticleUrl);
        if (localSrc) block.localSrc = localSrc;
      }
    }
    return blocks;
  }
}
