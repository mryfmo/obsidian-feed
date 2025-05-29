# Contents Feeds Reader - An Obsidian Plugin

Read, search and triage RSS / Atom (and soon YouTube & Podcast) feeds **inside Obsidian**.  
The plugin stores feed data in your vault so everything – including unread counts, snippets and “read later” notes – syncs with the rest of your knowledge base.

> **Heads-up:** This project is a heavily-refactored fork of *[obsidian-feed](https://github.com/fjdu/obsidian-feed) plugin by [Fujun Du](https://github.com/fjdu)*.<br>
> All issues fixed and features added since 0.0.2 are listed in [CHANGELOG](./CHANGELOG.md).

---

## ✨ Key Features

| Area | 0.0.3 Highlights |
|------|------------------|
| **Reader UI** | Collapsible nav-pane, per-item action bar, keyboard shortcuts |
| **Feed Management** | Add / remove feeds, bulk refresh, unread counters |
| **Search** | In-feed keyword search with instant filtering |
| **Ask GPT** | Send article text to GPT-4 / GPT-3.5 for summary or custom prompt |
| **Math Support** | Render LaTeX via KaTeX on demand |
| **Full-Content Fetch** | Try to retrieve the original article when feeds provide only excerpts |
| **Offline-first** | Data saved as gzipped JSON fragments → efficient sync & diff |
| **Tests & CI** | Vitest unit tests + Playwright E2E scripts included |

---

## 🛠 Installation

### 1. Obsidian BRAT (recommended)
1. Install the *Community Plugins* “BRAT” (Beta Reviewers Auto-update Tool).
2. In BRAT ➜ **Add Beta Plugin** ➜ paste  
```

[https://github.com/your-username/contents-feeds-reader](https://github.com/your-username/contents-feeds-reader)

```
3. Enable **Contents Feeds Reader** in Obsidian’s *Community Plugins* list.

### 2. Manual
1. Download the latest release `.zip` from GitHub.
2. Unzip to `<vault>/.obsidian/plugins/contents-feeds-reader/`.
3. Reload Obsidian → *Settings ▸ Community Plugins* → enable the plugin.

> Upgrading from **0.0.2**?  
> Rename the folder from `obsidian-feed` to `contents-feeds-reader` before copying, or Obsidian will think it’s a new plugin.

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

| Setting | Description |
|---------|-------------|
| Items per page | 10-100 (default 20) |
| Default sort | New → Old / Old → New / Random |
| Show buttons | Toggle visibility of each action icon (Jot/Snippet/Math …) |
| GPT API key | Required for **Ask GPT** |
| Math rendering | Enable KaTeX block/inline parsing |
| Auto refresh | Interval in minutes for background fetch |

---

## 🗺 Roadmap

Planned work is tracked in [TODO.md](./TODO.md); major milestones:

1. 0.0.4 – feed-group folders, keyboard-only triage  
2. 0.0.5 – text-to-speech playback, YouTube channel ingestion  
3. 0.0.6 – Podcast OPML import & in-app audio player

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

**Latest Updates (2025-01-29)**:
- Fixed all module resolution issues
- Enhanced shell scripts for macOS compatibility
- Implemented specialized guards (RFC-OK, WBS-OK)
- Added comprehensive test suite for MCP components

---

## 📝 License

GNU GENERAL PUBLIC LICENSE Version 3 – see [`LICENSE`](./LICENSE).