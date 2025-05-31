#!/bin/bash
# Test Claude Integration Setup
# Project: {{PROJECT_NAME}}
# Type: {{PROJECT_TYPE}}

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Testing Claude Integration Setup for {{PROJECT_NAME}}"
echo "=================================================="

# Test results
PASSED=0
FAILED=0
WARNINGS=0

# Function to test file existence
test_file() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $description - File not found: $file"
        ((FAILED++))
        return 1
    fi
}

# Function to test directory existence
test_dir() {
    local dir="$1"
    local description="$2"
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $description - Directory not found: $dir"
        ((FAILED++))
        return 1
    fi
}

# Function to test JSON validity
test_json() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        if jq empty "$file" 2>/dev/null; then
            echo -e "${GREEN}✅ PASS${NC}: $description - Valid JSON"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}❌ FAIL${NC}: $description - Invalid JSON in $file"
            ((FAILED++))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  SKIP${NC}: $description - File not found"
        ((WARNINGS++))
        return 1
    fi
}

# Function to check for template variables
check_templates() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        if grep -q '{{' "$file"; then
            echo -e "${YELLOW}⚠️  WARN${NC}: $description - Contains template variables"
            ((WARNINGS++))
            return 1
        else
            echo -e "${GREEN}✅ PASS${NC}: $description - No template variables"
            ((PASSED++))
            return 0
        fi
    fi
}

echo ""
echo "1️⃣ Testing Directory Structure"
echo "------------------------------"
test_dir ".claude" "Claude directory"
test_dir ".claude/config" "Config directory"
test_dir ".claude/docs" "Documentation directory"
test_dir ".claude/runtime" "Runtime directory"
test_dir ".claude/scripts" "Scripts directory"
test_dir ".github/workflows" "GitHub workflows directory"
test_dir ".mcp" "MCP directory"

echo ""
echo "2️⃣ Testing Core Configuration Files"
echo "-----------------------------------"
test_file "CLAUDE.md" "Main Claude documentation"
test_file ".claude/README.md" "Claude directory README"
test_file ".claude/config/claude-rules.json" "Safety rules configuration"
test_file ".claude/config/integration.json" "Integration configuration"
test_file ".claude/config/permissions.md" "Permissions documentation"
test_json ".claude/config/claude-rules.json" "Safety rules JSON"
test_json ".claude/config/integration.json" "Integration JSON"

echo ""
echo "3️⃣ Testing GitHub Integration"
echo "-----------------------------"
test_file ".github/workflows/claude.yml" "Main Claude workflow"
test_file ".github/scripts/claude-safety-wrapper.sh" "Safety wrapper script"

echo ""
echo "4️⃣ Testing MCP Integration"
echo "--------------------------"
test_file ".mcp/package.json" "MCP package.json"
test_file ".mcp/index.ts" "MCP entry point"
test_file ".mcp/operation-guard.ts" "Operation guard"
test_json ".mcp/package.json" "MCP package.json"

echo ""
echo "5️⃣ Testing Documentation"
echo "------------------------"
test_file ".claude/docs/core/PRINCIPLES.md" "Principles documentation"
test_file ".claude/docs/core/SAFETY.md" "Safety documentation"
test_file ".claude/docs/core/ARCHITECTURE.md" "Architecture documentation"

echo ""
echo "6️⃣ Checking for Template Variables"
echo "----------------------------------"
check_templates "CLAUDE.md" "CLAUDE.md"
check_templates ".claude/config/claude-rules.json" "claude-rules.json"
check_templates ".github/workflows/claude.yml" "claude.yml workflow"

echo ""
echo "7️⃣ Testing Permissions"
echo "----------------------"
if [ -x "$(command -v npx)" ]; then
    echo "Testing MCP operation guard..."
    if [ -f ".mcp/test-operation-guard.ts" ]; then
        cd .mcp && npx tsx test-operation-guard.ts 2>/dev/null && {
            echo -e "${GREEN}✅ PASS${NC}: Operation guard test"
            ((PASSED++))
        } || {
            echo -e "${RED}❌ FAIL${NC}: Operation guard test failed"
            ((FAILED++))
        }
        cd ..
    else
        echo -e "${YELLOW}⚠️  SKIP${NC}: No operation guard test found"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: npx not found - skipping MCP tests"
    ((WARNINGS++))
fi

echo ""
echo "8️⃣ Testing Safety Features"
echo "--------------------------"
# Test forbidden patterns
if [ -f ".claude/config/claude-rules.json" ]; then
    if jq -e '.rules.operations.delete.files.forbidden_patterns | length > 0' ".claude/config/claude-rules.json" >/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}: Forbidden patterns configured"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: No forbidden patterns found"
        ((FAILED++))
    fi
fi

# Test audit log setup
if [ -d ".claude/runtime" ]; then
    touch .claude/runtime/audit.log 2>/dev/null && {
        echo -e "${GREEN}✅ PASS${NC}: Audit log writable"
        ((PASSED++))
    } || {
        echo -e "${RED}❌ FAIL${NC}: Cannot write to audit log"
        ((FAILED++))
    }
fi

echo ""
echo "📊 Test Summary"
echo "=============="
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed!${NC}"
    echo "Your Claude integration is ready to use."
    exit 0
else
    echo -e "${RED}❌ Some tests failed.${NC}"
    echo "Please fix the issues above before using Claude integration."
    exit 1
fi