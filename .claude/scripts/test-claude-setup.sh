#!/bin/bash
# Test Claude Integration Setup
# Project: obsidian-feed
# Type: plugin

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Testing Claude Integration Setup for obsidian-feed"
echo "===================================================="

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

# Function to test command
test_command() {
    local cmd="$1"
    local description="$2"
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠️  WARN${NC}: $description - Command not found: $cmd"
        ((WARNINGS++))
        return 1
    fi
}

echo ""
echo "1. Testing Directory Structure"
echo "------------------------------"
test_dir ".claude" "Claude directory exists"
test_dir ".claude/config" "Config directory exists"
test_dir ".claude/docs" "Docs directory exists"
test_dir ".claude/runtime" "Runtime directory exists"
test_dir ".claude/scripts" "Scripts directory exists"
test_dir ".claude/workspace" "Workspace directory exists"
test_dir ".mcp" "MCP directory exists"
test_dir ".github/workflows" "GitHub workflows directory exists"

echo ""
echo "2. Testing Configuration Files"
echo "------------------------------"
test_file ".claude/config/claude-rules.json" "Claude rules configuration"
test_file ".claude/config/permissions.md" "Permissions documentation"
test_file ".claude/config/safety-checks.json" "Safety checks configuration"
test_file ".claude/config/consolidated-safety-rules.json" "Consolidated safety rules"
test_file "CLAUDE.md" "Main Claude documentation"

echo ""
echo "3. Testing Scripts"
echo "------------------"
test_file ".claude/scripts/init-workspace.sh" "Workspace initialization script"
test_file ".claude/scripts/validate-workspace.sh" "Workspace validation script"
test_file ".github/scripts/claude-safety-wrapper.sh" "GitHub safety wrapper"
test_file "tools/turn_guard.sh" "Turn guard script"

echo ""
echo "4. Testing Workflows"
echo "--------------------"
test_file ".github/workflows/claude.yml" "Claude GitHub workflow"
test_file ".github/workflows/mcp-validation.yml" "MCP validation workflow"

echo ""
echo "5. Testing Commands"
echo "-------------------"
test_command "node" "Node.js"
test_command "pnpm" "pnpm package manager"
test_command "git" "Git"

echo ""
echo "6. Testing Script Execution"
echo "---------------------------"
if [ -x ".claude/scripts/validate-workspace.sh" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Workspace validation script is executable"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Workspace validation script is not executable"
    ((FAILED++))
fi

if [ -x ".claude/scripts/init-workspace.sh" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Workspace init script is executable"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Workspace init script is not executable"
    ((FAILED++))
fi

echo ""
echo "7. Testing MCP Integration"
echo "--------------------------"
if [ -f ".mcp/package.json" ]; then
    echo -e "${GREEN}✅ PASS${NC}: MCP package.json exists"
    ((PASSED++))
    
    # Check if MCP dependencies are installed
    if [ -d ".mcp/node_modules" ]; then
        echo -e "${GREEN}✅ PASS${NC}: MCP dependencies installed"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠️  WARN${NC}: MCP dependencies not installed - run 'cd .mcp && pnpm install'"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}❌ FAIL${NC}: MCP package.json not found"
    ((FAILED++))
fi

echo ""
echo "=================================================="
echo "Test Summary:"
echo "  ✅ Passed:   $PASSED"
echo "  ❌ Failed:   $FAILED"
echo "  ⚠️  Warnings: $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix the issues above.${NC}"
    exit 1
fi