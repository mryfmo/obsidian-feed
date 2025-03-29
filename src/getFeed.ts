import { request, Notice } from "obsidian";

// --- Global Helper ---
export function nowdatetime(): string {
  const a = new Date();
  return a.toISOString();
}

// --- Interfaces ---
export interface RssFeedContent {
    subtitle: string,
    title: string,
    name: string, // Added by main.ts from feedList
    link: string, // Feed's primary link
    image: string, // Feed's primary image URL
    folder: string, // Added by main.ts from feedList
    description: string, // Feed description
    pubDate: string, // Feed publication/update date
    items: RssFeedItem[] // Array of feed items
}

export interface RssFeedItem {
    title: string,
    content?: string | null, // Changed to optional
    category?: string | null, // Changed to optional
    link: string,            // Keep link as required
    creator?: string | null, // Changed to optional
    pubDate: string,
    read: string | null;
    deleted: string | null;
    downloaded: string;
    starred: boolean;
    imageUrl: string | null; // Extracted image URL specific to this item
}

// --- Constants ---
// Keys used for saving/loading item data
export const itemKeys = ["title", "link", "pubDate", "read", "deleted", "downloaded", "starred", "content", "creator", "category", "imageUrl"];

// --- XML Parsing Helpers ---

/**
 * Finds a child node by name, handling namespaces and basic nesting.
 * @param element Parent Element or Document
 * @param name Tag name (e.g., "title", "dc:creator", "media:content")
 * @returns The first matching ChildNode or null.
 */
function getElementByName(element: Element | Document, name: string): ChildNode | null {
    let value: ChildNode | null = null;
    if (!(element instanceof Element || element instanceof Document)) return null;

    // Check for required methods more safely
    const el = element as Element; // Cast to Element for potential access, but check methods
    if (typeof el?.getElementsByTagName !== 'function' || typeof el?.getElementsByTagNameNS !== 'function') {
        console.warn("Feeds Reader: Element missing required methods (getElementsByTagName/NS)", element);
        return null;
    }


    try {
        if (name.includes(":")) {
            const [namespace, tag] = name.split(":");
            // lookupNamespaceURI might be null if the prefix isn't defined on this element or ancestors
            const namespaceUri = el.lookupNamespaceURI(namespace);
            if (namespaceUri) {
                const byNamespace = el.getElementsByTagNameNS(namespaceUri, tag);
                if (byNamespace.length > 0) value = byNamespace[0].firstChild || byNamespace[0];
            }
            // Fallback if namespace lookup fails or finds nothing
            if (!value) { const tmp = el.getElementsByTagName(name); if (tmp.length > 0) value = tmp[0].firstChild || tmp[0]; }
        } else if (name.includes(".")) {
            // Handle potential errors if structure isn't as expected
            const [prefix, tag] = name.split(".");
            const prefixEls = el.getElementsByTagName(prefix);
            if (prefixEls.length > 0 && prefixEls[0]) {
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

/** Gets potential text representations from a Node */
function getElPossibleText(el: Node | null): string[] {
  if (!el) return [''];
  const tags = ['textContent', 'nodeValue', 'data', 'innerHTML', 'innerText', 'wholeText'];
  const texts: string[] = [''];
  for (const t of tags) {
      // Add type check for safety
      if (el && typeof (el as any)[t] === 'string') {
          texts.push((el as any)[t]);
      }
  }
  // Ensure strings before processing
  return texts.map(s => (s || '').trim()).filter(s => s);
}


/** Extracts content using getContent, returning the longest non-empty string. */
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
                     // Find the longest text representation
                     currentValue = getElPossibleText(dataNode).reduce((a, b) => (b.length > a.length ? b : a), '');
                }
            }
        } catch (e) { console.error(`Feeds Reader: Error in getContent for "${name}":`, e, element); }

        // Basic sanitization/normalization (consider a more robust library if needed)
        currentValue = currentValue
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&apos;/g, "'")
            .replace(/&#39;/g, "'") // Numeric entity for apostrophe
            .replace(/&amp;/g, "&") // Must be last
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
        // Basic unescaping - be careful not to double-escape/unescape
        normalized = normalized
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#39;/g, "'");

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
        // Log invalid URLs if needed for debugging
        // console.warn(`Feeds Reader: Invalid URL encountered: ${url}`, e);
        return null; // Return null for invalid URLs
    }
}


/** Extracts image URL from item element or content. */
function extractImageUrl(element: Element, content: string | null): string | null {
    let imageUrl: string | null = null;
    // Define sources with clear type hints and error handling
    const sources: (() => string | null)[] = [
        () => {
            try {
                const mc = element.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "content");
                for (let i = 0; i < mc.length; i++) {
                    if (mc[i].getAttribute("medium") === "image") {
                        return mc[i].getAttribute("url");
                    }
                }
            } catch (e) { /* Handle potential error if needed */ }
            return null;
        },
        () => {
            try {
                const enc = element.getElementsByTagName("enclosure");
                for (let i = 0; i < enc.length; i++) {
                    if (enc[i].getAttribute("type")?.startsWith("image/")) {
                        return enc[i].getAttribute("url");
                    }
                }
            } catch (e) { /* Handle potential error */ }
            return null;
        },
        () => {
             try {
                 // Prioritize namespaced version, then fallback
                 const itunesImageNS = element.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image");
                 if (itunesImageNS?.[0]) return itunesImageNS[0].getAttribute("href");

                 const itunesImage = element.getElementsByTagName("itunes:image");
                 if (itunesImage?.[0]) return itunesImage[0].getAttribute("href");
             } catch (e) { /* Handle potential error */ }
             return null;
         },
        () => {
            try {
                const thumbnail = element.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "thumbnail");
                return thumbnail?.[0]?.getAttribute("url");
            } catch (e) { /* Handle potential error */ }
            return null;
        },
        () => {
            if (!content) return null;
            try {
                // Improved regex to handle single quotes and potential whitespace
                const match = content.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
                return match?.[1] || null;
            } catch (e) { /* Handle potential error */ }
            return null;
        }
    ];

    for (const source of sources) {
        try {
            const url = source(); // url is string | null here
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
    const contentValue = getContent(element, contentTags) || null; // Ensure null if empty
    const creatorValue = getContent(element, ["dc:creator", "creator", "author", "author.name", "itunes:author"]) || null; // Ensure null if empty
    const categoryValue = getContent(element, ["category"]) || null; // Use null for consistency
    // Ensure link is valid or empty string, never null for the RssFeedItem interface
    const linkValue = normalizeUrl(getContent(element, ["link", "link#href", "guid"])) || '';

    // Extract image URL once
    const itemImageUrl = extractImageUrl(element, contentValue);

    return {
        title: getContent(element, ["title", "rss:title"]),
        content: contentValue,
        category: categoryValue,
        link: linkValue,
        creator: creatorValue,
        // Ensure pubDate is a string, fallback if necessary
        pubDate: getContent(element, ["pubDate", "published", "updated", "dc:date", "dcterms:issued", "dcterms:modified"]) || nowdatetime(),
        read: null,
        deleted: null,
        downloaded: nowdatetime(), // Set download time consistently
        starred: false,
        imageUrl: itemImageUrl // Assign extracted image URL
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
        // Initialize elements as potentially undefined
        let elements: HTMLCollectionOf<Element> | NodeListOf<Element> | undefined = undefined;
        try {
            if (typeof selector === 'string') {
                elements = doc.getElementsByTagName(selector);
            } else {
                // Ensure namespace URI is valid before calling getElementsByTagNameNS
                if (selector.ns) {
                    elements = doc.getElementsByTagNameNS(selector.ns, selector.tag);
                }
                // If selector.ns is missing or empty, elements remains undefined
            }

            // Check if elements is defined AND has length > 0 before accessing length or using Array.from
            if (elements && elements.length > 0) {
                 // Now 'elements' is guaranteed to be non-null and have items.
                 // Spread NodeListOf/HTMLCollection into the array.
                 allElements.push(...Array.from(elements));
            }
        } catch (e) {
            console.error(`Feeds Reader: Error finding items with selector: ${JSON.stringify(selector)}`, e, doc);
            // If an error occurs, elements might remain undefined, but the loop continues.
        }
    }
    // Deduplication is usually not required as getElementsByTagName/NS returns live collections,
    // but if multiple selectors matched the *same* element, Set could deduplicate.
    // return Array.from(new Set(allElements));
    return allElements;
}


/** Fetches feed data with appropriate headers */
async function requestFeed(feedUrl: string): Promise<string> {
    try {
        // Use standard cache-busting headers
        return await request({
             url: feedUrl,
             method: "GET",
             headers: {
                 "Cache-Control": "no-cache, no-store, must-revalidate",
                 "Pragma": "no-cache", // For HTTP/1.0 caches
                 "Expires": "0" // For proxy caches
             }
         });
    }
    catch (error: any) {
        // Provide more context in the error message
        console.error(`Feeds Reader: Request failed for ${feedUrl}:`, error);
        const message = error?.message || (typeof error === 'string' ? error : 'Network request failed');
        throw new Error(`Failed to fetch feed (${feedUrl}): ${message}`);
    }
}


/** Main function to fetch and parse a feed. */
export async function getFeedItems(feedUrl: string): Promise<RssFeedContent | undefined> {
    let rawData: string;
    let doc: Document;

    try {
        rawData = await requestFeed(feedUrl);
    } catch (e: any) {
        // Notice already shown in requestFeed is preferable
        // new Notice(`Fetch failed for ${feedUrl}: ${e.message}`, 3000);
        return undefined;
    }

    try {
        const parser = new window.DOMParser();
        doc = parser.parseFromString(rawData, "application/xml");

        // Check for parser error more reliably
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
            console.error("XML Parsing Error:", parserError.textContent, `Feed: ${feedUrl}`);

            // Attempt to find alternate feed link in HTML
            try {
                const htmlDoc = parser.parseFromString(rawData, "text/html");
                const rssLink = htmlDoc.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');
                const altHref = rssLink?.getAttribute('href');

                if (altHref) {
                    try {
                        // Resolve relative URLs against the original feed URL
                        const altUrl = new URL(altHref, feedUrl).toString();
                        // Avoid infinite loops if the alternate is the same
                        if (altUrl !== feedUrl) {
                             new Notice(`XML parse failed. Trying alternate: ${altUrl}`, 4000);
                             // Recursively call getFeedItems with the alternate URL
                             return await getFeedItems(altUrl);
                        }
                    } catch (urlError) {
                        console.warn("Invalid alternate URL found in HTML:", altHref, urlError);
                    }
                }
            } catch (htmlParseError) {
                console.warn("Error parsing response as HTML to find alternate feed:", htmlParseError);
            }

            // If no alternate found or failed, show error notice
            new Notice(`Failed to parse feed XML: ${feedUrl}`, 3000);
            return undefined;
        }
    } catch (e) {
        console.error("DOMParser Error:", e, `Feed: ${feedUrl}`);
        new Notice(`Error parsing feed: ${feedUrl}`, 3000);
        return undefined;
    }

    // Define tag lists for clarity
    const feedTitleTags = ["title"];
    const feedLinkTags = ["link", "link#href"]; // Prioritize link with href attribute if present
    const feedDescTags = ["description", "subtitle", "itunes:summary"];
    // Broader image tag search including common patterns
    const feedImageTags = ["image > url", "image url", "image", "icon", "logo", "itunes:image#href"];
    const feedDateTags = ["pubDate", "updated", "lastBuildDate", "dc:date"]; // Include dc:date

    // Extract feed metadata
    const feedTitle = getContent(doc.documentElement || doc, feedTitleTags); // Use documentElement as root
    // Provide feedUrl as a fallback link
    const feedLink = normalizeUrl(getContent(doc.documentElement || doc, feedLinkTags)) || feedUrl;
    // Extract image, normalizing the result
    let feedImage = normalizeUrl(getContent(doc.documentElement || doc, feedImageTags));

    const items: RssFeedItem[] = [];
    const rawItems = getAllItems(doc); // Get all potential item elements

    rawItems.forEach((rawItem) => {
        try {
            const item = buildItem(rawItem);
            // Ensure essential fields are present before adding
            if (item.title && item.link) {
                 items.push(item);
            } else {
                 console.warn("Skipping item with missing title or link:", item, `Feed: ${feedUrl}`);
            }
        } catch (itemError) {
            console.error("Error building item:", itemError, `Element:`, rawItem, `Feed: ${feedUrl}`);
        }
    });

    // Construct the final RssFeedContent object
    const content: RssFeedContent = {
        // Provide a fallback title based on hostname if feed title is missing
        title: feedTitle || `Feed (${new URL(feedUrl).hostname})`,
        subtitle: getContent(doc.documentElement || doc, ["subtitle"]), // Keep subtitle specific
        link: feedLink,
        pubDate: getContent(doc.documentElement || doc, feedDateTags),
        image: feedImage || '', // Ensure image is always a string
        description: getContent(doc.documentElement || doc, feedDescTags),
        items: items,
        // These will be populated later by main.ts logic
        name: '',
        folder: '',
    };

    return content;
}