# MCP Server Configuration

## Overview

Model Context Protocol (MCP) servers provide enhanced capabilities for Claude.

## Required Servers

- **filesystem**: File operations with safety checks
- **github**: GitHub API integration
- **memory**: Context persistence
- **sequential-thinking**: Complex problem analysis
- **fetch**: Web content retrieval

## Configuration

See `.claude/config/` for MCP server configurations.

## Integration with OperationGuard

All MCP file operations go through the OperationGuard for safety validation.
