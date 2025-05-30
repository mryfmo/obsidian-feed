# Changelog

## [0.0.4] – 2025-05-31

### Added

- **MCP (Model Context Protocol) Integration**
  - Complete implementation with 26 validation guards
  - 5 official MCP servers integrated (filesystem, github, memory, sequential-thinking, context7)
  - Enhanced shell scripts with intelligent MCP fallback
  - Advanced workflow automation with automatic phase transitions
  - Interactive CLI interface for enhanced developer experience
  - Performance optimization with caching (TTL & LRU eviction)
  - Full test coverage (128 tests for MCP components)

- **View Component Interface System**
  - New `IFeedsReaderView` interface to break circular dependencies
  - Improved type safety across all view components

### Fixed

- **Shell Script Compatibility**
  - Fixed macOS compatibility issues (grep -P → POSIX patterns)
  - Fixed SHA validation to use content hash instead of URL hash

- **TypeScript Errors**
  - Fixed template literal syntax errors in main.ts
  - Resolved duplicate type definitions in MCP module
  - Fixed type compatibility issues between modules

- **Test Failures**
  - Fixed timeout issues in getFeed.spec.ts tests
  - Fixed failing Context7 test with proper mock setup

### Changed

- **Code Quality Improvements**
  - TypeScript: Achieved zero errors in both main and MCP modules
  - Type Safety: Replaced all explicit `any` types with proper types
  - Architecture: Resolved ALL circular dependencies
  - ESLint: Zero errors in production code (only dev dependency warnings remain)
  - Added explicit return types to all functions
  - Enhanced security with proper input validation and sanitization
  - Fixed references to non-existent documentation files
  - Proper exit code propagation for all guards

- **Development Workflow**
  - 7-phase workflow now enforced via MCP integration
  - Automatic GitHub label updates based on phase transitions
  - Enhanced CI/CD with MCP validation support
  - All tests passing (174 total tests: 46 main + 128 MCP)

### Technical Details

- **New Directory Structure**
  - `.mcp/` - Complete MCP integration layer
  - `.mcp/tests/` - Comprehensive test suite
  - `.mcp/CLAUDE_CODE_BEST_PRACTICES.md` - Developer guidelines
  - `src/view/types.ts` - New interface definitions for view components

- **Cleanup**
  - Removed empty directories
  - Cleaned up temporary files (.DS_Store)
  - Updated .gitignore for better coverage

## [0.0.3] – 2025-05-18

### Added

- **Complete project restructure**
  - Introduced a lightweight DI container (`ioc/`) and split large monoliths into discrete service / view / modal modules.
  - New UI components
    - **Add Feed**, **Manage Feeds**, **Search**, and **Chat/GPT** modals.
    - Item-level **Action Buttons**: `Jot`, `Snippet`, `Save`, `Math`, `Ask GPT`, `Embed`, `Fetch`, `Link`, `Delete`.
  - **Ask GPT (🧠)** integration – requires an OpenAI API key; prompt configurable in settings.
  - **Math‐Jax / KaTeX** rendering toggle for feeds containing LaTeX.
  - **Full-content fetch** (experimental) with fallback to _embed_ if iframe-blocking detected.
  - **Unit tests** (Vitest) and **end-to-end tests** (Playwright); fixture & result snapshots added.
  - **Rollup build pipeline** (TypeScript-first) and **eslint.config.js** migration; CI-friendly script set (`dev`, `lint`, `test`, `build`).
  - **Dep-check / type-check** configs for safer dependency management.
  - **CHANGELOG.md** and **TODO.md** are now first-class docs.

### Changed

- **Feed engine**
  - Replaced ad-hoc parser with `rss-parser`, improving RSS 2.0 & Atom 1.0 compatibility.
  - Switched requests to `axios` + Obsidian `request` helper for better error handling and timeout control.
  - Content sanitizer tightened to strip script/style and remote‐image “safe URL” whitelist.
- **UI/UX**
  - Default ribbon icon switched to Obsidian’s standard `rss`; all buttons now use lucide-react icons with hover tool-tips.
  - Pagination logic moved to a dedicated `PaginationComponent`; page size now user-configurable (default 20).
  - Global state (`GLB`) minimised; most view state is local or DI-scoped.
- **Project metadata**
  - Manifest, `package.json`, and `versions.json` bumped to **0.0.3**.
  - Plugin ID renamed to `contents-feeds-reader` (ensure manual folder rename when upgrading manually).

### Fixed

- Incorrect handling of `<description>` in some Atom feeds.
- Embedding failures on iOS due to missing `allow="clipboard-write"` attr.
- Numerous TypeScript `no-implicit-any` / `strictNullChecks` violations.
- Rare race condition causing duplicate “mark read” events.
- E2E regression where navigation pane could not re-open after rapid toggling.

### Removed

- Legacy `.eslintrc`, `.eslintignore`, and in-source global DOM helper polyfills (now replaced by utility functions).

---

## [0.0.2] - 2025-04-30

### Changed

- **UI Overhaul (Icons):** Replaced most text-based buttons in the navigation bar ("Manage" section) and item action lists with icons provided by the Obsidian API (`setIcon`). Tooltips (`title` attribute) were added for clarity. [16, 1]
- **Styling Update:** Adjusted `styles.css` to accommodate the new icon-based buttons, consolidating styling rules and using CSS variables for colors and hover effects. [1]
- **Event Handling Refactoring:**
  - Moved most item-specific event handling logic (like toggle read/delete, jot, save snippet, embed, fetch, etc.) from the main `plugin.ts` into the `FRView` class (`view.ts`), attaching the listener specifically to the content area. [15, 16]
  - Updated event handlers to use `target.closest()` for more reliable detection of clicks on icon buttons. [15, 16]
  - The main `plugin.ts` event listener now primarily handles the top-level navigation/manage buttons. [15]
- **Code Structure:** Moved several helper functions (`getNumFromId`, `nowdatetime`, `str2filename`, `unEscape`, `handle_img_tag`, `handle_a_tag`, `handle_tags`, `remedyLatex`) from `main.ts` to `view.ts`. [15, 16]
- **Dependencies & Metadata:** Updated version number in `manifest.json`, `package.json`, and `versions.json` to `0.0.2`. [12, 11, 10]
- **Feed Parsing:** Re-added the `description` field parsing within the `buildItem` function in `src/getFeed.ts`. [14]
- **Ribbon Icon:** Changed the plugin's ribbon icon from the custom circle to the standard `rss` icon. [15]

### Fixed

- Improved reliability of button clicks by using `target.closest()` in event listeners, especially for the new icon buttons. [15, 16]

---

## [0.0.1] - 2024-04-30

This version represents a fork or renaming of the original `obsidian-feed-master` plugin (v1.2.0) by `fjdu`. The project ownership and identity have changed.

### BREAKING CHANGES

- **Plugin ID Changed:** Renamed from `rss-feeds-reader` to `contents-feeds-reader`. Obsidian will treat this as a new, separate plugin.
- **Plugin Name Changed:** Renamed from "Feeds Reader" to "Contents Feeds Reader".
- **Author Changed:** Changed from `fjdu` to `mryfmo`.
- **Author URL Changed:** Updated to `https://mryfmo.github.io`.
- **Funding URL Changed:** Updated to `https://www.buymeacoffee.com/mryfmo`.
- **Version Reset:** Version number reset from `1.2.0` (in manifest of master) / `1.0.0` (in package.json of master) to `0.0.1`.

### Changed

- **Description Updated:** Plugin description expanded in `manifest.json` and `package.json` to mention "RSS/Atom, YouTube, Podcasts, and other contents", although the provided source code snippets primarily show RSS functionality similar to the original. [5, 6, 10, 11]
- **Dependencies:** Updated `esbuild` development dependency from `0.14.47` to `0.17.3`. [6, 11]
- **Code Refactoring & Typing:**
  - Applied stricter TypeScript typings across various files (`src/getFeed.ts`, `src/main.ts`, `src/globals.ts`), including optional properties (`?`), null checks, union types (`string | null`), and type assertions (`as HTMLElement`, `as HTMLInputElement`, etc.). [7, 12, 13, 16, 17, 18]
  - Updated code to use newer Obsidian API patterns (e.g., `this.app.vault.adapter.exists`, `cls` property in `createEl`). [16, 17]
  - Added more robust checks for element existence before manipulation (e.g., `if (element) ...`). [16]
  - Used optional chaining (`?.`) and nullish coalescing (`??`) in places. [16]
- **Internal Naming:** Updated package name in `package.json` to `obsidian-contents-feeds-reader`. [11]
- **Project References:** Updated internal references and links in `README.md` to reflect the new project name/author (e.g., issue links, acknowledgments). [10]
- **Data Handling:** `RssFeedContent` interface now includes `name` and `folder` properties; `image` property allows `null`. `RssFeedItem` properties `content` and `creator` are now optional. [7]

### Added

- **CompressionStream/DecompressionStream Types:** Added type declarations for these browser APIs at the top of `src/main.ts` for compatibility. [16]
- _(Note: While the description was updated to include YouTube/Podcasts, no specific implementation for these features is present in the provided source code snippets.)_

### Fixed

- Improved code robustness through stricter type checking and null checks in DOM manipulation and event handling. [16]

### Meta

- **License:** Both versions include a `license` file containing the GNU General Public License v3. [2, 9] However, both `package.json` files incorrectly list the license as "MIT". [6, 11] The GPLv3 from the `license` file likely represents the intended license.
- **README/Docs:** `README.md` structure and core feature descriptions remain largely the same as `obsidian-feed-master`, except for updated project links/names. [1, 10]
- **Styles:** `styles.css` remains unchanged. [14, 15]
- **TypeScript Config:** `tsconfig.json` remains unchanged. [8, 12]
- **Versions File:** `versions.json` updated to reflect the new version `0.0.1`. [4, 13]
