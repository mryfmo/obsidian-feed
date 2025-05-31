#!/bin/bash
# Claude Safety Wrapper - {{PROJECT_NAME}}
# This script wraps Claude operations with safety checks
# Generated: {{LAST_UPDATED}}

set -euo pipefail

# Configuration
PROJECT_ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
CLAUDE_CONFIG="$PROJECT_ROOT/.claude/config/claude-rules.json"
AUDIT_LOG="$PROJECT_ROOT/.claude/runtime/audit.log"
OPERATION="${1:-unknown}"
TARGET="${2:-}"
USER="${GITHUB_ACTOR:-system}"

# Colors for output (GitHub Actions compatible)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ensure required directories exist
mkdir -p "$(dirname "$AUDIT_LOG")"

# Function to log operations
log_operation() {
    local operation="$1"
    local target="$2"
    local status="$3"
    local level="${4:-1}"
    local message="${5:-}"
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local log_entry=$(jq -n \
        --arg ts "$timestamp" \
        --arg op "$operation" \
        --arg tgt "$target" \
        --arg st "$status" \
        --arg usr "$USER" \
        --arg lvl "$level" \
        --arg msg "$message" \
        '{timestamp: $ts, operation: $op, target: $tgt, status: $st, user: $usr, level: ($lvl | tonumber), message: $msg}'
    )
    
    echo "$log_entry" >> "$AUDIT_LOG"
}

# Function to check if operation is allowed
check_operation() {
    local operation="$1"
    local target="$2"
    
    if [[ ! -f "$CLAUDE_CONFIG" ]]; then
        echo -e "${RED}❌ Safety configuration not found${NC}"
        log_operation "$operation" "$target" "failed" 3 "Missing claude-rules.json"
        exit 1
    fi
    
    # Check forbidden patterns
    case "$operation" in
        delete|remove)
            # Extract forbidden patterns from config
            local forbidden_patterns=$(jq -r '.rules.operations.delete.files.forbidden_patterns[]? | select(. != null and (startswith("#") | not))' "$CLAUDE_CONFIG" 2>/dev/null || echo "")
            
            while IFS= read -r pattern; do
                if [[ -n "$pattern" && "$target" == $pattern ]]; then
                    echo -e "${RED}❌ Operation forbidden: File matches pattern '$pattern'${NC}"
                    log_operation "$operation" "$target" "forbidden" 2 "Matches forbidden pattern: $pattern"
                    exit 1
                fi
            done <<< "$forbidden_patterns"
            ;;
            
        execute)
            # Check forbidden commands
            local forbidden_commands=$(jq -r '.rules.operations.execute.commands.forbidden[]? | select(. != null and (startswith("#") | not))' "$CLAUDE_CONFIG" 2>/dev/null || echo "")
            
            while IFS= read -r cmd; do
                if [[ -n "$cmd" && "$target" == *"$cmd"* ]]; then
                    echo -e "${RED}❌ Command forbidden: Contains '$cmd'${NC}"
                    log_operation "$operation" "$target" "forbidden" 3 "Contains forbidden command: $cmd"
                    exit 1
                fi
            done <<< "$forbidden_commands"
            ;;
    esac
    
    echo -e "${GREEN}✅ Operation allowed${NC}"
    return 0
}

# Function to prompt for confirmation (GitHub Actions)
prompt_confirmation() {
    local operation="$1"
    local target="$2"
    local level="$3"
    
    if [[ "$level" -ge 2 ]]; then
        echo -e "${YELLOW}⚠️  Destructive operation detected${NC}"
        echo "Operation: $operation"
        echo "Target: $target"
        echo "Level: $level"
        
        # In GitHub Actions, check for approval label
        if [[ -n "${GITHUB_EVENT_NAME:-}" ]]; then
            # Check if PR has 'approved-destructive' label
            local has_approval=$(jq -r '.pull_request.labels[]?.name | select(. == "approved-destructive")' "$GITHUB_EVENT_PATH" 2>/dev/null || echo "")
            
            if [[ -z "$has_approval" ]]; then
                echo -e "${RED}❌ Destructive operation requires 'approved-destructive' label${NC}"
                log_operation "$operation" "$target" "rejected" "$level" "Missing approval label"
                exit 1
            fi
        fi
    fi
}

# Main execution
main() {
    echo "🛡️ Claude Safety Wrapper - {{PROJECT_NAME}}"
    echo "=================================="
    
    if [[ -z "$OPERATION" || -z "$TARGET" ]]; then
        echo -e "${RED}Usage: $0 <operation> <target>${NC}"
        exit 1
    fi
    
    echo "Checking operation: $OPERATION on $TARGET"
    
    # Check if operation is allowed
    check_operation "$OPERATION" "$TARGET"
    
    # Get operation level
    local level=$(jq -r --arg op "$OPERATION" '.rules.operations[$op].files.level // .rules.operations[$op].level // 1' "$CLAUDE_CONFIG" 2>/dev/null || echo "1")
    
    # Prompt for confirmation if needed
    prompt_confirmation "$OPERATION" "$TARGET" "$level"
    
    # Log successful check
    log_operation "$OPERATION" "$TARGET" "pre-check-passed" "$level" "Safety check passed"
    
    echo -e "${GREEN}✅ Safety check passed${NC}"
    echo "Proceed with operation: $OPERATION $TARGET"
}

# Run main function
main "$@"