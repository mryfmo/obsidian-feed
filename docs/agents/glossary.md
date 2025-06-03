# Claude Integration Glossary

## Core Concepts

### Dual Process Model
The Claude integration system uses two complementary processes:
1. **Development Lifecycle** - Strategic management of work items (7 phases)
2. **Execution Cycle** - Tactical safety for operations (7 steps)

These processes work at different levels but integrate seamlessly during development.

## Development Lifecycle Terms (7 Phases)

### Phase
A major stage in the development lifecycle. Phases are denoted in UPPERCASE (FETCH, BUILD, etc.) and represent strategic milestones in managing work items.

### FETCH (Phase 1)
- **Definition**: Resource and documentation gathering phase
- **Purpose**: Collect all necessary information before starting work
- **Activities**: Download docs, read specifications, gather requirements
- **Example**: `tools/fetch_doc.sh URL` to download external documentation
- **Duration**: Typically 1-2 hours
- **Exit Gate**: All required resources are available locally

### INV (Investigation - Phase 2)
- **Definition**: Problem investigation and reproduction phase
- **Purpose**: Understand and reproduce the issue or requirement
- **Activities**: Reproduce bugs, analyze behavior, create test cases
- **Example**: Creating minimal reproduction steps for a bug
- **Duration**: 2-4 hours
- **Exit Gate**: Issue is fully understood and reproducible

### ANA (Analysis - Phase 3)
- **Definition**: Root cause analysis and solution design phase
- **Purpose**: Identify root causes and design solutions
- **Activities**: Code analysis, architecture review, solution design
- **Example**: Identifying why a feed parser fails on certain URLs
- **Duration**: 2-4 hours
- **Exit Gate**: Root cause identified, solution approach defined

### PLAN (Planning - Phase 4)
- **Definition**: Implementation planning and RFC creation phase
- **Purpose**: Create detailed implementation plan
- **Activities**: Write RFC, define tasks, estimate effort
- **Example**: Creating RFC for adding CORS proxy support
- **Duration**: 1-2 hours
- **Exit Gate**: RFC approved, tasks defined

### BUILD (Building - Phase 5)
- **Definition**: Implementation and coding phase
- **Purpose**: Implement the planned solution
- **Activities**: Write code, create tests, update documentation
- **Example**: Implementing new feed parsing logic
- **Duration**: 4-8 hours
- **Exit Gate**: Code complete, tests passing locally

### VERIF (Verification - Phase 6)
- **Definition**: Testing and validation phase
- **Purpose**: Ensure solution works correctly
- **Activities**: Run tests, validate edge cases, performance testing
- **Example**: Running full test suite, manual testing
- **Duration**: 1-2 hours
- **Exit Gate**: All tests pass, no regressions

### REL (Release - Phase 7)
- **Definition**: Release preparation and deployment phase
- **Purpose**: Prepare and deploy the solution
- **Activities**: Update changelog, create PR, deployment
- **Example**: Creating pull request with release notes
- **Duration**: 30 minutes - 1 hour
- **Exit Gate**: Solution deployed/merged

## Execution Cycle Terms (7 Steps)

### Step
An individual action in the execution cycle. Steps are numbered (Step 1: Backup) and ensure safe execution of operations.

### BACKUP (Step 1)
- **Definition**: Create safety backups before operations
- **Purpose**: Enable rollback if operation fails
- **Script**: `.claude/scripts/create-task-backup.sh`
- **Example**: Backing up config files before modification
- **Required for**: Operation levels 1, 2, 3

### CONFIRM (Step 2)
- **Definition**: Get explicit user approval
- **Purpose**: Prevent unintended destructive operations
- **Script**: `.claude/scripts/request-confirmation.sh`
- **Example**: "Delete file.ts? This cannot be undone. (yes/no)"
- **Required for**: Operation levels 2, 3

### EXECUTE (Step 3)
- **Definition**: Perform the actual operation
- **Purpose**: Complete the requested action
- **Example**: Actually deleting the file or running the command
- **Required for**: All operation levels

### VERIFY (Step 4)
- **Definition**: Check operation results
- **Purpose**: Ensure operation completed successfully
- **Script**: `.claude/scripts/verify-task.sh`
- **Example**: Checking file was deleted, tests still pass
- **Required for**: All operation levels

### EVALUATE (Step 5)
- **Definition**: Assess overall success/failure
- **Purpose**: Determine if objectives were met
- **Script**: `.claude/scripts/evaluate-task.sh`
- **Example**: Evaluating if refactoring improved code quality
- **Required for**: Operation levels 1, 2, 3

### UPDATE (Step 6)
- **Definition**: Update progress tracking
- **Purpose**: Maintain audit trail and progress visibility
- **Script**: `.claude/scripts/update-progress.sh`
- **Example**: Logging "Deleted 3 deprecated files"
- **Required for**: Operation levels 1, 2, 3

### CLEANUP (Step 7)
- **Definition**: Clean up temporary resources
- **Purpose**: Remove temporary files, free resources
- **Script**: `.claude/scripts/cleanup-task.sh`
- **Example**: Removing backup files after successful operation
- **Required for**: Operation levels 2, 3

## Operation Levels

### Level 0 (Read-Only)
- **Definition**: Non-modifying operations
- **Examples**: Reading files, listing directories, git status
- **Cycle Requirements**: Steps 3-4 only (Execute, Verify)
- **Approval**: Automatic

### Level 1 (Safe Modifications)
- **Definition**: Non-destructive changes
- **Examples**: Creating new files, editing content
- **Cycle Requirements**: Steps 1, 3-6 (no Confirm, no Cleanup)
- **Approval**: Automatic

### Level 2 (Destructive Operations)
- **Definition**: Operations that remove or overwrite data
- **Examples**: File deletion, git reset, bulk replacements
- **Cycle Requirements**: All 7 steps mandatory
- **Approval**: Requires explicit user confirmation

### Level 3 (System Changes)
- **Definition**: Critical system or configuration changes
- **Examples**: Modifying tsconfig.json, package.json
- **Cycle Requirements**: All 7 steps + additional review
- **Approval**: Requires explicit approval with explanation

## Key Concepts

### Lifecycle vs Cycle
- **Development Lifecycle**: Strategic management of work items (7 phases)
- **Execution Cycle**: Tactical safety for operations (7 steps)
- **Relationship**: During each lifecycle phase, multiple execution cycles may occur

### Audit Trail
- **Definition**: Permanent record of all operations
- **Location**: `.claude/runtime/audit.log`
- **Purpose**: Accountability, debugging, compliance
- **Contents**: Timestamp, operation, user, result

### Rollback Registry
- **Definition**: Record of how to undo operations
- **Location**: `.claude/runtime/rollback-registry.json`
- **Purpose**: Enable recovery from failed operations
- **Contents**: Operation ID, rollback commands

### Cycle Compliance
- **Definition**: Adherence to mandatory execution cycle
- **Validation**: Automated via OperationGuard
- **Enforcement**: Operations blocked if cycle not followed
- **Violations**: Logged to `.claude/runtime/violations.log`

### Workspace Hierarchy
The standardized directory structure for organizing work:
```
.claude/workspace/projects/{project-name}/{PHASE}/{task-id}/{process}/
```

### Phase Transition
Moving from one development phase to another, requiring:
- Completion of current phase deliverables
- Update of phase status files
- Validation of exit gates

### Exit Gate
Criteria that must be met before transitioning to the next phase. Each phase has specific deliverables and validation requirements.

## Common Abbreviations

- **STP**: Standard Task Protocol
- **RFC**: Request for Comments
- **MCP**: Model Context Protocol
- **LOC**: Lines of Code
- **CI/CD**: Continuous Integration/Continuous Deployment
- **PR**: Pull Request
- **QA**: Quality Assurance

## Agent Types

### Developer Agent
Implements features and fixes bugs following the development lifecycle.

### Reviewer Agent
Reviews code changes, validates phase transitions, ensures compliance.

### Tester Agent
Creates and executes test plans, validates implementations.

### Doc Writer Agent
Creates and maintains documentation throughout the development process.

### Release Agent
Manages the release process, creates changelogs, handles deployments.