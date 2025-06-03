#!/bin/bash
# update-master-plan.sh - Add cycle references to master plan

set -euo pipefail

echo "Updating Master Plan with 7-Step Cycle References"
echo "================================================="

# Backup current master plan
MASTER_PLAN=".claude/workspace/projects/strict-rules-integration/PLAN/master-plan.md"
BACKUP_FILE="${MASTER_PLAN}.backup.$(date +%Y%m%d_%H%M%S)"

if [ -f "$MASTER_PLAN" ]; then
    cp "$MASTER_PLAN" "$BACKUP_FILE"
    echo "✓ Backed up master plan to: $BACKUP_FILE"
else
    echo "ERROR: Master plan not found at: $MASTER_PLAN"
    exit 1
fi

# Create updated master plan header
UPDATED_PLAN="${MASTER_PLAN}.updated"
cat > "$UPDATED_PLAN" << 'EOF'
# Strict Rules Integration Master Plan

## Project Overview

This project integrates strict enforcement mechanisms into the existing Claude Code system while preserving its architectural strengths.

## 🚨 MANDATORY: 7-Step Execution Cycle

**EVERY task MUST follow the mandatory 7-step execution cycle defined in:**
`PLAN/02-planning/task-execution-cycle.md`

**NO EXCEPTIONS. Violations result in immediate task termination.**

### Quick Reference: The 7 Steps
1. **BACKUP** - Create timestamped backup before any changes
2. **CONFIRM** - Get explicit user approval to proceed
3. **EXECUTE** - Perform the task actions
4. **VERIFY** - Check task results against criteria
5. **EVALUATE** - Assess success and compliance
6. **UPDATE** - Record progress and status
7. **CLEANUP** - Remove temporary files and archive

### Execution Command

To execute any task with mandatory cycle enforcement:
```bash
.claude/workspace/projects/strict-rules-integration/scripts/execute-task-with-cycle.sh <task-id> "<task-name>"
```

Example:
```bash
./scripts/execute-task-with-cycle.sh 1.1.1 "Create backup directory for all Claude files"
```

## Work Breakdown Structure

EOF

# Extract existing content after "Work Breakdown Structure" and update task references
awk '/^## Work Breakdown Structure/,0' "$MASTER_PLAN" | tail -n +2 | while IFS= read -r line; do
    # Check if this is a task definition line
    if [[ "$line" =~ ^\*\*Task[[:space:]]([0-9]+\.[0-9]+\.[0-9]+):[[:space:]](.+)\*\*$ ]]; then
        TASK_ID="${BASH_REMATCH[1]}"
        TASK_NAME="${BASH_REMATCH[2]}"
        
        # Write the task header
        echo "$line" >> "$UPDATED_PLAN"
        
        # Read until we find the next task or section
        while IFS= read -r next_line; do
            if [[ "$next_line" =~ ^\*\*Task[[:space:]] ]] || [[ "$next_line" =~ ^#+[[:space:]] ]] || [[ "$next_line" =~ ^#### ]]; then
                # Add cycle reference before the next section
                cat >> "$UPDATED_PLAN" << EOF

**🔄 Mandatory Cycle Compliance:**
- Configuration: \`tasks/task-${TASK_ID}/cycle-config.yml\`
- Execution: \`./scripts/execute-task-with-cycle.sh ${TASK_ID} "${TASK_NAME}"\`
- MUST follow all 7 steps - NO EXCEPTIONS

EOF
                echo "$next_line" >> "$UPDATED_PLAN"
                break
            else
                echo "$next_line" >> "$UPDATED_PLAN"
            fi
        done
    else
        echo "$line" >> "$UPDATED_PLAN"
    fi
done

# Add compliance tracking section at the end
cat >> "$UPDATED_PLAN" << 'EOF'

## Compliance Tracking

### Real-time Monitoring
- Compliance Dashboard: `.claude/workspace/projects/strict-rules-integration/compliance/dashboard.json`
- Violation Log: `.claude/runtime/violations.log`
- Cycle Compliance Log: `.claude/runtime/cycle-compliance.log`

### Check Compliance Status
```bash
.claude/workspace/projects/strict-rules-integration/compliance/check-compliance.sh
```

### Enforcement Rules
1. **100% Backup Coverage Required** - No task proceeds without backup
2. **100% Confirmation Required** - No task proceeds without user approval
3. **100% Verification Required** - All tasks must be verified
4. **0 Violations Allowed** - Any violation terminates the session

### Violation Consequences
- **WARNING**: Single step incomplete → Logged, must complete before next task
- **ERROR**: Multiple steps skipped → Task blocked, supervisor review required
- **CRITICAL**: Backup/confirmation skipped → Immediate termination

## Task Execution Summary

Total Tasks: 100
Configured with 7-Step Cycle: 100
Compliance Rate Target: 100%

**Remember: EVERY task execution MUST use the cycle enforcement script. Direct execution of task scripts is FORBIDDEN.**
EOF

# Replace original with updated version
mv "$UPDATED_PLAN" "$MASTER_PLAN"

echo
echo "================================================="
echo "Master Plan Update Complete"
echo "================================================="
echo "✓ All task references updated with cycle enforcement"
echo "✓ Compliance tracking section added"
echo "✓ Execution instructions included"
echo
echo "Original backed up to: $BACKUP_FILE"