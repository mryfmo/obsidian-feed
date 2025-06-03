# Directory Restructuring Proposal

## 🎯 Recommendation: Purpose-Based Reorganization

### Current Issues
1. `.mcp` name is too generic (suggests general MCP protocol)
2. `tools` contains mixed Claude-specific and general-purpose utilities
3. Claude integration overview is difficult to grasp

### Proposed New Structure

```
obsidian-feed/
├── .claude/                       # Claude integration home directory
│   ├── README.md                 # Integration guide (existing)
│   ├── config/                   # Configuration (existing)
│   ├── docs/                     # Documentation (existing)
│   ├── scripts/                  # Execution cycle scripts (existing)
│   ├── workspace/                # Work area (existing)
│   ├── runtime/                  # Runtime files (existing)
│   │
│   ├── mcp-integration/          # MCP protocol implementation (moved from .mcp/)
│   │   ├── README.md            # MCP integration description
│   │   ├── index.ts             # Entry point
│   │   ├── operation-guard.ts   # Safety validation
│   │   ├── bridge.ts            # Shell → TypeScript bridge
│   │   ├── package.json         # Independent package
│   │   └── tests/               # MCP tests
│   │
│   └── validation/               # Claude-specific validation tools
│       ├── turn-guard.sh        # Moved from tools/
│       ├── validate-stp.sh      # Moved and renamed from tools/
│       └── README.md            # Validation tools description
│
└── tools/                        # General-purpose project tools
    ├── fetch-doc.sh             # General document fetching
    ├── gen-wbs.sh               # General WBS generation
    ├── gen-wbs.py               # Python version of WBS
    └── list-guards.sh           # List guards (general)
```

### Migration Benefits

1. **Clear Ownership**
   - All Claude-related items under `.claude/`
   - MCP positioned as "integration"
   - General tools remain in `tools/`

2. **Discoverability**
   - Complete Claude integration overview visible in `.claude/`
   - Each subdirectory has clear role

3. **Improved Maintainability**
   - Claude-specific changes consolidated in `.claude/`
   - General tools maintain independence

### Migration Plan

#### Phase 1: Preparation (Non-destructive)
```bash
# 1. Create new directories
mkdir -p .claude/mcp-integration
mkdir -p .claude/validation

# 2. File copy (preserving git history)
git mv .mcp/* .claude/mcp-integration/
git mv tools/turn_guard.sh .claude/validation/turn-guard.sh
git mv tools/validate-stp-markers.sh .claude/validation/validate-stp.sh
```

#### Phase 2: Update References
1. **GitHub Workflows** (5 files)
   ```yaml
   # Before
   - run: ./tools/validate-stp-markers.sh
   # After
   - run: ./.claude/validation/validate-stp.sh
   ```

2. **Documentation** (40+ files)
   - Handle with bulk replacement script

3. **Bridge Pattern** (7 files)
   ```bash
   # Before
   if [ -f ".mcp/bridge.ts" ]
   # After
   if [ -f ".claude/mcp-integration/bridge.ts" ]
   ```

#### Phase 3: Validation
- All GitHub Actions succeed
- All tests pass
- Documentation links are valid

#### Phase 4: Cleanup
- Delete old directories
- Update .gitignore

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| External reference breakage | Medium | Search and list all references beforehand |
| CI/CD failure | High | Test in branch before merging |
| Developer confusion | Low | Provide clear migration guide |

### Alternative Comparison

| Option | Advantages | Disadvantages |
|--------|------------|---------------|
| Keep current | No changes needed | Structure remains unclear |
| All to .claude/ | Complete integration | Includes general tools |
| **Purpose-based reorganization** | **Clear and discoverable** | **Migration work required** |

### Implementation Decision

While migration cost is moderate, considering long-term maintainability and Claude integration clarity, **purpose-based reorganization is recommended**.

Specifically:
- Clarifies that MCP is "Claude MCP integration" not general "Model Context Protocol" implementation
- Makes it easier for new developers to find Claude-related features
- Clear placement for future extensions (new validation tools, etc.)