# TODO.md

### In Progress

**v0.0.5 (Post-MCP Integration & Future Enhancements)**

- [ ] Support for summarization and translation functions using large language models (LLMs) (beyond existing Claude API).
- [ ] Google Gemini Support for summarization/translation.
- [ ] Further refine "Fetch Full Content" using advanced article extraction heuristics.
- [ ] Text-to-speech support for feed item content.

### Done ✓

**v0.0.4**

- [x] **MCP (Model Context Protocol) Integration:**
  - [x] Complete implementation of 26 validation guards
  - [x] Integration with 5 official MCP servers
  - [x] Enhanced shell scripts with MCP fallback capability
  - [x] Advanced workflow automation (auto phase transitions)
  - [x] Interactive CLI interface
  - [x] Performance optimization with intelligent caching
  - [x] Full test coverage (128 MCP tests + 46 main tests)
  - [x] macOS compatibility fixes for all shell scripts
  - [x] CI/CD integration with MCP validation
- [x] Finalize and stabilize core parsing, fetching, and data handling logic from v0.0.3.
- [x] Comprehensive unit and E2E testing for refactored components.

**v0.0.3**

- [x] **Core Functionality Overhaul & Refactoring:**
  - [x] **Enhanced Feed Parsing & Fetching:**
    - [x] Integrate `rss-parser` library for improved RSS/Atom compatibility. (Status: In Progress / Partially Done)
    - [x] Integrate `axios` for robust HTTP requests. (Status: In Progress / Partially Done)
    - [x] Improve "Fetch Full Content" with `cheerio`/`domhandler`. (Status: Planning / Early Implementation)
  - [x] **Major Code Refactoring:**
    - [x] Restructure project files and modules for better organization.
    - [x] Refactor core classes (e.g., `FeedsReaderView`, data handling logic) to improve separation of concerns.
    - [x] Reduce reliance on global state (`GLB`) by localizing state or using alternative patterns.
    - [x] Improve type safety and interfaces throughout the codebase.
- [x] Supports grid/list view of content list (if still planned for this cycle, or defer)
- [x] Supports switching the display position of content display (if still planned for this cycle, or defer)

**v0.0.2**

- [x] Iconification support.

**v0.0.1**

- [x] Fixed build errors.

### Todo (Future Sprints / Versions)

**v0.0.5**

- [ ] Text-to-speech support for feed item content.
- [ ] Investigate and implement basic support for YouTube channel feeds (fetching video lists, titles, descriptions).

**v0.0.6**

- [ ] Support for YouTube and Podcast playback directly within Obsidian.
- [ ] Explore options for Podcast feed parsing and episode management.

### Future Considerations / Backlog

- [ ] Advanced content sanitization options.
- [ ] More sophisticated content transformation rules.
- [ ] Offline caching of fetched full content.
- [ ] Integration with read-it-later services.
- [ ] Plugin API for extensibility by other plugins.
