#!/usr/bin/env node
/**
 * GPT MCP Server
 *
 * An MCP (Model Context Protocol) server that provides OpenAI GPT capabilities
 * to Claude Code and other MCP clients using the new Responses API.
 * Features include text generation, multi-turn conversations, and server status.
 *
 * Uses OpenAI Responses API (v1/responses) which supports:
 * - All GPT models including gpt-5.1-codex
 * - Built-in tools (web search, file search)
 * - Adaptive reasoning with configurable effort
 *
 * @see https://github.com/george7979/gpt-mcp-server
 * @see https://platform.openai.com/docs/api-reference/responses
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const SERVER_NAME = "gpt-mcp-server";
const SERVER_VERSION = "2.0.0";

// Model configuration - gpt-5.1-codex works with Responses API
const FALLBACK_MODEL = "gpt-5.1-codex";
const CONFIGURED_MODEL = process.env.GPT_MODEL;
let ACTIVE_MODEL = CONFIGURED_MODEL || FALLBACK_MODEL;
let MODEL_FALLBACK_USED = false;

// Reasoning configuration - "low" is the minimum supported level for gpt-5.1-codex
const DEFAULT_REASONING_EFFORT = "low";

// Response limits - prevent context overflow
const CHARACTER_LIMIT = 25000;

// =============================================================================
// Types
// =============================================================================

/** Response format options */
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

/** Reasoning effort levels supported by GPT-5.x models */
type ReasoningEffort = "none" | "low" | "medium" | "high";

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
// Shared Utilities
// =============================================================================

/**
 * Truncate response if it exceeds CHARACTER_LIMIT.
 * Returns truncated text with warning message.
 */
function truncateResponse(text: string): { text: string; truncated: boolean } {
  if (text.length <= CHARACTER_LIMIT) {
    return { text, truncated: false };
  }

  const truncated = text.slice(0, CHARACTER_LIMIT);
  const truncatedText = truncated + `\n\n---\n⚠️ **Response truncated** from ${text.length} to ${CHARACTER_LIMIT} characters. Use \`max_output_tokens\` parameter to limit output size.`;

  return { text: truncatedText, truncated: true };
}

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

/**
 * Extract text content from Responses API output.
 * The output structure is: response.output[].content[].text
 */
function extractResponseText(response: OpenAI.Responses.Response): string {
  if (!response.output || response.output.length === 0) {
    return "";
  }

  // Collect text from all output items
  const texts: string[] = [];
  for (const item of response.output) {
    if (item.type === "message" && item.content) {
      for (const content of item.content) {
        if (content.type === "output_text" && content.text) {
          texts.push(content.text);
        }
      }
    }
  }

  return texts.join("\n\n");
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
  reasoning_effort: z.enum(["none", "low", "medium", "high"])
    .optional()
    .describe("Reasoning effort level (GPT-5.x: none/low/medium/high)"),
  max_output_tokens: z.number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum output tokens to generate"),
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
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
}).strict();

server.registerTool(
  "gpt_generate",
  {
    title: "Generate Text with GPT",
    description: `Generate text using OpenAI GPT API with a simple input prompt.

This tool sends a prompt to OpenAI GPT using the Responses API and returns
the generated text response. It is ideal for single-turn interactions,
creative writing, code generation, analysis, and general AI assistance tasks.

Args:
  - input (string, required): The prompt or question for GPT
  - model (string, optional): Model to use (defaults to GPT_MODEL env or gpt-5.1-codex)
  - instructions (string, optional): System instructions for the model
  - reasoning_effort (string, optional): Reasoning level - none/low/medium/high
    - none: No reasoning (like GPT-4.1, fastest)
    - low: Light reasoning (fast, server default)
    - medium/high: Increasing reasoning depth
  - max_output_tokens (number, optional): Maximum output length
  - temperature (number, optional): Randomness 0-2 (higher = more creative)
  - top_p (number, optional): Top-p sampling parameter
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "text": string,           // Generated text content
    "model": string,          // Model used for generation
    "usage": {
      "input_tokens": number,
      "output_tokens": number,
      "total_tokens": number
    },
    "truncated": boolean      // Whether response was truncated
  }

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
      const model = params.model ?? ACTIVE_MODEL;
      const reasoningEffort = (params.reasoning_effort ?? DEFAULT_REASONING_EFFORT) as ReasoningEffort;

      // Build Responses API request
      const requestOptions: OpenAI.Responses.ResponseCreateParams = {
        model,
        input: params.input,
      };

      // Add instructions if provided
      if (params.instructions) {
        requestOptions.instructions = params.instructions;
      }

      // Add reasoning configuration (GPT-5.x models)
      if (reasoningEffort !== "none") {
        requestOptions.reasoning = {
          effort: reasoningEffort as "low" | "medium" | "high",
        };
      }

      // Optional parameters
      if (params.max_output_tokens !== undefined) {
        requestOptions.max_output_tokens = params.max_output_tokens;
      }
      if (params.temperature !== undefined) {
        requestOptions.temperature = params.temperature;
      }
      if (params.top_p !== undefined) {
        requestOptions.top_p = params.top_p;
      }

      // Call Responses API
      const response = await openai.responses.create(requestOptions);

      const rawText = extractResponseText(response);

      // Prepare structured output
      const structuredOutput = {
        text: rawText,
        model: response.model,
        usage: response.usage ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        truncated: false,
      };

      // Format text based on response_format (defaults to markdown)
      const format = params.response_format ?? ResponseFormat.MARKDOWN;
      let textContent: string;
      if (format === ResponseFormat.JSON) {
        textContent = JSON.stringify(structuredOutput, null, 2);
      } else {
        // Markdown format
        textContent = rawText;
        if (response.usage) {
          textContent += `\n\n---\n**Usage:** ${response.usage.input_tokens} input + ${response.usage.output_tokens} output = ${response.usage.total_tokens} total tokens`;
        }
      }

      // Apply truncation if needed
      const { text: finalText, truncated } = truncateResponse(textContent);
      structuredOutput.truncated = truncated;

      return {
        content: [{ type: "text", text: finalText }],
        structuredContent: structuredOutput,
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
  role: z.enum(["user", "assistant"])
    .describe("Message role: 'user' for human, 'assistant' for AI"),
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
  reasoning_effort: z.enum(["none", "low", "medium", "high"])
    .optional()
    .describe("Reasoning effort level (GPT-5.x: none/low/medium/high)"),
  max_output_tokens: z.number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum output tokens to generate"),
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
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
}).strict();

server.registerTool(
  "gpt_messages",
  {
    title: "GPT Multi-turn Conversation",
    description: `Generate text using GPT with structured multi-turn conversation messages.

This tool enables multi-turn conversations by accepting an array of messages
with alternating user/assistant roles. Uses the Responses API for contextual
conversations where previous exchanges inform the response.

Args:
  - messages (array, required): Conversation history
    - role: "user" (human) or "assistant" (AI response)
    - content: The message text
  - model (string, optional): Model to use (defaults to GPT_MODEL env or gpt-5.1-codex)
  - instructions (string, optional): System instructions for the model
  - reasoning_effort (string, optional): Reasoning level - none/low/medium/high
  - max_output_tokens (number, optional): Maximum output length
  - temperature (number, optional): Randomness 0-2
  - top_p (number, optional): Top-p sampling parameter
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "text": string,           // AI response text
    "model": string,          // Model used
    "message_count": number,  // Number of messages in conversation
    "usage": { ... },         // Token usage
    "truncated": boolean
  }

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
      const model = params.model ?? ACTIVE_MODEL;
      const reasoningEffort = (params.reasoning_effort ?? DEFAULT_REASONING_EFFORT) as ReasoningEffort;

      // Build input items for Responses API
      // Convert messages to ResponseInputItem format
      const inputItems: OpenAI.Responses.ResponseInputItem[] = params.messages.map(msg => ({
        type: "message" as const,
        role: msg.role,
        content: msg.content,
      }));

      // Build Responses API request
      const requestOptions: OpenAI.Responses.ResponseCreateParams = {
        model,
        input: inputItems,
      };

      // Add instructions if provided
      if (params.instructions) {
        requestOptions.instructions = params.instructions;
      }

      // Add reasoning configuration (GPT-5.x models)
      if (reasoningEffort !== "none") {
        requestOptions.reasoning = {
          effort: reasoningEffort as "low" | "medium" | "high",
        };
      }

      // Optional parameters
      if (params.max_output_tokens !== undefined) {
        requestOptions.max_output_tokens = params.max_output_tokens;
      }
      if (params.temperature !== undefined) {
        requestOptions.temperature = params.temperature;
      }
      if (params.top_p !== undefined) {
        requestOptions.top_p = params.top_p;
      }

      // Call Responses API
      const response = await openai.responses.create(requestOptions);

      const rawText = extractResponseText(response);

      // Prepare structured output
      const structuredOutput = {
        text: rawText,
        model: response.model,
        message_count: params.messages.length,
        usage: response.usage ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        truncated: false,
      };

      // Format text based on response_format (defaults to markdown)
      const format = params.response_format ?? ResponseFormat.MARKDOWN;
      let textContent: string;
      if (format === ResponseFormat.JSON) {
        textContent = JSON.stringify(structuredOutput, null, 2);
      } else {
        // Markdown format
        textContent = rawText;
        if (response.usage) {
          textContent += `\n\n---\n**Usage:** ${response.usage.input_tokens} input + ${response.usage.output_tokens} output = ${response.usage.total_tokens} total tokens`;
        }
      }

      // Apply truncation if needed
      const { text: finalText, truncated } = truncateResponse(textContent);
      structuredOutput.truncated = truncated;

      return {
        content: [{ type: "text", text: finalText }],
        structuredContent: structuredOutput,
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

const StatusOutputSchema = z.object({
  active_model: z.string().describe("Currently used model"),
  configured_model: z.string().nullable().describe("Model from GPT_MODEL env var"),
  fallback_model: z.string().describe("Default fallback model"),
  fallback_used: z.boolean().describe("Whether fallback was triggered"),
  default_reasoning: z.string().describe("Default reasoning_effort level"),
  character_limit: z.number().describe("Maximum response character limit"),
  server_version: z.string().describe("Server version"),
  api_type: z.string().describe("OpenAI API type used"),
  api_key_configured: z.boolean().describe("Whether OPENAI_API_KEY is set"),
});

type StatusOutput = z.infer<typeof StatusOutputSchema>;

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
  Structured data with schema:
  {
    "active_model": string,        // Currently used model
    "configured_model": string|null, // From GPT_MODEL env var
    "fallback_model": string,      // Default fallback model
    "fallback_used": boolean,      // Whether fallback was triggered
    "default_reasoning": string,   // Default reasoning_effort level
    "character_limit": number,     // Max response size (25000)
    "server_version": string,      // Server version
    "api_type": string,            // OpenAI API type (Responses API)
    "api_key_configured": boolean  // Whether OPENAI_API_KEY is set
  }`,
    inputSchema: StatusInputSchema,
    outputSchema: StatusOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const status: StatusOutput = {
      active_model: ACTIVE_MODEL,
      configured_model: CONFIGURED_MODEL || null,
      fallback_model: FALLBACK_MODEL,
      fallback_used: MODEL_FALLBACK_USED,
      default_reasoning: DEFAULT_REASONING_EFFORT,
      character_limit: CHARACTER_LIMIT,
      server_version: SERVER_VERSION,
      api_type: "Responses API (v1/responses)",
      api_key_configured: !!process.env.OPENAI_API_KEY,
    };

    // Generate markdown text
    let statusText = `# GPT MCP Server Status\n\n`;
    statusText += `| Property | Value |\n`;
    statusText += `|----------|-------|\n`;
    statusText += `| **Active Model** | \`${status.active_model}\` |\n`;

    if (status.configured_model) {
      const configStatus = status.fallback_used ? "⚠️ not found, using fallback" : "✓";
      statusText += `| **Configured Model** | \`${status.configured_model}\` ${configStatus} |\n`;
    } else {
      statusText += `| **Configured Model** | _(not set, using default)_ |\n`;
    }

    statusText += `| **Fallback Model** | \`${status.fallback_model}\` |\n`;
    statusText += `| **Default Reasoning** | \`${status.default_reasoning}\` (adaptive) |\n`;
    statusText += `| **Character Limit** | ${status.character_limit.toLocaleString()} |\n`;
    statusText += `| **Server Version** | ${status.server_version} |\n`;
    statusText += `| **API Type** | ${status.api_type} |\n`;
    statusText += `| **API Key** | ${status.api_key_configured ? "✓ configured" : "⚠️ missing"} |\n`;

    return {
      content: [{ type: "text", text: statusText }],
      structuredContent: status,
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
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio (model: ${ACTIVE_MODEL}, API: Responses)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
