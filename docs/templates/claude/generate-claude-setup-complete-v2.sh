#!/bin/bash
# Claude Integration Setup Generator - Complete Edition v2
# Version: 2.1.0
# Usage: ./generate-claude-setup-complete-v2.sh [project-name] [project-type] [options]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_NAME="${1:-my-project}"
PROJECT_TYPE="${2:-web-app}" # web-app|cli-tool|plugin|library|api-service
AUTHOR_NAME="${3:-Your Name}"
AUTHOR_EMAIL="${4:-you@example.com}"
LICENSE="${5:-MIT}"

# Parse optional components
INCLUDE_ALL=false
INCLUDE_WORKFLOWS=false
INCLUDE_INTEGRATION=false
INCLUDE_REFERENCE=false
INCLUDE_ADVANCED=false
INCLUDE_EXAMPLES=false

# Check for flags
shift 5 2>/dev/null || shift $#
for arg in "$@"; do
    case $arg in
        --all)
            INCLUDE_ALL=true
            INCLUDE_WORKFLOWS=true
            INCLUDE_INTEGRATION=true
            INCLUDE_REFERENCE=true
            INCLUDE_ADVANCED=true
            INCLUDE_EXAMPLES=true
            ;;
        --workflows)
            INCLUDE_WORKFLOWS=true
            ;;
        --integration)
            INCLUDE_INTEGRATION=true
            ;;
        --reference)
            INCLUDE_REFERENCE=true
            ;;
        --advanced)
            INCLUDE_ADVANCED=true
            ;;
        --examples)
            INCLUDE_EXAMPLES=true
            ;;
        --help)
            echo "Usage: $0 [project-name] [project-type] [author] [email] [license] [options]"
            echo ""
            echo "Options:"
            echo "  --all          Include all optional components"
            echo "  --workflows    Include additional workflow documentation"
            echo "  --integration  Include integration guides"
            echo "  --reference    Include reference documentation"
            echo "  --advanced     Include advanced scripts and tools"
            echo "  --examples     Include example implementations"
            echo ""
            echo "Project types: web-app, cli-tool, plugin, library, api-service"
            exit 0
            ;;
    esac
done

# Validate project type
VALID_TYPES=("web-app" "cli-tool" "plugin" "library" "api-service")
if [[ ! " ${VALID_TYPES[@]} " =~ " ${PROJECT_TYPE} " ]]; then
    echo -e "${RED}Error: Invalid project type '${PROJECT_TYPE}'${NC}"
    echo "Valid types: ${VALID_TYPES[*]}"
    exit 1
fi

# Set project-type specific defaults
case "$PROJECT_TYPE" in
    web-app)
        PROJECT_FORBIDDEN_FILES="*.env.production\", \"build/*"
        PROJECT_CONFIG_PATTERNS="*.config.js\", \".env*"
        PROJECT_TEST_COMMAND="npm test"
        PROJECT_BUILD_COMMAND="npm run build"
        PROJECT_DEV_COMMAND="npm run dev"
        ;;
    cli-tool)
        PROJECT_FORBIDDEN_FILES="~/.config/**\", \"~/.ssh/**"
        PROJECT_FORBIDDEN_DIRS="/usr/bin\", \"/etc"
        PROJECT_FORBIDDEN_COMMANDS="sudo *\", \"rm -rf /"
        PROJECT_TEST_COMMAND="npm test"
        PROJECT_BUILD_COMMAND="npm run compile"
        PROJECT_DEV_COMMAND="npm run dev"
        ;;
    plugin)
        PROJECT_FORBIDDEN_FILES="manifest.json\", \"plugin.json"
        PROJECT_CONFIG_PATTERNS="*.json\", \"config/*"
        PROJECT_TEST_COMMAND="npm test"
        PROJECT_BUILD_COMMAND="npm run bundle"
        PROJECT_DEV_COMMAND="npm run watch"
        ;;
    library)
        PROJECT_FORBIDDEN_FILES="dist/*\", \"lib/*"
        PROJECT_TEST_COMMAND="npm test"
        PROJECT_BUILD_COMMAND="npm run build:lib"
        PROJECT_DEV_COMMAND="npm run dev"
        ;;
    api-service)
        PROJECT_FORBIDDEN_FILES="*.key\", \"*.pem\", \"*.cert"
        PROJECT_FORBIDDEN_COMMANDS="DROP DATABASE\", \"DELETE FROM"
        PROJECT_TEST_COMMAND="npm test"
        PROJECT_BUILD_COMMAND="npm run build:api"
        PROJECT_DEV_COMMAND="npm run start:dev"
        ;;
esac

# Default empty values for optional variables
PROJECT_SCOPE="${PROJECT_SCOPE:-}"
PROJECT_REPOSITORY="${PROJECT_REPOSITORY:-}"
PROJECT_OPERATIONS="${PROJECT_OPERATIONS:-['read', 'write', 'create']}"
PROJECT_RUNNER="${PROJECT_RUNNER:-ubuntu-latest}"
PROJECT_CONTEXT_ADDITIONS="${PROJECT_CONTEXT_ADDITIONS:-}"
PROJECT_LABELS="${PROJECT_LABELS:-['claude-safe']}"
PROJECT_IMPORTS="${PROJECT_IMPORTS:-}"
PROJECT_TOOLS="${PROJECT_TOOLS:-[]}"
PROJECT_TOOL_HANDLERS="${PROJECT_TOOL_HANDLERS:-}"
PROJECT_TOOL_SETUP="${PROJECT_TOOL_SETUP:-}"
PROJECT_METHODS="${PROJECT_METHODS:-}"
PROJECT_FORBIDDEN_FILES="${PROJECT_FORBIDDEN_FILES:-}"
PROJECT_FORBIDDEN_DIRS="${PROJECT_FORBIDDEN_DIRS:-}"
PROJECT_RESTRICTED_DIRS="${PROJECT_RESTRICTED_DIRS:-}"
PROJECT_CONFIG_PATTERNS="${PROJECT_CONFIG_PATTERNS:-}"
PROJECT_FORBIDDEN_CREATE="${PROJECT_FORBIDDEN_CREATE:-}"
PROJECT_FORBIDDEN_COMMANDS="${PROJECT_FORBIDDEN_COMMANDS:-}"
PROJECT_CONFIRM_COMMANDS="${PROJECT_CONFIRM_COMMANDS:-}"
PROJECT_SPECIFIC_DIRECTIVES="${PROJECT_SPECIFIC_DIRECTIVES:-}"

# Documentation variables
PROJECT_OPTIMIZATION_DESCRIPTION="${PROJECT_OPTIMIZATION_DESCRIPTION:-Optimized for $PROJECT_TYPE development with safety controls}"
PROJECT_REQUIREMENTS_AND_CONSTRAINTS="${PROJECT_REQUIREMENTS_AND_CONSTRAINTS:-Standard $PROJECT_TYPE requirements}"
PROJECT_DOMAIN_CONSIDERATIONS="${PROJECT_DOMAIN_CONSIDERATIONS:-Consider $PROJECT_TYPE best practices}"
PROJECT_INTEGRATION_POINTS="${PROJECT_INTEGRATION_POINTS:-Integrates via MCP protocol and GitHub Actions}"
PROJECT_SPECIFIC_REQUIREMENTS="${PROJECT_SPECIFIC_REQUIREMENTS:-Follow project coding standards}"
PROJECT_SPECIFIC_RESTRICTIONS="${PROJECT_SPECIFIC_RESTRICTIONS:-Respect project security policies}"
PROJECT_GOOD_PRACTICES_EXAMPLES="${PROJECT_GOOD_PRACTICES_EXAMPLES:-See examples/ directory for patterns}"
PROJECT_ANTIPATTERNS_EXAMPLES="${PROJECT_ANTIPATTERNS_EXAMPLES:-Avoid bypassing safety checks}"

echo -e "${BLUE}🚀 Claude Integration Setup Generator - Complete Edition v2${NC}"
echo "========================================================="
echo "Project: $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Author: $AUTHOR_NAME <$AUTHOR_EMAIL>"
echo "License: $LICENSE"
echo ""
echo "Optional Components:"
echo "  Workflows:    $([ $INCLUDE_WORKFLOWS = true ] && echo "✅" || echo "❌")"
echo "  Integration:  $([ $INCLUDE_INTEGRATION = true ] && echo "✅" || echo "❌")"
echo "  Reference:    $([ $INCLUDE_REFERENCE = true ] && echo "✅" || echo "❌")"
echo "  Advanced:     $([ $INCLUDE_ADVANCED = true ] && echo "✅" || echo "❌")"
echo "  Examples:     $([ $INCLUDE_EXAMPLES = true ] && echo "✅" || echo "❌")"
echo ""

# Create directory structure
echo -e "${GREEN}📁 Creating directory structure...${NC}"
mkdir -p "$PROJECT_NAME"/.claude/{config,docs/{core,workflows,integration,reference},scripts,runtime,tmp-docs/{analysis,experiments,drafts,sandbox},backups}
mkdir -p "$PROJECT_NAME"/.github/{scripts,workflows}
mkdir -p "$PROJECT_NAME"/.mcp/{tests,scripts}
mkdir -p "$PROJECT_NAME"/tools
mkdir -p "$PROJECT_NAME"/examples

# Enhanced template processing function
process_template() {
    local template_file="$1"
    local output_file="$2"
    
    if [ ! -f "$template_file" ]; then
        echo -e "${YELLOW}⚠️  Template not found: $template_file${NC}"
        return 1
    fi
    
    # Create output directory if needed
    mkdir -p "$(dirname "$output_file")"
    
    # Create temporary file for processing
    local temp_file=$(mktemp)
    cp "$template_file" "$temp_file"
    
    # Replace all variables - using a more robust approach
    # Core variables
    sed -i.bak "s|{{PROJECT_NAME}}|$PROJECT_NAME|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_TYPE}}|$PROJECT_TYPE|g" "$temp_file"
    sed -i.bak "s|{{AUTHOR_NAME}}|$AUTHOR_NAME|g" "$temp_file"
    sed -i.bak "s|{{AUTHOR_EMAIL}}|$AUTHOR_EMAIL|g" "$temp_file"
    sed -i.bak "s|{{LICENSE}}|$LICENSE|g" "$temp_file"
    sed -i.bak "s|{{LAST_UPDATED}}|$(date +%Y-%m-%d)|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_DESCRIPTION}}|A $PROJECT_TYPE project|g" "$temp_file"
    
    # Package variables
    sed -i.bak "s|{{PROJECT_SCOPE}}|${PROJECT_SCOPE:-$PROJECT_NAME}|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_VERSION}}|1.0.0|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_REPOSITORY}}|$PROJECT_REPOSITORY|g" "$temp_file"
    
    # GitHub Action variables
    sed -i.bak "s|{{PROJECT_OPERATIONS}}|$PROJECT_OPERATIONS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_RUNNER}}|$PROJECT_RUNNER|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_CONTEXT_ADDITIONS}}|$PROJECT_CONTEXT_ADDITIONS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_LABELS}}|$PROJECT_LABELS|g" "$temp_file"
    
    # MCP Integration variables
    sed -i.bak "s|{{PROJECT_IMPORTS}}|$PROJECT_IMPORTS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_TOOLS}}|$PROJECT_TOOLS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_TOOL_HANDLERS}}|$PROJECT_TOOL_HANDLERS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_TOOL_SETUP}}|$PROJECT_TOOL_SETUP|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_METHODS}}|$PROJECT_METHODS|g" "$temp_file"
    
    # Safety configuration variables
    sed -i.bak "s|{{PROJECT_FORBIDDEN_FILES}}|$PROJECT_FORBIDDEN_FILES|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_FORBIDDEN_DIRS}}|$PROJECT_FORBIDDEN_DIRS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_RESTRICTED_DIRS}}|$PROJECT_RESTRICTED_DIRS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_CONFIG_PATTERNS}}|$PROJECT_CONFIG_PATTERNS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_FORBIDDEN_CREATE}}|$PROJECT_FORBIDDEN_CREATE|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_FORBIDDEN_COMMANDS}}|$PROJECT_FORBIDDEN_COMMANDS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_CONFIRM_COMMANDS}}|$PROJECT_CONFIRM_COMMANDS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_SPECIFIC_DIRECTIVES}}|$PROJECT_SPECIFIC_DIRECTIVES|g" "$temp_file"
    
    # Documentation variables
    sed -i.bak "s|{{PROJECT_OPTIMIZATION_DESCRIPTION}}|$PROJECT_OPTIMIZATION_DESCRIPTION|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_REQUIREMENTS_AND_CONSTRAINTS}}|$PROJECT_REQUIREMENTS_AND_CONSTRAINTS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_DOMAIN_CONSIDERATIONS}}|$PROJECT_DOMAIN_CONSIDERATIONS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_INTEGRATION_POINTS}}|$PROJECT_INTEGRATION_POINTS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_SPECIFIC_REQUIREMENTS}}|$PROJECT_SPECIFIC_REQUIREMENTS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_SPECIFIC_RESTRICTIONS}}|$PROJECT_SPECIFIC_RESTRICTIONS|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_GOOD_PRACTICES_EXAMPLES}}|$PROJECT_GOOD_PRACTICES_EXAMPLES|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_ANTIPATTERNS_EXAMPLES}}|$PROJECT_ANTIPATTERNS_EXAMPLES|g" "$temp_file"
    
    # Script variables
    sed -i.bak "s|{{PROJECT_TEST_COMMAND}}|$PROJECT_TEST_COMMAND|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_BUILD_COMMAND}}|$PROJECT_BUILD_COMMAND|g" "$temp_file"
    sed -i.bak "s|{{PROJECT_DEV_COMMAND}}|$PROJECT_DEV_COMMAND|g" "$temp_file"
    
    # Clean up any remaining empty variables
    sed -i.bak "s|{{[A-Z_]*}}||g" "$temp_file"
    
    # Move processed file to output
    mv "$temp_file" "$output_file"
    rm -f "$temp_file.bak"
    
    echo -e "  ✅ Created: $output_file"
}

# Get template directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEMPLATE_DIR="$SCRIPT_DIR"

echo -e "${GREEN}📝 Processing core templates (required)...${NC}"

# Core configuration files (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/config/claude-rules.template.json" "$PROJECT_NAME/.claude/config/claude-rules.json"
process_template "$TEMPLATE_DIR/config/integration.template.json" "$PROJECT_NAME/.claude/config/integration.json"
process_template "$TEMPLATE_DIR/config/permissions.template.md" "$PROJECT_NAME/.claude/config/permissions.md"
process_template "$TEMPLATE_DIR/config/safety-checks.template.json" "$PROJECT_NAME/.claude/config/safety-checks.json"
process_template "$TEMPLATE_DIR/gitignore.template" "$PROJECT_NAME/.claude/.gitignore"

# Core documentation (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/core/PRINCIPLES.md" "$PROJECT_NAME/.claude/docs/core/PRINCIPLES.md"
process_template "$TEMPLATE_DIR/core/SAFETY.md" "$PROJECT_NAME/.claude/docs/core/SAFETY.md"
process_template "$TEMPLATE_DIR/core/ARCHITECTURE.template.md" "$PROJECT_NAME/.claude/docs/core/ARCHITECTURE.md"

# Core workflow (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/workflows/DEVELOPMENT.template.md" "$PROJECT_NAME/.claude/docs/workflows/DEVELOPMENT.md"

# GitHub essentials (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/github/workflows/claude.template.yml" "$PROJECT_NAME/.github/workflows/claude.yml"
process_template "$TEMPLATE_DIR/github/scripts/claude-safety-wrapper.template.sh" "$PROJECT_NAME/.github/scripts/claude-safety-wrapper.sh"
chmod +x "$PROJECT_NAME/.github/scripts/claude-safety-wrapper.sh"

# MCP core (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/mcp/package.template.json" "$PROJECT_NAME/.mcp/package.json"
process_template "$TEMPLATE_DIR/mcp/index.template.ts" "$PROJECT_NAME/.mcp/index.ts"
process_template "$TEMPLATE_DIR/mcp/operation-guard.template.ts" "$PROJECT_NAME/.mcp/operation-guard.ts"
process_template "$TEMPLATE_DIR/mcp/tsconfig.template.json" "$PROJECT_NAME/.mcp/tsconfig.json"

# Essential scripts (ALWAYS INCLUDED)
process_template "$TEMPLATE_DIR/scripts/test-setup.template.sh" "$PROJECT_NAME/.claude/scripts/test-setup.sh"
chmod +x "$PROJECT_NAME/.claude/scripts/test-setup.sh"

# Essential tools (ALWAYS INCLUDED)
if [ -f "$TEMPLATE_DIR/tools/turn_guard.template.sh" ]; then
    process_template "$TEMPLATE_DIR/tools/turn_guard.template.sh" "$PROJECT_NAME/tools/turn_guard.sh"
    chmod +x "$PROJECT_NAME/tools/turn_guard.sh"
fi

# OPTIONAL: Additional Workflows
if [ $INCLUDE_WORKFLOWS = true ]; then
    echo -e "${GREEN}📝 Processing workflow templates (optional)...${NC}"
    
    # Process additional workflow templates if they exist
    for workflow_template in "$TEMPLATE_DIR"/workflows/*.template.md; do
        if [ -f "$workflow_template" ] && [ "$(basename "$workflow_template")" != "DEVELOPMENT.template.md" ]; then
            workflow_name=$(basename "$workflow_template" .template.md)
            process_template "$workflow_template" "$PROJECT_NAME/.claude/docs/workflows/$workflow_name.md"
        fi
    done
fi

# OPTIONAL: Integration Guides
if [ $INCLUDE_INTEGRATION = true ]; then
    echo -e "${GREEN}📝 Processing integration templates (optional)...${NC}"
    
    # Process integration templates if they exist
    for integration_template in "$TEMPLATE_DIR"/integration/*.template.md; do
        if [ -f "$integration_template" ]; then
            integration_name=$(basename "$integration_template" .template.md)
            process_template "$integration_template" "$PROJECT_NAME/.claude/docs/integration/$integration_name.md"
        fi
    done
fi

# OPTIONAL: Reference Documentation
if [ $INCLUDE_REFERENCE = true ]; then
    echo -e "${GREEN}📝 Processing reference templates (optional)...${NC}"
    
    # Process reference templates if they exist
    for reference_template in "$TEMPLATE_DIR"/reference/*.template.md; do
        if [ -f "$reference_template" ]; then
            reference_name=$(basename "$reference_template" .template.md)
            process_template "$reference_template" "$PROJECT_NAME/.claude/docs/reference/$reference_name.md"
        fi
    done
fi

# OPTIONAL: Advanced Scripts and Tools
if [ $INCLUDE_ADVANCED = true ]; then
    echo -e "${GREEN}📝 Creating advanced scripts (optional)...${NC}"
    
    # Process advanced script templates if they exist
    for script_template in "$TEMPLATE_DIR"/scripts/*.template.{sh,ts}; do
        if [ -f "$script_template" ] && [ "$(basename "$script_template")" != "test-setup.template.sh" ]; then
            script_name=$(basename "$script_template" | sed 's/\.template//')
            process_template "$script_template" "$PROJECT_NAME/.claude/scripts/$script_name"
            if [[ "$script_name" == *.sh ]]; then
                chmod +x "$PROJECT_NAME/.claude/scripts/$script_name"
            fi
        fi
    done
fi

# OPTIONAL: Example Implementations
if [ $INCLUDE_EXAMPLES = true ]; then
    echo -e "${GREEN}📝 Creating example implementations (optional)...${NC}"
    
    # Process example templates if they exist
    for example_template in "$TEMPLATE_DIR"/examples/*.template.*; do
        if [ -f "$example_template" ]; then
            example_name=$(basename "$example_template" | sed 's/\.template//')
            process_template "$example_template" "$PROJECT_NAME/examples/$example_name"
        fi
    done
fi

# Create additional required files (ALWAYS)
echo -e "${GREEN}📄 Creating additional core files...${NC}"

# Create GitHub integration config
cat > "$PROJECT_NAME/.github/claude-integration.json" << EOF
{
  "version": "1.0.0",
  "integration_mode": "hybrid",
  "mcp_enabled": true,
  "safety_level": "strict",
  "project_type": "$PROJECT_TYPE",
  "optional_features": {
    "workflows": $INCLUDE_WORKFLOWS,
    "integration_guides": $INCLUDE_INTEGRATION,
    "reference_docs": $INCLUDE_REFERENCE,
    "advanced_scripts": $INCLUDE_ADVANCED,
    "examples": $INCLUDE_EXAMPLES
  }
}
EOF
echo -e "  ✅ Created: $PROJECT_NAME/.github/claude-integration.json"

# Create main CLAUDE.md
process_template "$TEMPLATE_DIR/CLAUDE.template.md" "$PROJECT_NAME/CLAUDE.md" 2>/dev/null || \
cat > "$PROJECT_NAME/CLAUDE.md" << EOF
# CLAUDE.md - $PROJECT_NAME

This file provides guidance to Claude Code when working with this $PROJECT_TYPE project.

## Project Overview

$PROJECT_NAME is a $PROJECT_TYPE project.

## Essential Documentation

All Claude-specific documentation is in \`.claude/docs/\`:

### Core (Always Available)
- **Principles**: \`.claude/docs/core/PRINCIPLES.md\`
- **Safety**: \`.claude/docs/core/SAFETY.md\`
- **Architecture**: \`.claude/docs/core/ARCHITECTURE.md\`
- **Development**: \`.claude/docs/workflows/DEVELOPMENT.md\`

$([ $INCLUDE_WORKFLOWS = true ] && echo "### Workflows (Optional - Included)
See \`.claude/docs/workflows/\` for additional workflow documentation." || echo "### Workflows (Optional - Not Included)
Run setup with \`--workflows\` to include additional workflow documentation.")

$([ $INCLUDE_INTEGRATION = true ] && echo "
### Integration (Optional - Included)
See \`.claude/docs/integration/\` for integration guides." || echo "
### Integration (Optional - Not Included)
Run setup with \`--integration\` to include integration guides.")

$([ $INCLUDE_REFERENCE = true ] && echo "
### Reference (Optional - Included)
See \`.claude/docs/reference/\` for reference documentation." || echo "
### Reference (Optional - Not Included)
Run setup with \`--reference\` to include reference documentation.")

## Safety Configuration

Safety rules are defined in \`.claude/config/claude-rules.json\`.
All operations are logged to \`.claude/runtime/audit.log\`.

## Quick Commands

\`\`\`bash
# Development
$PROJECT_DEV_COMMAND

# Testing
$PROJECT_TEST_COMMAND

# Build
$PROJECT_BUILD_COMMAND

# Validate safety
npx tsx .mcp/test-operation-guard.ts

# Test setup
./.claude/scripts/test-setup.sh
\`\`\`

$([ $INCLUDE_ADVANCED = true ] && echo "## Advanced Tools (Included)

See \`.claude/scripts/\` for advanced tools and utilities." || echo "## Advanced Tools (Not Included)

Run setup with \`--advanced\` to include advanced scripts.")

$([ $INCLUDE_EXAMPLES = true ] && echo "
## Examples (Included)

See \`examples/\` directory for implementation examples." || echo "
## Examples (Not Included)

Run setup with \`--examples\` to include example implementations.")
EOF

# Create setup status file
cat > "$PROJECT_NAME/.claude/SETUP_STATUS.md" << EOF
# Claude Integration Setup Status

Generated: $(date)
Version: Complete Edition 2.1.0

## Configuration

- Project: $PROJECT_NAME
- Type: $PROJECT_TYPE
- Author: $AUTHOR_NAME <$AUTHOR_EMAIL>
- License: $LICENSE

## Components Included

### Core (Required) ✅
- Configuration files
- Core documentation
- Essential workflows
- GitHub integration
- MCP integration
- Safety system

### Optional Components
- Additional Workflows: $([ $INCLUDE_WORKFLOWS = true ] && echo "✅ Included" || echo "❌ Not included (use --workflows)")
- Integration Guides: $([ $INCLUDE_INTEGRATION = true ] && echo "✅ Included" || echo "❌ Not included (use --integration)")
- Reference Docs: $([ $INCLUDE_REFERENCE = true ] && echo "✅ Included" || echo "❌ Not included (use --reference)")
- Advanced Scripts: $([ $INCLUDE_ADVANCED = true ] && echo "✅ Included" || echo "❌ Not included (use --advanced)")
- Examples: $([ $INCLUDE_EXAMPLES = true ] && echo "✅ Included" || echo "❌ Not included (use --examples)")

## Next Steps

1. Review and customize template variables
2. Test the setup: \`./.claude/scripts/test-setup.sh\`
3. Initialize git and commit
4. Configure GitHub secrets if using CI/CD

## To Add Missing Components

Run the setup again with additional flags:
\`\`\`bash
./generate-claude-setup-complete-v2.sh $PROJECT_NAME $PROJECT_TYPE --all
\`\`\`

Or individual components:
\`\`\`bash
./generate-claude-setup-complete-v2.sh $PROJECT_NAME $PROJECT_TYPE --workflows --reference
\`\`\`
EOF

# Create a README for .claude directory
cat > "$PROJECT_NAME/.claude/README.md" << EOF
# Claude Integration Directory

This directory contains all Claude-specific configuration and documentation.

## Structure

- \`config/\` - Safety rules and configuration
- \`docs/\` - Documentation for Claude integration
- \`scripts/\` - Utility scripts
- \`runtime/\` - Runtime data (audit logs, etc.)
- \`tmp-docs/\` - Temporary documentation (git-ignored)
- \`backups/\` - Backup files (git-ignored)

## Key Files

- \`config/claude-rules.json\` - Safety rules configuration
- \`runtime/audit.log\` - Audit trail of operations
- \`runtime/rollback-registry.json\` - Rollback commands

## Usage

See \`SETUP_STATUS.md\` for included components and \`../CLAUDE.md\` for main documentation.
EOF

# Summary
echo ""
echo -e "${BLUE}📊 Setup Summary${NC}"
echo "================"
echo "Core components (required):"
find "$PROJECT_NAME" -type f \( -name "*.md" -o -name "*.json" -o -name "*.yml" -o -name "*.ts" -o -name "*.sh" \) | grep -E "(config|core|workflows/DEVELOPMENT|github/workflows/claude)" | head -10 | sort | sed 's/^/  ✅ /'

if [ $INCLUDE_ALL = true ] || [ $INCLUDE_WORKFLOWS = true ] || [ $INCLUDE_INTEGRATION = true ] || [ $INCLUDE_REFERENCE = true ] || [ $INCLUDE_ADVANCED = true ] || [ $INCLUDE_EXAMPLES = true ]; then
    echo ""
    echo "Optional components included:"
    [ $INCLUDE_WORKFLOWS = true ] && find "$PROJECT_NAME/.claude/docs/workflows" -name "*.md" 2>/dev/null | grep -v DEVELOPMENT | head -5 | sed 's/^/  ➕ /'
    [ $INCLUDE_INTEGRATION = true ] && find "$PROJECT_NAME/.claude/docs/integration" -name "*.md" 2>/dev/null | head -5 | sed 's/^/  ➕ /'
    [ $INCLUDE_REFERENCE = true ] && find "$PROJECT_NAME/.claude/docs/reference" -name "*.md" 2>/dev/null | head -5 | sed 's/^/  ➕ /'
    [ $INCLUDE_ADVANCED = true ] && find "$PROJECT_NAME/.claude/scripts" -name "*" -type f 2>/dev/null | grep -v test-setup | head -5 | sed 's/^/  ➕ /'
    [ $INCLUDE_EXAMPLES = true ] && find "$PROJECT_NAME/examples" -name "*" -type f 2>/dev/null | head -5 | sed 's/^/  ➕ /'
fi

# Validation check
echo ""
echo -e "${YELLOW}🔍 Checking for unprocessed variables...${NC}"
unprocessed=$(grep -r '{{[A-Z_]*}}' "$PROJECT_NAME" --exclude-dir=node_modules 2>/dev/null | grep -v TEMPLATE_VARIABLES || true)
if [ -n "$unprocessed" ]; then
    echo -e "${YELLOW}⚠️  Found unprocessed variables:${NC}"
    echo "$unprocessed" | head -5
else
    echo -e "${GREEN}✅ All template variables processed successfully${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. cd $PROJECT_NAME"
echo "2. Review .claude/SETUP_STATUS.md for configuration details"
echo "3. Run ./.claude/scripts/test-setup.sh to validate"
echo "4. Customize any remaining template values"
echo "5. Initialize git and commit"
echo ""

if [ $INCLUDE_ALL = false ]; then
    echo -e "${BLUE}💡 Tip:${NC} To include all optional components, run with --all flag"
fi

echo ""
echo -e "${GREEN}✅ Claude integration setup complete!${NC}"

# Create a test script
cat > "$PROJECT_NAME/test-claude-setup.sh" << 'EOF'
#!/bin/bash
# Quick test of Claude setup

echo "🧪 Testing Claude Setup..."
echo ""

# Run the built-in test
if [ -x ".claude/scripts/test-setup.sh" ]; then
    ./.claude/scripts/test-setup.sh
else
    echo "❌ Test script not found or not executable"
    exit 1
fi

echo ""
echo "✅ If all tests passed, your Claude integration is ready!"
echo "📝 Check .claude/SETUP_STATUS.md for included components"
EOF
chmod +x "$PROJECT_NAME/test-claude-setup.sh"