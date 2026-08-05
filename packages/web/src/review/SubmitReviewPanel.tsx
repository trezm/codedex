import { useState } from "react";
import { REVIEW_EVENTS, type ReviewEvent, type ReviewRun } from "@syl/core";

/**
 * The bar that publishes staged comments to GitHub. Submitting is public and
 * can't be undone from here, so the button always states the exact payload —
 * repo, PR number, comment count and event — before it's pressed.
 */
export default function SubmitReviewPanel({
  run,
  onSubmit,
}: {
  run: ReviewRun;
  onSubmit: (input: { body: string; event: ReviewEvent }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = run.comments.length;
  const nothingToSend = count === 0 && !body.trim();
  const lastSubmission = run.submissions[run.submissions.length - 1];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ body: body.trim(), event });
      setBody("");
      setEvent("COMMENT");
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950">
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          className="text-xs text-gray-300 hover:text-gray-100 flex items-center gap-1.5"
          onClick={() => setOpen((o) => !o)}
        >
          <span>{open ? "▾" : "▸"}</span>
          Review
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              count > 0
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-gray-800 text-gray-500 border border-gray-700"
            }`}
          >
            {count} pending
          </span>
        </button>

        {lastSubmission && (
          <a
            className="text-[11px] text-emerald-300 hover:underline"
            href={lastSubmission.url}
            target="_blank"
            rel="noreferrer"
          >
            Posted {lastSubmission.commentCount} comment
            {lastSubmission.commentCount === 1 ? "" : "s"} to GitHub ↗
          </a>
        )}

        <span className="ml-auto text-[11px] text-gray-600 font-mono">
          {run.repo} #{run.number}
        </span>
      </div>

      {open && (
        <div className="px-4 pb-3 space-y-3 border-t border-gray-800/70 pt-3">
          <textarea
            className="w-full bg-gray-900 text-gray-200 border border-gray-700 rounded p-2 text-xs resize-y focus:outline-none focus:border-blue-500"
            rows={3}
            placeholder="Overall review comment (optional if you have inline comments)…"
            value={body}
            disabled={busy}
            onChange={(e) => setBody(e.target.value)}
          />

          <div className="space-y-1.5">
            {REVIEW_EVENTS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer"
              >
                <input
                  type="radio"
                  name="review-event"
                  className="mt-0.5"
                  checked={event === option.value}
                  disabled={busy}
                  onChange={() => setEvent(option.value)}
                />
                <span>
                  <span className="text-gray-200">{option.label}</span>
                  <span className="block text-[11px] text-gray-500">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {error && (
            <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <button
            className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white"
            disabled={nothingToSend || busy}
            onClick={submit}
          >
            {busy
              ? "Submitting…"
              : `Submit ${count} comment${count === 1 ? "" : "s"} to ${run.repo} #${run.number}`}
          </button>
          <p className="text-[11px] text-gray-600">
            This posts publicly to GitHub as your authenticated <code>gh</code>{" "}
            user and cannot be undone from Syl.
          </p>
        </div>
      )}
    </div>
  );
}
