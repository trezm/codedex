import OpenAI from "openai";
import { toolDefinitions } from "../tools.js";
import { executeTool, type SaveAnnotationEntry } from "../tool-executor.js";
import {
  MAX_ITERATIONS,
  MAX_OUTPUT_TOKENS,
  type ProviderRunOptions,
  type JsonCompletionOptions,
} from "../types.js";

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = toolDefinitions.map(
  (t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.parameters.properties,
        required: t.parameters.required,
      },
    },
  })
);

function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

export async function completeJsonOpenAI(
  options: JsonCompletionOptions
): Promise<unknown> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: options.model,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.schemaName,
        schema: options.schema,
        strict: true,
      },
    },
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
  });

  const choice = response.choices[0];
  if (!choice) throw new Error("The model returned no choices.");
  if (choice.finish_reason === "length") {
    throw new Error(
      "The model hit the output token limit before finishing. Try a smaller pull request."
    );
  }
  if (choice.message.refusal) {
    throw new Error(`The model declined: ${choice.message.refusal}`);
  }

  const text = choice.message.content ?? "";
  if (!text.trim()) throw new Error("The model returned an empty response.");
  return JSON.parse(text);
}

export async function runOpenAI(
  options: ProviderRunOptions
): Promise<SaveAnnotationEntry[]> {
  const client = createClient();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: "Please analyze the code and generate annotations." },
  ];

  const saved: SaveAnnotationEntry[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model: options.model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      tools,
      messages,
    });

    const choice = response.choices[0];
    if (!choice) break;

    messages.push(choice.message);

    if (choice.finish_reason === "length") {
      throw new Error(
        "The model hit the output token limit before finishing. Try a single element instead of the whole file."
      );
    }

    const calls = choice.message.tool_calls ?? [];
    if (calls.length === 0) break;

    // Every tool call must get a matching tool message back, even the ones we
    // can't service — otherwise the next request is rejected.
    for (const call of calls) {
      let output: string;
      if (call.type !== "function") {
        output = `Error: unsupported tool call type "${call.type}"`;
      } else {
        let input: Record<string, unknown> = {};
        let parsed = true;
        try {
          input = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
        } catch {
          parsed = false;
        }
        if (!parsed) {
          output = `Error: could not parse arguments for ${call.function.name} as JSON. Retry with valid JSON.`;
        } else {
          const result = await executeTool(
            call.function.name,
            input,
            options.context
          );
          if (result.savedAnnotations) {
            saved.push(...result.savedAnnotations);
          }
          output = result.output;
        }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: output });
    }
  }

  return saved;
}
