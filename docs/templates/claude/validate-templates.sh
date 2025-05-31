#!/bin/bash
# Template Validation Script
# Validates Claude integration templates for consistency and completeness

set -euo pipefail

# Configuration
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERROR_COUNT=0
WARNING_COUNT=0
VERBOSE="${1:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}🔍 Claude Template Validation${NC}"
echo "=============================="
echo "Template directory: $TEMPLATE_DIR"
echo ""

# Function to check for unprocessed variables
check_variables() {
    local file="$1"
    local unprocessed=$(grep -o '{{[A-Z_]*}}' "$file" 2>/dev/null | sort -u || true)
    
    if [[ -n "$unprocessed" ]]; then
        echo -e "${YELLOW}⚠️  WARNING${NC}: Unprocessed variables in $(basename "$file"):"
        echo "$unprocessed" | while read -r var; do
            echo "    $var"
        done
        ((WARNING_COUNT++))
    elif [[ "$VERBOSE" == "true" ]]; then
        echo -e "${GREEN}✓${NC} No unprocessed variables in $(basename "$file")"
    fi
}

# Function to validate JSON files
validate_json() {
    local file="$1"
    
    if command -v jq >/dev/null 2>&1; then
        if ! jq . "$file" >/dev/null 2>&1; then
            echo -e "${RED}❌ ERROR${NC}: Invalid JSON in $(basename "$file")"
            ((ERROR_COUNT++))
        elif [[ "$VERBOSE" == "true" ]]; then
            echo -e "${GREEN}✓${NC} Valid JSON: $(basename "$file")"
        fi
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo -e "${YELLOW}⚠️${NC} Skipping JSON validation (jq not installed)"
        fi
    fi
}

# Function to check file references
check_references() {
    local file="$1"
    
    # Extract file references (paths in backticks or quotes)
    grep -Eo '`[^`]+`|"[^"]+"' "$file" 2>/dev/null | sed 's/[`"]//g' | while read -r ref; do
        # Skip if not a file path
        if [[ ! "$ref" =~ \.md$|\.json$|\.yml$|\.ts$|\.js$|\.sh$ ]]; then
            continue
        fi
        
        # Skip URLs and example paths
        if [[ "$ref" =~ ^https?:// ]] || [[ "$ref" =~ ^/ ]] || [[ "$ref" =~ example|EXAMPLE ]]; then
            continue
        fi
        
        # Check if referenced template exists
        if [[ "$ref" =~ template ]] && [[ ! -f "$TEMPLATE_DIR/$ref" ]]; then
            echo -e "${YELLOW}⚠️  WARNING${NC}: Referenced template not found: $ref (in $(basename "$file"))"
            ((WARNING_COUNT++))
        fi
    done
}

# Function to check for required template files
check_required_templates() {
    echo -e "\n${MAGENTA}📋 Checking required templates...${NC}"
    
    REQUIRED_TEMPLATES=(
        "config/claude-rules.template.json"
        "config/integration.template.json"
        "config/permissions.template.md"
        "config/safety-checks.template.json"
        "core/PRINCIPLES.md"
        "core/SAFETY.md"
        "core/ARCHITECTURE.template.md"
        "workflows/DEVELOPMENT.template.md"
        "github/workflows/claude.template.yml"
        "github/scripts/claude-safety-wrapper.template.sh"
        "mcp/package.template.json"
        "mcp/index.template.ts"
        "mcp/operation-guard.template.ts"
        "mcp/tsconfig.template.json"
        "scripts/test-setup.template.sh"
        "gitignore.template"
    )
    
    for template in "${REQUIRED_TEMPLATES[@]}"; do
        if [[ -f "$TEMPLATE_DIR/$template" ]]; then
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${GREEN}✓${NC} Found: $template"
            fi
        else
            echo -e "${RED}❌ ERROR${NC}: Missing required template: $template"
            ((ERROR_COUNT++))
        fi
    done
}

# Function to check variable definitions
check_variable_definitions() {
    echo -e "\n${MAGENTA}📋 Checking variable definitions...${NC}"
    
    if [[ ! -f "$TEMPLATE_DIR/TEMPLATE_VARIABLES.md" ]]; then
        echo -e "${RED}❌ ERROR${NC}: Missing TEMPLATE_VARIABLES.md"
        ((ERROR_COUNT++))
        return
    fi
    
    # Extract all variables used in templates
    ALL_VARS=$(find "$TEMPLATE_DIR" -name "*.template.*" -o -name "*.md" | \
               xargs grep -ho '{{[A-Z_]*}}' 2>/dev/null | \
               sort -u | \
               grep -v '^$' || true)
    
    # Extract defined variables from TEMPLATE_VARIABLES.md
    DEFINED_VARS=$(grep -o '`{{[A-Z_]*}}`' "$TEMPLATE_DIR/TEMPLATE_VARIABLES.md" 2>/dev/null | \
                   sed 's/`//g' | \
                   sort -u || true)
    
    # Check for undefined variables
    echo "$ALL_VARS" | while read -r var; do
        if [[ -n "$var" ]] && ! echo "$DEFINED_VARS" | grep -q "$var"; then
            echo -e "${YELLOW}⚠️  WARNING${NC}: Variable $var used but not documented in TEMPLATE_VARIABLES.md"
            ((WARNING_COUNT++))
        fi
    done
}

# Function to check template consistency
check_template_consistency() {
    echo -e "\n${MAGENTA}📋 Checking template consistency...${NC}"
    
    # Check if generate scripts exist
    if [[ ! -f "$TEMPLATE_DIR/generate-claude-setup-complete.sh" ]] && \
       [[ ! -f "$TEMPLATE_DIR/generate-claude-setup-complete-v2.sh" ]]; then
        echo -e "${RED}❌ ERROR${NC}: No generate script found"
        ((ERROR_COUNT++))
    fi
    
    # Check for conflicting configurations
    if [[ -f "$TEMPLATE_DIR/config/claude-rules.template.json" ]]; then
        local audit_paths=$(grep -o '"audit_log":[[:space:]]*"[^"]*"' "$TEMPLATE_DIR/config/claude-rules.template.json" 2>/dev/null || true)
        if echo "$audit_paths" | grep -q '\.claude/audit\.log' && echo "$audit_paths" | grep -q '\.claude/runtime/audit\.log'; then
            echo -e "${YELLOW}⚠️  WARNING${NC}: Conflicting audit log paths in claude-rules.template.json"
            ((WARNING_COUNT++))
        fi
    fi
}

# Main validation process
echo -e "${MAGENTA}🔍 Starting validation...${NC}"

# 1. Check required templates
check_required_templates

# 2. Check all template files
echo -e "\n${MAGENTA}📋 Validating template files...${NC}"
find "$TEMPLATE_DIR" -name "*.template.*" -o -name "*.md" | while read -r file; do
    # Skip non-template markdown files
    if [[ "$file" =~ \.md$ ]] && [[ ! "$file" =~ template ]] && [[ ! "$file" =~ PRINCIPLES|SAFETY|VARIABLES|STANDARDS ]]; then
        continue
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "\nChecking: $(basename "$file")"
    fi
    
    # Check for unprocessed variables
    check_variables "$file"
    
    # Validate JSON files
    if [[ "$file" =~ \.json$ ]]; then
        validate_json "$file"
    fi
    
    # Check file references
    check_references "$file"
done

# 3. Check variable definitions
check_variable_definitions

# 4. Check template consistency
check_template_consistency

# 5. Check for executable scripts
echo -e "\n${MAGENTA}📋 Checking script permissions...${NC}"
find "$TEMPLATE_DIR" -name "*.sh" | while read -r script; do
    if [[ ! -x "$script" ]]; then
        echo -e "${YELLOW}⚠️  WARNING${NC}: Script not executable: $(basename "$script")"
        echo "    Run: chmod +x $script"
        ((WARNING_COUNT++))
    elif [[ "$VERBOSE" == "true" ]]; then
        echo -e "${GREEN}✓${NC} Executable: $(basename "$script")"
    fi
done

# Summary
echo -e "\n${BLUE}📊 Validation Summary${NC}"
echo "===================="
echo -e "Errors:   ${ERROR_COUNT}"
echo -e "Warnings: ${WARNING_COUNT}"

if [[ $ERROR_COUNT -eq 0 && $WARNING_COUNT -eq 0 ]]; then
    echo -e "\n${GREEN}✅ All templates are valid and consistent!${NC}"
    exit 0
elif [[ $ERROR_COUNT -eq 0 ]]; then
    echo -e "\n${YELLOW}⚠️  Validation passed with warnings${NC}"
    echo "Review warnings above to improve template quality."
    exit 0
else
    echo -e "\n${RED}❌ Validation failed${NC}"
    echo "Fix errors above before using templates."
    exit 1
fi