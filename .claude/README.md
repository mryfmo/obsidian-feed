# Claude Integration Directory

This directory contains all Claude-specific files and documentation.

## Structure

- `config/` - Configuration files (tracked in git)
- `docs/` - Claude documentation (tracked in git)
- `runtime/` - Operational files like audit logs (not tracked)
- `tmp-docs/` - Temporary documentation (not tracked)
- `scripts/` - Claude-specific scripts
- `mcp/` - MCP integration files

## Key Files

- `config/claude-rules.json` - Safety rules configuration
- `docs/guides/CLAUDE.md` - Main Claude usage guide
- `runtime/audit.log` - Operation audit trail
- `scripts/safety-wrapper.sh` - Safety enforcement script

## Usage

All Claude operations should reference files within this directory structure.
The `CLAUDE.md` file at the project root is kept for compatibility.
