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

