import { RssFeedContent } from "./getFeed";

export namespace GLB {
  export var showAll: boolean;
  export var titleOnly: boolean;
  export var itemOrder: string;
  export var feeds_reader_dir: string;
  export var feeds_data_fname: string;
  export var feeds_store_base: string;
  export var subscriptions_fname: string;
  export var saved_snippets_fname: string;
  export var currentFeed: string;
  export var currentFeedName: string;
  export var elUnreadCount: HTMLElement | undefined;
  export var elTotalCount: HTMLElement | undefined;
  export var elSepUnreadTotal: HTMLElement | undefined;
  export var feedList: {name: string, feedUrl: string, unread: number, updated: number, folder: string}[];
  export var feedsStore: {[id: string]: RssFeedContent;};
  export var feedsStoreChange: boolean;
  export var feedsStoreChangeList: Set<string>;
  export var hideThisItem: boolean;
  export var nMergeLookback: number;
  export var lenStrPerFile: number;
  export var undoList: number[];
  export var nItemPerPage: number;
  export var saveContent: boolean;
  export var saveSnippetNewToOld: boolean;
  export var nPage: number;
  export var idxItemStart: number;
  export var displayIndices: number[];
  export var maxTotalnumDisplayed: number;
  export var nThanksSep: number;
  export var settings: any;
}
