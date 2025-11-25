#!/usr/bin/env node
/**
 * GPT MCP Server
 *
 * An MCP (Model Context Protocol) server that provides OpenAI GPT capabilities
 * to Claude Code and other MCP clients. Features include text generation,
 * multi-turn conversations, and server status checking.
 *
 * @see https://github.com/george7979/gpt-mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const SERVER_NAME = "gpt-mcp-server";
const SERVER_VERSION = "1.0.0";

// Model configuration
const FALLBACK_MODEL = "gpt-5.1-codex";
const CONFIGURED_MODEL = process.env.GPT_MODEL;
let ACTIVE_MODEL = CONFIGURED_MODEL || FALLBACK_MODEL;
let MODEL_FALLBACK_USED = false;

// =============================================================================
// Environment Validation
// =============================================================================

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error(
    "ERROR: OPENAI_API_KEY environment variable is required.\n" +
    "Get your API key at: https://platform.openai.com/api-keys"
  );
  process.exit(1);
}

// =============================================================================
// OpenAI Client Initialization
// =============================================================================

const openai = new OpenAI({ apiKey });

// =============================================================================
// Model Validation
// =============================================================================

/**
 * Validate configured model exists in OpenAI API.
 * Only validates if GPT_MODEL env var is explicitly set.
 * Falls back to FALLBACK_MODEL if validation fails.
 */
async function validateConfiguredModel(): Promise<void> {
  // No custom model configured - use default without validation
  if (!CONFIGURED_MODEL) {
    return;
  }

  try {
    const models = await openai.models.list();
    const modelIds = models.data.map(m => m.id);

    const modelExists = modelIds.includes(CONFIGURED_MODEL);

    if (!modelExists) {
      console.error(
        `Warning: Model "${CONFIGURED_MODEL}" not found in available models. ` +
        `Falling back to: ${FALLBACK_MODEL}`
      );
      ACTIVE_MODEL = FALLBACK_MODEL;
      MODEL_FALLBACK_USED = true;
    }
  } catch (error) {
    // API error - can't validate, use configured model with warning
    console.error(
      `Warning: Could not validate model "${CONFIGURED_MODEL}". ` +
      `API error: ${error instanceof Error ? error.message : String(error)}. ` +
      `Using configured model anyway.`
    );
  }
}

// =============================================================================
// Shared Types & Utilities
// =============================================================================

/**
 * Handle errors from OpenAI API calls.
 * Returns actionable error messages to guide users.
 */
function handleOpenAIError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    const message = error.message.toLowerCase();

    if (status === 401) {
      return "Error: Invalid API key. Please verify your OPENAI_API_KEY at platform.openai.com/api-keys";
    }
    if (status === 429) {
      return "Error: Rate limit exceeded. Please wait and try again, or check your API quota.";
    }
    if (status === 402) {
      return "Error: API quota exceeded. Please check your billing at platform.openai.com/usage";
    }
    if (status === 404) {
      return `Error: Model not found. Please check the model name is correct.`;
    }
    if (status === 403) {
      return "Error: Permission denied. Your API key may not have access to this model.";
    }
    if (message.includes("timeout")) {
      return "Error: Request timed out. Please try again with a shorter prompt.";
    }

    return `Error: OpenAI API error (${status}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: Unexpected error occurred: ${String(error)}`;
}

// =============================================================================
// MCP Server Initialization
// =============================================================================

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// =============================================================================
// Tool: gpt_generate
// =============================================================================

const GenerateInputSchema = z.object({
  input: z.string()
    .min(1, "Input prompt is required")
    .describe("The input text or prompt for GPT"),
  model: z.string()
    .optional()
    .describe("GPT model variant to use (defaults to GPT_MODEL env or gpt-5.1-codex)"),
  instructions: z.string()
    .optional()
    .describe("System instructions for the model"),
  reasoning_effort: z.enum(["low", "medium", "high"])
    .optional()
    .describe("Reasoning effort level"),
  max_tokens: z.number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum tokens to generate"),
  temperature: z.number()
    .min(0)
    .max(2)
    .optional()
    .describe("Temperature for randomness (0-2)"),
  top_p: z.number()
    .min(0)
    .max(1)
    .optional()
    .describe("Top-p sampling parameter"),
}).strict();

server.registerTool(
  "gpt_generate",
  {
    title: "Generate Text with GPT",
    description: `Generate text using OpenAI GPT API with a simple input prompt.

This tool sends a prompt to OpenAI GPT and returns the generated text response.
It is ideal for single-turn interactions, creative writing, code generation,
analysis, and general AI assistance tasks.

Args:
  - input (string, required): The prompt or question for GPT
  - model (string, optional): Model to use (defaults to GPT_MODEL env or gpt-5.1-codex)
  - instructions (string, optional): System instructions for the model
  - reasoning_effort (string, optional): Reasoning effort level (low/medium/high)
  - max_tokens (number, optional): Maximum output length
  - temperature (number, optional): Randomness 0-2 (higher = more creative)
  - top_p (number, optional): Top-p sampling parameter

Returns:
  Generated text response from GPT.

Examples:
  - "Explain quantum computing in simple terms"
  - "Write a Python function to sort a list"
  - "Summarize the key points of machine learning"

Note: Each call may produce different results due to model randomness.`,
    inputSchema: GenerateInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false, // AI generation is NOT idempotent
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      // Add system instructions if provided
      if (params.instructions) {
        messages.push({
          role: "developer",
          content: params.instructions,
        });
      }

      // Add user prompt
      messages.push({
        role: "user",
        content: params.input,
      });

      const response = await openai.chat.completions.create({
        model: params.model ?? ACTIVE_MODEL,
        messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        top_p: params.top_p,
        // Note: reasoning_effort is model-specific, may not apply to all models
      });

      const text = response.choices[0]?.message?.content || "";

      // Add usage info if available
      let output = text;
      if (response.usage) {
        output += `\n\n---\n**Usage:** ${response.usage.prompt_tokens} prompt tokens, ${response.usage.completion_tokens} completion tokens, ${response.usage.total_tokens} total`;
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleOpenAIError(error) }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Tool: gpt_messages
// =============================================================================

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "developer"])
    .describe("Message role: 'user' for human, 'assistant' for AI, 'developer' for system"),
  content: z.string()
    .min(1, "Message content is required")
    .describe("The message content"),
}).strict();

const MessagesInputSchema = z.object({
  messages: z.array(MessageSchema)
    .min(1, "At least one message is required")
    .describe("Array of conversation messages"),
  model: z.string()
    .optional()
    .describe("GPT model variant to use (defaults to GPT_MODEL env or gpt-5.1-codex)"),
  instructions: z.string()
    .optional()
    .describe("System instructions for the model"),
  reasoning_effort: z.enum(["low", "medium", "high"])
    .optional()
    .describe("Reasoning effort level"),
  max_tokens: z.number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum tokens to generate"),
  temperature: z.number()
    .min(0)
    .max(2)
    .optional()
    .describe("Temperature for randomness (0-2)"),
  top_p: z.number()
    .min(0)
    .max(1)
    .optional()
    .describe("Top-p sampling parameter"),
}).strict();

server.registerTool(
  "gpt_messages",
  {
    title: "GPT Multi-turn Conversation",
    description: `Generate text using GPT with structured multi-turn conversation messages.

This tool enables multi-turn conversations by accepting an array of messages
with alternating user/assistant roles. Use this for contextual conversations
where previous exchanges inform the response.

Args:
  - messages (array, required): Conversation history
    - role: "user" (human), "assistant" (AI response), or "developer" (system)
    - content: The message text
  - model (string, optional): Model to use (defaults to GPT_MODEL env or gpt-5.1-codex)
  - instructions (string, optional): System instructions for the model
  - reasoning_effort (string, optional): Reasoning effort level (low/medium/high)
  - max_tokens (number, optional): Maximum output length
  - temperature (number, optional): Randomness 0-2
  - top_p (number, optional): Top-p sampling parameter

Returns:
  AI response continuing the conversation.

Example messages:
  [
    { "role": "user", "content": "What is the capital of France?" },
    { "role": "assistant", "content": "The capital of France is Paris." },
    { "role": "user", "content": "What is its population?" }
  ]

Note: Messages should alternate between user and assistant roles.`,
    inputSchema: MessagesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      // Add system instructions if provided
      if (params.instructions) {
        messages.push({
          role: "developer",
          content: params.instructions,
        });
      }

      // Add conversation messages
      for (const msg of params.messages) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      const response = await openai.chat.completions.create({
        model: params.model ?? ACTIVE_MODEL,
        messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        top_p: params.top_p,
      });

      const text = response.choices[0]?.message?.content || "";

      // Add usage info if available
      let output = text;
      if (response.usage) {
        output += `\n\n---\n**Usage:** ${response.usage.prompt_tokens} prompt tokens, ${response.usage.completion_tokens} completion tokens, ${response.usage.total_tokens} total`;
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleOpenAIError(error) }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Tool: gpt_status
// =============================================================================

const StatusInputSchema = z.object({}).strict();

server.registerTool(
  "gpt_status",
  {
    title: "GPT Server Status",
    description: `Check GPT MCP server status and configuration.

Returns information about the server's current state, including which model
is active and whether a fallback occurred due to invalid configuration.

Use this tool to:
- Verify which GPT model is being used
- Check if your GPT_MODEL configuration is valid
- Debug configuration issues

Args:
  None required.

Returns:
  Server status including:
  - active_model: Currently used model
  - configured_model: Model from GPT_MODEL env var (if set)
  - fallback_model: Default fallback model
  - fallback_used: Whether fallback was triggered
  - server_version: Server version
  - api_key_configured: Whether OPENAI_API_KEY is set`,
    inputSchema: StatusInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const status = {
      active_model: ACTIVE_MODEL,
      configured_model: CONFIGURED_MODEL || null,
      fallback_model: FALLBACK_MODEL,
      fallback_used: MODEL_FALLBACK_USED,
      server_version: SERVER_VERSION,
      api_key_configured: !!process.env.OPENAI_API_KEY,
    };

    let statusText = `**GPT MCP Server Status**\n\n`;
    statusText += `- **Active Model:** ${status.active_model}\n`;

    if (status.configured_model) {
      statusText += `- **Configured Model:** ${status.configured_model}`;
      if (status.fallback_used) {
        statusText += ` ⚠️ (not found, using fallback)\n`;
      } else {
        statusText += ` ✓\n`;
      }
    } else {
      statusText += `- **Configured Model:** (not set, using default)\n`;
    }

    statusText += `- **Fallback Model:** ${status.fallback_model}\n`;
    statusText += `- **Server Version:** ${status.server_version}\n`;
    statusText += `- **API Key:** ${status.api_key_configured ? "configured ✓" : "missing ⚠️"}\n`;

    return {
      content: [{ type: "text", text: statusText }],
    };
  }
);

// =============================================================================
// Server Startup
// =============================================================================

async function main(): Promise<void> {
  // Validate configured model before starting server
  await validateConfiguredModel();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio (model: ${ACTIVE_MODEL})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
