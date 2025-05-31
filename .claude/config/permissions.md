# Claude Code Permission Matrix

## Operation Level Definitions

### LEVEL 0: READ-ONLY
- File reading (Read, Grep, LS tools)
- Status checks (git status, ls, etc.)
- Non-destructive analysis
- Test execution result viewing

### LEVEL 1: SAFE-MODIFY
- New file creation (additive only)
- Existing file editing (content changes)
- Test execution
- Build execution
- Linter execution

### LEVEL 2: DESTRUCTIVE-MODIFY ⚠️
- File deletion (rm, git rm)
- File move/rename (mv)
- Directory deletion (rm -rf)
- git clean operations
- Bulk replacement operations

### LEVEL 3: SYSTEM-MODIFY 🚨
- Configuration file changes (tsconfig.json, package.json, etc.)
- .gitignore modifications
- CI/CD configuration changes (.github/workflows/)
- Security-related file changes

## Mandatory Confirmation Rules

### Required before LEVEL 2+ operations:
1. Operation description
2. Impact scope clarification
3. Rollback method presentation
4. Explicit approval wait

### Confirmation Template:
```
⚠️ Destructive operation requires confirmation:

【Operation】
- {specific operation details}

【Impact】
- {affected files/features}

【Reason】
- {why this operation is necessary}

【Rollback Method】
- {steps to revert}

Do you approve this operation? (yes/no)
```

## Auto-Approved Operations

The following operations can be executed without confirmation:
- All LEVEL 0 operations
- LEVEL 1 operations (except bulk file creation)
- Information retrieval (git status, git diff, etc.)
- Test execution (npm/pnpm test, etc.)

## Forbidden Operations

Never execute the following:
- `rm -rf /` or system directory deletion
- `git push --force` (without explicit instruction)
- Creating/editing files containing credentials
- Direct .env file editing
- Private key generation/manipulation

## Directories Requiring Special Consideration

Additional confirmation required for:
- `.git/` - Git management directory
- `node_modules/` - Dependencies (usually no operation needed)
- `.github/` - GitHub Actions configuration
- `.tmp-docs/` - Temporary documentation (gitignored)
- `.claude/` - Claude-specific configuration

## Escalation Rules

When uncertain:
1. Treat as one level higher
2. Request user confirmation
3. Provide alternatives

## Audit Requirements

All LEVEL 2+ operations must:
- Log before execution
- Log execution results
- Save rollback information