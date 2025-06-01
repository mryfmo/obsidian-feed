#!/usr/bin/env bash
#
# Initialize workspace for a new project
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <project-type> <project-id> <project-description>"
    echo ""
    echo "Project types: issue, feature, bug, refactor"
    echo ""
    echo "Example:"
    echo "  $0 issue 42 'implement-dark-mode'"
    echo ""
    exit 1
}

# Validate arguments
if [[ $# -ne 3 ]]; then
    usage
fi

PROJECT_TYPE="$1"
PROJECT_ID="$2"
PROJECT_DESC="$3"

# Validate project type
if ! [[ "$PROJECT_TYPE" =~ ^(issue|feature|bug|refactor)$ ]]; then
    echo -e "${RED}Error: Invalid project type: $PROJECT_TYPE${NC}"
    echo "Valid types: issue, feature, bug, refactor"
    exit 1
fi

# Validate project ID (must be numeric)
if ! [[ "$PROJECT_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Project ID must be numeric: $PROJECT_ID${NC}"
    exit 1
fi

# Validate project description (lowercase with hyphens)
if ! [[ "$PROJECT_DESC" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo -e "${RED}Error: Project description must be lowercase with hyphens: $PROJECT_DESC${NC}"
    echo "Example: implement-dark-mode, fix-memory-leak"
    exit 1
fi

# Construct project name
PROJECT_NAME="${PROJECT_TYPE}-${PROJECT_ID}-${PROJECT_DESC}"
WORKSPACE_ROOT=".claude/workspace/projects"

# Check if project already exists
if [[ -d "$WORKSPACE_ROOT/$PROJECT_NAME" ]]; then
    echo -e "${YELLOW}Warning: Project already exists: $PROJECT_NAME${NC}"
    echo -n "Overwrite? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -rf "$WORKSPACE_ROOT/$PROJECT_NAME"
fi

echo -e "${BLUE}Creating workspace for: $PROJECT_NAME${NC}"

# Create base structure
mkdir -p "$WORKSPACE_ROOT/$PROJECT_NAME"

# Create phase directories
for phase in FETCH INV ANA PLAN BUILD VERIF REL; do
    mkdir -p "$WORKSPACE_ROOT/$PROJECT_NAME/$phase"
    
    # Create phase status file
    cat > "$WORKSPACE_ROOT/$PROJECT_NAME/$phase/.phase-status.yml" << EOF
phase: "$phase"
entered: null
completed: null
status: "pending"

tasks: {}

exit_criteria: {}

artifacts: []
EOF
done

# Create project metadata
cat > "$WORKSPACE_ROOT/$PROJECT_NAME/.metadata.yml" << EOF
project:
  id: "$PROJECT_NAME"
  type: "$PROJECT_TYPE"
  title: "${PROJECT_DESC//-/ }"
  created: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  status: "active"
  current_phase: null
  github_issue: $PROJECT_ID
  description: ""
  
phases_completed: []
  
deliverables:
  planned: []
  completed: []
EOF

# Create README for the project
cat > "$WORKSPACE_ROOT/$PROJECT_NAME/README.md" << EOF
# Project: $PROJECT_NAME

## Overview
- **Type**: $PROJECT_TYPE
- **ID**: $PROJECT_ID
- **Description**: ${PROJECT_DESC//-/ }

## Current Status
- **Phase**: Not started
- **Created**: $(date -u +%Y-%m-%d)

## Phases

### FETCH
Document and resource retrieval phase.

### INV
Investigation and issue reproduction phase.

### ANA
Root cause analysis phase.

### PLAN
Planning and RFC creation phase.

### BUILD
Implementation phase.

### VERIF
Testing and verification phase.

### REL
Release preparation phase.

## Usage

1. Start with the INV phase (or FETCH if external docs needed)
2. Create tasks within each phase as needed
3. Follow the 4-level process for each task:
   - 01-investigation
   - 02-planning
   - 03-execution
   - 04-results
EOF

# Create archive directory
mkdir -p "$WORKSPACE_ROOT/$PROJECT_NAME/archive"

# Summary
echo ""
echo -e "${GREEN}✅ Workspace created successfully!${NC}"
echo ""
echo "Project structure:"
# Use find instead of tree since tree may not be installed
find "$WORKSPACE_ROOT/$PROJECT_NAME" -type d | sort | sed 's/^/  /'
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update project metadata in: $WORKSPACE_ROOT/$PROJECT_NAME/.metadata.yml"
echo "2. Start work in the appropriate phase (usually INV or FETCH)"
echo "3. Create task directories as needed, e.g.:"
echo "   mkdir -p $WORKSPACE_ROOT/$PROJECT_NAME/INV/I-1-reproduce/{01-investigation,02-planning,03-execution,04-results}"
echo "4. Run validation: .claude/scripts/validate-workspace.sh"
echo ""