# Claude Integration Complete Setup Guide

## Overview

The `generate-claude-setup-complete.sh` script creates a comprehensive Claude integration environment with mandatory core components and optional advanced features. This system ensures Claude Code follows documented rules through enforceable mechanisms.

## What It Creates

### Core Components (Always Included)

1. **Safety System**
   - `.claude/config/claude-rules.json` - Machine-readable operation rules
   - `.mcp/operation-guard.ts` - Runtime validation system
   - `.claude/runtime/` - Audit logs and rollback registry

2. **Documentation**
   - `.claude/docs/core/PRINCIPLES.md` - Core principles
   - `.claude/docs/core/SAFETY.md` - Safety guidelines
   - `.claude/docs/core/ARCHITECTURE.md` - Project architecture
   - `.claude/docs/workflows/DEVELOPMENT.md` - Development workflow

3. **Integration**
   - `.github/workflows/claude.yml` - GitHub Action for Claude
   - `.mcp/index.ts` - MCP server with operation interceptors
   - `CLAUDE.md` - Main guidance file

### Optional Components

Use flags to include additional components:

- `--workflows` - Additional workflow documentation (operations, testing)
- `--integration` - Integration guides (GitHub, MCP, tools)
- `--reference` - Reference documentation (commands, FAQ, patterns)
- `--advanced` - Advanced scripts (permission checker, audit analyzer, rollback helper)
- `--examples` - Example implementations
- `--all` - Include everything

## Usage

```bash
# Basic setup (core only)
./generate-claude-setup-complete.sh my-project web-app

# With author info
./generate-claude-setup-complete.sh my-project cli-tool "John Doe" "john@example.com" MIT

# Include all optional components
./generate-claude-setup-complete.sh my-project plugin --all

# Include specific components
./generate-claude-setup-complete.sh my-project library --workflows --reference
```

### Project Types

- `web-app` - Web applications
- `cli-tool` - Command-line tools
- `plugin` - Plugins/extensions
- `library` - Libraries
- `api-service` - API services

## How the Safety System Works

### Operation Levels

- **Level 0**: Read-only operations (always allowed)
- **Level 1**: Safe modifications (auto-approved)
- **Level 2**: Destructive operations (requires confirmation)
- **Level 3**: System-critical operations (requires explicit approval)

### Enforcement Mechanism

1. **Pre-Operation Check**: OperationGuard validates before any file operation
2. **Pattern Matching**: Forbidden patterns block dangerous operations
3. **Audit Trail**: All level 2+ operations logged to `.claude/runtime/audit.log`
4. **Rollback Registry**: Maintains rollback commands for destructive operations

### Example Safety Rules

```json
{
  "operations": {
    "delete": {
      "files": {
        "level": 2,
        "forbidden_patterns": [
          "*.env",
          "package.json",
          "*.md"
        ]
      }
    }
  }
}
```

## Testing the Setup

After generation:

```bash
cd my-project

# Test the setup
./test-claude-setup.sh

# Test MCP integration
cd .mcp
npm install
npm test

# Test specific operations
npx tsx .claude/scripts/check-permission.ts delete package.json
```

## Customization

### Template Variables

The templates use these variables:
- `{{PROJECT_NAME}}` - Your project name
- `{{PROJECT_TYPE}}` - Project type (web-app, cli-tool, etc.)
- `{{AUTHOR_NAME}}` - Author name
- `{{AUTHOR_EMAIL}}` - Author email
- `{{LICENSE}}` - License type

### Adding Project-Specific Rules

Edit `.claude/config/claude-rules.json`:

```json
{
  "forbidden_patterns": [
    "# === YOUR PROJECT SPECIFIC ===",
    "src/legacy/**",
    "*.prod.config.*"
  ]
}
```

## File Structure

```
my-project/
├── .claude/
│   ├── config/
│   │   ├── claude-rules.json      # Safety rules
│   │   ├── integration.json       # Integration config
│   │   ├── permissions.md         # Permission guide
│   │   └── safety-checks.json     # Safety validations
│   ├── docs/
│   │   ├── core/                  # Core documentation
│   │   ├── workflows/             # Workflow guides
│   │   ├── integration/           # Integration guides (optional)
│   │   └── reference/             # Reference docs (optional)
│   ├── scripts/                   # Utility scripts
│   └── runtime/                   # Runtime data (audit logs, etc.)
├── .github/
│   └── workflows/
│       └── claude.yml             # GitHub Action
├── .mcp/
│   ├── index.ts                   # MCP server
│   ├── operation-guard.ts         # Safety enforcer
│   └── package.json               # MCP dependencies
├── tools/                         # Shell tools
├── examples/                      # Examples (optional)
└── CLAUDE.md                      # Main guidance file
```

## Benefits

1. **Enforced Safety**: Operations are validated at runtime, not just documented
2. **Flexibility**: Optional components can be added as needed
3. **Auditability**: All destructive operations are logged
4. **Reversibility**: Rollback commands maintained for dangerous operations
5. **Customizable**: Templates use 80/20 rule - 80% reusable, 20% customizable

## Next Steps

1. Generate your setup with appropriate flags
2. Customize template variables in generated files
3. Test the safety system
4. Add project-specific rules
5. Commit to version control

## Troubleshooting

### MCP Not Working
- Ensure Node.js >= 18
- Run `npm install` in `.mcp/` directory
- Check that `claude-rules.json` exists

### Tests Failing
- Verify file paths are correct
- Check forbidden patterns in `claude-rules.json`
- Review audit logs in `.claude/runtime/audit.log`

### ES Module Issues
- Ensure `"type": "module"` in package.json
- Use `.js` extensions in imports
- Run with `tsx` for TypeScript files