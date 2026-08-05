import { randomUUID } from "node:crypto";
import type {
  ReviewRun,
  ScoutResult,
  ReviewResult,
  Finding,
  DraftComment,
  ReviewCommentSide,
  ReviewEvent,
  SubmittedReview,
} from "@syl/core";
import {
  parseUnifiedDiff,
  diffCommentTargets,
  canCommentOn,
} from "@syl/core";
import { completeJson, backendForModel } from "../ai/complete.js";
import {
  fetchPullRequestMeta,
  fetchPullRequestDiff,
  describeGhError,
  submitReview,
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
      comments: [],
      submissions: [],
    };

    this.runs.set(run.id, run);
    this.evict();
    // Deliberately not awaited: the client polls the run for progress.
    void this.execute(run);
    return run;
  }

  /**
   * Rejects a comment GitHub would refuse anyway. Doing it here means a bad
   * anchor surfaces while the user is still composing, instead of failing the
   * whole review submission later.
   */
  private assertCommentable(
    run: ReviewRun,
    path: string,
    line: number,
    side: ReviewCommentSide
  ): void {
    if (!run.diff) throw new Error("The diff for this run is not available yet.");
    const targets = diffCommentTargets(parseUnifiedDiff(run.diff));
    if (!targets.has(path)) {
      throw new Error(`"${path}" is not part of this pull request's diff.`);
    }
    if (!canCommentOn(targets, path, line, side)) {
      throw new Error(
        `Line ${line} of "${path}" is not part of the diff, so GitHub won't accept a comment there.`
      );
    }
  }

  addComment(
    id: string,
    input: {
      path: string;
      line: number;
      side: ReviewCommentSide;
      body: string;
      fromFinding?: string | null;
    }
  ): DraftComment {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");

    const body = input.body.trim();
    if (!body) throw new Error("A comment body is required.");
    this.assertCommentable(run, input.path, input.line, input.side);

    const comment: DraftComment = {
      id: randomUUID(),
      path: input.path,
      line: input.line,
      side: input.side,
      body,
      fromFinding: input.fromFinding ?? null,
      createdAt: new Date().toISOString(),
    };
    run.comments.push(comment);
    return comment;
  }

  updateComment(id: string, commentId: string, body: string): DraftComment {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    const comment = run.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error("comment not found");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("A comment body is required.");
    comment.body = trimmed;
    return comment;
  }

  deleteComment(id: string, commentId: string): void {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    const index = run.comments.findIndex((c) => c.id === commentId);
    if (index === -1) throw new Error("comment not found");
    run.comments.splice(index, 1);
  }

  /**
   * Posts the staged comments as a single GitHub review. On success the drafts
   * are cleared, so a retry after a partial failure can't double-post.
   */
  async submit(
    id: string,
    input: { body: string; event: ReviewEvent }
  ): Promise<SubmittedReview> {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");

    const body = input.body.trim();
    if (!body && run.comments.length === 0) {
      throw new Error(
        "Add at least one comment, or write an overall review body, before submitting."
      );
    }

    const result = await submitReview(
      run.repo,
      run.number,
      {
        body,
        event: input.event,
        comments: run.comments.map((c) => ({
          path: c.path,
          line: c.line,
          side: c.side,
          body: c.body,
        })),
      },
      this.projectRoot
    );

    const submission: SubmittedReview = {
      url: result.url,
      event: input.event,
      commentCount: run.comments.length,
      submittedAt: new Date().toISOString(),
    };
    run.submissions.push(submission);
    run.comments = [];
    return submission;
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
