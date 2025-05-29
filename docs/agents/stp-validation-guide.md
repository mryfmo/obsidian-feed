# STP Validation Guide

This guide explains how the Standard Task Protocol (STP) validation works and how to ensure your PRs pass validation.

## Overview

The STP Guard validates that all pull requests follow the Standard Task Protocol by checking for state transition markers or checklist updates. This ensures proper task lifecycle tracking.

## What Gets Validated

The validation checks **three sources** for STP markers:

### 1. Pull Request Body
The PR description is checked for:
- State transition markers: `State-Transition: INV→ANA`
- Checklist items: `- [x] INV: Investigation complete`
- Phase markers: `INV ✅`, `ANA ✓`

### 2. All Commit Messages
**Every commit** in the PR is checked, not just the latest one:
- Commit footers: `State-Transition: BUILD→VERIF`
- Inline markers: `[x] PLAN: RFC created`

### 3. Changed Documentation Files
Diffs in these files are checked for checklist updates:
- `docs/rfcs/*.md`
- `docs/qa/*.md`
- `.github/*.md`

## Valid STP Markers

### State Transition Format
```
State-Transition: CURRENT→NEXT
State-Transition: INV → ANA
State-Transition: BUILD -> VERIF
```

### Checklist Format
```markdown
- [x] INV: Investigation complete
- [x] ANA: Root cause identified
- [ ] PLAN: RFC not yet created
```

### Phase Markers
```
INV ✅
ANA ✓
PLAN ☑
```

### Valid Phases
- `INV` - Investigation
- `ANA` - Analysis
- `PLAN` - Planning
- `BUILD` - Building/Implementation
- `VERIF` - Verification
- `REL` - Release

## How to Add STP Markers

### Method 1: In PR Description
When creating or editing a PR, add a checklist:

```markdown
## Changes
Fixed the feed parsing issue.

## STP Progress
- [x] INV: Reproduced the issue with test case
- [x] ANA: Identified root cause in parser logic
- [x] PLAN: Simple fix, no RFC needed
- [x] BUILD: Updated parser and tests
- [ ] VERIF: Awaiting review
```

### Method 2: In Commit Messages
Add state transitions to your commits:

```bash
git commit -m "Fix feed parser edge case

Handles empty feed titles gracefully.

State-Transition: BUILD→VERIF"
```

### Method 3: In Documentation
Update checklists in RFC or QA documents:

```markdown
# RFC-001: Feed Parser Improvements

## Progress
- [x] INV: Issue investigated
- [x] ANA: Analysis complete
- [x] PLAN: This RFC
- [ ] BUILD: Implementation pending
```

## Local Validation

You can validate STP markers locally before pushing:

### Traditional Shell Script
```bash
# Check current branch
./tools/validate-stp-markers.sh

# Check with PR body
./tools/validate-stp-markers.sh "Your PR description here"

# Check specific commit range
./tools/validate-stp-markers.sh "" origin/main feature-branch
```

### MCP-Enhanced Execution
```bash
# Check with MCP bridge (intelligent fallback)
npx tsx .mcp/bridge.ts validate_stp_markers

# With PR body
npx tsx .mcp/bridge.ts validate_stp_markers "Your PR description"
```

**Note**: The MCP integration provides enhanced validation with caching and performance optimization. It automatically falls back to the shell script if MCP servers are unavailable.

## CI/CD Integration

The STP Guard runs automatically on:
- PR creation
- PR edits
- New commits
- PR reopening

### Workflow Details

1. **Full History**: The workflow fetches complete git history to check all commits
2. **Multiple Sources**: Checks PR body, all commits, and file changes
3. **Clear Feedback**: Shows exactly where markers were found or missing

## Troubleshooting

### "No STP markers found"
This means none of the three sources contained valid markers. Add markers using any of the methods above.

### "Lifecycle spec missing"
The file `docs/agents/01_task-lifecycle.md` must exist in the repository.

### Shallow Clone Issues
If running locally with a shallow clone:
```bash
git fetch --unshallow
```

### Special Characters
Both arrow formats work:
- Unicode arrow: `→` (U+2192)
- ASCII arrow: `->`

## Examples of Valid Markers

### In PR Body
```markdown
This PR implements the new feed parser.

Progress:
- [x] INV: Investigated performance issues
- [x] ANA: Profiled and found bottleneck
- [x] PLAN: Created optimization plan
- [x] BUILD: Implemented caching
- [ ] VERIF: Performance testing pending
```

### In Commit Message
```
refactor: Extract feed validation logic

Moved validation to separate module for reusability.
Added comprehensive test coverage.

State-Transition: BUILD→VERIF
Co-authored-by: @teammate
```

### In Changed Files
```diff
# docs/rfcs/002-feed-validation.md

## Implementation Progress
- - [ ] BUILD: Implementation
+ - [x] BUILD: Implementation complete
```

## Benefits

1. **Traceability**: Every PR shows its position in the task lifecycle
2. **Automation**: CI/CD can enforce workflow compliance
3. **Flexibility**: Multiple ways to add markers
4. **Completeness**: Checks all commits, not just the latest

## Related Documentation

- [`01_task-lifecycle.md`](./01_task-lifecycle.md) - Full STP specification
- [`validate-stp-markers.sh`](../../tools/validate-stp-markers.sh) - Validation script (MCP-enhanced)
- [`.github/workflows/stp-guard.yml`](../../.github/workflows/stp-guard.yml) - CI workflow
- [`MCP_DOCUMENTATION.md`](../../MCP_DOCUMENTATION.md) - Complete MCP integration details
- [`.mcp/bridge.ts`](../../.mcp/bridge.ts) - MCP bridge implementation