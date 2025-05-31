# Optional Components Reference

## Overview

The Claude integration setup provides a core foundation (45% of files) that's always included, plus optional components (55% of files) that can be added based on project needs.

## Core vs Optional Breakdown

### Always Included (Core - 45%)

These files are essential for Claude integration to function:

```
.claude/config/claude-rules.json         # Safety rules
.claude/config/integration.json          # Integration config
.claude/config/permissions.md            # Permission documentation
.claude/config/safety-checks.json        # Safety validations
.claude/docs/core/PRINCIPLES.md          # Core principles
.claude/docs/core/SAFETY.md              # Safety guidelines
.claude/docs/core/ARCHITECTURE.md        # Architecture overview
.claude/docs/workflows/DEVELOPMENT.md    # Basic workflow
.claude/scripts/test-setup.sh            # Setup validation
.github/workflows/claude.yml             # GitHub Action
.mcp/index.ts                           # MCP server
.mcp/operation-guard.ts                 # Safety enforcer
.mcp/package.json                       # Dependencies
CLAUDE.md                               # Main guidance
```

### Optional Components (55%)

#### 1. Additional Workflows (`--workflows`)

Extended workflow documentation for daily operations:

```
.claude/docs/workflows/OPERATIONS.md     # Daily ops, incident response
.claude/docs/workflows/TESTING.md        # Test strategies, coverage
```

**When to include**: Teams needing structured processes

#### 2. Integration Guides (`--integration`)

Detailed integration documentation:

```
.claude/docs/integration/GITHUB.md       # GitHub setup and usage
.claude/docs/integration/MCP.md          # MCP server details
.claude/docs/integration/TOOLS.md        # Tool integration guide
```

**When to include**: Complex integrations or multiple tools

#### 3. Reference Documentation (`--reference`)

Comprehensive reference materials:

```
.claude/docs/reference/COMMANDS.md       # Command reference
.claude/docs/reference/FAQ.md            # Common questions
.claude/docs/reference/PATTERNS.md       # Code patterns
```

**When to include**: Large teams or complex projects

#### 4. Advanced Scripts (`--advanced`)

Power-user tools and utilities:

```
.claude/scripts/check-permission.ts      # Permission checker
.claude/scripts/analyze-audit.ts         # Audit log analyzer
.claude/scripts/rollback.sh              # Rollback helper
```

**When to include**: Need detailed analysis or automation

#### 5. Example Implementations (`--examples`)

Working code examples:

```
examples/safe-file-handler.ts            # Safe file operations
examples/github-action-usage.yml         # GitHub Action examples
```

**When to include**: Teaching teams or reference implementations

## Usage Patterns

### Minimal Setup (Core Only)
```bash
./generate-claude-setup-complete.sh my-project web-app
```
Best for: Small projects, prototypes, personal use

### Standard Setup (Core + Workflows + Reference)
```bash
./generate-claude-setup-complete.sh my-project web-app --workflows --reference
```
Best for: Most team projects

### Full Setup (Everything)
```bash
./generate-claude-setup-complete.sh my-project web-app --all
```
Best for: Enterprise projects, high-security environments

### Developer Setup (Core + Advanced + Examples)
```bash
./generate-claude-setup-complete.sh my-project library --advanced --examples
```
Best for: Library development, teaching

## Decision Matrix

| Component | Include When... | Skip When... |
|-----------|----------------|--------------|
| `--workflows` | Multiple team members | Solo developer |
| `--integration` | Using multiple MCP servers | Basic setup only |
| `--reference` | Need searchable docs | Small, simple project |
| `--advanced` | Frequent auditing needed | Minimal operations |
| `--examples` | Teaching/onboarding | Experienced team |

## Adding Components Later

You can always add optional components later:

```bash
# Re-run with new flags (won't overwrite existing files)
./generate-claude-setup-complete.sh my-project web-app --workflows --reference

# Or manually create specific files from templates
cp templates/workflows/*.md my-project/.claude/docs/workflows/
```

## Storage Impact

- Core only: ~50KB
- With workflows: +10KB
- With integration: +15KB
- With reference: +20KB
- With advanced: +15KB
- With examples: +10KB
- Full setup: ~120KB total

## Performance Considerations

Optional components don't affect runtime performance:
- They're documentation and utilities only
- The safety system uses only core files
- MCP server doesn't load optional files

Choose components based on your team's needs, not performance concerns.