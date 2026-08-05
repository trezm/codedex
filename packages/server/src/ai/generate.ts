import { PROVIDER_AUTHORS } from "@syl/core";
import type { AnnotationStore, SemanticPathResult } from "@syl/core";
import type { ToolContext, SaveAnnotationEntry } from "./tool-executor.js";
import { singleElementPrompt, fileWidePrompt } from "./prompts.js";
import { backendFor, providerEnvKey, resolveModel } from "./models.js";
import { CLI_FOR_PROVIDER, completeJsonViaCli } from "./cli.js";
import type { ProviderRun } from "./types.js";
import { runAnthropic } from "./providers/anthropic.js";
import { runOpenAI } from "./providers/openai.js";

const RUNNERS: Record<string, ProviderRun> = {
  anthropic: runAnthropic,
  openai: runOpenAI,
};

const ANNOTATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          semantic_path: { type: "string" },
          body: { type: "string" },
        },
        required: ["semantic_path", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["annotations"],
  additionalProperties: false,
};

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

function formatSemanticTree(pathResult: SemanticPathResult): string {
  const lines: string[] = [];
  const walk = (nodes: any[], depth: number) => {
    for (const node of nodes) {
      lines.push(
        `${"  ".repeat(depth)}- ${node.path} (${node.kind}, L${node.startLine}-${node.endLine})`
      );
      walk(node.children, depth + 1);
    }
  };
  walk(pathResult.roots, 0);
  return lines.join("\n") || "(no semantic nodes)";
}

/**
 * The CLI backends bring their own file-reading tools and run inside the
 * project, so instead of driving our tool loop we hand them the semantic tree
 * and let them read whatever else they need.
 */
async function generateViaCli(
  options: GenerateOptions,
  provider: "anthropic" | "openai"
): Promise<SaveAnnotationEntry[]> {
  const systemPrompt = options.semanticPath
    ? singleElementPrompt(options.filePath, options.semanticPath)
    : fileWidePrompt(options.filePath);

  const userPrompt = `File: ${options.filePath}

Semantic tree (annotate using these exact paths):
${formatSemanticTree(options.pathResult)}

${
  options.semanticPath
    ? `Annotate exactly one element: "${options.semanticPath}".`
    : "Annotate the most important elements. Skip trivial ones."
}

You can read ${options.filePath} and any related file in this project with your own tools. Do not call a save_annotations tool — return the annotations as JSON.`;

  const result = (await completeJsonViaCli(CLI_FOR_PROVIDER[provider], {
    model: options.model,
    systemPrompt,
    userPrompt,
    schema: ANNOTATION_SCHEMA,
    schemaName: "annotations",
    cwd: options.projectRoot,
    allowFileTools: true,
  })) as { annotations?: SaveAnnotationEntry[] };

  const known = options.pathResult.pathMap;
  return (result.annotations ?? []).filter(
    (a) =>
      a &&
      typeof a.semantic_path === "string" &&
      typeof a.body === "string" &&
      a.body.trim() &&
      known.has(a.semantic_path)
  );
}

export async function generateAnnotations(
  options: GenerateOptions
): Promise<{ count: number }> {
  const modelInfo = resolveModel(options.model);
  if (!modelInfo) {
    throw new Error(`Unknown model "${options.model}"`);
  }

  const backend = await backendFor(modelInfo.provider);
  if (!backend) {
    throw new Error(
      `${modelInfo.label} is unavailable — install the \`${CLI_FOR_PROVIDER[modelInfo.provider]}\` CLI or set ${providerEnvKey(modelInfo.provider)}.`
    );
  }

  let saved: SaveAnnotationEntry[];

  if (backend === "cli") {
    saved = await generateViaCli(options, modelInfo.provider);
  } else {
    const systemPrompt = options.semanticPath
      ? singleElementPrompt(options.filePath, options.semanticPath)
      : fileWidePrompt(options.filePath);

    const context: ToolContext = {
      projectRoot: options.projectRoot,
      filePath: options.filePath,
      fileContent: options.fileContent,
      pathResult: options.pathResult,
    };

    saved = await RUNNERS[modelInfo.provider]({
      model: modelInfo.id,
      systemPrompt,
      context,
    });
  }

  const author = PROVIDER_AUTHORS[modelInfo.provider];
  for (const ann of saved) {
    await options.store.add(
      options.filePath,
      ann.semantic_path,
      ann.body,
      author
    );
  }

  return { count: saved.length };
}
