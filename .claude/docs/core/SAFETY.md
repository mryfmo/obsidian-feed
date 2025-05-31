# Safety Rules and Implementation Guide - Obsidian Feed Reader

> **Template Version**: 1.0.0  
> **Last Updated**: 2024-05-31  
> **Compatibility**: Claude Code v1.0+

## Quick Start Checklist

- [x] Replace all variables with Obsidian Feed Reader values
- [x] Choose appropriate forbidden patterns for plugin type
- [x] Set up audit log location at `.claude/runtime/`
- [x] Configure operation levels for plugin development
- [x] Test with `npx tsx .mcp/test-operation-guard.ts`

## 1. Core Safety Configuration

### 1.1 Operation Permission Levels

```json
{
  "operations": {
    "read": { "level": 0, "auto_approve": true },
    "create": { "level": 1, "auto_approve": true },
    "modify": { "level": 1, "auto_approve": true },
    "delete": { "level": 2, "require_confirmation": true },
    "execute": { "level": 2, "require_confirmation": true },
    "publish": { "level": 3, "require_confirmation": true },
    "vault_modify": { "level": 3, "require_confirmation": true }
  }
}
```

**Obsidian Plugin Specific Operations**:
- `publish`: Publishing to Obsidian community plugins
- `vault_modify`: Direct vault file modifications outside plugin API

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

#### Obsidian Plugin Specific Patterns

```json
{
  "forbidden_patterns": [
    "manifest.json",
    "package.json",
    "versions.json",
    "*.md",
    ".gitignore",
    "tsconfig.json",
    ".obsidian/**",
    "**/node_modules/**",
    "**/.git/**"
  ],
  "forbidden_commands": [
    "npm publish",
    "yarn publish",
    "pnpm publish",
    "git push --force",
    "git push --tags",
    "npm version",
    "rm -rf .obsidian",
    "rm -rf data.json"
  ],
  "restricted_directories": [
    ".git",
    ".github", 
    "node_modules",
    "src",
    "docs",
    ".obsidian"
  ]
}
```

## 2. Audit Trail Configuration

### 2.1 Audit Log Structure

```typescript
interface AuditEntry {
  timestamp: ISO8601String;
  operation: "read" | "create" | "modify" | "delete" | "execute" | "publish" | "vault_modify";
  target: string;
  level: 0 | 1 | 2 | 3;
  user: string;
  status: "allowed" | "blocked" | "confirmed";
  reason?: string;
  rollback?: string;
  plugin_version?: string;
}
```

### 2.2 Log Locations

**Obsidian Feed Reader Setup**:
```bash
.claude/
├── runtime/
│   ├── audit.log          # Human-readable log
│   ├── audit.json         # Structured log for analysis
│   └── rollback.json      # Rollback commands registry
└── backups/              # Automatic backups before modifications
    └── YYYY-MM-DD/
        └── HH-MM-SS/
```

## 3. Confirmation Templates

### 3.1 Standard Confirmation Prompts

```yaml
delete_file:
  template: |
    ⚠️ DELETE FILE: {path}
    Reason: {reason}
    Impact: May affect plugin functionality
    Rollback: git checkout -- {path}
    
    Type 'yes' to confirm, 'no' to cancel:
  
delete_directory:
  template: |
    🚨 DELETE DIRECTORY: {path}
    Files affected: {file_count}
    Total size: {size_human}
    
    WARNING: Deleting plugin directories may break the plugin!
    
    Type 'DELETE {directory_name}' to confirm:

execute_command:
  template: |
    ⚡ EXECUTE COMMAND: {command}
    Working directory: {cwd}
    
    For plugin development, prefer:
    - pnpm dev (not npm start)
    - pnpm build (not npm run build)
    - pnpm test (not npm test)
    
    Type 'yes' to confirm, 'no' to cancel:
```

### 3.2 Obsidian Plugin Specific Confirmations

```yaml
modify_manifest:
  template: |
    📦 MODIFY PLUGIN MANIFEST
    Current version: {current_version}
    New version: {new_version}
    
    This will affect all users of the plugin!
    Have you tested the changes thoroughly?
    
    Type 'UPDATE MANIFEST' to confirm:

publish_plugin:
  template: |
    🚀 PUBLISH TO OBSIDIAN COMMUNITY
    Version: {version}
    Min Obsidian Version: {min_obsidian_version}
    
    Pre-publish checklist:
    - [ ] All tests passing
    - [ ] README updated
    - [ ] CHANGELOG updated
    - [ ] No console.log statements
    - [ ] Version bumped in manifest.json
    
    Type 'PUBLISH {version}' to confirm:

vault_operation:
  template: |
    📝 DIRECT VAULT OPERATION
    Operation: {operation}
    Target: {vault_path}
    
    ⚠️ Use Obsidian API instead:
    await this.app.vault.{suggested_method}
    
    Type 'OVERRIDE SAFETY' to proceed anyway:
```

## 4. Implementation Guide

### 4.1 Obsidian Plugin Implementation

```typescript
// 1. In main.ts, initialize safety checks
import { OperationGuard } from '.claude/scripts/operation-guard';

export default class FeedReaderPlugin extends Plugin {
  private operationGuard: OperationGuard;
  
  async onload() {
    // Initialize safety system
    this.operationGuard = new OperationGuard();
    
    // Example: Safe file deletion
    await this.safeDelete('old-feed.json');
  }
  
  async safeDelete(filename: string) {
    const canDelete = await this.operationGuard.checkOperation(
      'delete', 
      filename,
      { reason: 'Removing outdated feed data' }
    );
    
    if (!canDelete.allowed) {
      new Notice(`Cannot delete: ${canDelete.message}`);
      return;
    }
    
    if (canDelete.requiresConfirmation) {
      const modal = new ConfirmModal(this.app, canDelete.message);
      const confirmed = await modal.open();
      if (!confirmed) return;
    }
    
    // Proceed with deletion
    await this.app.vault.adapter.remove(filename);
  }
}
```

### 4.2 Integration Points

**GitHub Actions**:
```yaml
# .github/workflows/claude.yml
- name: Validate Claude Operation
  run: |
    source .github/scripts/claude-safety-wrapper.sh
    
    # Special check for manifest.json
    if [[ "${{ inputs.target }}" == "manifest.json" ]]; then
      echo "::warning::Manifest modification detected"
      check_approval_label
    fi
    
    check_file_operation "${{ inputs.operation }}" "${{ inputs.target }}"
```

**Pre-commit Hook**:
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check if manifest.json is being modified
if git diff --cached --name-only | grep -q "manifest.json"; then
  echo "⚠️  Manifest.json modification detected!"
  echo "Ensure version is bumped correctly"
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

npx tsx .claude/scripts/validate-operations.ts
```

## 5. Testing Your Configuration

### 5.1 Obsidian Plugin Specific Tests

```bash
# Test plugin-specific forbidden patterns
npm run test:safety -- --plugin-patterns

# Test vault operation blocks
npm run test:safety -- --vault-ops

# Test manifest protection
npm run test:safety -- --manifest

# Full Obsidian plugin safety suite
npm run test:obsidian-safety
```

### 5.2 Validation Checklist

- [x] Cannot delete manifest.json, package.json, versions.json
- [x] Cannot run npm/yarn/pnpm publish
- [x] Vault operations require Level 3 confirmation
- [x] Feed data operations are properly logged
- [x] Rollback commands work for plugin files

## 6. Common Pitfalls and Solutions

### Pitfall 1: Blocking Legitimate Plugin Development
**Symptom**: Can't modify source files during development  
**Solution**: Ensure `src/**/*.ts` modifications are Level 1 (auto-approved)

### Pitfall 2: Feed Data Loss
**Symptom**: Accidentally deleted user's feed subscriptions  
**Solution**: Always backup before deletion:
```typescript
// Before deleting feed data
await this.createBackup(feedFile);
await this.safeDelete(feedFile);
```

### Pitfall 3: Breaking Plugin Loading
**Symptom**: Modified manifest.json incorrectly  
**Solution**: Validate manifest before saving:
```typescript
import { validateManifest } from 'obsidian-plugin-cli';
if (!validateManifest(newManifest)) {
  throw new Error('Invalid manifest');
}
```

## 7. Quick Reference Card

```
Level 0: Read         → Always allowed (viewing code, configs)
Level 1: Create/Mod   → Auto-approved (src files, tests)
Level 2: Delete       → Confirmation required
Level 3: System       → Manifest, publish, vault operations

Plugin-Specific:
- manifest.json     → FORBIDDEN to delete, Level 3 to modify
- Feed data         → Level 2 to delete, Level 1 to modify  
- Vault files       → Level 3 (use Obsidian API instead)
- Publishing        → Level 3 + all checks must pass
```

## Validation Script

`.claude/test-obsidian-safety.ts`:

```typescript
import { validateSafetyRules } from '.claude/scripts/validate-safety';
import { Notice } from 'obsidian';

async function testObsidianSafety() {
  const tests = [
    { op: 'delete', target: 'manifest.json', expected: false },
    { op: 'modify', target: 'src/main.ts', expected: true },
    { op: 'delete', target: 'feed-data.json', expected: 'confirm' },
    { op: 'execute', target: 'npm publish', expected: false }
  ];
  
  const results = await validateSafetyRules(tests);
  
  if (results.failed > 0) {
    new Notice(`Safety tests failed: ${results.failed}`);
    process.exit(1);
  }
  
  console.log('✅ All Obsidian plugin safety tests passed!');
}

testObsidianSafety();
```