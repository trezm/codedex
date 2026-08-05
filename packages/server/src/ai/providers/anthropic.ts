import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions } from "../tools.js";
import { executeTool, type SaveAnnotationEntry } from "../tool-executor.js";
import {
  MAX_ITERATIONS,
  MAX_OUTPUT_TOKENS,
  type ProviderRunOptions,
  type JsonCompletionOptions,
} from "../types.js";

const tools: Anthropic.Tool[] = toolDefinitions.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: {
    type: "object" as const,
    properties: t.parameters.properties,
    required: t.parameters.required,
  },
}));

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

export async function completeJsonAnthropic(
  options: JsonCompletionOptions
): Promise<unknown> {
  const client = createClient();

  const response = await client.messages.create({
    model: options.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: options.systemPrompt,
    output_config: {
      format: { type: "json_schema", schema: options.schema },
    },
    messages: [{ role: "user", content: options.userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to answer this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Claude hit the output token limit before finishing. Try a smaller pull request."
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) throw new Error("Claude returned an empty response.");
  return JSON.parse(text);
}

export async function runAnthropic(
  options: ProviderRunOptions
): Promise<SaveAnnotationEntry[]> {
  const client = createClient();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Please analyze the code and generate annotations." },
  ];

  const saved: SaveAnnotationEntry[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: options.systemPrompt,
      tools,
      messages,
    });

    // Push the content verbatim — thinking blocks must round-trip unchanged.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined to answer this request.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Claude hit the output token limit before finishing. Try a single element instead of the whole file."
      );
    }
    if (response.stop_reason !== "tool_use") {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(
        block.name,
        block.input as Record<string, unknown>,
        options.context
      );
      if (result.savedAnnotations) {
        saved.push(...result.savedAnnotations);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.output,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return saved;
}
