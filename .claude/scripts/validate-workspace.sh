#!/usr/bin/env bash
#
# Validate workspace structure compliance
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORKSPACE_ROOT=".claude/workspace"
ERRORS=0
WARNINGS=0

# Check if workspace exists
if [[ ! -d "$WORKSPACE_ROOT" ]]; then
    echo -e "${YELLOW}Warning: Workspace directory does not exist yet${NC}"
    echo "Run '.claude/scripts/init-workspace.sh' to create your first project"
    exit 0
fi

# Check if any projects exist
if [[ -z "$(ls -A "$WORKSPACE_ROOT/projects" 2>/dev/null)" ]]; then
    echo -e "${YELLOW}Info: No projects found in workspace${NC}"
    echo "Run '.claude/scripts/init-workspace.sh' to create your first project"
    exit 0
fi

echo "Validating workspace structure..."

# Validate project naming
for project in "$WORKSPACE_ROOT"/projects/*; do
    if [[ -d "$project" ]]; then
        project_name=$(basename "$project")
        if ! [[ "$project_name" =~ ^[a-z]+-[0-9]+-[a-z-]+$ ]]; then
            echo -e "${RED}Error: Invalid project name format: $project_name${NC}"
            echo "  Expected: {type}-{id}-{description} (e.g., issue-13-cors-proxy)"
            ((ERRORS++))
        fi
        
        # Check for project metadata
        if [[ ! -f "$project/.metadata.yml" ]]; then
            echo -e "${RED}Error: Missing .metadata.yml in $project_name${NC}"
            ((ERRORS++))
        fi
        
        # Check phases
        for phase_dir in "$project"/*; do
            if [[ -d "$phase_dir" ]] && [[ $(basename "$phase_dir") != "archive" ]]; then
                phase=$(basename "$phase_dir")
                if ! [[ "$phase" =~ ^(FETCH|INV|ANA|PLAN|BUILD|VERIF|REL)$ ]]; then
                    echo -e "${RED}Error: Invalid phase name: $phase in $project_name${NC}"
                    ((ERRORS++))
                fi
                
                # Check phase status
                if [[ ! -f "$phase_dir/.phase-status.yml" ]]; then
                    echo -e "${YELLOW}Warning: Missing .phase-status.yml in $project_name/$phase${NC}"
                    ((WARNINGS++))
                fi
                
                # Check tasks
                for task_dir in "$phase_dir"/*; do
                    if [[ -d "$task_dir" ]] && [[ ! $(basename "$task_dir") =~ ^\. ]]; then
                        task=$(basename "$task_dir")
                        if ! [[ "$task" =~ ^[A-Z]-[0-9]+-[a-z-]+$ ]]; then
                            echo -e "${RED}Error: Invalid task name format: $task in $project_name/$phase${NC}"
                            echo "  Expected: {phase-letter}-{number}-{description} (e.g., P-1-rfc-draft)"
                            ((ERRORS++))
                        fi
                        
                        # Check processes
                        for process in "01-investigation" "02-planning" "03-execution" "04-results"; do
                            if [[ ! -d "$task_dir/$process" ]]; then
                                echo -e "${YELLOW}Warning: Missing process directory $process in $project_name/$phase/$task${NC}"
                                ((WARNINGS++))
                            fi
                        done
                    fi
                done
            fi
        done
    fi
done

# Summary
echo
echo "Validation complete:"
echo -e "  Errors: ${ERRORS}"
echo -e "  Warnings: ${WARNINGS}"

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Workspace structure validation FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Workspace structure validation PASSED${NC}"
    exit 0
fi