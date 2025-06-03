# MCP Integration for obsidian-feed

This directory contains the Model Context Protocol (MCP) integration layer that enhances the obsidian-feed project with advanced validation, documentation fetching, and workflow management capabilities.

## True Integration Philosophy

This implementation follows the **integration** approach:

- Shell scripts are preserved and enhanced, not replaced
- MCP servers provide additional capabilities when available
- Graceful fallback ensures backward compatibility

## Architecture

```
.mcp/
├── index.ts          # Main integration entry point
├── bridge.ts         # Shell script bridge (called by tools/*.sh)
├── validator.ts      # Complete guard implementation (25+ guards)
├── fetcher.ts        # Document fetching with Context7 support
├── workflow.ts       # 7-phase workflow management
├── context7.ts       # Context7 MCP client
├── mcp-clients.ts    # Official MCP server connections
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript configuration
```

## Features

### 1. Validation System

- **25+ validation guards** from turn_guard.sh
- Phase-specific validation rules
- Role-based access control
- AI-powered analysis (optional)
- Exit code compatibility with shell scripts

### 2. Document Fetching

- **Context7 integration** for library documentation
- URL fetching with HTML-to-Markdown conversion
- Local file support
- 15-minute cache for performance
- Automatic source type detection

### 3. Workflow Management

- **7-phase lifecycle**: FETCH → INV → ANA → PLAN → BUILD → VERIF → REL
- GitHub label synchronization
- State transition validation
- Workflow automation with auto-transitions
- Interactive CLI interface

## Usage for Developers

### Basic Commands

```bash
# Validate a turn file
./tools/turn_guard.sh turn.md
# Or use MCP directly
npx tsx .mcp/bridge.ts turn_guard turn.md

# Fetch documentation
./tools/fetch_doc.sh https://api.example.com/docs
./tools/fetch_doc.sh react  # Fetches from Context7

# List all guards
./tools/list_guards.sh
```

### Workflow Commands

```bash
# Initialize workflow for a task
npx tsx .mcp/bridge.ts workflow init TASK-001

# Check and auto-transition if ready
npx tsx .mcp/bridge.ts workflow auto check TASK-001

# Generate visualization
npx tsx .mcp/bridge.ts workflow auto visualize TASK-001
```

### Interactive CLI

```bash
# Launch interactive mode
npx tsx .mcp/bridge.ts cli
```

In CLI mode:

- `task new` - Create new task
- `task select` - Select existing task
- `validate <file>` - Validate a turn file
- `workflow status` - Show current phase
- `guards` - List all validation guards
- Phase artifact management
- Progress tracking

### 4. Shell Script Compatibility

- **Seamless fallback** when MCP unavailable
- Exit code preservation
- Bridge script for integration
- No breaking changes to existing workflows

## Usage

### From Shell Scripts

```bash
# Validation
./tools/turn_guard.sh file.md
# → Falls back to: npx tsx .mcp/bridge.ts turn_guard file.md

# Document fetching
./tools/fetch_doc.sh react
# → Falls back to: npx tsx .mcp/bridge.ts fetch_doc react

# Workflow management
npx tsx .mcp/bridge.ts workflow init task-001
npx tsx .mcp/bridge.ts workflow transition task-001 INV
```

### From TypeScript/JavaScript

```typescript
import { MCPIntegration } from './.mcp';

const integration = new MCPIntegration({
  validation: { useAI: true },
  context7: { enabled: true },
});

await integration.initialize();

// Validate
const result = await integration.validate('turn.md');

// Fetch library documentation
const reactDoc = await integration.fetch('react');
const vueDoc = await integration.fetch('vue', { topic: 'components' });

// Fetch URL
const webDoc = await integration.fetch('https://example.com/api.html');

// Workflow
await integration.workflow('init', ['task-001']);
```

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: For GitHub operations
- `USE_AI`: Enable AI-powered validation
- `TURN_ROLE`: Current user role (dev, review, qa, etc.)
- `CI`: Set to 'true' in CI environment

### Claude Desktop Configuration

See `claude_desktop_config.json` for the required MCP server configuration.

## Testing

```bash
cd .mcp

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:coverage

# Test shell compatibility
npm test -- tests/shell-compatibility.test.ts
```

## Exit Codes

The integration preserves all original exit codes:

- `0`: Success
- `10-19`: Structure guards (G-PHASE, G-TOKEN, G-LABEL, etc.)
- `20-29`: Quality guards (G-RFC, G-TEST, etc.)
- `30-39`: Process guards (G-USER-OK, G-WBS-OK, etc.)
- `40-49`: Access control guards (G-ROLE, G-STATE, etc.)

## Development

```bash
# Install dependencies
cd .mcp && npm install

# Run tests
npm test

# Test Context7 integration
npx tsx bridge.ts test_context7
```

## Performance

- Validation results are cached per session
- Document fetches cached for 15 minutes
- Concurrent fetch support for multiple sources
- Lazy MCP client initialization

## Security

- URL validation for fetch operations
- File path sanitization
- Role-based access control
- No secrets in code or logs

## CI/CD Integration

The project includes GitHub Actions workflows for:

- Unit and integration testing
- Shell script compatibility testing
- Code coverage reporting
- Multi-version Node.js testing (18.x, 20.x)

See `.github/workflows/ci.yml` for details.

## License

Same as parent project (MIT)
