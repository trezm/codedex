import { Annotation, AnnotationFile, ResolvedAnnotation, SemanticNode } from "./types.js";
import { SemanticPathResult } from "../tree-sitter/semantic-path.js";

export function resolveAnnotations(
  annotationFile: AnnotationFile,
  pathResult: SemanticPathResult
): ResolvedAnnotation[] {
  const resolved: ResolvedAnnotation[] = [];

  for (const [path, annotations] of Object.entries(annotationFile.annotations)) {
    const node = pathResult.pathMap.get(path) ?? null;
    for (const annotation of annotations) {
      resolved.push({
        annotation,
        path,
        node,
        orphaned: node === null,
      });
    }
  }

  return resolved;
}
