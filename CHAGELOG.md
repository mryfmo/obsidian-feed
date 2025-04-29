# Changelog

## [0.0.1] - YYYY-MM-DD

This version represents a fork or renaming of the original `obsidian-feed-master` plugin (v1.2.0) by `fjdu`. The project ownership and identity have changed.

### BREAKING CHANGES

*   **Plugin ID Changed:** Renamed from `rss-feeds-reader` to `contents-feeds-reader`. Obsidian will treat this as a new, separate plugin.
*   **Plugin Name Changed:** Renamed from "Feeds Reader" to "Contents Feeds Reader".
*   **Author Changed:** Changed from `fjdu` to `mryfmo`.
*   **Author URL Changed:** Updated to `https://mryfmo.github.io`.
*   **Funding URL Changed:** Updated to `https://www.buymeacoffee.com/mryfmo`.
*   **Version Reset:** Version number reset from `1.2.0` (in manifest of master) / `1.0.0` (in package.json of master) to `0.0.1`.

### Changed

*   **Description Updated:** Plugin description expanded in `manifest.json` and `package.json` to mention "RSS/Atom, YouTube, Podcasts, and other contents", although the provided source code snippets primarily show RSS functionality similar to the original. [5, 6, 10, 11]
*   **Dependencies:** Updated `esbuild` development dependency from `0.14.47` to `0.17.3`. [6, 11]
*   **Code Refactoring & Typing:**
    *   Applied stricter TypeScript typings across various files (`src/getFeed.ts`, `src/main.ts`, `src/globals.ts`), including optional properties (`?`), null checks, union types (`string | null`), and type assertions (`as HTMLElement`, `as HTMLInputElement`, etc.). [7, 12, 13, 16, 17, 18]
    *   Updated code to use newer Obsidian API patterns (e.g., `this.app.vault.adapter.exists`, `cls` property in `createEl`). [16, 17]
    *   Added more robust checks for element existence before manipulation (e.g., `if (element) ...`). [16]
    *   Used optional chaining (`?.`) and nullish coalescing (`??`) in places. [16]
*   **Internal Naming:** Updated package name in `package.json` to `obsidian-contents-feeds-reader`. [11]
*   **Project References:** Updated internal references and links in `README.md` to reflect the new project name/author (e.g., issue links, acknowledgments). [10]
*   **Data Handling:** `RssFeedContent` interface now includes `name` and `folder` properties; `image` property allows `null`. `RssFeedItem` properties `content` and `creator` are now optional. [7]

### Added

*   **CompressionStream/DecompressionStream Types:** Added type declarations for these browser APIs at the top of `src/main.ts` for compatibility. [16]
*   *(Note: While the description was updated to include YouTube/Podcasts, no specific implementation for these features is present in the provided source code snippets.)*

### Fixed

*   Improved code robustness through stricter type checking and null checks in DOM manipulation and event handling. [16]

### Meta

*   **License:** Both versions include a `license` file containing the GNU General Public License v3. [2, 9] However, both `package.json` files incorrectly list the license as "MIT". [6, 11] The GPLv3 from the `license` file likely represents the intended license.
*   **README/Docs:** `README.md` structure and core feature descriptions remain largely the same as `obsidian-feed-master`, except for updated project links/names. [1, 10]
*   **Styles:** `styles.css` remains unchanged. [14, 15]
*   **TypeScript Config:** `tsconfig.json` remains unchanged. [8, 12]
*   **Versions File:** `versions.json` updated to reflect the new version `0.0.1`. [4, 13]