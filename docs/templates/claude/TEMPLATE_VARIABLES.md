# Template Variables Reference

This document defines all template variables used across Claude integration templates, their purposes, and default values.

## Core Variables (Required)

These variables MUST be replaced in all templates:

| Variable | Description | Example | Used In |
|----------|-------------|---------|---------|
| `{{PROJECT_NAME}}` | Project name (lowercase, hyphens) | `my-awesome-app` | All files |
| `{{PROJECT_TYPE}}` | Project type | `web-app`, `cli-tool`, `plugin`, `library`, `api-service` | Multiple files |
| `{{PROJECT_DESCRIPTION}}` | One-line project description | `A web application for task management` | package.json, README |
| `{{AUTHOR_NAME}}` | Author's full name | `John Doe` | package.json, LICENSE |
| `{{AUTHOR_EMAIL}}` | Author's email | `john@example.com` | package.json |
| `{{LICENSE}}` | License type | `MIT`, `Apache-2.0`, `GPL-3.0`, `proprietary` | package.json, LICENSE |
| `{{LAST_UPDATED}}` | Generation date | `2025-01-06` | Auto-generated |

## Package Variables

For npm/package configuration:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_SCOPE}}` | npm scope | (optional) | `mycompany` |
| `{{PROJECT_VERSION}}` | Initial version | `1.0.0` | `0.1.0` |
| `{{PROJECT_REPOSITORY}}` | Git repository URL | (optional) | `https://github.com/user/repo` |

## GitHub Action Variables

For GitHub workflows:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_OPERATIONS}}` | Allowed operations | `['read', 'write', 'create']` | `['read', 'write', 'delete']` |
| `{{PROJECT_RUNNER}}` | GitHub runner OS | `ubuntu-latest` | `macos-latest` |
| `{{PROJECT_CONTEXT_ADDITIONS}}` | Additional context | `""` | Custom context string |
| `{{PROJECT_LABELS}}` | Default labels | `['claude-safe']` | `['claude', 'automated']` |

## MCP Integration Variables

For MCP server configuration:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_IMPORTS}}` | Additional imports | `""` | `import { CustomTool } from './tools.js'` |
| `{{PROJECT_TOOLS}}` | Custom tool definitions | `[]` | Tool definition array |
| `{{PROJECT_TOOL_HANDLERS}}` | Tool handler methods | `""` | Handler implementation |
| `{{PROJECT_TOOL_SETUP}}` | Tool setup code | `""` | Initialization code |
| `{{PROJECT_METHODS}}` | Additional methods | `""` | Custom class methods |

## Safety Configuration Variables

For safety rules and permissions:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_FORBIDDEN_FILES}}` | Additional forbidden file patterns | `""` | `"*.prod.config", "secrets/*"` |
| `{{PROJECT_FORBIDDEN_DIRS}}` | Additional forbidden directories | `""` | `"production", "secure"` |
| `{{PROJECT_RESTRICTED_DIRS}}` | Additional restricted directories | `""` | `"config", "data"` |
| `{{PROJECT_CONFIG_PATTERNS}}` | Config file patterns | `""` | `"*.ini", "config/*"` |
| `{{PROJECT_FORBIDDEN_CREATE}}` | Forbidden file creation patterns | `""` | `"*.exe", "*.dll"` |
| `{{PROJECT_FORBIDDEN_COMMANDS}}` | Additional forbidden commands | `""` | `"sudo *", "chmod 777"` |
| `{{PROJECT_CONFIRM_COMMANDS}}` | Commands requiring confirmation | `""` | `"npm publish", "deploy"` |
| `{{PROJECT_SPECIFIC_DIRECTIVES}}` | Project-specific directives | `""` | Custom safety directives |

## Documentation Variables

For customizing documentation:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_OPTIMIZATION_DESCRIPTION}}` | How Claude is optimized | `""` | `Optimized for React development` |
| `{{PROJECT_REQUIREMENTS_AND_CONSTRAINTS}}` | Project requirements | `""` | `Must support IE11, max 5MB bundle` |
| `{{PROJECT_DOMAIN_CONSIDERATIONS}}` | Domain-specific needs | `""` | `Healthcare compliance required` |
| `{{PROJECT_INTEGRATION_POINTS}}` | Integration description | `""` | `Integrates with CI/CD pipeline` |
| `{{PROJECT_SPECIFIC_REQUIREMENTS}}` | Additional requirements | `""` | `Must validate all API inputs` |
| `{{PROJECT_SPECIFIC_RESTRICTIONS}}` | Additional restrictions | `""` | `Never modify patient data` |
| `{{PROJECT_GOOD_PRACTICES_EXAMPLES}}` | Good practice examples | `""` | Code examples |
| `{{PROJECT_ANTIPATTERNS_EXAMPLES}}` | Anti-pattern examples | `""` | Bad code examples |

## Script Variables

For shell scripts and automation:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `{{PROJECT_TEST_COMMAND}}` | Test command | `npm test` | `pnpm test` |
| `{{PROJECT_BUILD_COMMAND}}` | Build command | `npm run build` | `yarn build` |
| `{{PROJECT_DEV_COMMAND}}` | Dev command | `npm run dev` | `npm start` |

## Usage Guidelines

### 1. Variable Format
- Always use `{{SNAKE_CASE}}` format
- No spaces inside braces: `{{VAR}}` not `{{ VAR }}`
- Descriptive names: `{{PROJECT_BUILD_COMMAND}}` not `{{BUILD}}`

### 2. Default Values
- Empty string `""` for optional text variables
- Empty array `[]` for list variables
- Sensible defaults for required variables

### 3. Processing Order
1. Required variables first
2. Project-type specific variables
3. Optional customizations

### 4. Validation
Run this check after template processing:
```bash
# Check for unprocessed variables
grep -r '{{[A-Z_]*}}' . --exclude-dir=node_modules
```

## Project Type Defaults

### web-app
```json
{
  "PROJECT_TYPE": "web-app",
  "PROJECT_FORBIDDEN_FILES": "*.env.production, build/*",
  "PROJECT_CONFIG_PATTERNS": "*.config.js, .env*",
  "PROJECT_TEST_COMMAND": "npm test",
  "PROJECT_BUILD_COMMAND": "npm run build"
}
```

### cli-tool
```json
{
  "PROJECT_TYPE": "cli-tool",
  "PROJECT_FORBIDDEN_DIRS": "/usr/bin, /etc",
  "PROJECT_FORBIDDEN_COMMANDS": "sudo *, rm -rf /",
  "PROJECT_BUILD_COMMAND": "npm run compile"
}
```

### plugin
```json
{
  "PROJECT_TYPE": "plugin",
  "PROJECT_FORBIDDEN_FILES": "manifest.json, plugin.json",
  "PROJECT_CONFIG_PATTERNS": "*.json, config/*",
  "PROJECT_BUILD_COMMAND": "npm run bundle"
}
```

### library
```json
{
  "PROJECT_TYPE": "library",
  "PROJECT_FORBIDDEN_FILES": "dist/*, lib/*",
  "PROJECT_TEST_COMMAND": "npm test",
  "PROJECT_BUILD_COMMAND": "npm run build:lib"
}
```

### api-service
```json
{
  "PROJECT_TYPE": "api-service",
  "PROJECT_FORBIDDEN_FILES": "*.key, *.pem, *.cert",
  "PROJECT_FORBIDDEN_COMMANDS": "DROP DATABASE, DELETE FROM",
  "PROJECT_BUILD_COMMAND": "npm run build:api"
}
```

## Extending Variables

To add custom variables:

1. Add to this document
2. Update template files
3. Update `generate-claude-setup-complete.sh`
4. Test with all project types

## Common Issues

### Missing Variables
If you see `{{VARIABLE}}` in generated files:
1. Check spelling in this document
2. Verify variable is defined in generator script
3. Ensure proper escaping in sed commands

### Incorrect Substitution
If variables are partially replaced:
1. Check for nested braces
2. Verify no special characters in values
3. Use proper quoting in shell scripts