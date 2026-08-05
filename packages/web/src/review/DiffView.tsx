import { useState, Fragment } from "react";
import type {
  DiffFile,
  DiffLine,
  Finding,
  DraftComment,
  ReviewCommentSide,
} from "@syl/core";
import FindingCard, { type FindingAnchorState } from "./FindingCard";
import CommentComposer from "./CommentComposer";
import DraftCommentCard from "./DraftCommentCard";
import { SEVERITY_DOT } from "./severity";

const STATUS_STYLE: Record<string, string> = {
  added: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  deleted: "bg-red-500/15 text-red-300 border-red-500/40",
  renamed: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  modified: "bg-gray-500/15 text-gray-400 border-gray-500/40",
};

function lineClasses(type: DiffLine["type"]): string {
  if (type === "add") return "bg-emerald-500/10";
  if (type === "delete") return "bg-red-500/10";
  return "";
}

function marker(type: DiffLine["type"]): string {
  if (type === "add") return "+";
  if (type === "delete") return "-";
  return " ";
}

function Gutter({
  value,
  onAdd,
}: {
  value: number | null;
  onAdd?: () => void;
}) {
  return (
    <td className="relative select-none text-right align-top pr-2 pl-3 w-[1%] whitespace-nowrap text-[11px] text-gray-600 border-r border-gray-800/80">
      {onAdd && (
        <button
          className="absolute inset-0 opacity-0 group-hover/row:opacity-100 flex items-center justify-center bg-blue-500/30 text-blue-100 hover:bg-blue-500/60 transition-opacity"
          title="Comment on this line"
          onClick={onAdd}
        >
          +
        </button>
      )}
      {value ?? ""}
    </td>
  );
}

/** findingKey identifies a finding globally so the sidebar can scroll to it. */
export function findingDomId(finding: Finding, index: number): string {
  return `finding-${index}-${finding.file.replace(/[^\w]/g, "_")}-${finding.line}`;
}

/** Where a "+" on a given diff row would place a GitHub comment. */
function commentTargetFor(
  line: DiffLine
): { line: number; side: ReviewCommentSide } | null {
  if (line.newLine !== null) return { line: line.newLine, side: "RIGHT" };
  if (line.oldLine !== null) return { line: line.oldLine, side: "LEFT" };
  return null;
}

export interface CommentHandlers {
  comments: DraftComment[];
  onAddComment: (input: {
    path: string;
    line: number;
    side: ReviewCommentSide;
    body: string;
  }) => Promise<void>;
  onEditComment: (id: string, body: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  findingAnchorState: (finding: Finding) => FindingAnchorState;
  onAddFinding: (finding: Finding) => Promise<void>;
}

interface FileDiffProps extends CommentHandlers {
  file: DiffFile;
  findings: { finding: Finding; index: number }[];
  activeFindingId: string | null;
}

function FileDiff({
  file,
  findings,
  activeFindingId,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  findingAnchorState,
  onAddFinding,
}: FileDiffProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [composing, setComposing] = useState<{
    line: number;
    side: ReviewCommentSide;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Anchor findings to the new-file line they name; anything that doesn't land
  // on a line in the diff is shown at the top of the file instead of dropped.
  const byLine = new Map<number, { finding: Finding; index: number }[]>();
  const unanchored: { finding: Finding; index: number }[] = [];
  const linesInFile = new Set<number>();
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.newLine !== null) linesInFile.add(line.newLine);
    }
  }
  for (const entry of findings) {
    if (linesInFile.has(entry.finding.line)) {
      const list = byLine.get(entry.finding.line) ?? [];
      list.push(entry);
      byLine.set(entry.finding.line, list);
    } else {
      unanchored.push(entry);
    }
  }

  // Staged comments hang off the same rows, keyed by side so a comment on a
  // deleted line doesn't surface against the new-file line of the same number.
  const draftsByTarget = new Map<string, DraftComment[]>();
  for (const comment of comments) {
    if (comment.path !== file.path) continue;
    const key = `${comment.side}:${comment.line}`;
    const list = draftsByTarget.get(key) ?? [];
    list.push(comment);
    draftsByTarget.set(key, list);
  }

  const renderDraft = (comment: DraftComment) => (
    <DraftCommentCard
      key={comment.id}
      comment={comment}
      onEdit={(body) => onEditComment(comment.id, body)}
      onDelete={() => onDeleteComment(comment.id)}
    />
  );

  const fileDraftCount = comments.filter((c) => c.path === file.path).length;

  return (
    <div className="border border-gray-800 rounded-md overflow-hidden mb-4 bg-gray-950">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/70 border-b border-gray-800 sticky top-0 z-10">
        <button
          className="text-gray-500 hover:text-gray-300 text-xs w-4"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <span className="font-mono text-xs text-gray-200 truncate flex-1">
          {file.status === "renamed" && file.oldPath
            ? `${file.oldPath} → ${file.path}`
            : file.path}
        </span>
        {fileDraftCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300">
            {fileDraftCount} pending
          </span>
        )}
        {findings.length > 0 && (
          <span className="flex items-center gap-1">
            {findings.map((f) => (
              <span
                key={f.index}
                className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[f.finding.severity]}`}
              />
            ))}
          </span>
        )}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border ${
            STATUS_STYLE[file.status] ?? STATUS_STYLE.modified
          }`}
        >
          {file.status}
        </span>
        <span className="text-[11px] font-mono whitespace-nowrap">
          <span className="text-emerald-400">+{file.additions}</span>{" "}
          <span className="text-red-400">−{file.deletions}</span>
        </span>
      </div>

      {!collapsed && (
        <>
          {unanchored.map((entry) => (
            <FindingCard
              key={entry.index}
              finding={entry.finding}
              id={findingDomId(entry.finding, entry.index)}
              highlighted={
                activeFindingId === findingDomId(entry.finding, entry.index)
              }
              anchorState={findingAnchorState(entry.finding)}
              onAddToReview={() => onAddFinding(entry.finding)}
            />
          ))}

          {file.binary ? (
            <div className="px-3 py-3 text-xs text-gray-500">Binary file</div>
          ) : file.hunks.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">
              No textual changes
            </div>
          ) : (
            <table className="w-full border-collapse font-mono text-[12px] leading-[1.5]">
              <tbody>
                {file.hunks.map((hunk, hunkIndex) => (
                  <Fragment key={hunkIndex}>
                    <tr className="bg-sky-500/5">
                      <td
                        colSpan={3}
                        className="px-3 py-1 text-[11px] text-sky-300/70 border-y border-gray-800"
                      >
                        {hunk.header}
                      </td>
                    </tr>
                    {hunk.lines.map((line, lineIndex) => {
                      const anchored =
                        line.newLine !== null ? byLine.get(line.newLine) : undefined;
                      const target = commentTargetFor(line);
                      const drafts = target
                        ? draftsByTarget.get(`${target.side}:${target.line}`)
                        : undefined;
                      const isComposing =
                        composing !== null &&
                        target !== null &&
                        composing.line === target.line &&
                        composing.side === target.side;

                      return (
                        <Fragment key={lineIndex}>
                          <tr className={`group/row ${lineClasses(line.type)}`}>
                            <Gutter value={line.oldLine} />
                            <Gutter
                              value={line.newLine}
                              onAdd={
                                target
                                  ? () => {
                                      setComposeError(null);
                                      setComposing(target);
                                    }
                                  : undefined
                              }
                            />
                            <td className="pl-2 pr-3 whitespace-pre-wrap break-all text-gray-300">
                              <span
                                className={
                                  line.type === "add"
                                    ? "text-emerald-400"
                                    : line.type === "delete"
                                      ? "text-red-400"
                                      : "text-gray-700"
                                }
                              >
                                {marker(line.type)}
                              </span>
                              {line.text}
                            </td>
                          </tr>

                          {anchored?.map((entry) => (
                            <tr key={`f-${entry.index}`}>
                              <td colSpan={3} className="bg-gray-950">
                                <FindingCard
                                  finding={entry.finding}
                                  id={findingDomId(entry.finding, entry.index)}
                                  highlighted={
                                    activeFindingId ===
                                    findingDomId(entry.finding, entry.index)
                                  }
                                  anchorState={findingAnchorState(entry.finding)}
                                  onAddToReview={() => onAddFinding(entry.finding)}
                                />
                              </td>
                            </tr>
                          ))}

                          {drafts?.map((comment) => (
                            <tr key={comment.id}>
                              <td colSpan={3} className="bg-gray-950">
                                {renderDraft(comment)}
                              </td>
                            </tr>
                          ))}

                          {isComposing && target && (
                            <tr>
                              <td colSpan={3} className="bg-gray-950">
                                <div className="my-2 mx-3">
                                  <CommentComposer
                                    submitLabel="Add comment"
                                    busy={saving}
                                    onSubmit={async (body) => {
                                      setSaving(true);
                                      setComposeError(null);
                                      try {
                                        await onAddComment({
                                          path: file.path,
                                          line: target.line,
                                          side: target.side,
                                          body,
                                        });
                                        setComposing(null);
                                      } catch (e: any) {
                                        setComposeError(e.message);
                                      } finally {
                                        setSaving(false);
                                      }
                                    }}
                                    onCancel={() => {
                                      setComposing(null);
                                      setComposeError(null);
                                    }}
                                  />
                                  {composeError && (
                                    <p className="mt-1 text-[11px] text-red-300">
                                      {composeError}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default function DiffView({
  files,
  findings,
  activeFindingId,
  ...handlers
}: {
  files: DiffFile[];
  findings: Finding[];
  activeFindingId: string | null;
} & CommentHandlers) {
  const indexed = findings.map((finding, index) => ({ finding, index }));
  const byFile = new Map<string, { finding: Finding; index: number }[]>();
  for (const entry of indexed) {
    const list = byFile.get(entry.finding.file) ?? [];
    list.push(entry);
    byFile.set(entry.finding.file, list);
  }

  const diffPaths = new Set(files.map((f) => f.path));
  const orphaned = indexed.filter((e) => !diffPaths.has(e.finding.file));

  return (
    <div>
      {files.map((file) => (
        <FileDiff
          key={file.path}
          file={file}
          findings={byFile.get(file.path) ?? []}
          activeFindingId={activeFindingId}
          {...handlers}
        />
      ))}

      {orphaned.length > 0 && (
        <div className="border border-gray-800 rounded-md overflow-hidden mb-4 bg-gray-950">
          <div className="px-3 py-2 bg-gray-900/70 border-b border-gray-800 text-xs text-gray-400">
            Findings outside the diff ({orphaned.length}) — the reviewer named a
            file that isn&apos;t in this pull request
          </div>
          {orphaned.map((entry) => (
            <FindingCard
              key={entry.index}
              finding={entry.finding}
              id={findingDomId(entry.finding, entry.index)}
              highlighted={
                activeFindingId === findingDomId(entry.finding, entry.index)
              }
              anchorState={handlers.findingAnchorState(entry.finding)}
              onAddToReview={() => handlers.onAddFinding(entry.finding)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
