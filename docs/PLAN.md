# PLAN: GPT MCP Server

## Overview
Implementation roadmap for building the GPT MCP Server following Anthropic's official MCP guidelines.

## Current State: 🔲 In Development
Building new server from scratch with modern MCP SDK patterns:
- Modern `McpServer` + `registerTool()` API
- Zod schemas with `.strict()` for all inputs
- Comprehensive tool descriptions (Args, Returns, Examples)
- Proper tool annotations
- Actionable error messages

## Implementation Phases

### Phase 1: Project Structure 🔲
- [ ] Create directory structure (src/, docs/, dist/)
- [ ] Create `package.json` with modern dependencies
- [ ] Create `tsconfig.json` (outDir: dist/)
- [ ] Create `.gitignore` (dist/, node_modules/, .env)
- [ ] Create `.env.example` template

### Phase 2: Core Implementation 🔲
- [ ] Build `src/index.ts` with modern API:
  - `McpServer` instead of `Server`
  - `registerTool()` instead of `setRequestHandler`
- [ ] Add Zod schemas for all tools
- [ ] Add proper error handling with actionable messages
- [ ] Add tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)

### Phase 3: Model Configuration 🔲
- [ ] Implement `FALLBACK_MODEL` constant ("gpt-5.1-codex")
- [ ] Read `GPT_MODEL` from environment variable
- [ ] Validate model at startup via OpenAI models.list() API
- [ ] Implement fallback mechanism with `MODEL_FALLBACK_USED` flag
- [ ] Log warnings to stderr for invalid model configuration

### Phase 4: Tools Implementation 🔲
- [ ] `gpt_generate` - Basic text generation with input prompt
- [ ] `gpt_messages` - Structured multi-turn conversations
- [ ] `gpt_status` - Server status and configuration check

### Phase 5: Documentation 🔲
- [ ] Write professional README.md (no hardcoded paths)
- [ ] Add CLAUDE.md (project-specific instructions)
- [ ] Create docs/ with CKM (PRD, PLAN, TECH)

### Phase 6: Testing & Deployment 🔲
- [ ] `npm run build` - Verify compilation
- [ ] Test with MCP Inspector
- [ ] Initialize git repository
- [ ] Commit and push to GitHub
- [ ] Make repository public

## Technical Decisions

### Why `registerTool()` over `setRequestHandler`?
The `registerTool()` API is the recommended modern pattern per Anthropic's mcp-builder skill. It provides:
- Built-in Zod schema integration
- Cleaner registration syntax
- Automatic type inference
- Better separation of concerns

### Why `.strict()` on Zod schemas?
Strict schemas reject unexpected properties, preventing:
- Silent data loss from typos
- Security issues from unexpected inputs
- Confusion about what parameters are accepted

### Why `idempotentHint: false`?
AI text generation is inherently non-deterministic. The same prompt produces different outputs, so `idempotentHint: true` would be misleading.

### Why model validation at startup?
- Prevents runtime errors from invalid model names
- Provides clear feedback about configuration issues
- Graceful fallback ensures server always works
- `gpt_status` tool gives visibility into active configuration

## Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.13.3 | MCP protocol implementation |
| `openai` | ^4.x | Official OpenAI SDK |
| `zod` | ^3.24.1 | Runtime schema validation |
| `tsx` | ^4.19.2 | Development (TypeScript execution) |

## Risk Mitigation
| Risk | Mitigation |
|------|------------|
| MCP SDK breaking changes | Pinned to v1.13.3, tested pattern |
| OpenAI API changes | Using official openai SDK |
| TypeScript inference issues | Added `??` fallbacks for default values |
| Model deprecation | Fallback mechanism + gpt_status visibility |

## Timeline
- **Estimated:** 1-2 work sessions
- **Status:** In Progress

---
*Last Updated: 2025-11-25*

---
> 📋 This document was created following the [Context Keeper Method](https://github.com/george7979/context-keeper-method) - a structured approach to AI-friendly project documentation.
