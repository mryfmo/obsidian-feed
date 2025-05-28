# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Claude Code Action (GitHub integration) when working with code in this repository.

## 📚 Essential Documentation

**IMPORTANT: Read these files to understand the workflow and constraints:**

1. **AGENTS.md** - Overview of the multi-agent system and all available documentation
2. **docs/agents/02_claude-code.md** - Detailed workflow, phases, and guardrails for Claude Code
3. **docs/agents/01_task-lifecycle.md** - Standard Task Protocol (STP) that must be followed
4. **docs/agents/00_common-rules.md** - Coding conventions and shared constraints

## 🛠️ Available Tools

**Guard and validation scripts in `tools/` directory:**
- `tools/turn_guard.sh` - Validates Claude output format and phase compliance
- `tools/fetch_doc.sh` - Safe document fetching (FETCH phase only)
- `tools/list_guards.sh` - Lists available guard checks
- `tools/gen_wbs.py` - Generates Work Breakdown Structure

## Essential Commands

```bash
# Development
pnpm dev          # Build and watch for changes
pnpm build        # Production build with TypeScript checking

# Testing
pnpm test         # Run all tests (unit + integration)
pnpm test:unit    # Unit tests only
pnpm test:int     # Integration tests only  
pnpm e2e          # Playwright end-to-end tests

# Code Quality
pnpm lint         # ESLint checking

# Common test patterns
pnpm test <filename>           # Run specific test file
pnpm test -- --watch          # Watch mode for tests
```

## Architecture Overview

This is an Obsidian plugin for reading RSS/Atom feeds. The codebase follows a service-oriented architecture with clear separation of concerns:

### Core Structure
- **Entry Point**: `src/main.ts` - FeedsReaderPlugin extends Obsidian's Plugin class
- **Main View**: `src/view.ts` - Custom ItemView implementing the feed reader UI
- **State Management**: Uses a state machine pattern (`src/stateMachine.ts`) for UI state transitions

### Service Layer
- **NetworkService** (`src/networkService.ts`): HTTP client wrapper using axios for feed fetching
- **ContentParserService** (`src/contentParserService.ts`): RSS/Atom parsing using rss-parser library
- **AssetService** (`src/assetService.ts`): Downloads and manages feed assets (images, etc.)
- **Data Layer** (`src/data.ts`): Persists feeds as gzipped JSON files in `.obsidian/plugins/contents-feeds-reader/data/`

### UI Components
Located in `src/view/components/`, these are custom components without external UI framework:
- `FeedNavigationComponent`: Collapsible feed navigation sidebar
- `FeedItemsListComponent`/`FeedItemsCardComponent`: Display feed items
- `ControlsBarComponent`: Pagination and controls
- `ItemActionButtons`: Per-item actions (read, jot, snippet, etc.)

### Key Patterns
- **Command Pattern**: All user actions registered via Obsidian's command palette
- **Modal Pattern**: Add/manage feeds via custom Modal subclasses
- **Event-Driven**: Uses Obsidian's event system for plugin lifecycle
- **TypeScript Strict**: Full type safety with Zod validation for external data

## Development Notes

- **Build System**: Uses esbuild for fast bundling, configured for CommonJS output
- **Testing**: Vitest workspace separates unit/integration tests; Playwright for E2E with Electron stubs
- **Mocking**: Obsidian API mocked in `tests/__mocks__/obsidian.ts`
- **File Storage**: Feed data stored as `<feedName>.json.gz` files, not in vault notes
- **API Integration**: Optional Claude integration for article summarization (requires API key in settings)

## GitHub Integration

### Claude Code Action
This repository uses Claude Code Action for automated code review and interactive development:
- **Trigger**: Mention `@claude` in issues, PRs, or comments
- **Workflow**: `.github/workflows/claude.yml`
- **Required Secrets**: 
  - `CLAUDE_ACCESS_TOKEN`
  - `CLAUDE_REFRESH_TOKEN`
  - `CLAUDE_EXPIRES_AT`

### Workflow Guidelines
When working with Claude Code Action:
1. Follow the STP (Standard Task Protocol) defined in `docs/agents/01_task-lifecycle.md`
2. Use phase labels (FETCH, INV, ANA, PLAN, BUILD, VERIF, REL) in PR titles
3. Update task state transitions in commit messages or PR comments
4. Ensure all guardrails pass (`tools/turn_guard.sh`)

### Phase-Based Development Process

**7 Mandatory Phases** (see `docs/agents/02_claude-code.md` for details):
1. **FETCH** - Document/resource retrieval (network access allowed)
2. **INV** - Investigation, reproduce issues
3. **ANA** - Root cause analysis
4. **PLAN** - Create RFC, define scope
5. **BUILD** - Implementation (≤1000 LOC, ≤10 files)
6. **VERIF** - Testing and validation
7. **REL** - Release preparation

### CI/CD Workflows

**GitHub Actions in `.github/workflows/`:**
- `claude.yml` - Main Claude Code Action workflow
- `label-sync.yml` - Enforces phase label consistency
- `stp-guard.yml` - Validates lifecycle artifacts
- `path-guard.yml` - Role-based path restrictions
- `guard-unit.yml` - Runs guard validation tests
- `ci.yml` - Standard CI pipeline