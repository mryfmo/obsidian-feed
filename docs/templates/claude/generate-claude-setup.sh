#!/bin/bash
# Claude Integration Setup Generator
# Version: 1.0.0
# Usage: ./generate-claude-setup.sh [project-name] [project-type]

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

# Validate project type
VALID_TYPES=("web-app" "cli-tool" "plugin" "library" "api-service")
if [[ ! " ${VALID_TYPES[@]} " =~ " ${PROJECT_TYPE} " ]]; then
    echo -e "${RED}Error: Invalid project type '${PROJECT_TYPE}'${NC}"
    echo "Valid types: ${VALID_TYPES[*]}"
    exit 1
fi

echo -e "${BLUE}🚀 Claude Integration Setup Generator${NC}"
echo "======================================"
echo "Project: $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Author: $AUTHOR_NAME <$AUTHOR_EMAIL>"
echo "License: $LICENSE"
echo ""

# Create directory structure
echo -e "${GREEN}📁 Creating directory structure...${NC}"
mkdir -p "$PROJECT_NAME"/.claude/{config,docs/{core,workflows,integration,reference},scripts,runtime,tmp-docs/{analysis,experiments,drafts,sandbox},backups}
mkdir -p "$PROJECT_NAME"/.github/{scripts,workflows}
mkdir -p "$PROJECT_NAME"/.mcp/{tests,scripts}
mkdir -p "$PROJECT_NAME"/tools

# Function to process template
process_template() {
    local template_file="$1"
    local output_file="$2"
    
    if [ ! -f "$template_file" ]; then
        echo -e "${YELLOW}⚠️  Template not found: $template_file${NC}"
        return 1
    fi
    
    # Create output directory if needed
    mkdir -p "$(dirname "$output_file")"
    
    # Replace variables
    sed -e "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" \
        -e "s/{{PROJECT_TYPE}}/$PROJECT_TYPE/g" \
        -e "s/{{AUTHOR_NAME}}/$AUTHOR_NAME/g" \
        -e "s/{{AUTHOR_EMAIL}}/$AUTHOR_EMAIL/g" \
        -e "s/{{LICENSE}}/$LICENSE/g" \
        -e "s/{{LAST_UPDATED}}/$(date +%Y-%m-%d)/g" \
        -e "s/{{PROJECT_DESCRIPTION}}/A $PROJECT_TYPE project/g" \
        "$template_file" > "$output_file"
    
    echo -e "  ✅ Created: $output_file"
}

# Get template directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEMPLATE_DIR="$SCRIPT_DIR"

echo -e "${GREEN}📝 Processing templates...${NC}"

# Core configuration files
process_template "$TEMPLATE_DIR/config/claude-rules.template.json" "$PROJECT_NAME/.claude/config/claude-rules.json"
process_template "$TEMPLATE_DIR/config/integration.template.json" "$PROJECT_NAME/.claude/config/integration.json"
process_template "$TEMPLATE_DIR/config/permissions.template.md" "$PROJECT_NAME/.claude/config/permissions.md"
process_template "$TEMPLATE_DIR/gitignore.template" "$PROJECT_NAME/.claude/.gitignore"

# Core documentation
process_template "$TEMPLATE_DIR/core/PRINCIPLES.md" "$PROJECT_NAME/.claude/docs/core/PRINCIPLES.md"
process_template "$TEMPLATE_DIR/core/SAFETY.md" "$PROJECT_NAME/.claude/docs/core/SAFETY.md"
process_template "$TEMPLATE_DIR/core/ARCHITECTURE.template.md" "$PROJECT_NAME/.claude/docs/core/ARCHITECTURE.md"

# Workflow documentation
process_template "$TEMPLATE_DIR/workflows/DEVELOPMENT.template.md" "$PROJECT_NAME/.claude/docs/workflows/DEVELOPMENT.md"

# GitHub workflows
process_template "$TEMPLATE_DIR/github/workflows/claude.template.yml" "$PROJECT_NAME/.github/workflows/claude.yml"

# GitHub scripts
if [ -f "$TEMPLATE_DIR/github/scripts/claude-safety-wrapper.template.sh" ]; then
    process_template "$TEMPLATE_DIR/github/scripts/claude-safety-wrapper.template.sh" "$PROJECT_NAME/.github/scripts/claude-safety-wrapper.sh"
    chmod +x "$PROJECT_NAME/.github/scripts/claude-safety-wrapper.sh"
fi

# MCP setup
process_template "$TEMPLATE_DIR/mcp/package.template.json" "$PROJECT_NAME/.mcp/package.json"
process_template "$TEMPLATE_DIR/mcp/index.template.ts" "$PROJECT_NAME/.mcp/index.ts"
process_template "$TEMPLATE_DIR/mcp/operation-guard.template.ts" "$PROJECT_NAME/.mcp/operation-guard.ts"

# Scripts
process_template "$TEMPLATE_DIR/scripts/test-setup.template.sh" "$PROJECT_NAME/.claude/scripts/test-setup.sh"
chmod +x "$PROJECT_NAME/.claude/scripts/test-setup.sh"

# Core configuration files - continued
process_template "$TEMPLATE_DIR/config/safety-checks.template.json" "$PROJECT_NAME/.claude/config/safety-checks.json"

# MCP configuration
process_template "$TEMPLATE_DIR/mcp/tsconfig.template.json" "$PROJECT_NAME/.mcp/tsconfig.json"

# Shell tools
if [ -f "$TEMPLATE_DIR/tools/turn_guard.template.sh" ]; then
    process_template "$TEMPLATE_DIR/tools/turn_guard.template.sh" "$PROJECT_NAME/tools/turn_guard.sh"
    chmod +x "$PROJECT_NAME/tools/turn_guard.sh"
fi

# Create additional required files
echo -e "${GREEN}📄 Creating additional files...${NC}"

# Create GitHub integration config
cat > "$PROJECT_NAME/.github/claude-integration.json" << EOF
{
  "version": "1.0.0",
  "integration_mode": "hybrid",
  "mcp_enabled": true,
  "safety_level": "strict"
}
EOF
echo -e "  ✅ Created: $PROJECT_NAME/.github/claude-integration.json"

# Create MCP test file
cat > "$PROJECT_NAME/.mcp/test-operation-guard.ts" << 'EOF'
#!/usr/bin/env tsx
import { OperationGuard } from './operation-guard.js';

async function test() {
  console.log('Testing OperationGuard...');
  const guard = new OperationGuard();
  
  // Test forbidden operation
  const result = await guard.checkOperation('delete', 'package.json');
  console.log('Delete package.json:', result.allowed ? '❌ ALLOWED' : '✅ FORBIDDEN');
  
  // Test allowed operation
  const readResult = await guard.checkOperation('read', 'src/index.ts');
  console.log('Read src/index.ts:', readResult.allowed ? '✅ ALLOWED' : '❌ FORBIDDEN');
}

test().catch(console.error);
EOF
chmod +x "$PROJECT_NAME/.mcp/test-operation-guard.ts"
echo -e "  ✅ Created: $PROJECT_NAME/.mcp/test-operation-guard.ts"

# Create main CLAUDE.md
cat > "$PROJECT_NAME/CLAUDE.md" << EOF
# CLAUDE.md - $PROJECT_NAME

This file provides guidance to Claude Code when working with this $PROJECT_TYPE project.

## Project Overview

$PROJECT_NAME is a $PROJECT_TYPE project.

## Essential Documentation

All Claude-specific documentation is in \`.claude/docs/\`:

- **Core Concepts**: \`.claude/docs/core/\`
- **Workflows**: \`.claude/docs/workflows/\`
- **Integration**: \`.claude/docs/integration/\`
- **Reference**: \`.claude/docs/reference/\`

## Safety Configuration

Safety rules are defined in \`.claude/config/claude-rules.json\`.
All operations are logged to \`.claude/runtime/audit.log\`.

## Quick Commands

\`\`\`bash
# Development
npm run dev

# Testing
npm test

# Validate safety
npx tsx .mcp/test-operation-guard.ts
\`\`\`
EOF
echo -e "  ✅ Created: $PROJECT_NAME/CLAUDE.md"

# Create .claude/README.md
cat > "$PROJECT_NAME/.claude/README.md" << EOF
# Claude Integration - $PROJECT_NAME

This directory contains all Claude-specific files for $PROJECT_NAME.

## Structure

- \`config/\` - Configuration files (tracked in git)
- \`docs/\` - Documentation (tracked in git)
- \`runtime/\` - Runtime files like logs (not tracked)
- \`tmp-docs/\` - Temporary documentation (not tracked)
- \`scripts/\` - Claude-specific scripts

## Setup Status

- [x] Directory structure created
- [x] Core configuration files
- [x] Safety rules configured
- [x] GitHub workflows
- [ ] MCP integration tested
- [ ] Custom scripts added
- [ ] Documentation completed

## Next Steps

1. Review and customize files marked with {{VARIABLES}}
2. Remove template instructions and comments
3. Test the integration
4. Commit to version control
EOF
echo -e "  ✅ Created: $PROJECT_NAME/.claude/README.md"

# Create placeholder files
touch "$PROJECT_NAME/.claude/runtime/.gitkeep"
touch "$PROJECT_NAME/.claude/tmp-docs/.gitkeep"

# Summary
echo ""
echo -e "${BLUE}📊 Setup Summary${NC}"
echo "================"
echo "Created structure:"
find "$PROJECT_NAME" -type f -name "*.md" -o -name "*.json" -o -name "*.yml" | sort | sed 's/^/  /'

echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. cd $PROJECT_NAME"
echo "2. Search for {{VARIABLES}} and replace with actual values:"
echo "   grep -r '{{' . --include='*.md' --include='*.json' --include='*.yml'"
echo "3. Uncomment sections relevant to $PROJECT_TYPE"
echo "4. Remove template instructions and comments"
echo "5. Initialize git and commit"
echo ""
echo -e "${GREEN}✅ Claude integration setup complete!${NC}"

# Create a setup completion script
cat > "$PROJECT_NAME/complete-claude-setup.sh" << 'EOF'
#!/bin/bash
# Complete Claude Setup - Final customization helper

echo "🔍 Finding remaining template variables..."
echo ""
grep -r '{{' . --include='*.md' --include='*.json' --include='*.yml' --include='*.yaml' | grep -v complete-claude-setup.sh

echo ""
echo "📝 Files to review:"
find . -name "*.template.*" -o -name "*template*" | grep -v complete-claude-setup.sh

echo ""
echo "🧹 Cleanup commands:"
echo "  # Remove template comments:"
echo "  find . -type f \\( -name '*.md' -o -name '*.json' -o -name '*.yml' \\) -exec sed -i '' '/^#.*Template Instructions:/,/^# 6\./d' {} +"
echo ""
echo "  # Remove this script after completion:"
echo "  rm complete-claude-setup.sh"
EOF

chmod +x "$PROJECT_NAME/complete-claude-setup.sh"
echo -e "  ✅ Created: $PROJECT_NAME/complete-claude-setup.sh (run this to complete setup)"