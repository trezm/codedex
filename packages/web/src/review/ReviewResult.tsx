import { useCallback, useMemo, useRef, useState } from "react";
import {
  parseUnifiedDiff,
  diffTotals,
  sortFindings,
  diffCommentTargets,
  anchorForFinding,
  findingToCommentBody,
  type LinkTarget,
  type ReviewRun,
  type Finding,
} from "@syl/core";
import DiffView, {
  findingDomId,
  type DiffViewMode,
  type CommentHandlers,
} from "./DiffView";
import type { FindingAnchorState } from "./FindingCard";
import SubmitReviewPanel from "./SubmitReviewPanel";
import { useDiffAnnotations } from "./useDiffAnnotations";
import {
  addReviewComment,
  updateReviewComment,
  deleteReviewComment,
  submitReview,
} from "../api";
import { SEVERITY_STYLE, SEVERITY_DOT, RISK_STYLE } from "./severity";

const VIEW_MODE_KEY = "syl-diff-view-mode";

/** Absolute, not relative — a cached review can be arbitrarily old. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function ReviewResult({
  run,
  onNewReview,
  onRerun,
  onNavigate,
  onRefresh,
}: {
  run: ReviewRun;
  onNewReview: () => void;
  /** Reviews this PR again, ignoring the cached result. */
  onRerun: () => void;
  onNavigate?: (target: LinkTarget) => void;
  onRefresh: () => Promise<void>;
}) {
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [showScout, setShowScout] = useState(false);
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === "split"
        ? "split"
        : "unified";
    } catch {
      return "unified";
    }
  });

  const chooseViewMode = (mode: DiffViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const files = useMemo(
    () => (run.diff ? parseUnifiedDiff(run.diff) : []),
    [run.diff]
  );
  const totals = useMemo(() => diffTotals(files), [files]);
  const findings = useMemo(
    () => sortFindings(run.review?.findings ?? []),
    [run.review]
  );
  const annotationData = useDiffAnnotations(files);
  const annotationCount = useMemo(
    () =>
      Object.values(annotationData.byFile).reduce(
        (total, entries) => total + entries.length,
        0
      ),
    [annotationData]
  );

  const commentTargets = useMemo(() => diffCommentTargets(files), [files]);

  // A finding is "staged" when a comment already exists at its anchor, so the
  // same finding can't be queued twice.
  const findingAnchorState = useCallback(
    (finding: Finding): FindingAnchorState => {
      const anchor = anchorForFinding(commentTargets, finding);
      if (!anchor) return "unanchored";
      const staged = run.comments.some(
        (c) =>
          c.path === anchor.path &&
          c.line === anchor.line &&
          c.side === anchor.side &&
          c.fromFinding === finding.title
      );
      return staged ? "staged" : "ready";
    },
    [commentTargets, run.comments]
  );

  const commentHandlers: CommentHandlers = {
    comments: run.comments,
    findingAnchorState,
    onAddComment: async (input) => {
      await addReviewComment(run.id, input);
      await onRefresh();
    },
    onEditComment: async (id, body) => {
      await updateReviewComment(run.id, id, body);
      await onRefresh();
    },
    onDeleteComment: async (id) => {
      await deleteReviewComment(run.id, id);
      await onRefresh();
    },
    onAddFinding: async (finding) => {
      const anchor = anchorForFinding(commentTargets, finding);
      if (!anchor) throw new Error("This finding isn't on a line in the diff.");
      await addReviewComment(run.id, {
        ...anchor,
        body: findingToCommentBody(finding),
        fromFinding: finding.title,
      });
      await onRefresh();
    },
  };

  const readyFindings = useMemo(
    () => findings.filter((f) => findingAnchorState(f) === "ready"),
    [findings, findingAnchorState]
  );

  const [addingAll, setAddingAll] = useState(false);
  const [addAllError, setAddAllError] = useState<string | null>(null);

  const addAll = async () => {
    setAddingAll(true);
    setAddAllError(null);
    try {
      // Sequential on purpose: the run's comment list is mutated server-side,
      // and concurrent posts would race on it.
      for (const finding of readyFindings) {
        const anchor = anchorForFinding(commentTargets, finding);
        if (!anchor) continue;
        await addReviewComment(run.id, {
          ...anchor,
          body: findingToCommentBody(finding),
          fromFinding: finding.title,
        });
      }
      await onRefresh();
    } catch (e: any) {
      setAddAllError(e.message);
      await onRefresh();
    } finally {
      setAddingAll(false);
    }
  };

  const diffPaneRef = useRef<HTMLElement>(null);

  // A big PR makes for a very tall scroll container, and `scrollIntoView` with
  // smooth behaviour doesn't reliably traverse tens of thousands of pixels.
  // Compute the offset against the pane and jump straight there.
  //
  // Done synchronously rather than in requestAnimationFrame: every finding is
  // already in the DOM (only the highlight depends on state), and rAF never
  // fires in a backgrounded tab, which would silently drop the jump.
  const jumpTo = (index: number) => {
    const id = findingDomId(findings[index], index);
    setActiveFindingId(id);
    const pane = diffPaneRef.current;
    const el = document.getElementById(id);
    if (!pane || !el) return;
    const offset =
      el.getBoundingClientRect().top -
      pane.getBoundingClientRect().top +
      pane.scrollTop;
    pane.scrollTo({ top: Math.max(0, offset - pane.clientHeight / 3) });
  };

  const meta = run.meta;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* PR header */}
      <div className="border-b border-gray-800 px-5 py-3 bg-gray-950">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-base text-gray-100 font-medium">
            {meta?.title ?? `Pull request #${run.number}`}
          </h2>
          <span className="text-gray-500 font-mono text-sm">#{run.number}</span>
          {meta && (
            <a
              className="text-xs text-blue-400 hover:underline"
              href={meta.url}
              target="_blank"
              rel="noreferrer"
            >
              view on GitHub ↗
            </a>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded border border-gray-700 overflow-hidden">
              {(
                [
                  ["unified", "Unified"],
                  ["split", "Split"],
                ] as [DiffViewMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  className={`text-xs px-2 py-1 ${
                    viewMode === mode
                      ? "bg-gray-800 text-gray-100"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  onClick={() => chooseViewMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={onNewReview}
            >
              New review
            </button>
          </div>
        </div>
        <div className="mt-1 text-xs text-gray-500 flex items-center gap-3 flex-wrap">
          <span className="font-mono">{run.repo}</span>
          {meta && (
            <span>
              @{meta.author} wants to merge{" "}
              <span className="font-mono text-gray-400">{meta.head}</span> into{" "}
              <span className="font-mono text-gray-400">{meta.base}</span>
            </span>
          )}
          <span>
            {files.length} file{files.length === 1 ? "" : "s"}{" "}
            <span className="text-emerald-400">+{totals.additions}</span>{" "}
            <span className="text-red-400">−{totals.deletions}</span>
          </span>
          {annotationCount > 0 && (
            <span className="text-violet-300/80">
              {annotationCount} syl annotation
              {annotationCount === 1 ? "" : "s"} on these files
            </span>
          )}
          <span className="text-gray-600">
            scout {run.scoutModel}
            {run.scoutBackend && ` (${run.scoutBackend})`} · reviewer{" "}
            {run.reviewerModel}
            {run.reviewerBackend && ` (${run.reviewerBackend})`}
          </span>
          {run.reusedFrom && (
            <span className="flex items-center gap-1.5 text-gray-400">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 bg-gray-800/60"
                title="The diff, the pull request and the models were unchanged, so syl reused the stored findings instead of calling the models again."
              >
                cached
              </span>
              <span>from {formatWhen(run.reusedFrom.startedAt)}</span>
              <button
                className="text-blue-400 hover:underline"
                onClick={onRerun}
              >
                re-run
              </button>
            </span>
          )}
        </div>
        {run.diffTruncated && (
          <div className="mt-2 text-xs text-amber-300">
            The diff was too large to send in full — the models saw a truncated
            version, so coverage may be incomplete.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Findings sidebar */}
        <aside className="w-80 flex-shrink-0 border-r border-gray-800 overflow-y-auto bg-gray-950">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Review summary
            </div>
            <p className="mt-2 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {run.review?.summary || "No summary returned."}
            </p>
          </div>

          {run.scout && (
            <div className="px-4 py-3 border-b border-gray-800">
              <button
                className="text-xs uppercase tracking-wide text-gray-500 hover:text-gray-300 flex items-center gap-1"
                onClick={() => setShowScout((s) => !s)}
              >
                <span>{showScout ? "▾" : "▸"}</span> Scout triage
              </button>
              {showScout && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {run.scout.intent}
                  </p>
                  {run.scout.focus_areas.map((area, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1 py-0.5 rounded border ${
                            RISK_STYLE[area.risk] ?? RISK_STYLE.low
                          }`}
                        >
                          {area.risk}
                        </span>
                        <span className="font-mono text-gray-400 truncate">
                          {area.file}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-0.5">{area.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800 flex items-center gap-2">
            <span>
              {findings.length} finding{findings.length === 1 ? "" : "s"}
            </span>
            {readyFindings.length > 0 && (
              <button
                className="ml-auto normal-case text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 disabled:opacity-40"
                disabled={addingAll}
                title="Stage a comment for every finding that lands on a diff line"
                onClick={addAll}
              >
                {addingAll ? "Adding…" : `Add ${readyFindings.length} to review`}
              </button>
            )}
          </div>
          {addAllError && (
            <div className="px-4 py-2 text-[11px] text-red-300">{addAllError}</div>
          )}

          {findings.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              No findings — the reviewer had nothing high-confidence to report.
            </div>
          ) : (
            <ul className="divide-y divide-gray-800/70">
              {findings.map((finding, index) => {
                const id = findingDomId(finding, index);
                return (
                  <li key={id}>
                    <button
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-900 ${
                        activeFindingId === id ? "bg-blue-500/10" : ""
                      }`}
                      onClick={() => jumpTo(index)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            SEVERITY_DOT[finding.severity]
                          }`}
                        />
                        <span
                          className={`text-[10px] uppercase px-1 py-0.5 rounded border ${
                            SEVERITY_STYLE[finding.severity]
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">
                          {finding.category}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-200 leading-snug">
                        {finding.title}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-gray-600 truncate">
                        {finding.file}:{finding.line}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Diff */}
        <main ref={diffPaneRef} className="flex-1 overflow-y-auto px-4 py-4">
          {files.length === 0 ? (
            <div className="text-sm text-gray-500">No diff to display.</div>
          ) : (
            <DiffView
              files={files}
              findings={findings}
              activeFindingId={activeFindingId}
              viewMode={viewMode}
              annotationData={annotationData}
              onNavigate={onNavigate}
              {...commentHandlers}
            />
          )}
        </main>
      </div>

      <SubmitReviewPanel
        run={run}
        onSubmit={async (input) => {
          await submitReview(run.id, input);
          await onRefresh();
        }}
      />
    </div>
  );
}
