import Anthropic from "@anthropic-ai/sdk";
import type { AnnotationStore, SemanticPathResult } from "@syl/core";
import { toolSchemas } from "./tools.js";
import { executeTool, type SaveAnnotationEntry, type ToolContext } from "./tool-executor.js";
import { singleElementPrompt, fileWidePrompt } from "./prompts.js";

const MAX_ITERATIONS = 15;

export interface GenerateOptions {
  model: string;
  filePath: string;
  fileContent: string;
  pathResult: SemanticPathResult;
  projectRoot: string;
  store: AnnotationStore;
  /** If set, generate for a single element; otherwise file-wide */
  semanticPath?: string;
}

export async function generateAnnotations(
  options: GenerateOptions
): Promise<{ count: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = options.semanticPath
    ? singleElementPrompt(options.filePath, options.semanticPath)
    : fileWidePrompt(options.filePath);

  const context: ToolContext = {
    projectRoot: options.projectRoot,
    filePath: options.filePath,
    fileContent: options.fileContent,
    pathResult: options.pathResult,
  };

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Please analyze the code and generate annotations." },
  ];

  let allAnnotations: SaveAnnotationEntry[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolSchemas,
      messages,
    });

    // Collect assistant content
    messages.push({ role: "assistant", content: response.content });

    // Check if we're done
    if (response.stop_reason === "end_turn") {
      break;
    }

    // Process tool use blocks
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            context
          );

          if (result.savedAnnotations) {
            allAnnotations.push(...result.savedAnnotations);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result.output,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  // Persist all collected annotations
  for (const ann of allAnnotations) {
    await options.store.add(options.filePath, ann.semantic_path, ann.body, "claude");
  }

  return { count: allAnnotations.length };
}
