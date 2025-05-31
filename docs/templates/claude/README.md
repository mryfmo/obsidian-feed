# Claude Integration Templates

This directory contains templates for setting up Claude integration in projects.

## Quick Start

To apply Claude integration to a project:

```bash
./generate-claude-setup-complete-v2.sh <project-name> <project-type> [author] [email] [license] [options]
```

Example:
```bash
./generate-claude-setup-complete-v2.sh my-project plugin "John Doe" "john@example.com" MIT --all
```

## Directory Structure

```
claude/
├── README.md                               # This file
├── TEMPLATE_VARIABLES.md                   # Complete variable reference
├── TEMPLATE_STANDARDS.md                   # Template creation standards
├── generate-claude-setup-complete-v2.sh    # Main setup generator (recommended)
├── generate-claude-setup.sh               # Basic setup generator
├── validate-templates.sh                   # Template validation tool
│
├── config/                                # Configuration templates
│   ├── claude-rules.template.json         # Safety rules configuration
│   ├── integration.template.json          # Integration settings
│   ├── permissions.template.md            # Permission documentation
│   └── safety-checks.template.json        # Safety validation rules
│
├── core/                                  # Core documentation templates
│   ├── PRINCIPLES.md                      # Core principles (no variables)
│   ├── SAFETY.md                         # Safety guidelines
│   └── ARCHITECTURE.template.md           # Architecture documentation
│
├── github/                                # GitHub integration templates
│   ├── workflows/
│   │   └── claude.template.yml           # GitHub Action workflow
│   └── scripts/
│       └── claude-safety-wrapper.template.sh  # Safety wrapper for CI/CD
│
├── mcp/                                   # MCP (Model Context Protocol) templates
│   ├── package.template.json              # MCP package configuration
│   ├── index.template.ts                  # MCP server implementation
│   ├── operation-guard.template.ts        # Safety enforcement
│   └── tsconfig.template.json             # TypeScript configuration
│
├── scripts/                               # Utility script templates
│   └── test-setup.template.sh             # Setup validation script
│
├── tools/                                 # Tool templates
│   ├── turn_guard.template.sh             # Output validation
│   ├── validate-stp-markers.template.sh   # STP compliance checking
│   └── gen_wbs.template.sh               # Work breakdown structure
│
├── workflows/                             # Workflow documentation templates
│   └── DEVELOPMENT.template.md            # Development workflow
│
└── gitignore.template                     # .gitignore for .claude directory
```

## Available Options

### Project Types
- `web-app` - Web applications
- `cli-tool` - Command-line tools
- `plugin` - Plugins/extensions (like Obsidian)
- `library` - Libraries
- `api-service` - API services

### Optional Components
- `--all` - Include all optional components
- `--workflows` - Additional workflow documentation
- `--integration` - Integration guides
- `--reference` - Reference documentation
- `--advanced` - Advanced scripts and tools
- `--examples` - Example implementations

## Template Variables

See `TEMPLATE_VARIABLES.md` for a complete list of all template variables and their usage.

## Validation

Before using templates, validate them:

```bash
./validate-templates.sh
```

For verbose output:
```bash
./validate-templates.sh verbose
```

## Creating New Templates

1. Follow the standards in `TEMPLATE_STANDARDS.md`
2. Use `{{SNAKE_CASE_VARIABLE}}` format for variables
3. Add new variables to `TEMPLATE_VARIABLES.md`
4. Test with `validate-templates.sh`

## For This Project

To apply Claude integration to the obsidian-feed project:

```bash
# From this directory
./generate-claude-setup-complete-v2.sh ../../../ plugin \
  "Obsidian Feed Contributors" \
  "team@obsidian-feed.dev" \
  "MIT" \
  --all
```

## Support

For issues or questions about these templates:
1. Check `TEMPLATE_VARIABLES.md` for variable documentation
2. Run `validate-templates.sh` to check for issues
3. Review generated files in the output directory