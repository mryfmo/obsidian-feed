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

## 📝 License

GNU GENERAL PUBLIC LICENSE Version 3 – see [`license`](./license).