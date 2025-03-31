import { request, Notice } from "obsidian";
import { GLB } from "./globals"; // Import GLB to access feedsStore for stats

// --- Global Helper ---
export function nowdatetime(): string {
  const a = new Date();
  return a.toISOString();
}

// --- Interfaces ---
export interface RssFeedContent {
    subtitle: string,
    title: string,
    name: string, // Populated by main logic
    link: string,
    image: string,
    folder: string, // Populated by main logic
    description: string,
    pubDate: string,
    items: RssFeedItem[]
}

export interface RssFeedItem {
    title: string,
    content?: string | null,
    category?: string | null,
    link: string,
    creator?: string | null,
    pubDate: string,
    read: string | null;
    deleted: string | null;
    downloaded: string;
    starred: boolean;
    imageUrl: string | null;
}

// --- Constants ---
export const itemKeys = ["title", "link", "pubDate", "read", "deleted", "downloaded", "starred", "content", "creator", "category", "imageUrl"];

// --- XML Parsing Helpers ---
function getElementByName(element: Element | Document, name: string): ChildNode | null {
    let value: ChildNode | null = null;
    if (!(element instanceof Element || element instanceof Document)) return null;
    const el = element as Element;
    // Safely check for required methods
    if (typeof el?.getElementsByTagName !== 'function' || typeof el?.getElementsByTagNameNS !== 'function') {
        console.warn("Feeds Reader: Element missing required methods (getElementsByTagName/NS)", element);
        return null;
    }

    try {
        if (name.includes(":")) {
            const [namespace, tag] = name.split(":");
            // lookupNamespaceURI might be null
            const namespaceUri = el.lookupNamespaceURI(namespace);
            if (namespaceUri) {
                const byNamespace = el.getElementsByTagNameNS(namespaceUri, tag);
                if (byNamespace.length > 0) value = byNamespace[0].firstChild || byNamespace[0];
            }
            // Fallback if namespace lookup fails
            if (!value) { const tmp = el.getElementsByTagName(name); if (tmp.length > 0) value = tmp[0].firstChild || tmp[0]; }
        } else if (name.includes(".")) { // Adjusted to handle potentially missing childNodes
            const [prefix, tag] = name.split(".");
            const prefixEls = el.getElementsByTagName(prefix);
            // Check childNodes exists before accessing
            if (prefixEls.length > 0 && prefixEls[0] && prefixEls[0].childNodes) {
                 const nodes = Array.from(prefixEls[0].childNodes);
                 value = nodes.find(node => node.nodeName.toLowerCase() === tag.toLowerCase()) || null;
            }
        } else {
            const els = el.getElementsByTagName(name);
            if (els.length > 0) value = els[0].firstChild || els[0];
        }
    } catch (e) { console.error(`Feeds Reader: Error in getElementByName for "${name}":`, e, element); }
    return value;
}

function getElPossibleText(el: Node | null): string[] {
    if (!el) return ['']; // Return array with empty string if el is null
    const tags = ['textContent', 'nodeValue', 'data', 'innerHTML', 'innerText', 'wholeText'];
    const texts: string[] = []; // Initialize empty array
    for (const t of tags) {
      // Explicitly check for null/undefined before accessing property
      if (el && typeof (el as any)[t] === 'string') {
          texts.push((el as any)[t]);
      }
    }
    // Ensure initial empty string if no text found, then filter
    return (texts.length > 0 ? texts : ['']).map(s => (s || '').trim()).filter(s => s);
}

function getContent(element: Element | Document, names: string[]): string {
    let longestValue = '';
    for (const name of names) {
        let currentValue = '';
        try {
            if (name.includes("#")) {
                const [elementName, attr] = name.split("#");
                const dataNode = getElementByName(element, elementName);
                // Ensure it's an Element before calling getAttribute
                if (dataNode instanceof Element) {
                     currentValue = dataNode.getAttribute(attr) || '';
                }
            } else {
                const dataNode = getElementByName(element, name);
                if (dataNode) {
                     const possibleTexts = getElPossibleText(dataNode);
                     // Check if possibleTexts is not empty before reducing
                     if (possibleTexts.length > 0) {
                         // Provide initial value to reduce in case array is empty after filter
                         currentValue = possibleTexts.reduce((a, b) => (b.length > a.length ? b : a), '');
                     }
                }
            }
        } catch (e) { console.error(`Feeds Reader: Error in getContent for "${name}":`, e, element); }

        // Basic sanitization/normalization
        currentValue = currentValue
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "\"")
            .replace(/'/g, "'")
            .replace(/'/g, "'") // Numeric entity for apostrophe
            .replace(/&/g, "&") // Must be last
            .replace(/\u00A0/g, " ") // Replace non-breaking space
            .trim();

        if (currentValue.length > longestValue.length) {
            longestValue = currentValue;
        }
    }
    // Final cleanup before returning
    return longestValue;
}


/** Normalizes a URL string. */
export function normalizeUrl(url: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    let normalized = url.trim();
    if (!normalized) return null;
    try {
        // Basic unescaping
        normalized = normalized
          .replace(/&/g, '&')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '"')
          .replace(/'/g, "'")
          .replace(/'/g, "'");

        if (normalized.startsWith("//")) {
            normalized = "https:" + normalized;
        }
        // Check prefix before constructing URL
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            return null;
        }
        // Validate by attempting to create a URL object
        new URL(normalized);
        return normalized;
    } catch (e) {
        // console.warn(`Feeds Reader: Invalid URL encountered: ${url}`, e);
        return null; // Return null for invalid URLs
    }
}


/** Extracts image URL from item element or content. */
function extractImageUrl(element: Element, content: string | null): string | null {
    let imageUrl: string | null = null;
    // Define sources with type hints and error handling
    const sources: (() => string | null)[] = [
        () => { try { const mc = element.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "content"); for (let i = 0; i < mc.length; i++) { if (mc[i].getAttribute("medium") === "image") return mc[i].getAttribute("url"); } } catch (e) { /* Handle error */ } return null; },
        () => { try { const enc = element.getElementsByTagName("enclosure"); for (let i = 0; i < enc.length; i++) { if (enc[i].getAttribute("type")?.startsWith("image/")) return enc[i].getAttribute("url"); } } catch (e) { /* Handle error */ } return null; },
        () => { try { const itunesImageNS = element.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image"); if (itunesImageNS?.[0]) return itunesImageNS[0].getAttribute("href"); const itunesImage = element.getElementsByTagName("itunes:image"); if (itunesImage?.[0]) return itunesImage[0].getAttribute("href"); } catch (e) { /* Handle error */ } return null; },
        () => { try { const thumbnail = element.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "thumbnail"); return thumbnail?.[0]?.getAttribute("url"); } catch (e) { /* Handle error */ } return null; },
        () => { if (!content) return null; try { const match = content.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i); return match?.[1] || null; } catch (e) { /* Handle error */ } return null; }
    ];

    for (const source of sources) {
        try {
            const url = source(); // url is string | null
            // Pass string | null directly to normalizeUrl
            imageUrl = normalizeUrl(url);
            if (imageUrl) return imageUrl;
        } catch (e) {
            console.error("Feeds Reader: Image extract function error:", e, element);
        }
    }
    return null; // Return null if no valid image URL found
}


/** Builds an RssFeedItem from an XML Element */
function buildItem(element: Element): RssFeedItem {
    const contentTags = ["content:encoded", "content", "description", "summary", "itunes:summary", "media:description", "rss:description"];
    const contentValue = getContent(element, contentTags) || null;
    const creatorValue = getContent(element, ["dc:creator", "creator", "author", "author.name", "itunes:author"]) || null;
    const categoryValue = getContent(element, ["category"]) || null;
    // Ensure link is valid or empty string
    const linkValue = normalizeUrl(getContent(element, ["link", "link#href", "guid"])) || '';

    const itemImageUrl = extractImageUrl(element, contentValue);

    return {
        title: getContent(element, ["title", "rss:title"]),
        content: contentValue,
        category: categoryValue,
        link: linkValue,
        creator: creatorValue,
        pubDate: getContent(element, ["pubDate", "published", "updated", "dc:date", "dcterms:issued", "dcterms:modified"]) || nowdatetime(),
        read: null,
        deleted: null,
        downloaded: nowdatetime(),
        starred: false,
        imageUrl: itemImageUrl
    }
}


/**
 * Finds all item/entry elements in the document
 * Handles potential undefined elements and ensures type safety for Array.from.
 */
function getAllItems(doc: Document): Element[] {
    const itemSelectors: (string | { ns: string; tag: string })[] = [
        "item", // Common RSS 2.0
        "entry", // Common Atom
        { ns: "http://purl.org/rss/1.0/", tag: "item" } // RSS 1.0
    ];
    const allElements: Element[] = [];

    for (const selector of itemSelectors) {
        let elements: HTMLCollectionOf<Element> | NodeListOf<Element> | undefined = undefined;
        try {
            if (typeof selector === 'string') {
                elements = doc.getElementsByTagName(selector);
            } else {
                if (selector.ns) {
                    elements = doc.getElementsByTagNameNS(selector.ns, selector.tag);
                }
            }
            if (elements && elements.length > 0) {
                 allElements.push(...Array.from(elements));
            }
        } catch (e) {
            console.error(`Feeds Reader: Error finding items with selector: ${JSON.stringify(selector)}`, e, doc);
        }
    }
    return allElements;
}


/** Fetches feed data with appropriate headers */
async function requestFeed(feedUrl: string): Promise<string> {
    try {
        // Define headers, potentially using custom User-Agent from settings
        const headers: Record<string, string> = {
            "Accept": "application/xml,application/rss+xml,application/atom+xml;q=0.9,text/xml;q=0.8,text/html;q=0.7,*/*;q=0.5",
            "Accept-Language": "en-US,en;q=0.9", // Common default
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        };

        // Use custom User-Agent from settings if available, otherwise use a default Chrome one
        const customUserAgent = GLB.settings?.customUserAgent;
        headers["User-Agent"] = customUserAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

        console.log("Requesting feed with headers:", headers); // Log headers for debugging

        return await request({
             url: feedUrl,
             method: "GET",
             headers: headers,
             throw: true // Ensure errors on 4xx/5xx are thrown
         });
    }
    catch (error: any) {
        console.error(`Feeds Reader: Request failed for ${feedUrl}:`, error);
        const message = error?.message || (typeof error === 'string' ? error : 'Network request failed');
        const status = error?.status || error?.response?.status || '(status unknown)';
        // Throw error with status code
        throw new Error(`Failed to fetch feed (${feedUrl}), status ${status}: ${message}`);
    }
}


/** Main function to fetch and parse a feed. */
export async function getFeedItems(feedUrl: string): Promise<RssFeedContent | undefined> {
    let rawData: string;
    let doc: Document;

    // requestFeed will throw on network error (like 404)
    try {
        rawData = await requestFeed(feedUrl);
    } catch (e) {
        // Error is already logged in requestFeed's catch block
        // Re-throw the formatted error from requestFeed
        throw e;
    }

    try {
        const parser = new window.DOMParser();
        doc = parser.parseFromString(rawData, "application/xml");

        const parserError = doc.querySelector("parsererror");
        if (parserError) {
            console.error("XML Parsing Error:", parserError.textContent, `Feed: ${feedUrl}`);
            // Attempt to find alternate feed link
            try {
                const htmlDoc = parser.parseFromString(rawData, "text/html");
                const rssLink = htmlDoc.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');
                const altHref = rssLink?.getAttribute('href');
                if (altHref) {
                    try {
                        const altUrl = new URL(altHref, feedUrl).toString();
                        if (altUrl !== feedUrl) {
                             new Notice(`XML parse failed. Trying alternate: ${altUrl}`, 4000);
                             return await getFeedItems(altUrl);
                        }
                    } catch (urlError) { console.warn("Invalid alternate URL found:", altHref, urlError); }
                }
            } catch (htmlParseError) { console.warn("Error parsing response as HTML:", htmlParseError); }
            // Throw parse error if no alternate found or successful
            throw new Error(`Failed to parse feed XML (${feedUrl}). Check validity or console.`);
        }
    } catch (e: any) { // Catches DOMParser errors and thrown parse error
        console.error("Feed Parsing Error:", e, `Feed: ${feedUrl}`);
        throw e; // Re-throw to be caught by updateOneFeed
    }

    // --- Extract feed metadata and items ---
    const feedTitleTags = ["title"];
    const feedLinkTags = ["link", "link#href"];
    const feedDescTags = ["description", "subtitle", "itunes:summary"];
    const feedImageTags = ["image > url", "image url", "image", "icon", "logo", "itunes:image#href"];
    const feedDateTags = ["pubDate", "updated", "lastBuildDate", "dc:date"];

    const feedTitle = getContent(doc.documentElement || doc, feedTitleTags);
    const feedLink = normalizeUrl(getContent(doc.documentElement || doc, feedLinkTags)) || feedUrl;
    let feedImage = normalizeUrl(getContent(doc.documentElement || doc, feedImageTags));

    const items: RssFeedItem[] = [];
    const rawItems = getAllItems(doc);

    rawItems.forEach((rawItem) => {
        try {
            const item = buildItem(rawItem);
            if (item.title && item.link) { items.push(item); }
            else { console.warn("Skipping item with missing title or link:", item, `Feed: ${feedUrl}`); }
        } catch (itemError) { console.error("Error building item:", itemError, `Element:`, rawItem, `Feed: ${feedUrl}`); }
    });

    const content: RssFeedContent = {
        title: feedTitle || `Feed (${new URL(feedUrl).hostname})`,
        subtitle: getContent(doc.documentElement || doc, ["subtitle"]),
        link: feedLink, pubDate: getContent(doc.documentElement || doc, feedDateTags),
        image: feedImage || '', description: getContent(doc.documentElement || doc, feedDescTags),
        items: items, name: '', folder: '',
    };
    return content;
}


/** Calculates statistics for a given feed URL */
export function getFeedStats(feedUrl: string): { total: number; read: number; deleted: number; unread: number; starred: number } {
    let total = 0, read = 0, deleted = 0, unread = 0, starred = 0;
    const feed = GLB.feedsStore[feedUrl]; // Access global state
    if (feed?.items) {
        total = feed.items.length;
        for (const item of feed.items) {
            if (!item) continue;
            if (item.read && !item.deleted) read++;
            if (item.deleted) deleted++;
            if (!item.read && !item.deleted) unread++;
            if (item.starred && !item.deleted) starred++;
        }
    }
    return { total, read, deleted, unread, starred };
}