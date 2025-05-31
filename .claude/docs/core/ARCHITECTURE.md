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
