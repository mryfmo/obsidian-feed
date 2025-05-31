<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Claude Code Action (GitHub integration) when working with code in this repository.

## 🚨 CRITICAL SAFETY PROTOCOLS

**MANDATORY READING BEFORE ANY OPERATION:**

1. **claude-rules.json** - Machine-readable rules that MUST be enforced
2. **PERMISSIONS.md** - Operation permission levels and confirmation requirements
3. **CLAUDE_OPERATIONAL_PROTOCOL.md** - Detailed operation procedures and templates
4. **.claude/checks.json** - Automated safety checks and forbidden operations
5. **.mcp/operation-guard.ts** - Runtime operation validation

**ALL DESTRUCTIVE OPERATIONS (LEVEL 2+) REQUIRE EXPLICIT USER APPROVAL**

## ⚡ ENFORCEABLE DIRECTIVES

Claude MUST:
1. Check `claude-rules.json` before EVERY file system operation
2. Log ALL operations with level >= 2 to `.claude/audit.log`
3. Create backups before ANY destructive operation
4. STOP immediately if user types: STOP, CANCEL, or ABORT
5. NEVER execute forbidden operations listed in `claude-rules.json`

Claude MUST NOT:
1. Delete files without explicit approval (even if asked)
2. Modify config files without showing diff first
3. Execute commands containing: rm -rf /, git push --force, npm publish
4. Create or modify: .env files, private keys, credentials
5. Perform bulk operations without preview and confirmation

## 📚 Essential Documentation

**IMPORTANT: Read these files to understand the workflow and constraints:**

1. **AGENTS.md** - Overview of the multi-agent system and all available documentation
2. **.claude/docs/workflows/DEVELOPMENT.md** - 7-phase development process and guardrails
3. **.claude/docs/core/SAFETY.md** - Safety rules and security implementation
4. **.claude/docs/core/PRINCIPLES.md** - Core integration principles

## 🛠️ MCP (Model Context Protocol) Integration

This project uses official MCP servers for enhanced capabilities.

Configure Claude Desktop with:

### Required MCP Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/mryfmo/Sources/obsidian-feed"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": {
        "USER_AGENT": "Claude-Code-Fetcher/1.0"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

### MCP Server Usage Guidelines

1. **File Operations**: Use `filesystem` server instead of direct file access
2. **GitHub Integration**: Use `github` server for PR/issue management
3. **Document Fetching**: Use `fetch` server for web content retrieval
4. **Memory Management**: Use `memory` server for context persistence
5. **Complex Analysis**: Use `sequential-thinking` for step-by-step reasoning

### Shell Scripts (Current Implementation)

The following shell scripts are available:

- `tools/turn_guard.sh` → Validates Claude output format with ~10 guards implemented
- `tools/fetch_doc.sh` → Downloads documents to cache directory
- `tools/list_guards.sh` → Lists implemented validation guards
- `tools/gen_wbs.sh` → Generates work breakdown structure
- `tools/validate-stp-markers.sh` → Validates STP compliance

### Implementation Status

- ✅ **MCP Integration**: Basic implementation available in `.mcp/` directory
  - OperationGuard for safety validation
  - MCP server with tool definitions
  - TypeScript-based implementation
- ✅ Basic guard validation working (10 of 26 guards implemented)
- ✅ Shell script compatibility for macOS
- ⚠️ Phase transition validation not yet implemented
- ⚠️ Role-based access control not enforced in CI
- ⚠️ **Claude Configuration**: Not yet applied to main project (templates available in `docs/templates/claude/`)

To apply Claude integration to this project:
```bash
cd docs/templates/claude
./generate-claude-setup-complete.sh obsidian-feed plugin "Your Name" "email@example.com" MIT --all
```

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
- `mcp-validation.yml` - MCP integration health checks

## Development Guidelines

### Temporary Documentation

Use `.claude/tmp-docs/` directory for all temporary documentation:

- Work-in-progress guides
- Analysis reports
- Draft specifications
- Integration summaries

This directory is git-ignored. Move files to `docs/` when they're ready to be tracked.

### Code Quality Standards

As of 2025-01-30:

- **TypeScript**: Zero errors in both main and MCP modules
- **Tests**: All 174 tests passing (Main: 46, MCP: 128)
- **ESLint**: Reduced from 353 to 59 errors (83% improvement)
- **Architecture**: Zero circular dependencies
- **Type Safety**: All explicit `any` types replaced with proper types

Run `pnpm check:all` to verify all quality checks.

## Operation Safety Guidelines

### Destructive Operations (LEVEL 2+)

The following operations ALWAYS require explicit user confirmation:
- File deletion (`rm`, `git rm`)
- Directory deletion (`rm -rf`)
- File/directory renaming or moving (`mv`)
- Bulk find/replace operations
- Configuration file modifications

### Safe Operations (LEVEL 0-1)

The following can be performed without confirmation:
- Reading files (Read, Grep, LS tools)
- Creating new files (not overwriting)
- Editing existing file contents
- Running tests and builds
- Git status and diff commands

### Forbidden Operations

NEVER execute without explicit instruction:
- `rm -rf /` or any system directory deletion
- `git push --force`
- Direct `.env` file modifications
- Private key operations
- Package publishing commands

### Audit Trail

All operations are logged to:
- `.claude/runtime/audit.log` - Human-readable audit trail
- `.claude/runtime/rollback-registry.json` - Rollback information

### Emergency Procedures

If an operation goes wrong:
1. Check `.claude/rollback-registry.json` for rollback commands
2. Use git to restore files: `git checkout -- <file>`
3. Check `.claude/backups/` for file backups
4. Report the issue with operation ID from audit log

## Best Practices

1. **Always explain before executing** - Follow the EIA Protocol
2. **Batch operations need planning** - Present full plan before starting
3. **Uncertain means escalate** - When in doubt, ask for confirmation
4. **Maintain audit trail** - All LEVEL 2+ operations must be logged
5. **Test rollback plans** - Ensure recovery is possible before proceeding

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## 🚨 CRITICAL SAFETY ENFORCEMENT

**MANDATORY**: All operations MUST go through the OperationGuard validation:

```typescript
// ALL file operations MUST use these methods:
const mcp = new MCPIntegration();

// ✅ CORRECT - Uses guard validation
await mcp.readFile('/path/to/file');
await mcp.deleteFile('/path/to/file', 'Reason for deletion');

// ❌ WRONG - Bypasses safety checks
fs.unlinkSync('/path/to/file');  // NEVER do this
```

### Operation Levels (MUST respect):
- **LEVEL 0**: Read-only operations (auto-approved)
- **LEVEL 1**: Safe modifications (auto-approved)
- **LEVEL 2**: Destructive operations (REQUIRES user confirmation)
- **LEVEL 3**: System modifications (REQUIRES explicit approval)

### FORBIDDEN Operations (WILL be blocked):
- Deleting: `*.md`, `package.json`, `tsconfig.json`, `.gitignore`
- Deleting directories: `.git`, `.github`, `node_modules`, `src`, `docs`
- Executing: `rm -rf /`, `git push --force`, any publish commands

### MANDATORY Behaviors:
1. **EXPLAIN before destructive operations** with: operation, reason, impact, rollback
2. **CREATE backup** before modifying config files
3. **LOG all operations** with level >= 2 to audit trail
4. **STOP immediately** if user types STOP, CANCEL, or ABORT
5. **ASK for confirmation** for ANY operation marked as requiring confirmation

## 📁 File Organization

All Claude-specific files are organized under `.claude/`:

- `.claude/config/` - Configuration and rules
- `.claude/docs/` - Documentation and guides
- `.claude/runtime/` - Runtime files (audit logs, etc.)
- `.claude/tmp-docs/` - Temporary documentation
- `.claude/scripts/` - Claude-specific scripts

See `.claude/README.md` for details.
