# Claude Integration Cleanup and Organization Plan

## Current State Analysis

### Existing Claude Integration (Partial)
- `.claude/` directory exists with basic structure
- `.mcp/` directory has multiple TypeScript files and partial implementation
- Configuration files are outdated (missing security patterns, wrong paths)
- Multiple duplicate files in different locations

### Issues Identified
1. **Outdated Configuration**:
   - `.claude/config/claude-rules.json` - Missing security patterns, wrong audit path
   - Missing `projectInfo` section
   - Limited forbidden patterns

2. **Scattered Files**:
   - Claude-related files in root, .github, and docs/templates
   - Demo project mixed with actual templates
   - Multiple versions of safety wrappers

3. **Incomplete Integration**:
   - Missing required templates in actual project
   - MCP implementation exists but not properly integrated
   - No proper test setup

## Cleanup Actions

### Phase 1: Backup Current State
```bash
# Create backup of existing Claude integration
tar -czf claude-backup-$(date +%Y%m%d-%H%M%S).tar.gz .claude .mcp
```

### Phase 2: Clean Up Duplicates
1. Remove demo project from templates (it's for testing only)
2. Consolidate safety wrapper scripts
3. Remove outdated configurations

### Phase 3: Apply Proper Integration
1. Use generate-claude-setup-complete-v2.sh with proper parameters
2. Preserve existing MCP implementation
3. Update configurations to latest standards

### Phase 4: Organize Template Directory
```
docs/templates/claude/
├── README.md                          # Template usage guide
├── TEMPLATE_VARIABLES.md              # Variable reference
├── generate-claude-setup-complete-v2.sh # Main generator
├── validate-templates.sh              # Validation script
├── config/                           # Configuration templates
├── core/                            # Core documentation templates
├── github/                          # GitHub integration templates
├── mcp/                             # MCP templates
├── scripts/                         # Script templates
├── tools/                           # Tool templates
└── workflows/                       # Workflow templates
```

## Recommended Approach

### Option 1: Full Reset (Recommended)
1. Backup existing integration
2. Remove current .claude directory
3. Apply fresh integration with v2 generator
4. Merge existing MCP work into new structure

### Option 2: Incremental Update
1. Update configurations to match templates
2. Add missing files
3. Fix path inconsistencies
4. Preserve existing work

## Command to Execute (Option 1)

```bash
# Backup
tar -czf claude-backup-$(date +%Y%m%d-%H%M%S).tar.gz .claude .mcp

# Remove old integration
rm -rf .claude

# Apply new integration
cd docs/templates/claude
./generate-claude-setup-complete-v2.sh ../../../ plugin \
  "Obsidian Feed Contributors" \
  "team@obsidian-feed.dev" \
  "MIT" \
  --all

# Restore MCP customizations
# (manual merge of existing MCP work)
```

## Files to Preserve
- `.mcp/index.ts` - Has custom implementation
- `.mcp/operation-guard.ts` - Has project-specific logic
- Any custom scripts in `.mcp/`

## Expected Result
- Properly structured `.claude/` directory
- Updated configurations with all security patterns
- Consistent paths throughout
- Clean template directory
- Working validation and safety systems