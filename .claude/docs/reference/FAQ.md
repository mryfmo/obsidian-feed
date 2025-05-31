# Frequently Asked Questions

## General

### Q: How do I run tests?
A: Use `pnpm test` for all tests, `pnpm test:unit` for unit tests only.

### Q: Where are feed data stored?
A: In `.obsidian/plugins/contents-feeds-reader/data/` as gzipped JSON files.

### Q: How do I add a new feed?
A: Use the "Add Feed" command from the command palette or the UI button.

## Claude Integration

### Q: Why was my operation blocked?
A: Check `.claude/runtime/audit.log` for details. Likely a safety rule violation.

### Q: How do I enable destructive operations?
A: Add explicit approval in your request, e.g., "Delete X (I approve this action)"

### Q: Where are Claude rules configured?
A: In `.claude/config/claude-rules.json`
