export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "correctness"
  | "design"
  | "test";

export type RiskLevel = "high" | "medium" | "low";

export interface ScoutFocusArea {
  file: string;
  reason: string;
  risk: RiskLevel;
}

/** Stage one: cheap triage that tells the reviewer where to look. */
export interface ScoutResult {
  intent: string;
  focus_areas: ScoutFocusArea[];
}

export interface Finding {
  file: string;
  /** Best-guess line in the NEW version of the file. */
  line: number;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  suggestion: string;
}

/** Stage two: the actual review. */
export interface ReviewResult {
  summary: string;
  findings: Finding[];
}

export interface GitRemote {
  name: string;
  url: string;
  /** "owner/repo", or null when the URL isn't a recognisable GitHub remote. */
  repo: string | null;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  author: string;
  headRefName: string;
  state: string;
}

export interface PullRequestMeta {
  repo: string;
  number: number;
  title: string;
  body: string;
  base: string;
  head: string;
  author: string;
  url: string;
}

export type ReviewPhase =
  | "fetching"
  | "scout"
  | "reviewer"
  | "done"
  | "failed";

export interface ReviewRun {
  id: string;
  repo: string;
  remote: string;
  number: number;
  phase: ReviewPhase;
  scoutModel: string;
  reviewerModel: string;
  /** "cli" (subscription) or "sdk" (per-token API), recorded per stage. */
  scoutBackend: string | null;
  reviewerBackend: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  meta: PullRequestMeta | null;
  scout: ScoutResult | null;
  review: ReviewResult | null;
  /** Raw unified diff; the client parses it for display. */
  diff: string | null;
  /** Set when the diff was too large to send to the models in full. */
  diffTruncated: boolean;
}

export const SEVERITY_ORDER: FindingSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export function severityRank(severity: FindingSeverity): number {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
}
