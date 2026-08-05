import { useCallback, useEffect, useState } from "react";
import type { ReviewRun, ReviewPhase } from "@syl/core";
import ReviewSetup from "./ReviewSetup";
import ReviewResult from "./ReviewResult";
import { startReview, fetchReviewRun } from "../api";

const PHASE_LABEL: Record<ReviewPhase, string> = {
  fetching: "Fetching pull request and diff",
  scout: "Scout is triaging the diff",
  reviewer: "Reviewer is analysing the code",
  done: "Done",
  failed: "Failed",
};

const PHASE_ORDER: ReviewPhase[] = ["fetching", "scout", "reviewer", "done"];

function Progress({ run }: { run: ReviewRun }) {
  const currentIndex = PHASE_ORDER.indexOf(run.phase);
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h2 className="text-lg font-semibold text-gray-200">
        Reviewing {run.repo} #{run.number}
      </h2>
      <ol className="mt-6 space-y-3">
        {PHASE_ORDER.slice(0, 3).map((phase, i) => {
          const done = currentIndex > i || run.phase === "done";
          const active = run.phase === phase;
          return (
            <li key={phase} className="flex items-center gap-3 text-sm">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] border ${
                  done
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : active
                      ? "border-blue-500/60 bg-blue-500/15 text-blue-300 animate-pulse"
                      : "border-gray-700 text-gray-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "text-gray-200" : "text-gray-500"}>
                {PHASE_LABEL[phase]}
                {active && "…"}
              </span>
              {phase !== "fetching" && (
                <span className="text-xs text-gray-600 font-mono">
                  {phase === "scout" ? run.scoutModel : run.reviewerModel}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-xs text-gray-600">
        The reviewer pass on a large diff can take a couple of minutes.
      </p>
    </div>
  );
}

const LAST_RUN_KEY = "syl-last-review-run";

export default function ReviewView() {
  // Runs live on the server, so a reload can pick the last one back up.
  const [runId, setRunId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_RUN_KEY);
    } catch {
      return null;
    }
  });
  const [run, setRun] = useState<ReviewRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const next = await fetchReviewRun(runId);
        if (cancelled) return;
        setRun(next);
        if (next.phase !== "done" && next.phase !== "failed") {
          timer = window.setTimeout(poll, 1500);
        }
      } catch (e: any) {
        if (cancelled) return;
        // A stale id from a previous server process just means "start over".
        try {
          localStorage.removeItem(LAST_RUN_KEY);
        } catch {
          // ignore
        }
        setRunId(null);
        setRun(null);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [runId]);

  // Polling stops once a run is done, so comment edits refresh on demand.
  const refresh = useCallback(async () => {
    if (!runId) return;
    setRun(await fetchReviewRun(runId));
  }, [runId]);

  const handleStart = async (params: {
    remote: string;
    repo: string;
    number: number;
  }) => {
    setStarting(true);
    setError(null);
    try {
      const id = await startReview(params);
      setRun(null);
      setRunId(id);
      try {
        localStorage.setItem(LAST_RUN_KEY, id);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const reset = () => {
    setRunId(null);
    setRun(null);
    setError(null);
    try {
      localStorage.removeItem(LAST_RUN_KEY);
    } catch {
      // ignore
    }
  };

  if (error && !run) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6">
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
        <button
          className="mt-4 text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={reset}
        >
          Back
        </button>
      </div>
    );
  }

  if (!runId || !run) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ReviewSetup onStart={handleStart} busy={starting} />
      </div>
    );
  }

  if (run.phase === "failed") {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6">
        <h2 className="text-lg font-semibold text-gray-200">Review failed</h2>
        <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 whitespace-pre-wrap">
          {run.error}
        </div>
        <button
          className="mt-4 text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={reset}
        >
          Start over
        </button>
      </div>
    );
  }

  if (run.phase !== "done") {
    return (
      <div className="flex-1 overflow-y-auto">
        <Progress run={run} />
      </div>
    );
  }

  return <ReviewResult run={run} onNewReview={reset} onRefresh={refresh} />;
}
