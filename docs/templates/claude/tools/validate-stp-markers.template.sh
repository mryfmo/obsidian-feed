#!/bin/bash
# Validate STP (Standard Task Protocol) Markers
# Project: {{PROJECT_NAME}}
# Generated: {{LAST_UPDATED}}

set -euo pipefail

# Configuration
PROJECT_ROOT="${1:-.}"
VERBOSE="${2:-false}"
ERROR_COUNT=0
WARNING_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Valid phases
VALID_PHASES=("FETCH" "INV" "ANA" "PLAN" "BUILD" "VERIF" "REL")

# Valid states
VALID_STATES=("pending" "in_progress" "completed" "blocked" "cancelled")

echo -e "${BLUE}🔍 STP Marker Validation - {{PROJECT_NAME}}${NC}"
echo "======================================="

# Function to validate phase marker
validate_phase() {
    local file="$1"
    local line_num="$2"
    local phase="$3"
    
    if [[ ! " ${VALID_PHASES[@]} " =~ " ${phase} " ]]; then
        echo -e "${RED}❌ ERROR${NC}: Invalid phase '$phase' at $file:$line_num"
        ((ERROR_COUNT++))
        return 1
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${GREEN}✓${NC} Valid phase: $phase"
    fi
    return 0
}

# Function to validate state marker
validate_state() {
    local file="$1"
    local line_num="$2"
    local state="$3"
    
    if [[ ! " ${VALID_STATES[@]} " =~ " ${state} " ]]; then
        echo -e "${RED}❌ ERROR${NC}: Invalid state '$state' at $file:$line_num"
        ((ERROR_COUNT++))
        return 1
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${GREEN}✓${NC} Valid state: $state"
    fi
    return 0
}

# Function to check phase transitions
check_phase_transition() {
    local from_phase="$1"
    local to_phase="$2"
    local file="$3"
    
    # Get indices
    local from_idx=-1
    local to_idx=-1
    
    for i in "${!VALID_PHASES[@]}"; do
        if [[ "${VALID_PHASES[$i]}" == "$from_phase" ]]; then
            from_idx=$i
        fi
        if [[ "${VALID_PHASES[$i]}" == "$to_phase" ]]; then
            to_idx=$i
        fi
    done
    
    # Check if transition is valid (can only go forward or stay same)
    if [[ $to_idx -lt $from_idx ]]; then
        echo -e "${YELLOW}⚠️  WARNING${NC}: Backward phase transition $from_phase → $to_phase in $file"
        ((WARNING_COUNT++))
        return 1
    fi
    
    return 0
}

# Main validation loop
echo "Scanning for STP markers..."

# Find all markdown files
find "$PROJECT_ROOT" -name "*.md" -type f | while read -r file; do
    # Skip node_modules and other irrelevant directories
    if [[ "$file" =~ node_modules|\.git|dist|build ]]; then
        continue
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "\nChecking: $file"
    fi
    
    # Extract STP markers
    grep -n -E "(PHASE:|STATE:|phase:|state:)" "$file" 2>/dev/null | while IFS=: read -r line_num line_content; do
        # Extract phase markers
        if [[ "$line_content" =~ PHASE:\ *([A-Z]+) ]] || [[ "$line_content" =~ phase:\ *([A-Z]+) ]]; then
            phase="${BASH_REMATCH[1]}"
            validate_phase "$file" "$line_num" "$phase"
        fi
        
        # Extract state markers
        if [[ "$line_content" =~ STATE:\ *([a-z_]+) ]] || [[ "$line_content" =~ state:\ *([a-z_]+) ]]; then
            state="${BASH_REMATCH[1]}"
            validate_state "$file" "$line_num" "$state"
        fi
    done
done

# Check for required files
echo -e "\n${BLUE}📋 Checking required STP files...${NC}"

REQUIRED_FILES=(
    "docs/agents/01_task-lifecycle.md"
    "docs/agents/02_claude-code.md"
)

for req_file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$PROJECT_ROOT/$req_file" ]]; then
        echo -e "${GREEN}✓${NC} Found: $req_file"
    else
        echo -e "${YELLOW}⚠️  WARNING${NC}: Missing required file: $req_file"
        ((WARNING_COUNT++))
    fi
done

# Summary
echo -e "\n${BLUE}📊 Validation Summary${NC}"
echo "===================="
echo -e "Errors:   ${ERROR_COUNT}"
echo -e "Warnings: ${WARNING_COUNT}"

if [[ $ERROR_COUNT -eq 0 && $WARNING_COUNT -eq 0 ]]; then
    echo -e "\n${GREEN}✅ All STP markers are valid!${NC}"
    exit 0
elif [[ $ERROR_COUNT -eq 0 ]]; then
    echo -e "\n${YELLOW}⚠️  Validation passed with warnings${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Validation failed${NC}"
    exit 1
fi