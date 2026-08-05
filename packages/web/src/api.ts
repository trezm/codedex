import type {
  AnnotationFile,
  SemanticNode,
  Annotation,
  LinkTarget,
  GitRemote,
  PullRequestSummary,
  ReviewRun,
} from "@syl/core";
import type { AvailableModel } from "./components/ModelSelector";

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

export async function resolveLinks(
  file: string,
  refs: string[]
): Promise<Record<string, LinkTarget | null>> {
  if (refs.length === 0) return {};
  const res = await fetch("/api/links/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, refs }),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.results ?? {};
}

// ---- Review ----

export async function fetchRemotes(): Promise<{
  remotes: GitRemote[];
  defaults: { scout: string | null; reviewer: string | null };
}> {
  const res = await fetch("/api/review/remotes");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list git remotes");
  return data;
}

export async function fetchPullRequests(
  repo: string
): Promise<PullRequestSummary[]> {
  const res = await fetch(
    `/api/review/prs?repo=${encodeURIComponent(repo)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list pull requests");
  return data.pullRequests ?? [];
}

export async function startReview(params: {
  remote: string;
  repo: string;
  number: number;
  scoutModel?: string;
  reviewerModel?: string;
}): Promise<string> {
  const res = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to start review");
  return data.id;
}

export async function fetchReviewRun(id: string): Promise<ReviewRun> {
  const res = await fetch(`/api/review/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load review");
  return data.run;
}

export interface GenerateStatus {
  available: boolean;
  defaultModel: string | null;
  models: AvailableModel[];
}

export async function checkGenerateStatus(): Promise<GenerateStatus> {
  const res = await fetch("/api/generate/status");
  return res.json();
}

export async function generateAnnotation(
  file: string,
  model: string,
  semanticPath: string
): Promise<{ ok: boolean; count: number }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, model, semanticPath }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Generation failed");
  }
  return res.json();
}

export async function generateFileAnnotations(
  file: string,
  model: string
): Promise<{ ok: boolean; count: number }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, model }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Generation failed");
  }
  return res.json();
}
