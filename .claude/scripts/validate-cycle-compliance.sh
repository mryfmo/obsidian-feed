#!/bin/bash
# validate-cycle-compliance.sh - Validate 7-step cycle compliance

set -euo pipefail

echo "======================================"
echo "7-STEP CYCLE COMPLIANCE VALIDATION"
echo "======================================"
echo "Date: $(date)"
echo

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation results
ISSUES=0
WARNINGS=0

# Function to check item
check_item() {
    local description="$1"
    local condition="$2"
    local severity="${3:-error}" # error or warning
    
    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        if [ "$severity" = "warning" ]; then
            echo -e "${YELLOW}⚠${NC} $description"
            ((WARNINGS++))
        else
            echo -e "${RED}✗${NC} $description"
            ((ISSUES++))
        fi
        return 1
    fi
}

echo "1. CONFIGURATION FILES"
echo "---------------------"

# Check cycle enforcement config
check_item "Cycle enforcement config exists" "[ -f '.claude/config/cycle-enforcement.json' ]"

if [ -f '.claude/config/cycle-enforcement.json' ]; then
    check_item "Valid JSON format" "jq empty .claude/config/cycle-enforcement.json 2>/dev/null"
    check_item "Strict mode enabled" "[ \"$(jq -r '.enforcement_rules.strict_mode' .claude/config/cycle-enforcement.json)\" = 'true' ]"
    check_item "Bypass not allowed" "[ \"$(jq -r '.enforcement_rules.allow_bypass' .claude/config/cycle-enforcement.json)\" = 'false' ]"
fi

# Check consolidated safety rules
check_item "Consolidated safety rules updated" "grep -q 'cycle_enforcement' .claude/config/consolidated-safety-rules.json 2>/dev/null || false"

echo
echo "2. DOCUMENTATION"
echo "----------------"

# Check CLAUDE.md
check_item "CLAUDE.md has cycle section" "grep -q 'MANDATORY 7-STEP EXECUTION CYCLE' CLAUDE.md"
check_item "CLAUDE.md has enforcement directive" "grep -q 'EXECUTE the 7-step cycle' CLAUDE.md"
check_item "CLAUDE.md lists automation scripts" "grep -q 'execute-task-with-cycle.sh' CLAUDE.md"

echo
echo "3. AUTOMATION SCRIPTS"
echo "--------------------"

# Check required scripts
SCRIPTS=(
    "execute-task-with-cycle.sh"
    "create-task-backup.sh"
    "request-confirmation.sh"
    "verify-task.sh"
    "evaluate-task.sh"
    "update-progress.sh"
    "cleanup-task.sh"
    "validate-cycle-compliance.sh"
)

for script in "${SCRIPTS[@]}"; do
    check_item "Script exists: $script" "[ -f '.claude/scripts/$script' ]"
    if [ -f ".claude/scripts/$script" ]; then
        check_item "Script executable: $script" "[ -x '.claude/scripts/$script' ]" "warning"
    fi
done

echo
echo "4. MCP INTEGRATION"
echo "------------------"

if [ -f ".mcp/operation-guard.ts" ]; then
    check_item "OperationGuard has validateCycleCompliance" "grep -q 'validateCycleCompliance' .mcp/operation-guard.ts"
    check_item "OperationGuard has initializeCycle" "grep -q 'initializeCycle' .mcp/operation-guard.ts"
    check_item "OperationGuard has recordCycleStep" "grep -q 'recordCycleStep' .mcp/operation-guard.ts"
    check_item "OperationGuard has reportViolation" "grep -q 'reportViolation' .mcp/operation-guard.ts"
else
    echo -e "${YELLOW}⚠${NC} MCP not configured (operation-guard.ts not found)"
    ((WARNINGS++))
fi

echo
echo "5. GITHUB WORKFLOWS"
echo "-------------------"

check_item "Cycle compliance workflow exists" "[ -f '.github/workflows/cycle-compliance.yml' ]"

echo
echo "6. RUNTIME DIRECTORIES"
echo "----------------------"

check_item ".claude/runtime directory exists" "[ -d '.claude/runtime' ]" "warning"
check_item ".claude/backups directory exists" "[ -d '.claude/backups' ]" "warning"

echo
echo "======================================"
echo "VALIDATION SUMMARY"
echo "======================================"

# Count successful checks by looking at the output above
SUCCESSFUL_CHECKS=$(grep -c "✓" "$0" | head -1 || echo 0)

if [ $ISSUES -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ ALL CHECKS PASSED!${NC}"
        echo "The 7-step cycle enforcement is fully configured."
        EXIT_CODE=0
    else
        echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
        echo "Found $WARNINGS warnings that should be addressed."
        EXIT_CODE=0
    fi
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo "Found $ISSUES critical issues and $WARNINGS warnings."
    echo
    echo "To fix:"
    echo "1. Ensure all configuration files are present"
    echo "2. Check that all scripts are copied and executable"
    echo "3. Verify documentation is updated"
    echo "4. Run the integration checklist"
    EXIT_CODE=1
fi

echo
echo "Run '.claude/scripts/test-cycle-non-interactive.sh' to test the cycle execution"
echo "======================================"

exit $EXIT_CODE