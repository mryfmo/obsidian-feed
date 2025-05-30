/**
 * View-related type definitions to break circular dependencies
 */

import { ItemView } from 'obsidian';
import { RssFeedItem, FeedInfo } from '../types';
import { IFeedsReaderPlugin } from '../pluginTypes';

export interface IFeedsReaderView extends ItemView {
  plugin: IFeedsReaderPlugin;
  showAll: boolean;
  titleOnly: boolean;
  itemOrder: 'New to old' | 'Old to new' | 'Random';
  currentPage: number;
  navSelectedIndex: number;
  currentFeed: string | null;
  itemsPerPage: number;
  undoList: any[];
  contentAreaEl: HTMLElement;
  expandedItems: Set<string>;
  renderFeedList: () => void;
  renderFeedContent: () => void;
  createControlButtons: () => void;
  updateControlsBar?: () => void;
  isMixedViewEnabled: () => boolean;
  dispatchEvent: (event: any) => void;
  toggleTitleOnlyMode: () => void;
  toggleItemExpansion: (itemId: string) => void;
  handleUndo: () => void;
  refreshView: () => void;
  setSelectedItemById: (itemId: string) => void;
  pushUndo: (action: any) => void;
  currentFilter?: FeedInfo;
  searchQuery?: string;
  items?: RssFeedItem[];
  filteredItems?: RssFeedItem[];
  feedItems?: Map<string, RssFeedItem[]>;
  controlsBar?: {
    updatePageInfo: () => void;
  };
}
