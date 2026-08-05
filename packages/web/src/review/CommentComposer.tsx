import { useState } from "react";

/**
 * The inline box for writing or editing a review comment. Cmd/Ctrl+Enter saves,
 * matching the shortcut GitHub uses for the same box.
 */
export default function CommentComposer({
  initialBody = "",
  submitLabel,
  placeholder = "Leave a comment…",
  busy,
  onSubmit,
  onCancel,
}: {
  initialBody?: string;
  submitLabel: string;
  placeholder?: string;
  busy?: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const empty = !body.trim();

  return (
    <div className="rounded-md border border-gray-700 bg-gray-900/90 p-2">
      <textarea
        className="w-full bg-gray-950 text-gray-200 border border-gray-700 rounded p-2 text-xs font-sans resize-y focus:outline-none focus:border-blue-500"
        rows={4}
        value={body}
        placeholder={placeholder}
        autoFocus
        disabled={busy}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !empty) {
            e.preventDefault();
            onSubmit(body.trim());
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          className="px-2.5 py-1 text-[11px] rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white"
          disabled={empty || busy}
          onClick={() => onSubmit(body.trim())}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          className="px-2.5 py-1 text-[11px] rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <span className="text-[10px] text-gray-600 ml-auto">⌘↵ to save</span>
      </div>
    </div>
  );
}
