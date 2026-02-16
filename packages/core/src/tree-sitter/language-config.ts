export interface LanguagePathConfig {
  /** Language identifier (e.g. "typescript", "python") */
  id: string;
  /** File extensions this language handles */
  extensions: string[];
  /** Tree-sitter node types that form semantic path segments */
  pathNodeTypes: string[];
  /**
   * Given a path-bearing node, extract the name for the path segment.
   * Most languages use a "name" child, but some differ.
   */
  getNodeName(node: { type: string; childForFieldName(name: string): { text: string } | null }): string | null;
  /** WASM file name for tree-sitter (e.g. "tree-sitter-typescript.wasm") */
  wasmFile: string;
}

const registry = new Map<string, LanguagePathConfig>();

export function registerLanguage(config: LanguagePathConfig): void {
  for (const ext of config.extensions) {
    registry.set(ext, config);
  }
}

export function getLanguageForFile(filePath: string): LanguagePathConfig | undefined {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  return registry.get(ext);
}

export function getAllLanguages(): LanguagePathConfig[] {
  const seen = new Set<string>();
  const result: LanguagePathConfig[] = [];
  for (const config of registry.values()) {
    if (!seen.has(config.id)) {
      seen.add(config.id);
      result.push(config);
    }
  }
  return result;
}
