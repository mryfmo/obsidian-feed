# Claude Integration Principles - obsidian-feed

## Core Principles

### 1. Safety First
All operations must go through safety validation. No exceptions.

### 2. Explicit Approval
Destructive operations (Level 2+) require explicit user confirmation.

### 3. Audit Trail
All significant operations are logged for accountability and debugging.

### 4. Project-Specific Optimization
Claude is optimized for Obsidian plugin development, ensuring vault data integrity and respecting plugin architecture.

### 5. Fail Safe
When uncertain, Claude asks for clarification rather than guessing.

## Integration Philosophy

Claude enhances developer productivity while maintaining strict safety controls.

### Risk Levels
- **Level 0**: Read-only operations (auto-approved)
- **Level 1**: Safe modifications (auto-approved)
- **Level 2**: Destructive operations (requires confirmation)
- **Level 3**: System modifications (requires explicit approval)

## Project Context

### Obsidian Plugin Requirements
- Preserve manifest.json integrity
- Protect compiled main.js
- Maintain styles.css consistency
- Never modify user vault data
- Respect .obsidian directory structure

### Domain-Specific Considerations
- Feed data stored as gzipped JSON
- State machine pattern for UI transitions
- Service-oriented architecture
- TypeScript strict mode
- Obsidian API constraints

### Integration Points
- MCP server for enhanced capabilities
- GitHub Actions for CI/CD
- Vitest for testing
- esbuild for bundling

## Behavioral Guidelines

### Claude MUST:
1. Validate all operations against safety rules
2. Log operations with level >= 2
3. Create backups before destructive operations
4. Stop immediately on STOP/CANCEL/ABORT
5. Protect plugin distribution files (main.js, manifest.json, styles.css)
6. Preserve feed data integrity

### Claude MUST NOT:
1. Delete files without explicit approval
2. Modify configs without showing diffs
3. Execute forbidden commands
4. Make assumptions about user intent
5. Modify user vault files directly
6. Change plugin manifest without review

## Examples

### Good Practices
- Using Edit tool for incremental changes
- Creating backups before major refactoring
- Testing changes with vitest before committing
- Respecting Obsidian plugin lifecycle

### Anti-Patterns
- Bulk file deletions
- Direct vault manipulation
- Skipping test runs
- Modifying distribution files without building

## Customization Notes

This configuration is specifically tailored for the obsidian-feed plugin project, emphasizing:
- Protection of plugin core files
- Feed data integrity
- Development workflow safety
- User vault preservation
EOF < /dev/null