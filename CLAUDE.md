# CLAUDE.md

This file provides context for Claude Code when working with this project.

## Project Overview

**gpt-mcp-server** is an MCP (Model Context Protocol) server that provides OpenAI GPT capabilities to Claude Code. It implements 3 tools: text generation, multi-turn conversations, and server status check.

## Quick Reference

### Build & Run
```bash
npm install     # Install dependencies
npm run dev     # Development with hot reload (tsx watch)
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled server
```

### Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Environment
Requires `OPENAI_API_KEY` environment variable. Get a key at: https://platform.openai.com/api-keys

## Architecture

### Single-File Design
All server code is in `src/index.ts` (~500 LOC). This is intentional:
- Simple project (3 tools)
- Easy to understand and modify
- No complex module dependencies

### Key Patterns

**Tool Registration (Anthropic MCP Guidelines):**
```typescript
server.registerTool(
  "tool_name",
  {
    title: "Human-readable title",
    description: `Comprehensive description with Args, Returns, Examples`,
    inputSchema: ZodSchema.strict(),
    annotations: { readOnlyHint: true, idempotentHint: false, ... }
  },
  async (params) => { /* handler */ }
);
```

**Why `idempotentHint: false`:** AI text generation produces different outputs for the same input.

**Zod with `.strict()`:** Rejects unknown properties for security and clarity.

### Code Structure
```
src/index.ts:
├── Constants (SERVER_NAME, FALLBACK_MODEL, CONFIGURED_MODEL, ACTIVE_MODEL, MODEL_FALLBACK_USED)
├── Environment validation (OPENAI_API_KEY)
├── OpenAI client initialization
├── Model validation (validateConfiguredModel)
├── Shared types & utilities (handleOpenAIError)
├── Tool: gpt_generate
├── Tool: gpt_messages
├── Tool: gpt_status
└── Server startup (validates model, then connects)
```

## Tools Implemented

| Tool | Purpose |
|------|---------|
| `gpt_generate` | Simple text generation |
| `gpt_messages` | Multi-turn conversations |
| `gpt_status` | Server status and config check |

**Default Model:** `gpt-5.1-codex` (configurable via `GPT_MODEL` env var)

## Dependencies

- `@modelcontextprotocol/sdk` ^1.13.3 - MCP protocol
- `openai` ^4.x - Official OpenAI SDK
- `zod` ^3.24.1 - Schema validation

## Common Tasks

### Adding a New Tool
1. Define Zod schema with `.strict()`
2. Call `server.registerTool()` with comprehensive description
3. Include proper annotations
4. Add to README tool list

### Modifying Error Handling
Edit `handleOpenAIError()` function - maps API errors to actionable user messages.

### Changing Default Model
Set `GPT_MODEL` environment variable in your MCP client config (e.g., `.claude.json`).

### Reasoning Control (GPT-5.1)
The `reasoning_effort` parameter controls GPT-5.1's chain-of-thought reasoning:
- **Not specified:** Uses server default `"minimal"` (adaptive reasoning enabled)
- **`none`:** Disable reasoning entirely (like GPT-4.1, fastest)
- **`minimal`:** Very fast with minimal adaptive reasoning (server default)
- **`low`/`medium`/`high`:** Increasing reasoning depth

**Server Default:** This server uses `minimal` by default to enable adaptive reasoning while keeping responses fast. Override with `none` for pure speed or `high` for complex analysis.

**Model Validation:** At startup, the server validates the configured model via OpenAI `models.list()` API:
- If `GPT_MODEL` not set → uses default `gpt-5.1-codex` (no validation)
- If model exists → uses it silently
- If model doesn't exist → warning to stderr + fallback to `gpt-5.1-codex`

**Fallback model:** Hardcoded in `FALLBACK_MODEL` constant in `src/index.ts`.

**Checking status:** Use `gpt_status` tool to see active model, fallback status, and configuration.

## Documentation

- [docs/PRD.md](./docs/PRD.md) - Product requirements
- [docs/PLAN.md](./docs/PLAN.md) - Implementation roadmap
- [docs/TECH.md](./docs/TECH.md) - Technical specification
