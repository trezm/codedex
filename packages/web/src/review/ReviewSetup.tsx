import { useEffect, useState } from "react";
import type { GitRemote, PullRequestSummary } from "@syl/core";
import { fetchRemotes, fetchPullRequests } from "../api";

interface ReviewSetupProps {
  onStart: (params: { remote: string; repo: string; number: number }) => void;
  busy: boolean;
}

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  MERGED: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  CLOSED: "bg-gray-500/15 text-gray-400 border-gray-500/40",
};

export default function ReviewSetup({ onStart, busy }: ReviewSetupProps) {
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [remote, setRemote] = useState<GitRemote | null>(null);
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [prsLoading, setPrsLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRemotes()
      .then(({ remotes }) => {
        setRemotes(remotes);
        // One remote is the common case — preselect it but still show it.
        const usable = remotes.filter((r) => r.repo);
        if (usable.length === 1) setRemote(usable[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!remote?.repo) {
      setPrs([]);
      return;
    }
    let cancelled = false;
    setPrsLoading(true);
    setPrError(null);
    fetchPullRequests(remote.repo)
      .then((list) => {
        if (!cancelled) setPrs(list);
      })
      .catch((e) => {
        if (!cancelled) setPrError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPrsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [remote]);

  const submit = () => {
    if (!remote?.repo) return;
    const parsed = parseInt(number, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a pull request number.");
      return;
    }
    setError(null);
    onStart({ remote: remote.name, repo: remote.repo, number: parsed });
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h2 className="text-lg font-semibold text-gray-200">Review a pull request</h2>
      <p className="text-sm text-gray-500 mt-1">
        A cheap scout model triages the diff, then a stronger reviewer produces
        findings.
      </p>

      {error && (
        <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Step 1 — remote */}
      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          1 · Remote
        </h3>
        {remotes.length === 0 ? (
          <div className="text-sm text-gray-500">No git remotes found.</div>
        ) : (
          <div className="space-y-1">
            {remotes.map((r) => (
              <button
                key={r.name}
                disabled={!r.repo}
                onClick={() => setRemote(r)}
                className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                  remote?.name === r.name
                    ? "border-blue-500/60 bg-blue-500/10"
                    : "border-gray-800 hover:border-gray-700 bg-gray-900/40"
                } ${!r.repo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="font-mono text-gray-200">{r.name}</span>
                <span className="ml-2 text-gray-500">
                  {r.repo ?? "not a recognisable GitHub remote"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2 — PR */}
      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          2 · Pull request
        </h3>

        <div className="flex gap-2 items-center">
          <span className="text-gray-500 text-sm">#</span>
          <input
            className="w-28 bg-gray-900 text-gray-200 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            placeholder="number"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={!remote?.repo}
          />
          <button
            className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white"
            onClick={submit}
            disabled={!remote?.repo || !number || busy}
          >
            {busy ? "Starting…" : "Start review"}
          </button>
        </div>

        {remote?.repo && (
          <div className="mt-4">
            {prsLoading && (
              <div className="text-sm text-gray-500">Loading pull requests…</div>
            )}
            {prError && (
              <div className="text-sm text-amber-300">
                {prError} — you can still enter a number above.
              </div>
            )}
            {!prsLoading && !prError && prs.length > 0 && (
              <ul className="border border-gray-800 rounded divide-y divide-gray-800 overflow-hidden">
                {prs.map((pr) => (
                  <li key={pr.number}>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800/60 flex items-center gap-2 ${
                        String(pr.number) === number ? "bg-blue-500/10" : ""
                      }`}
                      onClick={() => setNumber(String(pr.number))}
                    >
                      <span className="text-gray-500 font-mono">#{pr.number}</span>
                      <span className="text-gray-200 truncate flex-1">
                        {pr.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          STATE_STYLE[pr.state] ?? STATE_STYLE.CLOSED
                        }`}
                      >
                        {pr.state.toLowerCase()}
                      </span>
                      <span className="text-gray-600 text-xs">@{pr.author}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!prsLoading && !prError && prs.length === 0 && (
              <div className="text-sm text-gray-500">
                No pull requests listed — enter a number above.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
