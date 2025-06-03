<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Contents Feeds Reader - An Obsidian Plugin

Read, search and triage RSS / Atom (and soon YouTube & Podcast) feeds **inside Obsidian**.  
The plugin stores feed data in your vault so everything – including unread counts, snippets and “read later” notes – syncs with the rest of your knowledge base.

> **Heads-up:** This project is a heavily-refactored fork of _[obsidian-feed](https://github.com/fjdu/obsidian-feed) plugin by [Fujun Du](https://github.com/fjdu)_.<br>
> All issues fixed and features added since 0.0.2 are listed in [CHANGELOG](./CHANGELOG.md).

---

## ✨ Key Features

| Area                   | 0.0.4 Highlights                                                      |
| ---------------------- | --------------------------------------------------------------------- |
| **Reader UI**          | Collapsible nav-pane, per-item action bar, keyboard shortcuts         |
| **Feed Management**    | Add / remove feeds, bulk refresh, unread counters                     |
| **Search**             | In-feed keyword search with instant filtering                         |
| **Ask GPT**            | Send article text to GPT-4 / GPT-3.5 for summary or custom prompt     |
| **Math Support**       | Render LaTeX via KaTeX on demand                                      |
| **Full-Content Fetch** | Try to retrieve the original article when feeds provide only excerpts |
| **Offline-first**      | Data saved as gzipped JSON fragments → efficient sync & diff          |
| **Tests & CI**         | Vitest unit tests + Playwright E2E scripts included                   |

---

## 🛠 Installation

### 1. Obsidian BRAT (recommended)

1. Install the _Community Plugins_ “BRAT” (Beta Reviewers Auto-update Tool).
2. In BRAT ➜ **Add Beta Plugin** ➜ paste

```

[https://github.com/your-username/contents-feeds-reader](https://github.com/your-username/contents-feeds-reader)

```

3. Enable **Contents Feeds Reader** in Obsidian’s _Community Plugins_ list.

### 2. Manual

1. Download the latest release `.zip` from GitHub.
2. Unzip to `<vault>/.obsidian/plugins/contents-feeds-reader/`.
3. Reload Obsidian → _Settings ▸ Community Plugins_ → enable the plugin.

#### Upgrading from Previous Versions
1. Close Obsidian
2. Navigate to your vault's `.obsidian/plugins/` directory
3. Rename the plugin folder to `contents-feeds-reader` (regardless of current name)
4. Restart Obsidian

Note: The plugin ID has been standardized to `contents-feeds-reader` since v0.0.1

---

## 🚀 Quick Start

1. Click the **RSS** ribbon icon (left side-bar).
2. Use **➕ Add Feed** to register one or more feed URLs.
3. Hit **🔄 Refresh** or wait for the scheduled auto-refresh (default 30 min).
4. Click any item → read, jot a note, or open the original link.

See also the in-app **? Help** command palette entry.

---

## 📚 Documentation

Need in-depth, always-up-to-date docs?  
Explore the interactive DeepWiki instead ↓

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mryfmo/obsidian-feed)

---

## ⚙️ Settings

| Setting        | Description                                                |
| -------------- | ---------------------------------------------------------- |
| Items per page | 10-100 (default 20)                                        |
| Default sort   | New → Old / Old → New / Random                             |
| Show buttons   | Toggle visibility of each action icon (Jot/Snippet/Math …) |
| GPT API key    | Required for **Ask GPT**                                   |
| Math rendering | Enable KaTeX block/inline parsing                          |
| Auto refresh   | Interval in minutes for background fetch                   |

---

## 🗺 Roadmap

Planned work is tracked in [TODO.md](./TODO.md); major milestones:

1. ✅ 0.0.4 – MCP integration, type safety, circular dependency fixes (Released)
2. 0.0.5 – Stability improvements, GitHub issue resolution
3. 0.0.6 – LLM integration, YouTube/Podcast support, advanced features

---

## 🔧 MCP Integration

This project features a complete Model Context Protocol (MCP) integration that enhances the development workflow.

**Status**: Production Ready - All core features implemented and tested.

**Key Features**:

- ✅ 26 validation guards with intelligent fallback (all implemented)
- ✅ 5 MCP servers integrated (filesystem, github, memory, sequential-thinking, context7)
- ✅ Complete shell script compatibility maintained (including macOS fixes)
- ✅ 7-phase development workflow (FETCH→INV→ANA→PLAN→BUILD→VERIF→REL)
- ✅ True integration (真の統合) - hybrid architecture preserving existing value
- ✅ Performance optimization with caching (TTL & LRU eviction)
- ✅ Complete test coverage (122 tests, all passing)

**Latest Updates (2025-01-30)**:

- Complete MCP integration with 26 validation guards
- Advanced workflow automation with automatic phase transitions
- Interactive CLI interface for enhanced developer experience
- All tests passing (174 total: 128 MCP + 46 main project)
- Full documentation updates and version bump to 0.0.4

### MCP Benefits for Users

**For Developers:**

- Enforced code quality through automated validation
- Guided workflow ensures consistent development practices
- Intelligent caching reduces build and test times
- Enhanced debugging with MCP-powered analysis

**For Contributors:**

- Clear phase-based workflow (no guesswork)
- Automatic GitHub integration (labels, checks)
- Built-in documentation fetching (Context7)
- AI-powered code analysis and suggestions

**For End Users:**

- Higher quality releases due to strict validation
- Faster bug fixes with structured workflow
- Better tested features (enforced coverage)
- More stable plugin experience

---

## 🔨 Development

### Dependencies
- **Obsidian**: 1.8.7+ (uses Electron ~26.x)
- **Electron**: 34.3.0 in devDependencies for future compatibility testing
- **Node.js**: 16.x or higher
- **pnpm**: 8.x recommended

### Build Instructions
```bash
# Install dependencies
pnpm install

# Development build with watch mode
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Generate API documentation
pnpm docs:api

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run all checks (typecheck + lint + test + coverage)
pnpm check:all
```

## 📝 License

This project uses a dual-license approach:

- **Source Code** (*.ts, *.js, *.css, etc.): GNU General Public License v3.0 or later - see [`LICENSE`](./LICENSE)
- **Documentation** (*.md files, docs/, etc.): MIT License - see [`LICENSE-MIT`](./LICENSE-MIT)

For details, see [`LICENSE-NOTICE`](./LICENSE-NOTICE).
