# Claude Code Best Practices

## Quick Start Checklist

When starting any task:

1. **Read Context**

   ```bash
   # Check current phase from git labels or PR title
   # Read CLAUDE.md for project rules
   # Check docs/agents/02_claude-code.md for workflow
   ```

2. **Use TodoWrite First**

   ```typescript
   // Create tasks for current phase
   TodoWrite({
     todos: [
       { id: 'task-001', content: 'Investigate issue', status: 'in_progress', priority: 'high' },
     ],
   });
   ```

3. **Follow Phase Constraints**
   ```
   FETCH  → Only network operations allowed
   INV    → Reproduce and create failing tests
   ANA    → Analysis only, no code changes
   PLAN   → Create RFC documents
   BUILD  → Code changes (≤1000 LOC, ≤10 files)
   VERIF  → Run tests and validation
   REL    → Update version and changelog
   ```

## Integration with turn_guard.sh

Every Claude Code output must pass validation:

```bash
# Local validation
./tools/turn_guard.sh output.md

# CI validation (automatic)
npx tsx .mcp/bridge.ts turn_guard output.md
```

## Common Pitfalls to Avoid

1. **Jumping to BUILD phase**

   - ❌ Don't modify code immediately
   - ✅ Follow FETCH→INV→ANA→PLAN first

2. **Ignoring size limits**

   - ❌ Don't make large changes
   - ✅ Keep changes under 1000 lines

3. **Network access outside FETCH**

   - ❌ Don't fetch URLs in other phases
   - ✅ Cache everything in FETCH phase

4. **Not using TodoWrite**
   - ❌ Don't work without task tracking
   - ✅ Always track progress with todos

## MCP Integration

The project uses MCP for enhanced capabilities:

- **Validation**: 26 guards implemented
- **Workflow**: Phase management and GitHub sync
- **Fetching**: Context7 library documentation
- **Analysis**: Sequential thinking for complex tasks

## Example Workflow

```typescript
// 1. Start with investigation
TodoWrite({
  todos: [
    { id: 'inv-001', content: 'Reproduce test failure', status: 'in_progress', priority: 'high' },
  ],
});

// 2. Run tests to reproduce
Bash({ command: 'pnpm test failing-test.spec.ts' });

// 3. Document findings
Write({ file_path: 'docs/investigations/test-failure.md', content: '...' });

// 4. Mark complete and transition
TodoWrite({
  todos: [
    { id: 'inv-001', status: 'completed' },
    { id: 'ana-001', content: 'Analyze root cause', status: 'pending' },
  ],
});
```

## GitHub Actions Integration

The `.github/workflows/claude.yml` workflow:

- Validates all Claude outputs
- Updates phase labels automatically
- Enforces workflow progression
- Supports hybrid mode (shell + MCP)

## Key Commands

```bash
# Validate turn file
./tools/turn_guard.sh turn.md

# List all guards
./tools/list_guards.sh

# Fetch documentation
./tools/fetch_doc.sh https://example.com/docs

# Run MCP bridge
npx tsx .mcp/bridge.ts turn_guard turn.md
```

## Remember

1. **Always read project documentation first**
2. **Use TodoWrite for task management**
3. **Follow the 7-phase workflow**
4. **Respect guard constraints**
5. **Test your changes**

The workflow exists to ensure quality and prevent errors. Following it makes development smoother and more predictable.
