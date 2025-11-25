# GPT MCP Server

[![MCP](https://img.shields.io/badge/MCP-1.13.3-blue)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that brings OpenAI GPT capabilities to Claude Code and other MCP clients. Built following Anthropic's official MCP guidelines.

## Why GPT + Claude?

While Claude excels at many tasks, GPT offers unique capabilities:

- **Different Training Data** - Alternative perspective from different model training
- **Reasoning Models** - Access to GPT's reasoning effort levels (low/medium/high)
- **Model Variety** - Access to GPT-4, GPT-4.1, GPT-5.1-codex and future models
- **Second Opinion** - Get a different AI's take on complex problems

## Features

| Tool | Description |
|------|-------------|
| `gpt_generate` | Simple text generation with input prompts |
| `gpt_messages` | Multi-turn structured conversations |
| `gpt_status` | Server status and configuration check |

**Default Model:** `gpt-5.1-codex` (configurable via `GPT_MODEL` env var)

## Quick Start

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **OpenAI API Key** - [Get your key](https://platform.openai.com/api-keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/george7979/gpt-mcp-server.git
cd gpt-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

### Configuration

#### Option 1: Quick Install (Recommended)

Use Claude Code's built-in command:

```bash
claude mcp add gpt-mcp-server node /absolute/path/to/gpt-mcp-server/dist/index.js -e OPENAI_API_KEY=your-api-key-here
```

> **Tip:** Run `pwd` in the gpt-mcp-server directory to get the absolute path.

To install globally (available in all projects):
```bash
claude mcp add gpt-mcp-server node /path/to/dist/index.js -e OPENAI_API_KEY=your-key --scope user
```

#### Option 2: Manual Configuration

Add to your Claude Code MCP settings file (`~/.claude.json`)

```json
{
  "mcpServers": {
    "gpt-mcp-server": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/gpt-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "GPT_MODEL": "gpt-5.1-codex"  // optional - validated at startup
      }
    }
  }
}
```

#### Option 3: VS Code with Claude Extension

Add to `.vscode/mcp.json`

```json
{
  "servers": {
    "gpt-mcp-server": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/path/to/gpt-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "GPT_MODEL": "gpt-5.1-codex"  // optional - validated at startup
      }
    }
  }
}
```

> **Note:** Replace the path with your actual installation location. You can find it with `pwd` in the gpt-mcp-server directory.

### Verify Installation

Restart Claude Code after configuration. You should see the GPT tools available:

```
gpt_generate - Generate text using OpenAI GPT API
gpt_messages - Multi-turn conversation with GPT
gpt_status   - Check server status and configuration
```

## Usage Examples

### Simple Generation
```
Ask GPT: "Explain the difference between async and await in JavaScript"
```

### Multi-turn Conversation
```
Have a conversation with GPT about software architecture,
maintaining context across multiple exchanges.
```

### Check Configuration
```
Use gpt_status to see which model is active and if fallback was used
```

## Tool Reference

### gpt_generate

Generate text from a single prompt.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | Yes | The prompt or question |
| `model` | string | No | Model to use (default: `gpt-5.1-codex`) |
| `instructions` | string | No | System instructions |
| `reasoning_effort` | string | No | `low`, `medium`, or `high` |
| `temperature` | number | No | Randomness 0-2 (default: 1) |
| `max_tokens` | number | No | Maximum output length |
| `top_p` | number | No | Nucleus sampling 0-1 |

### gpt_messages

Multi-turn conversation with message history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | array | Yes | Array of `{role, content}` objects |
| `model` | string | No | Model to use (default: `gpt-5.1-codex`) |
| `instructions` | string | No | System instructions |
| `reasoning_effort` | string | No | `low`, `medium`, or `high` |
| `temperature` | number | No | Randomness 0-2 |
| `max_tokens` | number | No | Maximum output length |

Message format:
```json
{
  "role": "user" | "assistant" | "developer",
  "content": "message text"
}
```

### gpt_status

Check server status and configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | No parameters required |

Returns:
- `active_model` - Currently used model
- `configured_model` - Model from GPT_MODEL env var (if set)
- `fallback_model` - Default fallback model
- `fallback_used` - Whether fallback was triggered due to invalid model
- `server_version` - Server version
- `api_key_configured` - Whether OPENAI_API_KEY is set

## Development

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Run compiled server
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Troubleshooting

### "OPENAI_API_KEY environment variable is required"
Make sure your Claude Code configuration includes the `env` block with your API key.

### "Invalid API key"
1. Verify your key at [OpenAI Platform](https://platform.openai.com/api-keys)
2. Make sure there are no extra spaces or quotes around the key
3. Check your API key has sufficient credits

### "API quota exceeded"
Check your billing at [OpenAI Platform](https://platform.openai.com/usage). You may need to add credits.

### Tools not appearing in Claude Code
1. Verify the path in your configuration is correct (use absolute path)
2. Make sure you ran `npm run build`
3. Restart Claude Code after configuration changes

### Model validation and fallback
If you configure an invalid model via `GPT_MODEL`, the server automatically falls back to `gpt-5.1-codex`. The warning is logged to stderr but may not be visible in Claude Code.

To check your current configuration status:
1. Use the `gpt_status` tool - it shows active model and whether fallback occurred
2. Run Claude Code with `--verbose` flag to see MCP server logs

## Project Structure

```
gpt-mcp-server/
├── src/
│   └── index.ts          # Server implementation
├── dist/                 # Compiled output
├── docs/
│   ├── PRD.md            # Product requirements
│   ├── PLAN.md           # Implementation roadmap
│   └── TECH.md           # Technical specification
├── package.json
├── tsconfig.json
├── .env.example          # Environment template
├── README.md             # This file
└── CLAUDE.md             # AI assistant context
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Anthropic](https://anthropic.com/) - MCP Protocol and Claude
- [OpenAI](https://openai.com/) - GPT API
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol specification

---

**Made with Claude Code following Anthropic's MCP guidelines**
