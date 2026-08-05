import { useState } from "react";
import type { Finding } from "@syl/core";
import { SEVERITY_STYLE, CATEGORY_LABEL } from "./severity";

/** Why a finding can't be staged as an inline comment, if it can't. */
export type FindingAnchorState = "ready" | "staged" | "unanchored";

function AddToReview({
  state,
  onAdd,
}: {
  state: FindingAnchorState;
  onAdd: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "staged") {
    return (
      <span className="text-[10px] text-amber-300 border border-amber-500/40 rounded px-1.5 py-0.5">
        Added to review
      </span>
    );
  }

  if (state === "unanchored") {
    return (
      <span
        className="text-[10px] text-gray-600"
        title="GitHub only accepts inline comments on lines that are part of the diff."
      >
        Not on a diff line
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[10px] text-red-300">{error}</span>}
      <button
        className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 disabled:opacity-40"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onAdd();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Adding…" : "+ Add to review"}
      </button>
    </span>
  );
}

export default function FindingCard({
  finding,
  id,
  highlighted,
  anchorState,
  onAddToReview,
}: {
  finding: Finding;
  id?: string;
  highlighted?: boolean;
  anchorState?: FindingAnchorState;
  onAddToReview?: () => Promise<void>;
}) {
  return (
    <div
      id={id}
      className={`my-2 mx-3 rounded-md border bg-gray-900/80 ${
        highlighted ? "border-blue-500/70 ring-1 ring-blue-500/30" : "border-gray-700/60"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
            SEVERITY_STYLE[finding.severity]
          }`}
        >
          {finding.severity}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {CATEGORY_LABEL[finding.category] ?? finding.category}
        </span>
        <span className="text-sm text-gray-200 font-medium">{finding.title}</span>
        {anchorState && onAddToReview && (
          <span className="ml-auto flex-shrink-0">
            <AddToReview state={anchorState} onAdd={onAddToReview} />
          </span>
        )}
      </div>
      <div className="px-3 py-2 space-y-2">
        <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
          {finding.description}
        </p>
        {finding.suggestion && (
          <div className="text-xs">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
              Suggestion
            </div>
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed border-l-2 border-emerald-500/40 pl-2">
              {finding.suggestion}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
