# Safety Rules and Implementation Guide

> **Template Version**: 1.0.0  
> **Last Updated**: 2024-05-31  
> **Compatibility**: Claude Code v1.0+

## Quick Start Checklist

- [ ] Replace all `{{VARIABLES}}` with your values
- [ ] Choose appropriate forbidden patterns for your project type
- [ ] Set up audit log location
- [ ] Configure operation levels
- [ ] Test with `npx tsx .mcp/test-operation-guard.ts`

## 1. Core Safety Configuration

### 1.1 Operation Permission Levels

```json
{
  "operations": {
    "read": { "level": 0, "auto_approve": true },
    "create": { "level": 1, "auto_approve": true },
    "modify": { "level": 1, "auto_approve": true },
    "delete": { "level": 2, "require_confirmation": true },
    "execute": { "level": 2, "require_confirmation": true }
  }
}
```

**Customization Required**:
- `{{PROJECT_SENSITIVE_OPS}}`: Add operations specific to your domain

### 1.2 Forbidden Patterns

#### Universal Forbidden Operations (DO NOT REMOVE)
```json
{
  "forbidden_commands": [
    "rm -rf /",
    "rm -rf /*", 
    ":(){ :|:& };:",
    "dd if=/dev/random of=/dev/sda",
    "chmod -R 777 /",
    "chown -R nobody:nobody /"
  ]
}
```

#### Project Type Specific Patterns

<details>
<summary><strong>Web Application</strong></summary>

```json
{
  "forbidden_patterns": [
    "*.env",
    ".env.*",
    "**/*secret*",
    "**/*private*",
    "**/node_modules/**",
    "**/.git/**"
  ],
  "forbidden_commands": [
    "npm publish",
    "yarn publish", 
    "git push --force",
    "DROP DATABASE",
    "DELETE FROM users"
  ]
}
```
</details>

<details>
<summary><strong>CLI Tool</strong></summary>

```json
{
  "forbidden_patterns": [
    "~/.ssh/**",
    "~/.aws/**",
    "~/.config/**",
    "/etc/**",
    "/usr/bin/**"
  ],
  "forbidden_commands": [
    "sudo rm",
    "pkill",
    "killall",
    "systemctl stop"
  ]
}
```
</details>

<details>
<summary><strong>Plugin/Extension</strong></summary>

```json
{
  "forbidden_patterns": [
    "manifest.json",
    "package.json",
    "plugin.json",
    "**/dist/**",
    "**/build/**"
  ],
  "forbidden_commands": [
    "npm version",
    "npm publish",
    "git tag -a",
    "git push --tags"
  ]
}
```
</details>

**Your Project Type**: {{PROJECT_TYPE}}

```json
{
  "forbidden_patterns": [
    {{PROJECT_FORBIDDEN_PATTERNS}}
  ],
  "forbidden_commands": [
    {{PROJECT_FORBIDDEN_COMMANDS}}
  ]
}
```

## 2. Audit Trail Configuration

### 2.1 Audit Log Structure

```typescript
interface AuditEntry {
  timestamp: ISO8601String;
  operation: "read" | "create" | "modify" | "delete" | "execute";
  target: string;
  level: 0 | 1 | 2 | 3;
  user: string;
  status: "allowed" | "blocked" | "confirmed";
  reason?: string;
  rollback?: string;
}
```

### 2.2 Log Locations

**Standard Setup**:
```bash
.claude/
├── runtime/
│   ├── audit.log          # Human-readable log
│   ├── audit.json         # Structured log
│   └── rollback.json      # Rollback registry
└── backups/              # Automatic backups
    └── YYYY-MM-DD/
```

**Custom Location** (if needed):
```bash
{{PROJECT_AUDIT_PATH}}/audit.log
```

## 3. Confirmation Templates

### 3.1 Standard Confirmation Prompts

```yaml
delete_file:
  template: |
    ⚠️ DELETE FILE: {path}
    Reason: {reason}
    Impact: {impact}
    Rollback: {rollback_command}
    
    Type 'yes' to confirm, 'no' to cancel:
  
delete_directory:
  template: |
    🚨 DELETE DIRECTORY: {path}
    Files affected: {file_count}
    Total size: {size_human}
    This action CANNOT be undone via git if directory is not tracked.
    
    Type 'DELETE {directory_name}' to confirm:

execute_command:
  template: |
    ⚡ EXECUTE COMMAND: {command}
    Working directory: {cwd}
    Environment: {env_vars}
    Estimated duration: {duration}
    
    Type 'yes' to confirm, 'no' to cancel:
```

### 3.2 Custom Confirmations

Add your project-specific confirmations:

```yaml
{{PROJECT_OPERATION}}:
  template: |
    {{PROJECT_CONFIRMATION_TEMPLATE}}
```

## 4. Implementation Guide

### 4.1 Basic Implementation

```typescript
// 1. Create claude-rules.json
const rules = {
  "$schema": "https://claude.ai/schemas/rules/v1",
  "version": "1.0.0",
  "enforce": true,
  "rules": { /* Your rules from above */ }
};

// 2. Initialize OperationGuard
import { OperationGuard } from '.claude/scripts/operation-guard';
const guard = new OperationGuard();

// 3. Check operations before execution
const canDelete = await guard.checkOperation('delete', 'config.json');
if (!canDelete.allowed) {
  throw new Error(canDelete.message);
}
```

### 4.2 Integration Points

**GitHub Actions**:
```yaml
- name: Validate Claude Operation
  run: |
    source .github/scripts/claude-safety-wrapper.sh
    check_file_operation "${{ inputs.operation }}" "${{ inputs.target }}"
```

**Pre-commit Hook**:
```bash
#!/bin/bash
# .git/hooks/pre-commit
npx tsx .claude/scripts/validate-operations.ts
```

## 5. Testing Your Configuration

### 5.1 Test Commands

```bash
# Test forbidden patterns
npm run test:safety -- --forbidden

# Test confirmation flow  
npm run test:safety -- --confirmations

# Test audit logging
npm run test:safety -- --audit

# Full safety test suite
npm run test:safety
```

### 5.2 Validation Checklist

- [ ] All forbidden patterns block correctly
- [ ] Confirmation prompts appear for level 2+ operations
- [ ] Audit log captures all operations
- [ ] Rollback commands are generated
- [ ] Custom rules work as expected

## 6. Common Pitfalls and Solutions

### Pitfall 1: Too Restrictive
**Symptom**: Claude can't perform basic tasks  
**Solution**: Review level 1 operations, ensure they're auto-approved

### Pitfall 2: Audit Log Growing Too Large
**Symptom**: Disk space issues  
**Solution**: Implement log rotation:
```bash
# Add to crontab
0 0 * * 0 /usr/bin/find {{AUDIT_PATH}} -name "*.log" -mtime +30 -delete
```

### Pitfall 3: Missing Rollback Info
**Symptom**: Can't undo operations  
**Solution**: Ensure all level 2+ operations include rollback commands

## 7. Quick Reference Card

```
Level 0: Read      → Always allowed
Level 1: Create    → Auto-approved (safe)
Level 2: Delete    → Requires confirmation  
Level 3: System    → Requires explicit approval + reviewer

Forbidden → Blocked immediately, no override
Restricted → Warning shown, can proceed with caution
```

## Template Metadata

**Customization Effort**: ~30 minutes  
**Variables to Replace**: 6  
**Optional Sections**: 2  
**Project Types Covered**: Web, CLI, Plugin  

---

## Validation Script

Save as `.claude/test-safety-config.ts`:

```typescript
import { validateSafetyRules } from '.claude/scripts/validate-safety';

async function test() {
  const results = await validateSafetyRules();
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  if (results.failed > 0) {
    process.exit(1);
  }
}

test();
```