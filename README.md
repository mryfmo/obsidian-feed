# Contents Feeds Reader - An Obsidian Plugin

This plugin allows you to read and manage RSS/Atom feeds directly within Obsidian. The goal is to provide a way to consolidate various content sources and save important items locally as notes.

While currently focused on RSS/Atom feeds, future development aims to expand support for other content types like YouTube channels and Podcasts (see [TODO.md](./TODO.md) for planned features).

This plugin is a fork and significant modification of the original [obsidian-feed](https://github.com/fjdu/obsidian-feed) plugin by [Fujun Du](https://github.com/fjdu), addressing various issues and adding new functionalities.

## How it works

- It creates an icon in the left sidebar (for the mobile version the icon is located in the bottom right pop-up menu).
- The first time you use it, you need to manually add RSS/Atom feed sources.
- It creates nested folders `feeds-reader/feeds-store/` in the current vault's plugin settings directory (`.obsidian/plugins/feeds-reader` or similar). All the saved items (`.md` files) are stored in `feeds-reader`, and all the feeds data (`.json.frag.gzip` files, i.e. gzipped json fragments.) are saved in `feeds-reader/feeds-store/`.
- The top-left `>` icon (or `panel-left-close`/`panel-left-open` icon) is for toggling the feed list sidebar (navigation panel). This is useful when reading on a small screen.
- The `Search` icon (🔍) allows searching for one or more keywords (separated by space) within the currently selected feed.
- The `Unread only`/`Show all` toggle icon (`filter-x`/`filter`) is for switching between displaying only unread items or all items (Note: items marked as "read" or "deleted" are considered not unread).
- The `Title only`/`Show content` toggle icon (`layout-list`/`layout-grid`) is for switching whether to show the full content of each item below its title. Glancing over titles is often enough to decide whether to read an article in detail.
- The `Sort order` icon (`sort-desc`/`sort-asc`/`shuffle`) cycles the display order through `New to old`, `Old to new`, and `Random`.
- The `Save data` icon (💾) is for manually saving the current state of your feeds (read/deleted markers) to disk, preventing accidental loss of reading progress. Data is also typically saved automatically when switching feeds or closing Obsidian.
- The `Update all` icon (🔄) fetches new items for all subscribed feeds.
- The `Undo` icon (↩️) undoes the most recent `mark as read`/`unread` or `delete`/`restore` actions for the **currently selected feed**.
- The `Add feed` icon (➕) opens a dialog to add new feed subscriptions (RSS/Atom URLs). Shorter, unique feed names are preferred.
   - *Be careful with the feed provider! While feed content is sanitized using Obsidian's `sanitizeHTMLToDom` API, always subscribe to trusted sources.*
   - Displaying rich HTML content (including links, images, basic formatting) is preferred over plain text to preserve the reading experience.
- The `Manage` icon (⚙️) opens a dialog for managing your feeds, where you can mark all items in a feed as read, permanently purge items marked as deleted, or remove all items and data for a feed. **Be cautious, as these actions cannot be easily undone.**
- All the subscribed feed sources are listed in the navigation panel on the left.
- The number of unread items is displayed next to the feed name. Click the feed name to select it and view its items.
- For each displayed item, action icons allow you to:
    - `Mark Read/Unread` (📖/🔖): Toggle the read status.
    - `Delete/Restore` (🗑️/⏳): Mark the item as deleted or restore it.
    - `Save Note` (💾): Create a standalone `.md` note for the item in the `feeds-reader` folder.
    *   `Open Link` (🔗): Open the item's original URL in your default browser.
    *   `Jot Note` (✏️): (Functionality may be basic or pending implementation) Quickly jot down notes related to the item.
    *   `Save Snippet` (✂️): Append a snippet (e.g., title, link, excerpt) of the item to a central `snippets.md` file.
    *   `Fetch Full Content` (☁️): (Experimental) Attempt to download and display the full content from the item's link, replacing the potentially truncated feed content. Success varies greatly depending on the website.
    *   `Ask GPT` (🧠): (Requires OpenAI API Key in settings) Send the item's content (text only) to ChatGPT for summarization or other defined tasks based on your prompt.
- The display of action buttons (`Jot`, `Snippet`, `Save`, `Math`, `GPT`, `Embed`, `Fetch`, `Link`, `Delete`) can be configured in the plugin settings.
- Math rendering (via MathJax/KaTeX) can be enabled in settings for feeds containing LaTeX.
- Items are paginated (default 20 items per page, configurable in settings). Use `j` (next page) and `k` (previous page) hotkeys (configurable via Obsidian's hotkey settings) or potentially future pagination buttons to navigate.
- Feeds data is saved locally as gzipped, potentially fragmented JSON files (`.frag.gzip`). Fragmentation aims to improve sync efficiency by only updating files containing new data.

## Acknowledgment
This plugin heavily utilizes and builds upon the parsing logic and core ideas from the [RSS Reader](https://github.com/joethei/obsidian-rss) plugin by [Johannes Theiner](https://github.com/joethei), with significant modifications and additions.

## Known issues:

- Some item URLs might not be embeddable in Obsidian mobile due to platform limitations.
- The "Fetch Full Content" feature is experimental and may not work reliably for all websites due to varying site structures and potential anti-scraping measures.
- Complex HTML or scripts within feed content, despite sanitization, might occasionally cause display issues.
- Atom feed parsing for complex `content` types (e.g., XHTML) or deeply nested author information might still have limitations.