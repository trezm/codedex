import { randomUUID } from "node:crypto";
import type {
  ReviewRun,
  ScoutResult,
  ReviewResult,
  Finding,
} from "@syl/core";
import { completeJson, backendForModel } from "../ai/complete.js";
import {
  fetchPullRequestMeta,
  fetchPullRequestDiff,
  describeGhError,
} from "./github.js";
import {
  SCOUT_SCHEMA,
  REVIEW_SCHEMA,
  SCOUT_SYSTEM,
  REVIEWER_SYSTEM,
  scoutPrompt,
  reviewerPrompt,
} from "./prompts.js";

/** Characters of diff sent to the models. The UI still renders the full diff. */
const MAX_PROMPT_DIFF_CHARS = 400_000;
/** Runs are in-memory only; keep the most recent ones. */
const MAX_RUNS = 25;

export interface StartOptions {
  remote: string;
  repo: string;
  number: number;
  scoutModel: string;
  reviewerModel: string;
}

function truncateDiff(diff: string): { text: string; truncated: boolean } {
  if (diff.length <= MAX_PROMPT_DIFF_CHARS) {
    return { text: diff, truncated: false };
  }
  return {
    text:
      diff.slice(0, MAX_PROMPT_DIFF_CHARS) +
      "\n\n[diff truncated — too large to send in full]",
    truncated: true,
  };
}

function normalizeFindings(findings: Finding[]): Finding[] {
  return findings
    .filter((f) => f && typeof f.file === "string" && f.file.trim())
    .map((f) => ({
      ...f,
      file: f.file.trim(),
      line: Number.isFinite(f.line) && f.line > 0 ? Math.floor(f.line) : 1,
      title: (f.title ?? "").trim(),
      description: (f.description ?? "").trim(),
      suggestion: (f.suggestion ?? "").trim(),
    }));
}

export class ReviewRunner {
  private runs = new Map<string, ReviewRun>();

  constructor(private projectRoot: string) {}

  get(id: string): ReviewRun | undefined {
    return this.runs.get(id);
  }

  list(): ReviewRun[] {
    // Newest first, without the diff payload — the list view doesn't need it.
    return [...this.runs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((run) => ({ ...run, diff: null }));
  }

  start(options: StartOptions): ReviewRun {
    const run: ReviewRun = {
      id: randomUUID(),
      repo: options.repo,
      remote: options.remote,
      number: options.number,
      phase: "fetching",
      scoutModel: options.scoutModel,
      reviewerModel: options.reviewerModel,
      scoutBackend: null,
      reviewerBackend: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      meta: null,
      scout: null,
      review: null,
      diff: null,
      diffTruncated: false,
    };

    this.runs.set(run.id, run);
    this.evict();
    // Deliberately not awaited: the client polls the run for progress.
    void this.execute(run);
    return run;
  }

  private evict(): void {
    if (this.runs.size <= MAX_RUNS) return;
    const ordered = [...this.runs.values()].sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt)
    );
    for (const run of ordered.slice(0, this.runs.size - MAX_RUNS)) {
      if (run.phase === "done" || run.phase === "failed") {
        this.runs.delete(run.id);
      }
    }
  }

  private fail(run: ReviewRun, message: string): void {
    run.phase = "failed";
    run.error = message;
    run.finishedAt = new Date().toISOString();
  }

  private async execute(run: ReviewRun): Promise<void> {
    try {
      run.phase = "fetching";
      const [meta, diff] = await Promise.all([
        fetchPullRequestMeta(run.repo, run.number, this.projectRoot),
        fetchPullRequestDiff(run.repo, run.number, this.projectRoot),
      ]);
      run.meta = meta;
      run.diff = diff;

      if (!diff.trim()) {
        this.fail(run, "This pull request has an empty diff — nothing to review.");
        return;
      }

      const { text: promptDiff, truncated } = truncateDiff(diff);
      run.diffTruncated = truncated;

      run.phase = "scout";
      run.scoutBackend = await backendForModel(run.scoutModel);
      const scout = (await completeJson({
        model: run.scoutModel,
        systemPrompt: SCOUT_SYSTEM,
        userPrompt: scoutPrompt(meta, promptDiff),
        schema: SCOUT_SCHEMA,
        schemaName: "scout_triage",
        cwd: this.projectRoot,
      })) as ScoutResult;
      run.scout = scout;

      run.phase = "reviewer";
      run.reviewerBackend = await backendForModel(run.reviewerModel);
      const review = (await completeJson({
        model: run.reviewerModel,
        systemPrompt: REVIEWER_SYSTEM,
        userPrompt: reviewerPrompt(meta, promptDiff, scout),
        schema: REVIEW_SCHEMA,
        schemaName: "code_review",
        cwd: this.projectRoot,
      })) as ReviewResult;

      run.review = {
        summary: review.summary ?? "",
        findings: normalizeFindings(review.findings ?? []),
      };

      run.phase = "done";
      run.finishedAt = new Date().toISOString();
    } catch (e) {
      console.error(`Review run ${run.id} failed:`, e);
      this.fail(run, describeGhError(e));
    }
  }
}
