<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Claude Code Action (GitHub integration) when working with code in this repository.

## 🚨 CRITICAL SAFETY PROTOCOLS

**MANDATORY READING BEFORE ANY OPERATION:**

1. **.claude/config/consolidated-safety-rules.json** - Unified safety rules and validations
2. **.claude/config/permissions.md** - Operation permission levels and confirmation requirements
3. **.claude/docs/workflows/OPERATIONS.md** - Detailed operation procedures and templates
4. **.claude/mcp-integration/operation-guard.ts** - Runtime operation validation
5. **.claude/docs/standards/WORKSPACE-HIERARCHY.md** - Workspace organization standards

**ALL DESTRUCTIVE OPERATIONS (LEVEL 2+) REQUIRE EXPLICIT USER APPROVAL**

## 🔄 Two Complementary Processes

This project uses two distinct processes that work together:

### 1. **7-Phase Development Lifecycle** (Strategic Work Management)
**Purpose**: Structure complete work items from inception to release  
**Phases**: FETCH → INV → ANA → PLAN → BUILD → VERIF → REL  
**Used for**: GitHub issues, features, bugs, enhancements  
**Duration**: Hours to days per work item  
**Details**: See `docs/agents/01_task-lifecycle.md`

### 2. **7-Step Execution Cycle** (Tactical Operation Safety)
**Purpose**: Ensure every file operation is safe and reversible  
**Steps**: BACKUP → CONFIRM → EXECUTE → VERIFY → EVALUATE → UPDATE → CLEANUP  
**Used for**: All file operations, git commands, system changes  
**Duration**: Seconds to minutes per operation  
**MANDATORY**: Every operation MUST follow this cycle based on its security level

### How They Work Together
During any development phase (especially BUILD), each file operation automatically triggers the execution cycle. For example:
- In BUILD phase, editing a file → triggers 7-step cycle
- In VERIF phase, running tests → triggers appropriate cycle steps
- The execution cycle operates WITHIN the development lifecycle

**Quick Reference**: See `.claude/README.md` for navigation or `.claude/docs/concepts/dual-process-model.md` for detailed explanation.

## 🔄 MANDATORY 7-STEP EXECUTION CYCLE

### The 7 Mandatory Steps:
1. **BACKUP** - Create backups of all files that will be modified
2. **CONFIRM** - Get explicit user approval for the operation
3. **EXECUTE** - Perform the actual operation
4. **VERIFY** - Check that the operation completed successfully
5. **EVALUATE** - Assess the overall success/failure
6. **UPDATE** - Update progress tracking and status
7. **CLEANUP** - Clean up temporary files and resources

### Enforcement Mechanisms:
- **Automated Scripts**: Use `.claude/scripts/execute-task-with-cycle.sh` for automation
- **Manual Execution**: Each step MUST be logged in `.claude/runtime/cycle-compliance.log`
- **Violation Detection**: Any cycle bypass triggers immediate operation abort
- **Audit Trail**: All cycle executions logged with timestamps and outcomes

### Cycle Requirements by Operation Level:
- **LEVEL 0** (Read-only): Steps 3-4 only (Execute, Verify)
- **LEVEL 1** (Safe modifications): Steps 1, 3-6 (Skip Confirm, Cleanup)
- **LEVEL 2** (Destructive): ALL 7 steps MANDATORY
- **LEVEL 3** (System): ALL 7 steps + additional safety review

### Consequences of Non-Compliance:
1. **Immediate operation termination**
2. **Violation logged to `.claude/runtime/violations.log`
3. **Rollback initiated automatically**
4. **User notified of compliance failure**
5. **Further operations blocked until resolved**

## ⚡ ENFORCEABLE DIRECTIVES

Claude MUST:
1. **EXECUTE the 7-step cycle** for EVERY operation (no exceptions)
2. Check `.claude/config/consolidated-safety-rules.json` before EVERY file system operation
3. Log ALL operations with level >= 2 to audit trail
4. Request confirmation before ANY destructive operation (level 2+)
5. STOP immediately if user types: STOP, CANCEL, or ABORT
6. NEVER execute forbidden operations listed in safety rules
7. **VERIFY cycle compliance** before proceeding with any operation
8. **CREATE backups** before ANY modification operation

Claude MUST NOT:
1. **SKIP any mandatory cycle step** for the operation level
2. Delete files without explicit approval (even if asked)
3. Modify config files without showing diff first
4. Execute commands containing: rm -rf /, git push --force, npm publish
5. Create or modify: .env files, private keys, credentials
6. Perform bulk operations without preview and confirmation
7. **BYPASS the 7-step cycle** even if user requests it
8. **PROCEED without cycle validation** from operation-guard

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

- `.claude/validation/turn-guard.sh` → Validates Claude output format with ~10 guards implemented
- `.claude/validation/validate-stp.sh` → Validates STP compliance
- `.claude/validation/fetch-doc.sh` → Downloads documents to cache directory
- `.claude/validation/list-guards.sh` → Lists implemented validation guards
- `.claude/validation/gen-wbs.sh` → Generates work breakdown structure

### 7-Step Cycle Automation Scripts

**MANDATORY**: Use these scripts for cycle compliance:

- `.claude/scripts/execute-task-with-cycle.sh` → Main cycle enforcement script
- `.claude/scripts/create-task-backup.sh` → Step 1: Backup creation
- `.claude/scripts/request-confirmation.sh` → Step 2: User confirmation
- `.claude/scripts/verify-task.sh` → Step 4: Result verification
- `.claude/scripts/evaluate-task.sh` → Step 5: Success evaluation
- `.claude/scripts/update-progress.sh` → Step 6: Progress tracking
- `.claude/scripts/cleanup-task.sh` → Step 7: Resource cleanup
- `.claude/scripts/validate-cycle-compliance.sh` → Cycle compliance validation

### Implementation Status

- ✅ **Claude Integration**: Full workspace structure and safety system
  - Configuration in `.claude/config/`
  - Workspace validation scripts in `.claude/scripts/`
  - Safety rules and permissions defined
- ✅ **MCP Integration**: Available in `.claude/mcp-integration/` directory
  - OperationGuard for safety validation
  - MCP server with tool definitions
  - TypeScript-based implementation
- ✅ Shell-based guards in `.claude/validation/` directory
- ✅ GitHub Actions workflows configured
- ⚠️ Some advanced guards still in development

For workspace organization, see `.claude/docs/standards/WORKSPACE-HIERARCHY.md`

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
4. Ensure all guardrails pass (`.claude/validation/turn-guard.sh`)

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
- `claude-basic.yml` - Basic Claude integration workflow
- `claude-integration-helper.yml` - Claude integration helper utilities
- `claude-safety.yml` - Claude safety checks and validations
- `label-sync.yml` - Enforces phase label consistency
- `stp-guard.yml` - Validates lifecycle artifacts
- `path-guard.yml` - Role-based path restrictions
- `guard-unit.yml` - Runs guard validation tests
- `ci.yml` - Standard CI pipeline
- `mcp-validation.yml` - MCP integration health checks
- `validate-git-commands.yml` - Git command validation
- `version-check.yml` - Version consistency checks
- `release.yml` - Release automation workflow

## Development Guidelines

### Workspace Organization

Use `.claude/workspace/` directory for all project work following the hierarchy:

```
workspace/projects/{project-name}/{PHASE}/{task-id}/{process}/
```

Where:
- **Project**: Complete work item (e.g., `issue-13-cors-proxy`)
- **Phase**: Development phase (`FETCH`, `INV`, `ANA`, `PLAN`, `BUILD`, `VERIF`, `REL`)
- **Task**: Specific deliverable (e.g., `P-1-rfc-draft`)
- **Process**: Work stage (`01-investigation`, `02-planning`, `03-execution`, `04-results`)

This directory is git-ignored. Move completed deliverables to `docs/` when ready.

For details, see: `.claude/docs/standards/WORKSPACE-HIERARCHY.md`

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

## 🎯 MANDATORY Development Completion Checklist

**CRITICAL**: The following checklist MUST be completed at the end of EVERY development task before considering the work done:

### 1. Documentation Updates (MANDATORY)
- [ ] **README.md** - Update if new features, APIs, or usage changes were introduced
- [ ] **API Documentation** - Update JSDoc/TypeDoc comments for all modified functions/classes
- [ ] **CHANGELOG.md** - Add entry describing the changes (features, fixes, breaking changes)
- [ ] **Migration Guide** - Document breaking changes and migration steps if applicable
- [ ] **Architecture Docs** - Update if architectural changes were made

### 2. Test Coverage (MANDATORY)
- [ ] **All Tests Pass** - Run `pnpm test` and ensure 100% pass rate
- [ ] **New Tests Added** - Every new feature/fix MUST have corresponding tests
- [ ] **Coverage Check** - Run `pnpm test:coverage` and ensure ≥90% coverage for modified files
- [ ] **E2E Tests** - Run `pnpm e2e` if UI or user-facing features were changed
- [ ] **Integration Tests** - Ensure external dependencies are properly tested

### 3. Code Quality (MANDATORY)
- [ ] **Lint Check** - Run `pnpm lint` and fix all errors
- [ ] **Type Check** - Run `pnpm tsc --noEmit` to ensure no TypeScript errors
- [ ] **Build Success** - Run `pnpm build` to ensure production build works
- [ ] **No Console Logs** - Remove all debug console.log statements
- [ ] **Error Handling** - All edge cases have proper error handling

### 4. Impact Analysis (MANDATORY)
- [ ] **Breaking Changes** - Document any breaking API changes
- [ ] **Performance Impact** - Note if changes affect performance
- [ ] **Security Review** - Ensure no security vulnerabilities introduced
- [ ] **Dependency Updates** - Document any new or updated dependencies
- [ ] **Compatibility** - Verify compatibility with supported Obsidian versions

### 5. Final Verification (MANDATORY)
- [ ] **Feature Works** - Manually test the implemented feature/fix
- [ ] **No Regressions** - Verify existing features still work
- [ ] **Clean Git Status** - No uncommitted changes or untracked files
- [ ] **PR Ready** - All changes are ready for review

### Enforcement
- **NEVER** mark a task as complete without completing ALL checklist items
- **ALWAYS** run the full test suite before finalizing any work
- **MUST** update documentation for ANY user-facing changes
- **If any item cannot be completed**, explicitly document why and get approval

## MANDATORY TypeScript Implementation Rules

### Core Principles (MUST follow in order of priority)
1. **Essential Implementation** - Every line of code must have a clear purpose
2. **Type Safety** - Use TypeScript's type system properly without shortcuts
3. **API Compliance** - Follow official API specifications exactly
4. **Maintainability** - Code must be clear and self-documenting

### STRICTLY FORBIDDEN (Will result in immediate rejection)
1. **Type evasion**
   - NEVER use `any` type (including `as any`, `: any`, `<any>`)
   - NEVER use `unknown` type when proper types exist
   - NEVER use `as` type assertions (use type guards instead)
   - NEVER use `// @ts-ignore` comments
   - NEVER use `!` non-null assertion when avoidable
   - NEVER use `null!` or `undefined!`

2. **Implementation shortcuts**
   - NEVER leave empty implementations `{}`
   - NEVER write meaningless comments
   - NEVER use `_` prefix for variables (use meaningful names)
   - Use meaningful return types that express the operation's result
   - `void` is acceptable when:
     - External API requires it
     - Operation success/failure is communicated via exceptions
     - Side effects are the primary purpose (e.g., logging)

3. **Naming conventions (STRICTLY FORBIDDEN)**
   - NEVER use `I` prefix for interfaces (e.g., `IVault`, `IFile`)
   - NEVER use `_` prefix for private properties
   - NEVER use Hungarian notation
   - NEVER use abbreviations that reduce clarity
   - MUST use descriptive names that express intent

### REQUIRED Naming Conventions

1. **Interfaces**: Use descriptive names without prefixes
   ```typescript
   // GOOD
   interface FileSystem { }
   interface VaultOperations { }
   
   // BAD
   interface IFileSystem { }
   interface FileSystemInterface { }
   ```

2. **Types**: Use descriptive names, optionally with `Type` suffix for clarity
   ```typescript
   // GOOD
   type FileMetadata = { ... }
   type VaultConfig = { ... }
   
   // ACCEPTABLE when avoiding name conflicts
   type FileType = { ... }
   ```

3. **Private properties**: Use descriptive names without prefixes
   ```typescript
   // GOOD
   private vaultCache: Map<string, Vault>
   
   // BAD
   private _vaultCache: Map<string, Vault>
   ```

### Circular Reference Resolution Pattern
When encountering circular references (e.g., A depends on B, B depends on A):
1. **DO NOT** use `any` type
2. **DO NOT** use forward declarations with `!`
3. **DO** use one of these patterns:
   ```typescript
   // Pattern 1: Interface segregation
   interface IVault {
     delete(file: IFile): Promise<void>;
   }
   interface IFile {
     vault: IVault;
   }
   class Vault implements IVault { ... }
   class File implements IFile { ... }
   
   // Pattern 2: Late binding
   class File {
     private vaultRef: WeakRef<Vault>;
     get vault(): Vault {
       const v = this.vaultRef.deref();
       if (!v) throw new Error('Vault has been garbage collected');
       return v;
     }
   }
   ```

### MANDATORY Requirements
1. **Type accuracy**
   - MUST follow official Obsidian API type definitions exactly
   - MUST initialize all properties with appropriate values
   - MUST use generics for type safety where applicable

2. **Dependency management**
   - MUST eliminate all circular references
   - MUST order class definitions to avoid forward references
   - MUST use interfaces to separate types from implementations

3. **Implementation completeness**
   - MUST provide meaningful implementations for all methods
   - MUST fully implement features used in tests
   - MUST handle errors appropriately

### Enforcement
- ANY violation of these rules MUST be rejected immediately
- MUST provide compliant implementation that follows ALL rules
- NO exceptions or workarounds are permitted

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

### Active Claude Integration Files

All Claude-specific **active** files are organized under `.claude/`:

- `.claude/config/` - Active configuration and rules (used at runtime)
- `.claude/docs/` - Documentation and guides
- `.claude/runtime/` - Runtime files (audit logs, etc.)
- `.claude/workspace/` - Project workspace (see `.claude/docs/standards/WORKSPACE-HIERARCHY.md`)
- `.claude/scripts/` - Claude-specific scripts

### Template Files

Template files for setting up new Claude integrations are located in:

- `docs/templates/claude/` - All Claude-related templates
  - `config/` - Configuration templates (*.template.json, *.template.md)
  - `core/` - Core integration templates (*.template.md)
  - `mcp/` - MCP integration templates (*.template.ts, *.template.json)
  - `scripts/` - Script templates (*.template.sh)
  - `workflows/` - Workflow templates (*.template.md)

**Important**: Template files have `.template` extension and should be copied/renamed when creating actual integration files. Do not edit templates directly unless updating the template system itself.

See `.claude/README.md` for details.
