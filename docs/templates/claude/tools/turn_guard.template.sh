#!/bin/bash
# Turn Guard - Validates Claude output format
# Project: {{PROJECT_NAME}}
# Version: 1.0.0

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if file provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <output-file>"
    exit 1
fi

OUTPUT_FILE="$1"
ROLE="${TURN_ROLE:-BUILD}"
PASSED=0
FAILED=0

echo "🛡️ Turn Guard Validation"
echo "======================="
echo "File: $OUTPUT_FILE"
echo "Role: $ROLE"
echo ""

# Function to check for required section
check_section() {
    local section="$1"
    local required="$2"
    
    if grep -q "$section" "$OUTPUT_FILE"; then
        echo -e "${GREEN}✅ Found $section${NC}"
        ((PASSED++))
    else
        if [ "$required" = "required" ]; then
            echo -e "${RED}❌ Missing $section${NC}"
            ((FAILED++))
        else
            echo -e "${YELLOW}⚠️  Optional $section not found${NC}"
        fi
    fi
}

# Basic structure validation
echo "📋 Checking Document Structure"
echo "-----------------------------"
check_section "<think>" "required"
check_section "</think>" "required"
check_section "<act>" "required"
check_section "</act>" "required"

# Phase-specific validation
case "$ROLE" in
    FETCH)
        check_section "Downloaded:" "required"
        check_section "Cached:" "optional"
        ;;
    INV)
        check_section "Issue:" "required"
        check_section "Reproduced:" "required"
        ;;
    ANA)
        check_section "Root Cause:" "required"
        check_section "Impact:" "required"
        ;;
    PLAN)
        check_section "RFC:" "required"
        check_section "Implementation Plan:" "required"
        ;;
    BUILD)
        check_section "Changes:" "required"
        check_section "Files Modified:" "required"
        ;;
    VERIF)
        check_section "<verify>" "required"
        check_section "</verify>" "required"
        check_section "Tests:" "required"
        ;;
    REL)
        check_section "Version:" "required"
        check_section "Changelog:" "required"
        ;;
esac

# Check for state transition
echo ""
echo "🔄 Checking State Transition"
echo "---------------------------"
if grep -q "State-Transition:" "$OUTPUT_FILE"; then
    TRANSITION=$(grep "State-Transition:" "$OUTPUT_FILE" | head -1)
    echo -e "${GREEN}✅ $TRANSITION${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ No state transition found${NC}"
    ((FAILED++))
fi

# Check for forbidden patterns
echo ""
echo "🚫 Checking Forbidden Patterns"
echo "-----------------------------"
FORBIDDEN_PATTERNS=(
    "rm -rf /"
    "git push --force"
    "npm publish"
    "DELETE FROM"
    "DROP TABLE"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -q "$pattern" "$OUTPUT_FILE"; then
        echo -e "${RED}❌ Found forbidden pattern: $pattern${NC}"
        ((FAILED++))
    fi
done

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ No forbidden patterns found${NC}"
    ((PASSED++))
fi

# Summary
echo ""
echo "📊 Validation Summary"
echo "==================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Validation PASSED${NC}"
    exit 0
else
    echo -e "${RED}❌ Validation FAILED${NC}"
    exit 1
fi