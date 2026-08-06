import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "@syl/core";

const MAX_RESULTS = 50;

/** Matched characters, with runs merged so long paths don't become span soup. */
function Highlighted({
  text,
  positions,
  offset = 0,
}: {
  text: string;
  positions: number[];
  offset?: number;
}) {
  const marked = new Set(
    positions.map((p) => p - offset).filter((p) => p >= 0 && p < text.length)
  );
  const runs: { text: string; match: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const match = marked.has(i);
    const last = runs[runs.length - 1];
    if (last && last.match === match) last.text += text[i];
    else runs.push({ text: text[i], match });
  }
  return (
    <>
      {runs.map((run, i) =>
        run.match ? (
          <span key={i} className="text-blue-300 font-semibold">
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        )
      )}
    </>
  );
}

export default function FileFinder({
  open,
  files,
  onSelect,
  onClose,
}: {
  open: boolean;
  files: string[];
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) {
      return files.slice(0, MAX_RESULTS).map((item) => ({
        item,
        match: { score: 0, positions: [] as number[] },
      }));
    }
    return fuzzyFilter(query, files, (f) => f, MAX_RESULTS);
  }, [query, files]);

  // Start clean every time it opens, rather than resuming a stale search.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the highlighted row on screen while arrowing through.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[active] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const choose = (path: string) => {
    onSelect(path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[active];
      if (chosen) choose(chosen.item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          className="w-full bg-transparent text-gray-100 px-4 py-3 text-sm border-b border-gray-800 focus:outline-none placeholder:text-gray-600"
          placeholder="Search files…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {results.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            No files match “{query}”.
          </div>
        ) : (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {results.map(({ item, match }, index) => {
              const slash = item.lastIndexOf("/");
              const dir = slash === -1 ? "" : item.slice(0, slash + 1);
              const base = slash === -1 ? item : item.slice(slash + 1);
              return (
                <li key={item}>
                  <button
                    className={`w-full text-left px-4 py-1.5 font-mono text-xs flex items-baseline gap-0 ${
                      index === active ? "bg-blue-500/20" : "hover:bg-gray-800"
                    }`}
                    // Mouse-over selection keeps the keyboard and pointer from
                    // disagreeing about which row Enter would open.
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    {dir && (
                      <span className="text-gray-600">
                        <Highlighted text={dir} positions={match.positions} />
                      </span>
                    )}
                    <span className="text-gray-200">
                      <Highlighted
                        text={base}
                        positions={match.positions}
                        offset={dir.length}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="px-4 py-1.5 border-t border-gray-800 text-[10px] text-gray-600 flex gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">
            {results.length}
            {results.length === MAX_RESULTS ? "+" : ""} of {files.length}
          </span>
        </div>
      </div>
    </div>
  );
}
