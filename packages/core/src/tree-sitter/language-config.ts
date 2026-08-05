/**
 * The slice of a tree-sitter node a language config is allowed to look at.
 * Field lookups cover most languages, but some grammars (Kotlin) expose no
 * `name` field at all, so child traversal has to be available too.
 */
export interface PathNode {
  type: string;
  text: string;
  childCount: number;
  namedChildCount: number;
  child(index: number): PathNode | null;
  namedChild(index: number): PathNode | null;
  childForFieldName(name: string): PathNode | null;
}

/** First direct child matching any of `types`, in child order. */
export function firstChildOfType(
  node: PathNode | null | undefined,
  ...types: string[]
): PathNode | null {
  if (!node) return null;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && types.includes(child.type)) return child;
  }
  return null;
}

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
  getNodeName(node: PathNode): string | null;
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
