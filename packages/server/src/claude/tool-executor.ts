import fs from "node:fs/promises";
import path from "node:path";
import type { SemanticPathResult } from "@syl/core";

export interface ToolContext {
  projectRoot: string;
  filePath: string;
  fileContent: string;
  pathResult: SemanticPathResult;
}

export interface SaveAnnotationEntry {
  semantic_path: string;
  body: string;
}

export interface ToolExecutionResult {
  output: string;
  savedAnnotations?: SaveAnnotationEntry[];
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "get_semantic_tree":
      return executeGetSemanticTree(context);
    case "get_node_source":
      return executeGetNodeSource(input as { semantic_path: string }, context);
    case "get_file_content":
      return executeGetFileContent(input as { file_path: string }, context);
    case "save_annotations":
      return executeSaveAnnotations(
        input as { annotations: SaveAnnotationEntry[] }
      );
    default:
      return { output: `Unknown tool: ${toolName}` };
  }
}

function formatNode(
  node: { path: string; kind: string; startLine: number; endLine: number; children: any[] },
  indent: number
): string {
  const pad = "  ".repeat(indent);
  let result = `${pad}- ${node.path} (${node.kind}, L${node.startLine}-${node.endLine})\n`;
  for (const child of node.children) {
    result += formatNode(child, indent + 1);
  }
  return result;
}

function executeGetSemanticTree(context: ToolContext): ToolExecutionResult {
  const { pathResult } = context;
  if (pathResult.roots.length === 0) {
    return { output: "No semantic nodes found in this file." };
  }
  let output = `Semantic tree for ${context.filePath}:\n\n`;
  for (const root of pathResult.roots) {
    output += formatNode(root, 0);
  }
  return { output };
}

function executeGetNodeSource(
  input: { semantic_path: string },
  context: ToolContext
): ToolExecutionResult {
  const node = context.pathResult.pathMap.get(input.semantic_path);
  if (!node) {
    return {
      output: `No node found at path "${input.semantic_path}". Use get_semantic_tree to see available paths.`,
    };
  }
  const lines = context.fileContent.split("\n");
  const source = lines.slice(node.startLine - 1, node.endLine).join("\n");
  return {
    output: `Source for ${input.semantic_path} (${node.kind}, L${node.startLine}-${node.endLine}):\n\n${source}`,
  };
}

async function executeGetFileContent(
  input: { file_path: string },
  context: ToolContext
): Promise<ToolExecutionResult> {
  const resolved = path.resolve(context.projectRoot, input.file_path);
  if (!resolved.startsWith(path.resolve(context.projectRoot))) {
    return { output: "Error: path traversal not allowed" };
  }
  try {
    const content = await fs.readFile(resolved, "utf-8");
    // Truncate very large files
    const maxChars = 20000;
    const truncated =
      content.length > maxChars
        ? content.slice(0, maxChars) + "\n\n... (truncated)"
        : content;
    return { output: `Content of ${input.file_path}:\n\n${truncated}` };
  } catch {
    return { output: `Error: could not read file "${input.file_path}"` };
  }
}

function executeSaveAnnotations(input: {
  annotations: SaveAnnotationEntry[];
}): ToolExecutionResult {
  if (!input.annotations || input.annotations.length === 0) {
    return { output: "No annotations provided." };
  }
  return {
    output: `Saved ${input.annotations.length} annotation(s).`,
    savedAnnotations: input.annotations,
  };
}
