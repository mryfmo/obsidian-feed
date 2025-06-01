<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# RFC Workflow and Document Placement

This document clarifies the RFC (Request for Comments) creation workflow and temporary document placement rules.

## Document Placement Rules

### 1. Project Workspace Documents
- **Location**: `.claude/workspace/projects/{project-name}/{PHASE}/{task-id}/{process}/`
- **Purpose**: All project-related work following the standard hierarchy
- **Git Status**: Ignored (per `.claude/.gitignore`)
- **Example**:
  ```
  .claude/workspace/projects/issue-13-cors-proxy/PLAN/P-1-rfc-draft/
  ├── 01-investigation/    # Research and requirements
  ├── 02-planning/         # Design and approach
  ├── 03-execution/        # Draft iterations
  └── 04-results/          # Final RFC draft
  ```

### 2. Final Documents
- **Location**: `docs/`
- **Purpose**: Completed, reviewed, and approved documentation
- **Git Status**: Tracked
- **Structure**:
  ```
  docs/
  ├── rfcs/         # Approved RFCs (NNN-slug.md format)
  ├── qa/           # QA sheets and test reports
  ├── agents/       # Agent documentation
  └── dev-notes/    # Development notes
  ```

## RFC Creation Workflow

### Phase 1: Draft Creation (PLAN phase)
1. Create project workspace: `.claude/workspace/projects/{project-name}/PLAN/P-1-rfc-draft/`
2. Copy RFC template to `03-execution/` directory
3. Follow naming convention: `YYYYMMDD-HHMMSS-PLAN-P1-exec-rfc-draft.md`
4. Iterate on content without affecting git history

### Phase 2: Review and Refinement
1. Move draft to `04-results/` when ready for review
2. Create review feedback in `04-results/feedback/`
3. Update status markers in the draft

### Phase 3: Finalization

#### Approval Process
1. **Self Review**: Ensure RFC meets all requirements
2. **Peer Review**: Request review from team members or maintainers
3. **Approval Criteria**:
   - Technical feasibility confirmed
   - Risk mitigation strategies defined
   - Test plan included
   - No blocking concerns raised

#### RFC Numbering
1. Check existing RFCs: `ls docs/rfcs/[0-9]*.md | sort -n`
2. Use next sequential number (e.g., if 001 exists, use 002)
3. Format: `NNN-slug.md` where NNN is zero-padded (001, 002, etc.)

#### Final Steps
1. Copy approved draft to `docs/rfcs/NNN-slug.md`
2. Remove any draft markers or comments
3. Add approval date and approvers to RFC metadata
4. Commit with message: `docs: Add RFC-NNN for {description}`

## Example Workflow

```bash
# 1. Create project workspace
mkdir -p .claude/workspace/projects/issue-13-cors-proxy/PLAN/P-1-rfc-draft/{01-investigation,02-planning,03-execution,04-results}

# 2. Start RFC draft
cp docs/rfcs/_template.md .claude/workspace/projects/issue-13-cors-proxy/PLAN/P-1-rfc-draft/03-execution/20250601-143000-PLAN-P1-exec-rfc-draft.md
# Edit and iterate...

# 3. After approval, move to final location
cp .claude/workspace/projects/issue-13-cors-proxy/PLAN/P-1-rfc-draft/04-results/final-rfc.md docs/rfcs/001-cors-proxy.md

# 4. Commit
git add docs/rfcs/001-cors-proxy.md
git commit -m "docs: Add RFC-001 for CORS proxy privacy enhancement"
```

## Common Mistakes to Avoid

1. ❌ Creating RFCs directly in `docs/rfcs/` before approval
2. ❌ Using legacy `.tmp-docs/` or `.claude/tmp-docs/` directories  
3. ❌ Committing work-in-progress RFCs to git
4. ❌ Skipping the RFC template
5. ❌ Not following the project/phase/task/process hierarchy
6. ❌ Missing metadata files at each level
7. ❌ Using non-sequential RFC numbers
8. ❌ Not getting explicit approval before finalization

## Integration with .gitignore

The `.claude/workspace/` directory is git-ignored to ensure:
- Work-in-progress documents don't clutter git history
- Large files or logs don't get committed accidentally
- Team members can work independently without conflicts

Only move documents to tracked directories (`docs/`) when they are:
- Complete and approved
- Ready for version control
- Part of the permanent project record

## Validation

The guard system validates:
- RFCs in `docs/rfcs/` must be in approved format
- Draft documents should not be in tracked directories
- RFC numbering must be sequential

## Related Documentation

- RFC Template: `docs/rfcs/_template.md`
- Development Process: `.claude/docs/workflows/DEVELOPMENT.md`
- Guard Validation: `.claude/docs/guards/VALIDATION.md`