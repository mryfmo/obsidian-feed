#!/bin/bash
# Claude Safety Wrapper - Ensures all Claude operations go through safety checks
# This script should be called by GitHub Actions before Claude executes commands

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if operation guard is available (check both locations)
if [ ! -f ".claude/config/claude-rules.json" ] && [ ! -f "claude-rules.json" ]; then
    echo -e "${RED}ERROR: claude-rules.json not found${NC}"
    echo "Claude safety rules are not configured. Aborting."
    exit 1
fi

# Initialize audit system
mkdir -p .claude/runtime
touch .claude/runtime/audit.log
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | INFO | GITHUB_ACTION | claude-safety-wrapper | STARTED | ${GITHUB_ACTOR:-system} | Safety wrapper initialized" >> .claude/runtime/audit.log

# Function to check if command is safe
check_command_safety() {
    local cmd="$1"
    
    # List of forbidden commands from claude-rules.json
    local forbidden_commands=(
        "rm -rf /"
        "git push --force"
        "npm publish"
        "yarn publish"
        "pnpm publish"
    )
    
    # Check against forbidden list
    for forbidden in "${forbidden_commands[@]}"; do
        if [[ "$cmd" == *"$forbidden"* ]]; then
            echo -e "${RED}❌ FORBIDDEN COMMAND DETECTED: $forbidden${NC}"
            echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | ERROR | GITHUB_ACTION | command | BLOCKED | ${GITHUB_ACTOR:-system} | Forbidden command: $cmd" >> .claude/runtime/audit.log
            return 1
        fi
    done
    
    # List of commands requiring confirmation
    local confirm_commands=(
        "git clean"
        "git reset --hard"
        "find * -exec rm"
        "xargs rm"
    )
    
    # Check if confirmation needed
    for confirm in "${confirm_commands[@]}"; do
        if [[ "$cmd" == *"$confirm"* ]]; then
            echo -e "${YELLOW}⚠️  DANGEROUS COMMAND: $confirm${NC}"
            echo "This command requires explicit approval in the PR/Issue"
            echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | WARN | GITHUB_ACTION | command | NEEDS_CONFIRMATION | ${GITHUB_ACTOR:-system} | Dangerous command: $cmd" >> .claude/runtime/audit.log
            
            # In CI, we can't get interactive confirmation, so check for approval label
            if [ -n "${GITHUB_EVENT_NAME:-}" ]; then
                # Check if PR/Issue has approval label
                if ! check_approval_label; then
                    echo -e "${RED}Command requires approval label 'approved-destructive'${NC}"
                    return 1
                fi
            fi
        fi
    done
    
    echo -e "${GREEN}✅ Command appears safe${NC}"
    return 0
}

# Function to check for approval label
check_approval_label() {
    if [ -z "${GITHUB_TOKEN:-}" ]; then
        echo "Warning: GITHUB_TOKEN not set, cannot check labels"
        return 1
    fi
    
    local labels=""
    
    if [ "${GITHUB_EVENT_NAME}" = "pull_request" ] || [ "${GITHUB_EVENT_NAME}" = "pull_request_review" ]; then
        labels=$(gh pr view "${GITHUB_EVENT_PULL_REQUEST_NUMBER:-$PR_NUMBER}" --json labels -q '.labels[].name' 2>/dev/null || echo "")
    elif [ "${GITHUB_EVENT_NAME}" = "issues" ] || [ "${GITHUB_EVENT_NAME}" = "issue_comment" ]; then
        labels=$(gh issue view "${GITHUB_EVENT_ISSUE_NUMBER:-$ISSUE_NUMBER}" --json labels -q '.labels[].name' 2>/dev/null || echo "")
    fi
    
    if echo "$labels" | grep -q "approved-destructive"; then
        echo "✅ Found approval label 'approved-destructive'"
        return 0
    else
        echo "❌ Missing approval label 'approved-destructive'"
        return 1
    fi
}

# Function to validate file operations
check_file_operation() {
    local operation="$1"
    local target="$2"
    
    # Use MCP integration if available
    if command -v tsx >/dev/null 2>&1 && [ -f ".mcp/index.ts" ]; then
        echo "Using MCP OperationGuard for validation..."
        npx tsx -e "
import { MCPIntegration } from './.mcp/index.js';
const mcp = new MCPIntegration();
(async () => {
    const result = await mcp.checkOperationPermission('$operation', '$target');
    if (!result.allowed) {
        console.error('❌ Operation forbidden:', result.message);
        process.exit(1);
    }
    if (result.requiresConfirmation) {
        console.warn('⚠️  Operation requires confirmation');
        process.exit(2);
    }
    console.log('✅ Operation allowed');
})();
        "
        return $?
    else
        echo "Warning: MCP integration not available, using basic checks"
        
        # Basic forbidden patterns
        case "$operation" in
            delete)
                if [[ "$target" =~ \.(md|json|gitignore)$ ]] || [[ "$target" = "package.json" ]] || [[ "$target" = "tsconfig.json" ]]; then
                    echo -e "${RED}❌ Cannot delete protected file: $target${NC}"
                    return 1
                fi
                ;;
            delete_directory)
                if [[ "$target" =~ ^(\.|src|docs|node_modules|.git|.github)$ ]]; then
                    echo -e "${RED}❌ Cannot delete protected directory: $target${NC}"
                    return 1
                fi
                ;;
        esac
    fi
    
    return 0
}

# Main execution
echo "🛡️  Claude Safety Wrapper Active"
echo "================================"

# Export functions for use in other scripts
export -f check_command_safety
export -f check_file_operation
export -f check_approval_label

# If called with arguments, check the command
if [ $# -gt 0 ]; then
    case "$1" in
        check-command)
            shift
            check_command_safety "$*"
            ;;
        check-file)
            shift
            check_file_operation "$@"
            ;;
        check-approval)
            check_approval_label
            ;;
        *)
            echo "Usage: $0 [check-command <command>|check-file <operation> <target>|check-approval]"
            exit 1
            ;;
    esac
else
    echo "Safety wrapper loaded. Functions available:"
    echo "  - check_command_safety <command>"
    echo "  - check_file_operation <operation> <target>"
    echo "  - check_approval_label"
fi