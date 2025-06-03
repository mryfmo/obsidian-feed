# Directory Restructure Migration Guide

**Date**: 2025-06-03  
**Type**: Directory reorganization  
**Impact**: Medium (references need updating)

## Summary

Reorganized `.mcp` and `tools` directories to create clearer separation between Claude-specific and general-purpose tools.

## Changes Made

### 1. Moved `.mcp` → `.claude/mcp-integration`
- **Rationale**: Makes it clear this is Claude's MCP integration, not general MCP
- **Files moved**: All TypeScript files, tests, and configurations
- **Total files**: 31 files moved

### 2. Moved Claude-specific tools → `.claude/validation`
- `tools/turn_guard.sh` → `.claude/validation/turn-guard.sh`
- `tools/validate-stp-markers.sh` → `.claude/validation/validate-stp.sh`
- **Rationale**: Claude-specific validation belongs with Claude integration

### 3. Updated References
- **GitHub Workflows**: 4 files updated
- **Documentation**: CLAUDE.md updated
- **Shell scripts**: Bridge pattern updated in 6 files
- **Test files**: 1 test file updated

## Impact on Developers

### If you have local scripts referencing old paths:
```bash
# Old
./tools/turn_guard.sh
./tools/validate-stp-markers.sh

# New
./.claude/validation/turn-guard.sh
./.claude/validation/validate-stp.sh
```

### If you have code referencing MCP:
```typescript
// Old
import { OperationGuard } from '.mcp/operation-guard';

// New
import { OperationGuard } from '.claude/mcp-integration/operation-guard';
```

## Verification Steps

1. **Check GitHub Actions**:
   ```bash
   grep -r "\.mcp\|tools/turn_guard\|tools/validate-stp" .github/workflows/
   ```
   Should return no results.

2. **Check shell scripts**:
   ```bash
   grep -r "\.mcp/bridge\.ts" tools/ .claude/
   ```
   Should only show new paths.

3. **Run tests**:
   ```bash
   pnpm test guard.spec.ts
   ```
   Should pass with new paths.

## Rollback Plan

If issues arise:
```bash
# Revert the commit
git revert HEAD

# Manual rollback (if needed)
git mv .claude/mcp-integration/* .mcp/
git mv .claude/validation/turn-guard.sh tools/turn_guard.sh
git mv .claude/validation/validate-stp.sh tools/validate-stp-markers.sh
```

## Benefits

1. **Clarity**: `.claude/` now contains all Claude-specific functionality
2. **Discoverability**: Easy to find all Claude integration files
3. **Maintainability**: Clear separation of concerns
4. **Future-proof**: Easy to add more Claude-specific tools

## Next Steps

- Monitor GitHub Actions for any issues
- Update any external documentation referencing old paths
- Consider creating symbolic links for backward compatibility if needed