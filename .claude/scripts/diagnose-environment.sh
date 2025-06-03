#!/bin/bash
# diagnose-environment.sh - Comprehensive environment test

set -euo pipefail

echo "======================================"
echo "ENVIRONMENT DIAGNOSIS"
echo "======================================"
echo "Date: $(date)"
echo "User: $(whoami)"
echo

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check item
check_item() {
    local description="$1"
    local condition="$2"
    
    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# Track overall status
ISSUES_FOUND=0

echo "1. DIRECTORY STRUCTURE CHECK"
echo "----------------------------"

# Check project root
PROJECT_ROOT="/Users/mryfmo/Sources/obsidian-feed"
check_item "Project root exists" "[ -d '$PROJECT_ROOT' ]" || ((ISSUES_FOUND++))

# Check Claude integration directories
check_item ".claude directory exists" "[ -d '$PROJECT_ROOT/.claude' ]" || ((ISSUES_FOUND++))
check_item ".claude/runtime exists" "[ -d '$PROJECT_ROOT/.claude/runtime' ]" || ((ISSUES_FOUND++))
check_item ".claude/backups exists" "[ -d '$PROJECT_ROOT/.claude/backups' ]" || ((ISSUES_FOUND++))
check_item ".claude/workspace exists" "[ -d '$PROJECT_ROOT/.claude/workspace' ]" || ((ISSUES_FOUND++))

# Check project directories
WORKSPACE="$PROJECT_ROOT/.claude/workspace/projects/strict-rules-integration"
check_item "Project workspace exists" "[ -d '$WORKSPACE' ]" || ((ISSUES_FOUND++))
check_item "Scripts directory exists" "[ -d '$WORKSPACE/scripts' ]" || ((ISSUES_FOUND++))
check_item "Tasks directory exists" "[ -d '$WORKSPACE/tasks' ]" || ((ISSUES_FOUND++))
check_item "Compliance directory exists" "[ -d '$WORKSPACE/compliance' ]" || ((ISSUES_FOUND++))

echo
echo "2. REQUIRED LOG FILES CHECK"
echo "---------------------------"

# Check log files
LOGS=(
    "$PROJECT_ROOT/.claude/runtime/backup.log"
    "$PROJECT_ROOT/.claude/runtime/confirmations.log"
    "$PROJECT_ROOT/.claude/runtime/task-execution.log"
    "$PROJECT_ROOT/.claude/runtime/verification.log"
    "$PROJECT_ROOT/.claude/runtime/evaluation.log"
    "$PROJECT_ROOT/.claude/runtime/progress.log"
    "$PROJECT_ROOT/.claude/runtime/cleanup.log"
    "$PROJECT_ROOT/.claude/runtime/cycle-compliance.log"
    "$PROJECT_ROOT/.claude/runtime/violations.log"
    "$PROJECT_ROOT/.claude/runtime/audit.log"
)

for log in "${LOGS[@]}"; do
    check_item "$(basename "$log") exists" "[ -f '$log' ]" || ((ISSUES_FOUND++))
done

echo
echo "3. SCRIPT EXECUTABILITY CHECK"
echo "-----------------------------"

# Check scripts are executable
SCRIPTS=(
    "create-task-backup.sh"
    "request-confirmation.sh"
    "verify-task.sh"
    "evaluate-task.sh"
    "update-progress.sh"
    "cleanup-task.sh"
    "execute-task-with-cycle.sh"
)

for script in "${SCRIPTS[@]}"; do
    check_item "$script is executable" "[ -x '$WORKSPACE/scripts/$script' ]" || ((ISSUES_FOUND++))
done

echo
echo "4. TASK CONFIGURATION CHECK"
echo "---------------------------"

# Check sample task configuration
TASK_DIR="$WORKSPACE/tasks/task-1.1.1"
check_item "Task 1.1.1 directory exists" "[ -d '$TASK_DIR' ]" || ((ISSUES_FOUND++))
check_item "cycle-config.yml exists" "[ -f '$TASK_DIR/cycle-config.yml' ]" || ((ISSUES_FOUND++))
check_item "execution-script.sh exists" "[ -f '$TASK_DIR/execution-script.sh' ]" || ((ISSUES_FOUND++))
check_item "execution-script.sh is executable" "[ -x '$TASK_DIR/execution-script.sh' ]" || ((ISSUES_FOUND++))

echo
echo "5. PATH RESOLUTION CHECK"
echo "------------------------"

# Check if we can resolve paths correctly
cd "$WORKSPACE" 2>/dev/null && check_item "Can change to workspace directory" "true" || ((ISSUES_FOUND++))
cd "$PROJECT_ROOT" 2>/dev/null

# Check relative paths from different locations
if [ -d "$WORKSPACE" ]; then
    cd "$WORKSPACE"
    check_item "Scripts accessible from workspace" "[ -d './scripts' ]" || ((ISSUES_FOUND++))
    check_item "Tasks accessible from workspace" "[ -d './tasks' ]" || ((ISSUES_FOUND++))
fi

echo
echo "6. PERMISSION CHECK"
echo "-------------------"

# Check write permissions
TEMP_FILE="$PROJECT_ROOT/.claude/runtime/test-write-$(date +%s).tmp"
if touch "$TEMP_FILE" 2>/dev/null; then
    check_item "Can write to runtime directory" "true"
    rm -f "$TEMP_FILE"
else
    check_item "Can write to runtime directory" "false"
    ((ISSUES_FOUND++))
fi

echo
echo "======================================"
echo "DIAGNOSIS SUMMARY"
echo "======================================"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "The environment is ready for task execution."
else
    echo -e "${RED}✗ Found $ISSUES_FOUND issues${NC}"
    echo
    echo "RECOMMENDED FIXES:"
    echo "1. Run the fix-environment.sh script"
    echo "2. Ensure you're in the correct directory"
    echo "3. Check file permissions"
fi

echo
echo "Current directory: $(pwd)"
echo "======================================"

exit $ISSUES_FOUND