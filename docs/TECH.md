# TECH: GPT MCP Server

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                            │
│                    (MCP Client)                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ stdio (JSON-RPC)
┌─────────────────────▼───────────────────────────────────────┐
│                   gpt-mcp-server                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  McpServer (registerTool API)                       │   │
│  │  ├── gpt_generate    (text generation)              │   │
│  │  ├── gpt_messages    (conversations)                │   │
│  │  └── gpt_status      (configuration check)          │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Model Configuration                                 │   │
│  │  ├── FALLBACK_MODEL = "gpt-5.1-codex"               │   │
│  │  ├── GPT_MODEL env var (optional override)          │   │
│  │  ├── validateConfiguredModel() at startup           │   │
│  │  └── MODEL_FALLBACK_USED flag                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│                   OpenAI API                                │
│              api.openai.com/v1/...                          │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.8+ |
| MCP SDK | @modelcontextprotocol/sdk | ^1.13.3 |
| OpenAI SDK | openai | ^4.x |
| Schema Validation | Zod | ^3.24.1 |
| Dev Runner | tsx | ^4.19.2 |

## File Structure

```
gpt-mcp-server/
├── src/
│   └── index.ts          # Single-file server (~400 LOC)
├── dist/                 # Compiled output (gitignored)
├── docs/
│   ├── PRD.md            # Product requirements
│   ├── PLAN.md           # Implementation roadmap
│   └── TECH.md           # This file
├── package.json
├── tsconfig.json
├── .env.example          # Environment template
├── .gitignore
├── README.md             # User documentation
└── CLAUDE.md             # AI assistant context
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `GPT_MODEL` | No | `gpt-5.1-codex` | Default model to use |

### Model Validation Flow

```
Startup:
1. Read OPENAI_API_KEY (required, exit if missing)
2. Read GPT_MODEL from env (optional)
3. If GPT_MODEL set:
   a. Call OpenAI models.list() API
   b. Check if model exists in response
   c. If exists → ACTIVE_MODEL = GPT_MODEL
   d. If not exists → warning to stderr, ACTIVE_MODEL = FALLBACK_MODEL, MODEL_FALLBACK_USED = true
4. If GPT_MODEL not set:
   a. ACTIVE_MODEL = FALLBACK_MODEL (no validation needed)
```

## API Reference

### gpt_generate

Generate text using OpenAI GPT API with a simple input prompt.

**Input Schema:**
```typescript
{
  input: string;              // Required - The prompt
  model?: string;             // Optional - Model override
  instructions?: string;      // Optional - System instructions
  reasoning_effort?: 'low' | 'medium' | 'high';  // Optional
  max_tokens?: number;        // Optional - Max output length
  temperature?: number;       // Optional - 0-2
  top_p?: number;             // Optional - 0-1
}
```

**Returns:** Generated text with optional usage statistics.

**Annotations:**
- `readOnlyHint: true` - Does not modify any state
- `destructiveHint: false` - Safe operation
- `idempotentHint: false` - Same input produces different output
- `openWorldHint: true` - Interacts with external API

---

### gpt_messages

Generate text using GPT with structured conversation messages.

**Input Schema:**
```typescript
{
  messages: Array<{
    role: 'user' | 'developer' | 'assistant';
    content: string;
  }>;
  model?: string;
  instructions?: string;
  reasoning_effort?: 'low' | 'medium' | 'high';
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}
```

**Returns:** AI response continuing the conversation.

**Annotations:**
- `readOnlyHint: true`
- `destructiveHint: false`
- `idempotentHint: false`
- `openWorldHint: true`

---

### gpt_status

Check GPT MCP server status and configuration.

**Input Schema:**
```typescript
{} // No parameters required
```

**Returns:**
```typescript
{
  active_model: string;           // Currently used model
  configured_model: string | null; // From GPT_MODEL env var
  fallback_model: string;         // Default fallback
  fallback_used: boolean;         // Whether fallback was triggered
  server_version: string;         // Server version
  api_key_configured: boolean;    // Whether OPENAI_API_KEY is set
}
```

**Annotations:**
- `readOnlyHint: true`
- `destructiveHint: false`
- `idempotentHint: true` - Same output for same state
- `openWorldHint: false` - No external API call

## Error Handling

### Error Categories

| Error Type | HTTP Code | User Message |
|------------|-----------|--------------|
| Missing API Key | - | "OPENAI_API_KEY environment variable is required" |
| Invalid API Key | 401 | "Invalid API key. Verify at platform.openai.com" |
| Rate Limited | 429 | "Rate limit exceeded. Wait and retry." |
| Model Not Found | 404 | "Model not found. Check available models." |
| Quota Exceeded | 402 | "API quota exceeded. Check billing at platform.openai.com" |
| Network Error | - | "Network error. Check internet connection." |

### Error Response Format

```typescript
{
  content: [{
    type: "text",
    text: "Error: [actionable message]"
  }],
  isError: true
}
```

## Security Considerations

1. **API Key Storage** - Never hardcoded, always from environment
2. **Input Validation** - Zod `.strict()` rejects unknown properties
3. **Error Messages** - No sensitive data in error responses
4. **Transport** - stdio only (no network exposure)

## Development

### Commands

```bash
npm install     # Install dependencies
npm run dev     # Development with hot reload (tsx watch)
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled server
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Deployment

### Claude Code Configuration

```json
{
  "mcpServers": {
    "gpt-mcp-server": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/gpt-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GPT_MODEL": "gpt-5.1-codex"
      }
    }
  }
}
```

---
*Last Updated: 2025-11-25*

---
> 📋 This document was created following the [Context Keeper Method](https://github.com/george7979/context-keeper-method) - a structured approach to AI-friendly project documentation.
