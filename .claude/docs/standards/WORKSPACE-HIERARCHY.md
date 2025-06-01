<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Workspace Hierarchy Standards

## Overview

This document defines the standard hierarchy for organizing work in the Claude workspace, clearly separating projects, phases, tasks, and processes.

## Hierarchy Levels

### Level 1: Project
- **Definition**: A complete work item (Issue, Feature, Bug, etc.)
- **Examples**: `issue-13-cors-proxy`, `feature-42-dark-mode`, `bug-99-memory-leak`
- **Naming**: `{type}-{id}-{brief-description}`

### Level 2: Phase
- **Definition**: One of the 7 development phases
- **Values**: `FETCH`, `INV`, `ANA`, `PLAN`, `BUILD`, `VERIF`, `REL`
- **Purpose**: Major stages of development lifecycle

### Level 3: Task
- **Definition**: Specific deliverable within a phase
- **Examples**: `P-1-rfc-draft`, `B-2-unit-tests`, `V-3-performance-test`
- **Naming**: `{phase-prefix}-{number}-{description}`

### Level 4: Process
- **Definition**: Work stages for each task
- **Standard Processes**:
  - `01-investigation` - Research and requirements gathering
  - `02-planning` - Design and approach planning
  - `03-execution` - Implementation work
  - `04-results` - Outcomes and deliverables

## Directory Structure

```
.claude/workspace/
├── projects/
│   └── {project-name}/              # Level 1: Project
│       ├── .metadata.yml            # Project metadata
│       ├── {PHASE}/                 # Level 2: Phase
│       │   ├── .phase-status.yml    # Phase completion status
│       │   └── {task-id}/           # Level 3: Task
│       │       ├── .task-meta.yml   # Task metadata
│       │       ├── 01-investigation/# Level 4: Process
│       │       ├── 02-planning/
│       │       ├── 03-execution/
│       │       └── 04-results/
│       └── archive/                 # Completed phases
│
├── templates/                       # Reusable templates
│   ├── project-template/
│   ├── phase-templates/
│   └── task-templates/
│
└── .gitignore                      # Ignore entire workspace
```

## File Naming Convention

### Formal Convention (for deliverables)
```
{timestamp}-{phase}-{task}-{process}-{description}.{ext}

Where:
- timestamp: YYYYMMDD-HHMMSS
- phase: Current phase (FETCH, INV, etc.)
- task: Task ID (P-1, B-2, etc.)
- process: Process stage (inv, plan, exec, result)
- description: Brief description in kebab-case

Examples:
- 20250601-143022-PLAN-P1-inv-rfc-requirements.md
- 20250601-152344-BUILD-B2-exec-unit-test-implementation.ts
- 20250601-163055-VERIF-V3-result-performance-report.md
```

### Simplified Convention (for working files)
For day-to-day work, simpler names are acceptable:
```
- investigation-notes.md
- approach-draft.md
- test-results.log
```

The formal convention is required for:
- Final deliverables
- Cross-phase references
- Audit trail documents

## Metadata Files

### Project Metadata (.metadata.yml)
```yaml
project:
  id: "issue-13-cors-proxy"
  type: "issue"
  title: "CORS Proxy Privacy Enhancement"
  created: "2025-06-01T10:00:00Z"
  status: "active"
  current_phase: "PLAN"
  github_issue: 13
```

### Phase Status (.phase-status.yml)
```yaml
phase: "PLAN"
entered: "2025-06-01T14:00:00Z"
tasks:
  P-1: "completed"
  P-2: "in-progress"
  P-3: "pending"
  P-4: "pending"
exit_criteria:
  rfc_approved: false
  reviewer_signoff: false
```

### Task Metadata (.task-meta.yml) - Optional
```yaml
task:
  id: "P-1"
  name: "RFC Draft Creation"
  started: "2025-06-01T14:30:00Z"
  status: "completed"
  deliverables:
    - "rfc-001-cors-proxy-privacy.md"
```

## Archive Structure

The `archive/` directory stores completed or abandoned work:

```
archive/
├── completed/           # Successfully completed projects
│   └── {project-name}-{completion-date}/
├── cancelled/          # Cancelled or abandoned projects
│   └── {project-name}-{cancellation-date}/
└── README.md          # Archive log with reasons
```

### Archive Rules
1. Move entire project directory when complete
2. Add completion/cancellation date to directory name
3. Update archive README with:
   - Reason for archival
   - Final status
   - Key deliverables location
4. Remove from active workspace after archival

## Usage Examples

### Creating a New Project
```bash
# Start new project for Issue #20
mkdir -p .claude/workspace/projects/issue-20-feed-pagination
cd .claude/workspace/projects/issue-20-feed-pagination

# Create metadata
cat > .metadata.yml << EOF
project:
  id: "issue-20-feed-pagination"
  type: "issue"
  title: "Implement Feed Pagination"
  created: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  status: "active"
  current_phase: "INV"
  github_issue: 20
EOF
```

### Working on a Task
```bash
# Navigate to task
cd .claude/workspace/projects/issue-13-cors-proxy/PLAN/P-1-rfc-draft

# Create investigation notes
mkdir -p 01-investigation
echo "# RFC Requirements Investigation" > 01-investigation/20250601-143022-PLAN-P1-inv-requirements.md
```

## Validation Rules

### Required Validations
1. **Project names** must match pattern: `{type}-{id}-{description}`
2. **Phase directories** must be uppercase and valid phase names
3. **Task directories** must match pattern: `{phase-letter}-{number}-{description}`
4. **Process directories** must be numbered 01-04
5. **Project level** must have `.metadata.yml`
6. **Phase level** should have `.phase-status.yml` (warning if missing)

### Optional Elements
- Task-level `.task-meta.yml` files
- Simplified file names for working documents
- Additional subdirectories within process folders

## Workspace Maintenance

### Size Limits
- Workspace should not exceed 500MB total
- Individual projects should not exceed 100MB
- Archive projects when complete

### Cleanup Procedures
1. Run monthly: `find .claude/workspace -name "*.log" -mtime +30 -delete`
2. Archive completed projects within 7 days of completion
3. Remove cancelled projects after documenting reasons
4. Clear empty directories: `find .claude/workspace -type d -empty -delete`

## Benefits

1. **Clear Separation**: No confusion between different hierarchy levels
2. **Complete Tracking**: Every piece of work is traceable
3. **Consistent Structure**: Same pattern for all projects
4. **Easy Navigation**: Find any artifact quickly
5. **Audit Trail**: Full history of decisions and changes

## Migration from tmp-docs

### Step 1: Identify Existing Content
```bash
find .claude/tmp-docs -type f -name "*.md" | while read file; do
  echo "Found: $file"
  # Determine appropriate project based on content
done
```

### Step 2: Create Project Structure
```bash
# For each identified project
.claude/scripts/init-workspace.sh issue 13 "cors-proxy-privacy"
```

### Step 3: Move Files
```bash
# Move to appropriate phase/task/process
mv .claude/tmp-docs/analysis/issue-13-*.md \
   .claude/workspace/projects/issue-13-cors-proxy/ANA/
```

### Step 4: Archive tmp-docs
```bash
mv .claude/tmp-docs .claude/workspace/archive/legacy-tmp-docs-$(date +%Y%m%d)
```

## Common Scenarios

### Scenario 1: Multiple People Working
- Each person works in their own task directory
- Use git branches named after task IDs
- Merge completed tasks back to main branch

### Scenario 2: Long-Running Projects
- Keep project active across multiple PRs
- Update phase status as work progresses
- Archive only when fully complete

### Scenario 3: Failed/Abandoned Work
- Move to `archive/cancelled/` with explanation
- Document lessons learned in archive README
- Keep for future reference