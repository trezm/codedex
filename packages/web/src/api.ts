import type { AnnotationFile, SemanticNode, Annotation } from "@syl/core";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface ResolveResponse {
  annotations: Record<string, Annotation[]>;
  nodes: SemanticNode[];
  orphans: { path: string; annotations: Annotation[] }[];
}

export async function fetchFileTree(): Promise<FileNode[]> {
  const res = await fetch("/api/files/tree");
  return res.json();
}

export async function fetchFileContent(
  path: string
): Promise<{ path: string; content: string }> {
  const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("Failed to read file");
  return res.json();
}

export async function fetchAnnotations(
  file: string
): Promise<AnnotationFile> {
  const res = await fetch(`/api/annotations?file=${encodeURIComponent(file)}`);
  return res.json();
}

export async function resolveAnnotations(
  file: string
): Promise<ResolveResponse> {
  const res = await fetch(
    `/api/annotations/resolve?file=${encodeURIComponent(file)}`
  );
  return res.json();
}

export async function addAnnotation(
  file: string,
  semanticPath: string,
  body: string,
  author: string = "anonymous"
): Promise<Annotation> {
  const res = await fetch("/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, path: semanticPath, body, author }),
  });
  return res.json();
}

export async function updateAnnotation(
  id: string,
  file: string,
  semanticPath: string,
  body: string
): Promise<Annotation> {
  const res = await fetch(`/api/annotations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, path: semanticPath, body }),
  });
  return res.json();
}

export async function deleteAnnotation(
  id: string,
  file: string,
  semanticPath: string
): Promise<void> {
  await fetch(`/api/annotations/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, path: semanticPath }),
  });
}
