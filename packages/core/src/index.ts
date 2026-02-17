// Annotations
export type {
  Annotation,
  AnnotationFile,
  SylConfig,
  SemanticNode,
  ResolvedAnnotation,
} from "./annotations/types.js";
export { AnnotationStore } from "./annotations/store.js";
export type { FileSystem } from "./annotations/store.js";

// Tree-sitter
export type { LanguagePathConfig } from "./tree-sitter/language-config.js";
export {
  registerLanguage,
  getLanguageForFile,
  getAllLanguages,
} from "./tree-sitter/language-config.js";
export { buildSemanticPaths } from "./tree-sitter/semantic-path.js";
export type { SemanticPathResult } from "./tree-sitter/semantic-path.js";
export { initTreeSitter, createParser, Parser } from "./tree-sitter/init.js";

// Language registrations (side effects)
import "./tree-sitter/languages/typescript.js";
import "./tree-sitter/languages/javascript.js";
import "./tree-sitter/languages/python.js";

// Resolver
export { resolveAnnotations } from "./annotations/resolver.js";
export { detectOrphans } from "./orphans/detector.js";
