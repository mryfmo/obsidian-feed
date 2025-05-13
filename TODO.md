# TODO.md

### In Progress

**v0.0.3**
- [ ] **Core Functionality Overhaul & Refactoring:**
    - [ ] **Enhanced Feed Parsing & Fetching:**
        - [ ] Integrate `rss-parser` library for improved RSS/Atom compatibility. (Status: In Progress / Partially Done)
        - [ ] Integrate `axios` for robust HTTP requests. (Status: In Progress / Partially Done)
        - [ ] Improve "Fetch Full Content" with `cheerio`/`domhandler`. (Status: Planning / Early Implementation)
    - [ ] **Major Code Refactoring:**
        - [ ] Restructure project files and modules for better organization.
        - [ ] Refactor core classes (e.g., `FeedsReaderView`, data handling logic) to improve separation of concerns.
        - [ ] Reduce reliance on global state (`GLB`) by localizing state or using alternative patterns.
        - [ ] Improve type safety and interfaces throughout the codebase.
- [ ] Supports grid/list view of content list (if still planned for this cycle, or defer)
- [ ] Supports switching the display position of content display (if still planned for this cycle, or defer)

### Done ✓

**v0.0.2**
- [x] Iconification support.

**v0.0.1**
- [x] Fixed build errors.

### Todo (Future Sprints / Versions)

**v0.0.4 (Post-Refactoring & Core Enhancements)**
- [ ] Finalize and stabilize core parsing, fetching, and data handling logic from v0.0.3.
- [ ] Support for summarization and translation functions using large language models (LLMs) (beyond existing ChatGPT).
- [ ] Google Gemini Support for summarization/translation.
- [ ] Further refine "Fetch Full Content" using advanced article extraction heuristics.
- [ ] Comprehensive unit and E2E testing for refactored components.

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