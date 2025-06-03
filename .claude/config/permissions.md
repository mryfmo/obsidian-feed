# Claude Code Permission Matrix

## 🔄 MANDATORY 7-STEP EXECUTION CYCLE

**ALL operations MUST follow the 7-step cycle. The required steps vary by operation level:**

### Cycle Requirements by Level:
- **LEVEL 0**: Steps 3-4 (Execute, Verify)
- **LEVEL 1**: Steps 1, 3-6 (Backup, Execute, Verify, Evaluate, Update)
- **LEVEL 2**: ALL 7 steps (Backup, Confirm, Execute, Verify, Evaluate, Update, Cleanup)
- **LEVEL 3**: ALL 7 steps + additional safety review

### The 7 Steps:
1. **BACKUP** - Create backups before changes
2. **CONFIRM** - Get user approval (LEVEL 2+ only)
3. **EXECUTE** - Perform the operation
4. **VERIFY** - Check results
5. **EVALUATE** - Assess success/failure
6. **UPDATE** - Track progress
7. **CLEANUP** - Remove temporary files

**Use `.claude/scripts/execute-task-with-cycle.sh` to ensure compliance.**

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
1. Complete BACKUP step of 7-step cycle
2. Operation description
3. Impact scope clarification
4. Rollback method presentation
5. Explicit approval wait (CONFIRM step)
6. Post-operation VERIFY and CLEANUP steps

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
- `.claude/workspace/` - Project workspace (gitignored)
- `.claude/` - Claude-specific configuration

## Escalation Rules

When uncertain:
1. Treat as one level higher
2. Request user confirmation
3. Provide alternatives

## Audit Requirements

All LEVEL 2+ operations must:
- Follow complete 7-step cycle
- Log before execution (part of EXECUTE step)
- Log execution results (part of VERIFY step)
- Save rollback information (part of BACKUP step)
- Log cycle compliance in `.claude/runtime/cycle-compliance.log`
- Report violations to `.claude/runtime/violations.log`

## Cycle Enforcement

### Automatic Enforcement:
- OperationGuard validates cycle compliance
- Scripts in `.claude/scripts/` automate cycle steps
- GitHub Actions verify cycle configuration

### Manual Enforcement:
- Each step must be explicitly logged
- Skipping steps triggers violation reporting
- Non-compliance blocks further operations