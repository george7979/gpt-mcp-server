# CLAUDE.md

This file provides context for Claude Code when working with this project.

## Project Overview

**gpt-mcp-server** is an MCP (Model Context Protocol) server that provides OpenAI GPT capabilities to Claude Code using the **Responses API** (`v1/responses`). It implements 3 tools: text generation, multi-turn conversations, and server status check.

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
All server code is in `src/index.ts` (~670 LOC). This is intentional:
- Simple project (3 tools)
- Easy to understand and modify
- No complex module dependencies

### API Choice: Responses API

**Why Responses API instead of Chat Completions?**

| Feature | Chat Completions | Responses API |
|---------|------------------|---------------|
| Endpoint | `v1/chat/completions` | `v1/responses` |
| `gpt-5.1-codex` support | ❌ No | ✅ Yes |
| All GPT models | ✅ Yes | ✅ Yes |
| Built-in web search | ❌ No | ✅ Yes |
| Built-in file search | ❌ No | ✅ Yes |
| MCP Tools integration | ❌ No | ✅ Yes |
| Multi-turn via `previous_response_id` | ❌ No | ✅ Yes |

The Responses API is OpenAI's newest and most advanced interface, supporting all models including `gpt-5.1-codex` which is optimized for agentic coding tasks.

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
├── Constants (SERVER_NAME, FALLBACK_MODEL, CHARACTER_LIMIT)
├── Types (ResponseFormat enum, ReasoningEffort type)
├── Environment validation (OPENAI_API_KEY)
├── OpenAI client initialization
├── Model validation (validateConfiguredModel)
├── Shared utilities (truncateResponse, handleOpenAIError, extractResponseText)
├── Zod schemas (GenerateInputSchema, MessagesInputSchema, StatusOutputSchema)
├── Tool: gpt_generate (uses openai.responses.create)
├── Tool: gpt_messages (uses openai.responses.create with input items)
├── Tool: gpt_status (with outputSchema)
└── Server startup (validates model, then connects)
```

## Tools Implemented

| Tool | Purpose |
|------|---------|
| `gpt_generate` | Simple text generation |
| `gpt_messages` | Multi-turn conversations |
| `gpt_status` | Server status and config check |

**Default Model:** `gpt-5.1-codex` (configurable via `GPT_MODEL` env var)

**Response Limit:** 25,000 characters (auto-truncated with warning)

## Dependencies

- `@modelcontextprotocol/sdk` ^1.13.3 - MCP protocol
- `openai` ^4.x - Official OpenAI SDK (uses Responses API)
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

### Reasoning Control (GPT-5.x)
The `reasoning_effort` parameter controls GPT-5.x's chain-of-thought reasoning:
- **Not specified:** Uses server default `"minimal"` (adaptive reasoning enabled)
- **`none`:** Disable reasoning entirely (like GPT-4.1, fastest)
- **`minimal`:** Very fast with minimal adaptive reasoning (server default)
- **`low`/`medium`/`high`:** Increasing reasoning depth

**Server Default:** This server uses `minimal` by default to enable adaptive reasoning while keeping responses fast. Override with `none` for pure speed or `high` for complex analysis.

### Response Format
The `response_format` parameter controls output format:
- **`markdown`:** Human-readable markdown (default)
- **`json`:** Structured JSON for programmatic use

### Response Truncation
Responses exceeding 25,000 characters are automatically truncated with a warning appended. This prevents MCP token overflow issues.

### Extracting Response Text
The Responses API returns a different structure than Chat Completions:
```typescript
// Chat Completions: response.choices[0].message.content
// Responses API: response.output[].content[].text

function extractResponseText(response: OpenAI.Responses.Response): string {
  // Iterates through output items and extracts text from output_text content
}
```

**Model Validation:** At startup, the server validates the configured model via OpenAI `models.list()` API:
- If `GPT_MODEL` not set → uses default `gpt-5.1-codex` (no validation)
- If model exists → uses it silently
- If model doesn't exist → warning to stderr + fallback to `gpt-5.1-codex`

**Fallback model:** Hardcoded in `FALLBACK_MODEL` constant in `src/index.ts`.

**Checking status:** Use `gpt_status` tool to see active model, API type, fallback status, and configuration.

## API Reference

### Responses API Usage

```typescript
// Simple text generation
const response = await openai.responses.create({
  model: "gpt-5.1-codex",
  input: "Your prompt here",
  instructions: "System instructions (optional)",
  reasoning: { effort: "minimal" },  // GPT-5.x only
  max_output_tokens: 1000,
  temperature: 0.7,
});

// Multi-turn conversation
const response = await openai.responses.create({
  model: "gpt-5.1-codex",
  input: [
    { type: "message", role: "user", content: "Hello" },
    { type: "message", role: "assistant", content: "Hi there!" },
    { type: "message", role: "user", content: "How are you?" },
  ],
});
```

### Token Usage
```typescript
// Responses API uses different field names
response.usage.input_tokens   // (not prompt_tokens)
response.usage.output_tokens  // (not completion_tokens)
response.usage.total_tokens
```

## Documentation

- [docs/PRD.md](./docs/PRD.md) - Product requirements
- [docs/PLAN.md](./docs/PLAN.md) - Implementation roadmap
- [docs/TECH.md](./docs/TECH.md) - Technical specification

## Version History

- **v2.0.0** - Migrated to Responses API (`v1/responses`), enabling `gpt-5.1-codex` support
- **v1.1.0** - Added response_format, improved error handling
- **v1.0.0** - Initial release with Chat Completions API
