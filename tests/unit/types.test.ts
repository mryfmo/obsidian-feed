import { describe, it, expect } from "vitest";
import {
  RssFeedItemSchema,
  RssFeedContentSchema,
  FeedListSchema,
} from "../../src/types";

describe("types.ts – schema validation", () => {
  it("valid feed item passes, missing field fails", () => {
    const item = {
      title: "t",
      content: "c",
      category: "",
      link: "http://example.com",
      creator: "me",
      pubDate: "2025-01-01",
      read: "0",
      deleted: "0",
      downloaded: "0",
    };
    expect(() => RssFeedItemSchema.parse(item)).not.toThrow();
    expect(() => RssFeedItemSchema.parse({ ...item, title: undefined })).toThrow();
  });

  it("feed content with optional fields parses", () => {
    const feed = {
      title: "My Feed",
      name: "my",
      link: "http://x",
      folder: "my",
      items: [],
    };
    expect(() => RssFeedContentSchema.parse(feed)).not.toThrow();
  });

  it("feed list validates array of feeds", () => {
    const list = [
      { name: "n", feedUrl: "http://x", unread: 0, updated: Date.now(), folder: "n" },
    ];
    expect(() => FeedListSchema.parse(list)).not.toThrow();
  });
});
