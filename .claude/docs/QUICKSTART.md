<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Claude Integration Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Initialize Your First Project

```bash
# Create a workspace for an issue
.claude/scripts/init-workspace.sh issue 42 "implement-dark-mode"

# Or for a bug fix
.claude/scripts/init-workspace.sh bug 99 "fix-memory-leak"
```

### Step 2: Start Investigation

The init script creates the basic structure. Now add your first task:

```bash
# Navigate to your project
cd .claude/workspace/projects/issue-42-implement-dark-mode/INV

# Create your first task (if you need specific tasks)
mkdir -p I-1-research/{01-investigation,02-planning,03-execution,04-results}

# Start documenting
echo "# Dark Mode Investigation" > I-1-research/01-investigation/notes.md

# Or just work directly in the phase directory for simple cases
echo "# Investigation Notes" > investigation.md
```

### Step 3: Follow the Phases

Work through each phase as needed:

1. **INV** - Investigate the problem
2. **ANA** - Analyze root causes
3. **PLAN** - Create an RFC
4. **BUILD** - Implement the solution
5. **VERIF** - Test everything
6. **REL** - Prepare for release

### Step 4: Validate Your Work

```bash
# Check workspace structure
.claude/scripts/validate-workspace.sh

# Review your project status
cat .claude/workspace/projects/issue-42-implement-dark-mode/.metadata.yml
```

## 📋 Common Tasks

### Creating an RFC

```bash
# First, check if docs/rfcs directory exists
mkdir -p docs/rfcs

# In PLAN phase
cd .claude/workspace/projects/issue-42-implement-dark-mode/PLAN
mkdir -p P-1-rfc/{01-investigation,02-planning,03-execution,04-results}

# Copy template (if it exists)
if [ -f docs/rfcs/_template.md ]; then
  cp docs/rfcs/_template.md P-1-rfc/03-execution/rfc-draft.md
else
  echo "# RFC-XXX - Title" > P-1-rfc/03-execution/rfc-draft.md
fi

# When approved, check next RFC number
next_num=$(printf "%03d" $(($(ls docs/rfcs/[0-9]*.md 2>/dev/null | wc -l) + 1)))
cp P-1-rfc/04-results/final-rfc.md docs/rfcs/${next_num}-dark-mode.md
```

### Working with Code

```bash
# In BUILD phase
cd .claude/workspace/projects/issue-42-implement-dark-mode/BUILD
mkdir -p B-1-implementation/{01-investigation,02-planning,03-execution,04-results}

# Plan your approach
echo "# Implementation Plan" > B-1-implementation/02-planning/approach.md

# Track your changes
echo "# Changes Made" > B-1-implementation/03-execution/changes.md
```

### Archiving Completed Work

```bash
# When project is complete
cd .claude/workspace/projects
mv issue-42-implement-dark-mode ../archive/completed/issue-42-implement-dark-mode-20250602
```

## 🔧 Essential Commands

```bash
# Initialize new project
.claude/scripts/init-workspace.sh <type> <id> <description>

# Validate workspace
.claude/scripts/validate-workspace.sh

# List active projects
ls .claude/workspace/projects/

# Check project status
cat .claude/workspace/projects/*/metadata.yml | grep -E "id:|status:|current_phase:"
```

## 📁 Where Things Go

- **Working files**: `.claude/workspace/projects/{project}/{phase}/{task}/{process}/`
- **Final deliverables**: `docs/` (RFCs, guides, etc.)
- **Archives**: `.claude/workspace/archive/`
- **Configuration**: `.claude/config/`

## ⚠️ Important Rules

1. **Never commit** `.claude/workspace/` - it's git-ignored
2. **Always validate** before moving to next phase
3. **Use metadata files** to track progress
4. **Follow naming conventions** for consistency

## 🆘 Getting Help

- **Workspace structure**: `.claude/docs/standards/WORKSPACE-HIERARCHY.md`
- **Development process**: `.claude/docs/workflows/DEVELOPMENT.md`
- **RFC workflow**: `.claude/docs/workflows/RFC-WORKFLOW.md`
- **Safety rules**: `.claude/config/consolidated-safety-rules.json`

## 💡 Pro Tips

1. Use simplified names for working files
2. Keep detailed notes in investigation phase
3. Update metadata files as you progress
4. Archive completed work promptly
5. Run validation frequently

## 🔄 Typical Workflow

```bash
# 1. Start project
.claude/scripts/init-workspace.sh issue 50 "add-search-feature"

# 2. Investigate
cd .claude/workspace/projects/issue-50-add-search-feature/INV
# ... do investigation work ...

# 3. Analyze
cd ../ANA
# ... do analysis work ...

# 4. Plan
cd ../PLAN
# ... create RFC ...

# 5. Build
cd ../BUILD
# ... implement solution ...

# 6. Verify
cd ../VERIF
# ... test everything ...

# 7. Release
cd ../REL
# ... prepare release ...

# 8. Archive
cd ../../../
mv issue-50-add-search-feature archive/completed/issue-50-add-search-feature-$(date +%Y%m%d)
```

Start with Step 1 and you'll be productive immediately!