<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Template Deviations Documentation

This document lists deviations from the Claude integration templates.

**Note**: Rules and specifications can be flexibly added or modified based on project needs. This document simply records the current differences.

## Major Deviations

### 1. Workspace System
**Deviation**: Added `.claude/workspace/` directory hierarchy not present in templates.

**Rationale**: 
- Provides structured project management following 7-phase development process
- Keeps work-in-progress separate from tracked files
- Enables better collaboration and audit trails

**Impact**: 
- More complex than template but provides significant value
- Requires additional validation scripts

### 2. Consolidated Safety Rules
**Deviation**: Created `consolidated-safety-rules.json` not in template.

**Rationale**:
- Unifies all safety rules in one place
- Reduces duplication and potential conflicts
- Easier to maintain and validate

**Impact**:
- Single source of truth for safety configuration
- May need updates when templates change

### 3. Enhanced MCP Implementation
**Deviation**: MCP module significantly expanded beyond template scope.

**Components Added**:
- `bridge.ts` - Provides fallback mechanism
- `vitest.config.ts` - Testing configuration
- Multiple test files and utilities

**Rationale**:
- Production-ready implementation requires testing
- Bridge pattern allows graceful degradation
- Better error handling and validation

### 4. Additional Scripts
**Deviation**: Added scripts not in template:
- `init-workspace.sh`
- `validate-workspace.sh`
- `test-claude-setup.sh`

**Rationale**:
- Workspace system requires initialization and validation
- Test script ensures setup integrity
- Improves developer experience

### 5. Extended Documentation
**Deviation**: Added documentation beyond template:
- `.claude/docs/standards/`
- `.claude/docs/guards/`
- `.claude/docs/integration/`
- `.claude/docs/QUICKSTART.md`

**Rationale**:
- Complex systems need comprehensive documentation
- Standards ensure consistency
- Quick start guide improves onboarding

## Minor Deviations

### Configuration Enhancements
1. **permissions.md** - Updated with workspace-specific paths
2. **safety-checks.json** - Added workspace validation rules
3. **claude-rules.json** - Removed template comments, added project-specific rules

### Structural Changes
1. Moved some scripts from `scripts/` to `.claude/scripts/`
2. Added `.claude/runtime/rollback-registry.json` for better rollback tracking
3. Enhanced audit logging structure

## Template Compatibility

Despite these deviations, the implementation remains compatible with the template structure:
- All required template files exist
- Core functionality matches template expectations
- Additional features are additive, not breaking

## Maintenance Considerations

When updating from new template versions:
1. Preserve workspace system additions
2. Merge safety rules carefully
3. Keep enhanced MCP features
4. Update test script for new requirements
5. Document any new deviations

## Summary

Current implementation extends the template with additional features while maintaining core compatibility.