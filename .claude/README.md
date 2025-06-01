# Claude Integration Directory

This directory contains all Claude-specific files and documentation.

## Structure

- `config/` - Configuration files (tracked in git)
  - `claude-rules.json` - Safety rules configuration
  - `permissions.md` - Permission levels documentation
  - `safety-checks.json` - Operation safety checks
  - `consolidated-safety-rules.json` - Unified safety rules
  
- `docs/` - Claude documentation (tracked in git)
  - `core/` - Core principles and safety guidelines
  - `standards/` - Standards including WORKSPACE-HIERARCHY.md
  - `workflows/` - Development workflows and processes
  - `integration/` - Integration guides
  - `guards/` - Validation guard documentation
  
- `workspace/` - Project workspace (not tracked)
  - `projects/{project-name}/{PHASE}/{task-id}/{process}/`
  - See `docs/standards/WORKSPACE-HIERARCHY.md` for details
  
- `runtime/` - Operational files like audit logs (not tracked)

- `scripts/` - Claude-specific scripts
  - `validate-workspace.sh` - Workspace structure validation

- `mcp/` - MCP integration files

## Key Documentation

- `docs/standards/WORKSPACE-HIERARCHY.md` - Workspace organization standard
- `docs/workflows/DEVELOPMENT.md` - 7-phase development process
- `docs/workflows/RFC-WORKFLOW.md` - RFC creation workflow
- `../CLAUDE.md` - Main Claude usage guide (project root)

## Workspace Structure

All project work follows the hierarchy:

```
workspace/projects/{project-name}/{PHASE}/{task-id}/{process}/
```

Where:
- **Project**: Complete work item (e.g., `issue-13-cors-proxy`)
- **Phase**: `FETCH`, `INV`, `ANA`, `PLAN`, `BUILD`, `VERIF`, `REL`
- **Task**: Specific deliverable (e.g., `P-1-rfc-draft`)
- **Process**: `01-investigation`, `02-planning`, `03-execution`, `04-results`

## Quick Start

See `.claude/docs/QUICKSTART.md` for immediate productivity.

```bash
# Start your first project
.claude/scripts/init-workspace.sh issue 42 "your-feature"

# Validate your work
.claude/scripts/validate-workspace.sh
```

## Key Scripts

- `scripts/init-workspace.sh` - Create new project workspace
- `scripts/validate-workspace.sh` - Validate workspace structure

## Usage

1. **Start**: Use init-workspace.sh to create project
2. **Work**: Follow the 7-phase process (INV → ANA → PLAN → BUILD → VERIF → REL)
3. **Validate**: Run validation frequently
4. **Complete**: Move final deliverables to `docs/`
5. **Archive**: Move completed projects to `archive/`

## Important Notes

- The `workspace/` directory is git-ignored for clean history
- Use metadata files to track progress
- Follow naming conventions for consistency
- Archive completed work promptly
