#!/bin/bash
# generate-task-configs.sh - Generate cycle configurations for all 100 tasks

set -euo pipefail

echo "Generating Task Configurations for All 100 Tasks"
echo "==============================================="

# Task definitions - Phase 1
PHASE1_TASKS=(
    "1.1.1:Create backup directory for all Claude files"
    "1.1.2:Copy CLAUDE.md to backup"
    "1.1.3:Copy .claude/config directory to backup"
    "1.1.4:Copy .mcp/operation-guard.ts to backup"
    "1.1.5:Create backup verification log"
    "1.2.1:Read current CLAUDE.md structure"
    "1.2.2:Create CLAUDE.md section mapping document"
    "1.2.3:Identify replaceable sections in CLAUDE.md"
    "1.2.4:Identify enhanceable sections in CLAUDE.md"
    "1.2.5:Identify preservable sections in CLAUDE.md"
)

# Task definitions - Phase 2
PHASE2_TASKS=(
    "2.1.1:Create enforcement mechanism specification"
    "2.1.2:Define violation detection rules"
    "2.1.3:Create automatic blocking specification"
    "2.1.4:Define compliance metrics"
    "2.1.5:Create rollback procedure specification"
    "2.2.1:Design StrictOperationGuard class structure"
    "2.2.2:Define new configuration schema"
    "2.2.3:Create pre-flight check algorithm"
    "2.2.4:Design audit trail enhancement"
    "2.2.5:Create compatibility mode design"
    "2.3.1:Create phase transition criteria"
    "2.3.2:Define compatibility mode rules"
    "2.3.3:Create testing strategy document"
    "2.3.4:Define rollback triggers"
    "2.3.5:Create communication plan"
)

# Function to create task directory and files
create_task_config() {
    local TASK_ID="$1"
    local TASK_NAME="$2"
    local PHASE="${TASK_ID%%.*}"
    
    echo "Creating configuration for Task $TASK_ID..."
    
    # Create task directory
    TASK_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}"
    mkdir -p "$TASK_DIR"
    
    # Determine task level based on phase
    local LEVEL=1
    if [[ "$TASK_ID" =~ ^[3-5]\. ]]; then
        LEVEL=2  # Implementation tasks need approval
    fi
    
    # Create cycle configuration
    cat > "$TASK_DIR/cycle-config.yml" << EOF
task:
  id: "${TASK_ID}"
  name: "${TASK_NAME}"
  phase: ${PHASE}
  section: "${TASK_ID%.*}"
  
cycle:
  backup:
    required: true
    level: ${LEVEL}
    targets:
      - "**/*.md"
      - "**/*.json"
      - "**/*.yml"
      - "**/*.ts"
    
  confirmation:
    level: ${LEVEL}
    template: "standard"
    require_explicit: $([ $LEVEL -ge 2 ] && echo "true" || echo "false")
    
  execution:
    script: "execution-script.sh"
    timeout: 600
    
  verification:
    manual_checks:
      - "Task outputs created"
      - "No errors in execution"
      - "Documentation updated if needed"
      
  evaluation:
    success_criteria:
      - metric: "task_completed"
        target: true
        
  cleanup:
    temporary_files:
      - "/tmp/task-${TASK_ID}-*"
    preserve_outputs: true
EOF

    # Create basic execution script
    cat > "$TASK_DIR/execution-script.sh" << EOF
#!/bin/bash
# Task ${TASK_ID}: ${TASK_NAME}

set -euo pipefail

echo "Executing Task ${TASK_ID}: ${TASK_NAME}"
echo "================================================"

# TODO: Implement actual task logic
echo "Task implementation required"

# Create output directory
OUTPUT_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/outputs"
mkdir -p "\$OUTPUT_DIR"

# Mark task as executed
echo "Task ${TASK_ID} executed at \$(date)" > "\$OUTPUT_DIR/execution.log"

exit 0
EOF
    chmod +x "$TASK_DIR/execution-script.sh"

    # Create standard files
    echo "# Backup list for Task ${TASK_ID}" > "$TASK_DIR/backup-list.txt"
    echo "# Add files to backup here" >> "$TASK_DIR/backup-list.txt"
    
    echo "# Verification checklist for Task ${TASK_ID}" > "$TASK_DIR/verification-checklist.md"
    echo "- [ ] Task completed successfully" >> "$TASK_DIR/verification-checklist.md"
    echo "- [ ] Expected outputs created" >> "$TASK_DIR/verification-checklist.md"
    
    echo "# Cleanup list for Task ${TASK_ID}" > "$TASK_DIR/cleanup-list.txt"
    echo "/tmp/task-${TASK_ID}-*" >> "$TASK_DIR/cleanup-list.txt"
}

# Generate configurations for all phases
echo
echo "Phase 1 Tasks..."
for task in "${PHASE1_TASKS[@]}"; do
    IFS=':' read -r id name <<< "$task"
    create_task_config "$id" "$name"
done

echo
echo "Phase 2 Tasks..."
for task in "${PHASE2_TASKS[@]}"; do
    IFS=':' read -r id name <<< "$task"
    create_task_config "$id" "$name"
done

# Generate remaining tasks (simplified for brevity)
echo
echo "Generating remaining Phase 3-9 tasks..."

# Phase 3-9 task patterns
for phase in {3..9}; do
    for section in {1..3}; do
        for task in {1..5}; do
            # Skip if we exceed expected tasks
            TASK_ID="${phase}.${section}.${task}"
            
            # Adjust for actual task count per phase
            if [[ $phase -eq 3 && $section -eq 3 && $task -gt 5 ]]; then continue; fi
            if [[ $phase -eq 4 && $section -eq 2 && $task -gt 5 ]]; then continue; fi
            if [[ $phase -eq 5 && $section -eq 2 && $task -gt 5 ]]; then continue; fi
            if [[ $phase -eq 6 && $section -eq 2 && $task -gt 5 ]]; then continue; fi
            if [[ $phase -eq 7 && $section -eq 3 && $task -gt 5 ]]; then continue; fi
            if [[ $phase -eq 8 && $section -eq 1 && $task -gt 3 ]]; then continue; fi
            if [[ $phase -eq 8 && $section -eq 2 && $task -gt 3 ]]; then continue; fi
            if [[ $phase -eq 8 && $section -eq 3 && $task -gt 4 ]]; then continue; fi
            if [[ $phase -eq 9 && $section -ge 2 ]]; then continue; fi
            if [[ $phase -eq 9 && $section -eq 1 && $task -gt 5 ]]; then continue; fi
            
            TASK_NAME="Phase ${phase} Task ${section}.${task}"
            create_task_config "$TASK_ID" "$TASK_NAME"
        done
    done
done

# Create task index
INDEX_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-index.json"
echo "{" > "$INDEX_FILE"
echo '  "tasks": [' >> "$INDEX_FILE"

FIRST=true
for dir in .claude/workspace/projects/strict-rules-integration/tasks/task-*/; do
    if [ -d "$dir" ]; then
        TASK_ID=$(basename "$dir" | sed 's/task-//')
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            echo "," >> "$INDEX_FILE"
        fi
        echo -n "    \"$TASK_ID\"" >> "$INDEX_FILE"
    fi
done

echo "" >> "$INDEX_FILE"
echo "  ]" >> "$INDEX_FILE"
echo "}" >> "$INDEX_FILE"

# Summary
TASK_COUNT=$(find .claude/workspace/projects/strict-rules-integration/tasks -name "task-*" -type d | wc -l)
echo
echo "==============================================="
echo "Task Configuration Generation Complete"
echo "==============================================="
echo "Tasks configured: $TASK_COUNT"
echo "Index created at: $INDEX_FILE"
echo
echo "Each task now has:"
echo "- cycle-config.yml"
echo "- execution-script.sh"
echo "- backup-list.txt"
echo "- verification-checklist.md"
echo "- cleanup-list.txt"