#!/bin/bash
# test-cycle-non-interactive.sh - Test the 7-step cycle without user interaction

set -euo pipefail

echo "======================================"
echo "7-STEP CYCLE TEST (Non-Interactive)"
echo "======================================"
echo "This test simulates the complete cycle without requiring user input"
echo

# Test configuration
TEST_TASK_ID="TEST-001"
TEST_TASK_NAME="Test Task for Cycle Validation"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/Users/mryfmo/Sources/obsidian-feed"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Change to project root
cd "$PROJECT_ROOT"

# Function to simulate a step
simulate_step() {
    local step_num="$1"
    local step_name="$2"
    local script="$3"
    shift 3
    local args=("$@")
    
    echo
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}STEP $step_num/7: $step_name${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -x "$SCRIPT_DIR/$script" ]; then
        # Create test task directory if needed
        if [[ "$step_num" == "1" ]]; then
            mkdir -p ".claude/workspace/projects/strict-rules-integration/tasks/task-${TEST_TASK_ID}"
            echo "# Test backup list" > ".claude/workspace/projects/strict-rules-integration/tasks/task-${TEST_TASK_ID}/backup-list.txt"
        fi
        
        # Special handling for confirmation step
        if [[ "$script" == "request-confirmation.sh" ]]; then
            echo "Simulating user confirmation..."
            echo "[$(date)] Task ${TEST_TASK_ID} approved by user (simulated)" >> .claude/runtime/confirmations.log
            echo -e "${GREEN}✓ Confirmation simulated${NC}"
        else
            # Run the actual script
            if [ ${#args[@]} -eq 0 ]; then
                "$SCRIPT_DIR/$script"
            else
                "$SCRIPT_DIR/$script" "${args[@]}"
            fi
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ Step completed successfully${NC}"
            else
                echo -e "${RED}✗ Step failed${NC}"
                return 1
            fi
        fi
    else
        echo -e "${RED}✗ Script not found or not executable: $script${NC}"
        return 1
    fi
}

# Create test task configuration
echo "Creating test task configuration..."
TEST_TASK_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TEST_TASK_ID}"
mkdir -p "$TEST_TASK_DIR"

# Create minimal test configuration
cat > "$TEST_TASK_DIR/cycle-config.yml" << EOF
task:
  id: "${TEST_TASK_ID}"
  name: "${TEST_TASK_NAME}"
  phase: 0
  section: "TEST"
  
cycle:
  backup:
    required: true
    level: 1
    targets:
      - "README.md"
    
  confirmation:
    level: 1
    template: "standard"
    
  execution:
    script: "execution-script.sh"
    timeout: 60
EOF

# Create test execution script
cat > "$TEST_TASK_DIR/execution-script.sh" << 'EOF'
#!/bin/bash
echo "Executing test task..."
mkdir -p "$(dirname "$0")/outputs"
echo "Test task executed at $(date)" > "$(dirname "$0")/outputs/test-result.txt"
echo "Test execution successful!"
exit 0
EOF
chmod +x "$TEST_TASK_DIR/execution-script.sh"

# Create other required files
echo "README.md" > "$TEST_TASK_DIR/backup-list.txt"
echo "- [ ] Test verification item" > "$TEST_TASK_DIR/verification-checklist.md"
echo "/tmp/task-${TEST_TASK_ID}-*" > "$TEST_TASK_DIR/cleanup-list.txt"

# Start the test
echo
echo "Starting 7-step cycle test..."
echo "======================================"

# Track results
STEPS_PASSED=0
TOTAL_STEPS=7

# Step 1: Backup
simulate_step 1 "BACKUP" "create-task-backup.sh" "$TEST_TASK_ID" && ((STEPS_PASSED++)) || true

# Step 2: Confirmation (simulated)
simulate_step 2 "CONFIRMATION" "request-confirmation.sh" "$TEST_TASK_ID" "$TEST_TASK_NAME" && ((STEPS_PASSED++)) || true

# Step 3: Execution
echo "[$(date)] START Task ${TEST_TASK_ID}" >> .claude/runtime/task-execution.log
simulate_step 3 "EXECUTION" "../tasks/task-${TEST_TASK_ID}/execution-script.sh" && ((STEPS_PASSED++)) || true
echo "[$(date)] COMPLETE Task ${TEST_TASK_ID}" >> .claude/runtime/task-execution.log

# Step 4: Verification
simulate_step 4 "VERIFICATION" "verify-task.sh" "$TEST_TASK_ID" && ((STEPS_PASSED++)) || true

# Step 5: Evaluation
simulate_step 5 "EVALUATION" "evaluate-task.sh" "$TEST_TASK_ID" && ((STEPS_PASSED++)) || true

# Step 6: Progress Update
simulate_step 6 "PROGRESS UPDATE" "update-progress.sh" "$TEST_TASK_ID" && ((STEPS_PASSED++)) || true

# Step 7: Cleanup
simulate_step 7 "CLEANUP" "cleanup-task.sh" "$TEST_TASK_ID" && ((STEPS_PASSED++)) || true

# Summary
echo
echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
echo "Steps Passed: $STEPS_PASSED/$TOTAL_STEPS"

if [ $STEPS_PASSED -eq $TOTAL_STEPS ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo "The 7-step cycle is working correctly."
    EXIT_CODE=0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Please check the output above for details."
    EXIT_CODE=1
fi

# Cleanup test artifacts
echo
echo "Cleaning up test artifacts..."
rm -rf "$TEST_TASK_DIR"
echo "Test cleanup complete."

echo "======================================"
exit $EXIT_CODE