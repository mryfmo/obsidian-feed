#!/bin/bash
# Generate Work Breakdown Structure (WBS)
# Project: {{PROJECT_NAME}}
# Generated: {{LAST_UPDATED}}

set -euo pipefail

# Configuration
PROJECT_ROOT="${1:-.}"
OUTPUT_FILE="${2:-WBS.md}"
MAX_DEPTH="${3:-3}"
INCLUDE_ESTIMATES="${4:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 WBS Generator - {{PROJECT_NAME}}${NC}"
echo "======================================"

# Initialize WBS
cat > "$OUTPUT_FILE" << EOF
# Work Breakdown Structure - {{PROJECT_NAME}}

Generated: $(date)
Project Type: {{PROJECT_TYPE}}

## Project Overview

{{PROJECT_DESCRIPTION}}

## Task Breakdown

EOF

# Function to estimate task complexity
estimate_complexity() {
    local file="$1"
    local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    
    if [[ $lines -lt 50 ]]; then
        echo "S"
    elif [[ $lines -lt 200 ]]; then
        echo "M"
    elif [[ $lines -lt 500 ]]; then
        echo "L"
    else
        echo "XL"
    fi
}

# Function to scan for TODO/FIXME markers
scan_todos() {
    local dir="$1"
    local indent="$2"
    local depth="$3"
    
    if [[ $depth -gt $MAX_DEPTH ]]; then
        return
    fi
    
    # Check for TODO markers in current directory
    local todo_count=0
    if find "$dir" -maxdepth 1 -name "*.ts" -o -name "*.js" -o -name "*.md" 2>/dev/null | head -1 | grep -q .; then
        todo_count=$(grep -r "TODO\|FIXME\|HACK\|XXX" "$dir" --include="*.ts" --include="*.js" --include="*.md" 2>/dev/null | wc -l || echo 0)
    fi
    
    if [[ $todo_count -gt 0 ]]; then
        echo "${indent}- **$(basename "$dir")** (${todo_count} tasks)" >> "$OUTPUT_FILE"
    else
        echo "${indent}- $(basename "$dir")" >> "$OUTPUT_FILE"
    fi
    
    # Process subdirectories
    for subdir in "$dir"/*; do
        if [[ -d "$subdir" ]] && [[ ! "$subdir" =~ node_modules|\.git|dist|build|coverage ]]; then
            scan_todos "$subdir" "${indent}  " $((depth + 1))
        fi
    done
}

# Generate source code structure
echo -e "\n### Source Code Structure\n" >> "$OUTPUT_FILE"
scan_todos "$PROJECT_ROOT/src" "" 1

# Extract tasks from markdown files
echo -e "\n### Documentation Tasks\n" >> "$OUTPUT_FILE"

find "$PROJECT_ROOT" -name "*.md" -type f | while read -r file; do
    # Skip generated files and node_modules
    if [[ "$file" =~ node_modules|\.git|dist|build|$OUTPUT_FILE ]]; then
        continue
    fi
    
    # Extract TODO items
    grep -n "TODO\|TASK\|\[ \]\|\\[x\\]" "$file" 2>/dev/null | while IFS=: read -r line_num line_content; do
        # Clean up the line
        task=$(echo "$line_content" | sed 's/^[[:space:]]*//;s/TODO://;s/TASK://;s/^- //')
        
        # Determine task status
        if [[ "$line_content" =~ \[x\] ]]; then
            status="✅"
        elif [[ "$line_content" =~ \[\ \] ]]; then
            status="⬜"
        else
            status="📌"
        fi
        
        echo "- $status $task *($(basename "$file"):$line_num)*" >> "$OUTPUT_FILE"
    done
done

# Generate phase-based breakdown
echo -e "\n### Phase-Based Tasks\n" >> "$OUTPUT_FILE"

PHASES=("FETCH" "INV" "ANA" "PLAN" "BUILD" "VERIF" "REL")
for phase in "${PHASES[@]}"; do
    echo -e "\n#### $phase Phase\n" >> "$OUTPUT_FILE"
    
    # Find phase-specific tasks
    phase_files=$(grep -r "PHASE: $phase" "$PROJECT_ROOT" --include="*.md" -l 2>/dev/null || true)
    
    if [[ -n "$phase_files" ]]; then
        echo "$phase_files" | while read -r file; do
            if [[ -n "$file" ]]; then
                echo "- [ ] Review and complete: $(basename "$file")" >> "$OUTPUT_FILE"
            fi
        done
    else
        echo "- [ ] No tasks identified for this phase" >> "$OUTPUT_FILE"
    fi
done

# Generate test coverage breakdown
if [[ -d "$PROJECT_ROOT/tests" ]] || [[ -d "$PROJECT_ROOT/test" ]]; then
    echo -e "\n### Test Coverage Tasks\n" >> "$OUTPUT_FILE"
    
    # Count test files
    test_count=$(find "$PROJECT_ROOT" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l || echo 0)
    src_count=$(find "$PROJECT_ROOT/src" -name "*.ts" -o -name "*.js" 2>/dev/null | grep -v test | wc -l || echo 0)
    
    echo "- Test files: $test_count" >> "$OUTPUT_FILE"
    echo "- Source files: $src_count" >> "$OUTPUT_FILE"
    
    if [[ $src_count -gt 0 ]]; then
        coverage_ratio=$((test_count * 100 / src_count))
        echo "- Coverage ratio: ${coverage_ratio}%" >> "$OUTPUT_FILE"
        
        if [[ $coverage_ratio -lt 80 ]]; then
            echo "- ⚠️ **Action needed**: Increase test coverage to 80%" >> "$OUTPUT_FILE"
        fi
    fi
fi

# Add estimation summary if requested
if [[ "$INCLUDE_ESTIMATES" == "true" ]]; then
    echo -e "\n## Effort Estimation\n" >> "$OUTPUT_FILE"
    
    cat >> "$OUTPUT_FILE" << EOF
### Size Definitions
- **S (Small)**: < 2 hours
- **M (Medium)**: 2-8 hours  
- **L (Large)**: 1-3 days
- **XL (Extra Large)**: 3+ days

### Estimation Guidelines
1. Add 20% buffer for integration testing
2. Add 30% buffer for documentation
3. Consider dependencies between tasks
4. Account for code review cycles
EOF
fi

# Generate summary
echo -e "\n## Summary\n" >> "$OUTPUT_FILE"

total_todos=$(grep -r "TODO\|FIXME" "$PROJECT_ROOT" --include="*.ts" --include="*.js" --include="*.md" 2>/dev/null | wc -l || echo 0)
total_tasks=$(grep -c "^- \[" "$OUTPUT_FILE" 2>/dev/null || echo 0)

cat >> "$OUTPUT_FILE" << EOF
- Total TODOs in code: $total_todos
- Total tasks identified: $total_tasks
- Last updated: $(date)

### Next Steps
1. Review and prioritize tasks
2. Assign owners to each task
3. Set target completion dates
4. Track progress in project management tool
EOF

echo -e "${GREEN}✅ WBS generated successfully!${NC}"
echo "Output saved to: $OUTPUT_FILE"

# Display summary
echo -e "\n${BLUE}📊 Quick Summary:${NC}"
echo "- Total TODOs found: $total_todos"
echo "- Total tasks identified: $total_tasks"
echo "- Output file: $OUTPUT_FILE"