export interface Annotation {
  id: string;
  body: string;
  author: string;
  created: string;
  updated: string;
}

export interface AnnotationFile {
  version: 1;
  sourceFile: string;
  annotations: Record<string, Annotation[]>;
}

export interface SylConfig {
  version: 1;
  rootDir: string;
}

export interface SemanticNode {
  path: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  children: SemanticNode[];
}

export interface ResolvedAnnotation {
  annotation: Annotation;
  path: string;
  node: SemanticNode | null;
  orphaned: boolean;
}
