# PLAN: GPT MCP Server

## Overview
Implementation roadmap for building the GPT MCP Server following Anthropic's official MCP guidelines.

## Current State: ✅ COMPLETED
Server has been built from scratch with modern MCP SDK patterns:
- Modern `McpServer` + `registerTool()` API
- Zod schemas with `.strict()` for all inputs
- Comprehensive tool descriptions (Args, Returns, Examples)
- Proper tool annotations
- Actionable error messages

## Implementation Phases

### Phase 1: Project Structure ✅
- [x] Create directory structure (src/, docs/, dist/)
- [x] Create `package.json` with modern dependencies
- [x] Create `tsconfig.json` (outDir: dist/)
- [x] Create `.gitignore` (dist/, node_modules/, .env)
- [x] Create `.env.example` template

### Phase 2: Core Implementation ✅
- [x] Build `src/index.ts` with modern API:
  - `McpServer` instead of `Server`
  - `registerTool()` instead of `setRequestHandler`
- [x] Add Zod schemas for all tools
- [x] Add proper error handling with actionable messages
- [x] Add tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)

### Phase 3: Model Configuration ✅
- [x] Implement `FALLBACK_MODEL` constant ("gpt-5.1-codex")
- [x] Read `GPT_MODEL` from environment variable
- [x] Validate model at startup via OpenAI models.list() API
- [x] Implement fallback mechanism with `MODEL_FALLBACK_USED` flag
- [x] Log warnings to stderr for invalid model configuration

### Phase 4: Tools Implementation ✅
- [x] `gpt_generate` - Basic text generation with input prompt
- [x] `gpt_messages` - Structured multi-turn conversations
- [x] `gpt_status` - Server status and configuration check

### Phase 5: Documentation ✅
- [x] Write professional README.md (no hardcoded paths)
- [x] Add CLAUDE.md (project-specific instructions)
- [x] Create docs/ with CKM (PRD, PLAN, TECH)

### Phase 6: Testing & Deployment ✅
- [x] `npm run build` - Verify compilation
- [ ] Test with MCP Inspector (optional)
- [x] Initialize git repository
- [x] Commit and push to GitHub
- [ ] Make repository public (when ready)

### Phase 7: v2.0.0 - Responses API Migration ✅
- [x] Discovered `gpt-5.1-codex` only works with Responses API (not Chat Completions)
- [x] Migrated from `v1/chat/completions` to `v1/responses`
- [x] Updated API call: `openai.responses.create()` instead of `openai.chat.completions.create()`
- [x] Changed parameter names:
  - `max_tokens` → `max_output_tokens`
  - `messages` → `input` (array of message items)
  - `reasoning_effort` → `reasoning: { effort: ... }` (nested object)
- [x] Updated response parsing: `extractResponseText()` for Responses API structure
- [x] Updated message roles: `user` and `assistant` only (no `developer` in Responses API)
- [x] Added `api_type` field to `gpt_status` output
- [x] Updated all documentation (README, CLAUDE.md, docs/)

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
| `openai` | ^4.73.0 | Official OpenAI SDK |
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
- **Actual:** 1 session
- **Status:** ✅ COMPLETED

---
*Last Updated: 2025-11-25*

---
> 📋 This document was created following the [Context Keeper Method](https://github.com/george7979/context-keeper-method) - a structured approach to AI-friendly project documentation.
