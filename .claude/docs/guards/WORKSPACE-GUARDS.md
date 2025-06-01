<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Workspace Guards

This document defines the validation guards for the workspace hierarchy structure.

## Guard Definitions

### G-WORKSPACE-PROJECT
**Purpose**: Validate project naming format  
**Pattern**: `^[a-z]+-[0-9]+-[a-z-]+$`  
**Example**: `issue-13-cors-proxy`, `feature-42-dark-mode`  
**Implementation**: `.claude/scripts/validate-workspace.sh`

### G-WORKSPACE-PHASE
**Purpose**: Validate phase directories  
**Valid Values**: `FETCH`, `INV`, `ANA`, `PLAN`, `BUILD`, `VERIF`, `REL`  
**Implementation**: `.claude/scripts/validate-workspace.sh`

### G-WORKSPACE-TASK
**Purpose**: Validate task naming format  
**Pattern**: `^[A-Z]-[0-9]+-[a-z-]+$`  
**Example**: `P-1-rfc-draft`, `B-2-unit-tests`  
**Implementation**: `.claude/scripts/validate-workspace.sh`

### G-WORKSPACE-PROCESS
**Purpose**: Validate process directories  
**Required Directories**: 
- `01-investigation`
- `02-planning`
- `03-execution`
- `04-results`
**Implementation**: `.claude/scripts/validate-workspace.sh`

### G-WORKSPACE-META
**Purpose**: Validate metadata files exist  
**Required Files**:
- Project level: `.metadata.yml`
- Phase level: `.phase-status.yml`
- Task level: `.task-meta.yml` (optional)
**Implementation**: `.claude/scripts/validate-workspace.sh`

### G-WORKSPACE-FILE
**Purpose**: Validate file naming convention  
**Pattern**: `^[0-9]{8}-[0-9]{6}-[A-Z]+-[A-Z0-9]+-[a-z]+-[a-z-]+\.[a-z]+$`  
**Example**: `20250601-143022-PLAN-P1-inv-rfc-requirements.md`  
**Implementation**: `.claude/config/consolidated-safety-rules.json`

## Integration with Turn Guard

To integrate workspace validation with `turn_guard.sh`, add:

```bash
# Check workspace structure for any created directories
if grep -q "mkdir.*workspace/projects" "$file"; then
  project_dir=$(grep -o "workspace/projects/[^/]*" "$file" | head -1)
  if ! .claude/scripts/validate-workspace.sh 2>/dev/null; then
    echo "FAIL G-WORKSPACE: Invalid workspace structure"
    exit 1
  fi
fi
```

## Usage in CI/CD

```yaml
- name: Validate Workspace Structure
  run: |
    if [ -d ".claude/workspace" ]; then
      .claude/scripts/validate-workspace.sh
    fi
```

## Error Messages

### Project Naming
```
Error: Invalid project name format: myproject
Expected: {type}-{id}-{description} (e.g., issue-13-cors-proxy)
```

### Phase Naming
```
Error: Invalid phase name: TESTING in issue-13-cors-proxy
Valid phases: FETCH, INV, ANA, PLAN, BUILD, VERIF, REL
```

### Task Naming
```
Error: Invalid task name format: task1 in issue-13-cors-proxy/PLAN
Expected: {phase-letter}-{number}-{description} (e.g., P-1-rfc-draft)
```

### Missing Metadata
```
Error: Missing .metadata.yml in issue-13-cors-proxy
Warning: Missing .phase-status.yml in issue-13-cors-proxy/PLAN
```

## Enforcement Levels

- **ERROR**: Blocks workflow progression
  - Invalid project/phase/task names
  - Missing project metadata
  
- **WARNING**: Allows progression but logs issue
  - Missing phase status files
  - Missing process directories
  - Missing task metadata

## Best Practices

1. Always use `init-workspace.sh` to create new projects
2. Validate after any workspace modification
3. Include validation in pre-commit hooks
4. Run validation in CI pipeline
5. Fix warnings before they become errors