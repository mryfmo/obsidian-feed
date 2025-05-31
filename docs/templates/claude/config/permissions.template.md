# Permission Matrix - {{PROJECT_NAME}}

> **Template Version**: 1.0.0  
> **Project Type**: {{PROJECT_TYPE}}  
> **Last Updated**: {{LAST_UPDATED}}

## Quick Reference

| Level | Name | Auto-Approve | Examples |
|-------|------|--------------|----------|
| 0 | READ-ONLY | ✅ Yes | View files, search, analyze |
| 1 | SAFE-MODIFY | ✅ Yes | Create/edit source files |
| 2 | DESTRUCTIVE-MODIFY | ❌ No | Delete files, rename |
| 3 | SYSTEM-MODIFY | ❌ No | Config changes, publish |

## Detailed Permission Matrix

### Level 0: READ-ONLY Operations

**Always Allowed - No Confirmation Needed**

| Operation | Scope | Notes |
|-----------|-------|-------|
| Read file | Any file | Including sensitive files (logged) |
| List directory | Any directory | Full project traversal allowed |
| Search/Grep | All files | Pattern matching allowed |
| Analyze code | All files | Static analysis permitted |
| View logs | `.claude/runtime/*` | Audit trail visible |

### Level 1: SAFE-MODIFY Operations

**Auto-Approved - Logged for Audit**

| Operation | Scope | Conditions |
|-----------|-------|------------|
| Create file | `src/**`, `tests/**` | New files only |
| Edit file | Source code | No config files |
| Add dependency | `package.json` | Dev dependencies only |
| Run tests | Test suites | Read-only side effects |
| Build project | Output to `dist/` | No deployment |

**Project Type Specific - Level 1**

<details>
<summary><strong>Web Application</strong></summary>

| Operation | Allowed |
|-----------|---------|
| Create React component | ✅ |
| Edit styles/CSS | ✅ |
| Add route | ✅ |
| Modify state management | ✅ |
| Update API endpoints | ✅ |
</details>

<details>
<summary><strong>CLI Tool</strong></summary>

| Operation | Allowed |
|-----------|---------|
| Add command | ✅ |
| Edit command logic | ✅ |
| Update help text | ✅ |
| Add command flag | ✅ |
| Modify output format | ✅ |
</details>

<details>
<summary><strong>Plugin/Extension</strong></summary>

| Operation | Allowed |
|-----------|---------|
| Add feature | ✅ |
| Edit plugin logic | ✅ |
| Update UI components | ✅ |
| Add API integration | ✅ |
| Modify event handlers | ✅ |
</details>

### Level 2: DESTRUCTIVE-MODIFY Operations

**Requires Explicit Confirmation**

| Operation | Scope | Confirmation Required |
|-----------|-------|----------------------|
| Delete file | Any | "DELETE filename" |
| Delete directory | Non-critical | "DELETE dirname" |
| Rename/Move | Files/Dirs | "MOVE source TO dest" |
| Force overwrite | Existing files | "OVERWRITE filename" |
| Clean/Reset | Working directory | "CLEAN workspace" |
| Bulk operations | Multiple files | "BULK operation COUNT files" |

**Confirmation Template**:
```
⚠️ DESTRUCTIVE OPERATION REQUESTED
Operation: {{OPERATION}}
Target: {{TARGET}}
Impact: {{IMPACT_DESCRIPTION}}
Rollback: {{ROLLBACK_COMMAND}}

To proceed, type: {{CONFIRMATION_PHRASE}}
To cancel, type: CANCEL
```

### Level 3: SYSTEM-MODIFY Operations

**Requires Explicit Approval + Additional Checks**

| Operation | Scope | Additional Requirements |
|-----------|-------|------------------------|
| Modify config | `*.json`, `*.yml` | Show diff first |
| Change manifest | `manifest.json` | Version check |
| Publish package | npm/yarn/pnpm | All tests pass |
| Deploy | Production | Approval label |
| Database migration | Schema changes | Backup required |
| Security settings | Auth/Permissions | Security review |

**Approval Process**:
1. Show detailed diff/preview
2. Require explicit confirmation phrase
3. Log with timestamp and reason
4. Create rollback point
5. Notify administrators

## Forbidden Operations

**Never Allowed - Blocked Immediately**

| Operation | Reason |
|-----------|--------|
| `rm -rf /` | System destruction |
| Delete `.git` | Repository destruction |
| Modify `.env` with secrets | Security risk |
| Push --force to main | History destruction |
| Execute arbitrary shell | Security risk |
| Access parent directories | Scope violation |

## Project-Specific Permissions

### {{PROJECT_TYPE}} Specific Rules

```yaml
additional_permissions:
  - operation: "{{PROJECT_OPERATION}}"
    level: {{PROJECT_OPERATION_LEVEL}}
    reason: "{{PROJECT_OPERATION_REASON}}"
```

## Escalation Procedures

### When Uncertain
1. Default to higher permission level
2. Ask for explicit clarification
3. Provide examples of what will happen
4. Suggest safer alternatives

### Emergency Stop
User can type any of these to halt operations:
- `STOP`
- `CANCEL`  
- `ABORT`
- `Ctrl+C` (in terminal)

### Override Mechanism
For exceptional cases with explicit user approval:
```
OVERRIDE SAFETY: {{REASON}}
I UNDERSTAND THE RISKS: {{OPERATION}}
```

## Audit Requirements

### What Gets Logged

| Level | Logged Fields |
|-------|---------------|
| 0 | Timestamp, file, user |
| 1 | + operation, status |
| 2 | + reason, impact, rollback |
| 3 | + approval, reviewer, diff |

### Log Retention

- Level 0-1: 30 days
- Level 2: 90 days  
- Level 3: 1 year
- Failed operations: Permanent

## Implementation Checklist

- [ ] Permission levels configured in `claude-rules.json`
- [ ] Confirmation templates defined
- [ ] Audit logging enabled
- [ ] Rollback registry configured
- [ ] Emergency stop implemented
- [ ] Project-specific rules added
- [ ] Team training completed

## Testing Permissions

```bash
# Test permission system
npx tsx .claude/test-permissions.ts

# Verify specific operation
npx tsx .claude/check-permission.ts "delete" "src/index.ts"

# Audit log analysis
npx tsx .claude/analyze-audit.ts --level 2
```

---

**Template Variables**: 8  
**Customization Time**: ~20 minutes  
**Project Types Covered**: All