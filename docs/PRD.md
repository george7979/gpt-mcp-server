# PRD: GPT MCP Server

## Project Overview
**Name:** gpt-mcp-server
**Type:** MCP (Model Context Protocol) Server
**Status:** Production Ready
**Repository:** https://github.com/george7979/gpt-mcp-server

## Problem Statement
Claude Code users need access to OpenAI GPT capabilities without leaving their workflow. While Claude excels at many tasks, GPT offers unique strengths:
- **Different Training Data** - Alternative perspective from different model training
- **Reasoning Models** - Access to GPT's reasoning effort levels (low/medium/high)
- **Model Variety** - Access to GPT-4, GPT-4.1, GPT-5.1-codex and future models
- **Comparison** - Get a second opinion from a different AI provider

Existing solutions are either outdated, poorly documented, or not compliant with Anthropic's MCP guidelines.

## Goals
1. **Production-Ready Server** - Professional codebase ready for public use
2. **Anthropic Compliance** - Follow official MCP guidelines (McpServer + registerTool pattern)
3. **Easy Installation** - `git clone` → `npm install` → configure → works
4. **Comprehensive Documentation** - Clear README, CKM docs, and CLAUDE.md

## Features

### Core Tools
| Tool | Description | Status |
|------|-------------|--------|
| `gpt_generate` | Simple text generation with input prompt | ✅ Complete |
| `gpt_messages` | Structured multi-turn conversations | ✅ Complete |
| `gpt_status` | Server status and configuration check | ✅ Complete |

### Technical Requirements
- TypeScript with strict mode
- MCP SDK v1.13+ with modern `registerTool()` API
- Zod schemas with `.strict()` for all tool inputs
- Tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Actionable error messages for common failure modes
- Model validation at startup with fallback mechanism
- Development workflow with `tsx watch` for hot reload

### Non-Functional Requirements
- **Performance:** Minimal overhead, direct API passthrough
- **Reliability:** Graceful error handling, no crashes
- **Maintainability:** Clean code, comprehensive comments
- **Security:** Environment variable for API key, no hardcoded secrets

## Success Criteria
- [x] Compliant with Anthropic MCP guidelines (mcp-builder skill verified)
- [x] `npm run build` compiles without errors
- [x] All 3 tools implemented with proper schemas and annotations
- [x] README contains complete installation instructions
- [x] Project installable on clean machine in <5 minutes
- [x] Published to GitHub as repository

## Out of Scope
- npm package publication (considered for future)
- HTTP/SSE transport (stdio only for now)
- Automated test suite (considered for future)
- Rate limiting or usage quotas
- Multi-provider routing (GPT only)

## Stakeholders
- **Owner:** george7979 (GitHub)
- **Users:** Claude Code users wanting OpenAI GPT integration

## Related Documents
- [PLAN.md](./PLAN.md) - Implementation roadmap
- [TECH.md](./TECH.md) - Technical specification

---
*Last Updated: 2025-11-25*

---
> 📋 This document was created following the [Context Keeper Method](https://github.com/george7979/context-keeper-method) - a structured approach to AI-friendly project documentation.
