import { useState, Fragment } from "react";
import { toSplitRows } from "@syl/core";
import type { DiffFile, DiffLine, Finding, LinkTarget } from "@syl/core";
import FindingCard from "./FindingCard";
import AnnotationNote from "./AnnotationNote";
import type { DiffAnnotation, DiffAnnotationData } from "./useDiffAnnotations";
import type { ResolvedLinks } from "../components/AnnotationBody";
import { SEVERITY_DOT } from "./severity";

export type DiffViewMode = "unified" | "split";

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

function markerClass(type: DiffLine["type"]): string {
  if (type === "add") return "text-emerald-400";
  if (type === "delete") return "text-red-400";
  return "text-gray-700";
}

function Gutter({
  value,
  type,
}: {
  value: number | null;
  type?: DiffLine["type"];
}) {
  return (
    <td
      className={`select-none text-right align-top pr-2 pl-3 w-[1%] whitespace-nowrap text-[11px] text-gray-600 border-r border-gray-800/80 ${
        type ? lineClasses(type) : ""
      }`}
    >
      {value ?? ""}
    </td>
  );
}

/** One code cell; `divider` draws the rule between the panes in split mode. */
function CodeCell({
  line,
  divider,
}: {
  line: DiffLine | null;
  divider?: boolean;
}) {
  if (!line) {
    return (
      <td
        className={`bg-gray-900/40 ${divider ? "border-r border-gray-800/80" : ""}`}
      />
    );
  }
  return (
    <td
      className={`pl-2 pr-3 whitespace-pre-wrap break-all text-gray-300 align-top ${lineClasses(
        line.type
      )} ${divider ? "border-r border-gray-800/80" : ""}`}
    >
      <span className={markerClass(line.type)}>{marker(line.type)}</span>
      {line.text}
    </td>
  );
}

/** findingKey identifies a finding globally so the sidebar can scroll to it. */
export function findingDomId(finding: Finding, index: number): string {
  return `finding-${index}-${finding.file.replace(/[^\w]/g, "_")}-${finding.line}`;
}

/** First diff line at or after `from` that still falls inside `to`, else null. */
function firstLineInRange(
  sortedLines: number[],
  from: number,
  to: number
): number | null {
  let lo = 0;
  let hi = sortedLines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedLines[mid] < from) lo = mid + 1;
    else hi = mid;
  }
  const candidate = sortedLines[lo];
  return candidate !== undefined && candidate <= to ? candidate : null;
}

interface FileDiffProps {
  file: DiffFile;
  findings: { finding: Finding; index: number }[];
  annotations: DiffAnnotation[];
  links: ResolvedLinks;
  activeFindingId: string | null;
  viewMode: DiffViewMode;
  onNavigate?: (target: LinkTarget) => void;
}

function FileDiff({
  file,
  findings,
  annotations,
  links,
  activeFindingId,
  viewMode,
  onNavigate,
}: FileDiffProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showOffDiff, setShowOffDiff] = useState(false);

  const columns = viewMode === "split" ? 4 : 3;

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

  // An annotation covers a whole node, so anchor it to the first line of that
  // node the diff actually shows — a note on a function is worth seeing next to
  // the changed line inside it, not only when the signature itself changed.
  const sortedLines = [...linesInFile].sort((a, b) => a - b);
  const notesByLine = new Map<number, DiffAnnotation[]>();
  const offDiffNotes: DiffAnnotation[] = [];
  for (const entry of annotations) {
    const line = firstLineInRange(sortedLines, entry.startLine, entry.endLine);
    if (line === null) {
      offDiffNotes.push(entry);
      continue;
    }
    const list = notesByLine.get(line) ?? [];
    list.push(entry);
    notesByLine.set(line, list);
  }

  /** Cards that hang under a rendered line: findings first, then annotations. */
  const anchoredRows = (newLine: number | null) => {
    if (newLine === null) return null;
    const findingsHere = byLine.get(newLine);
    const notesHere = notesByLine.get(newLine);
    if (!findingsHere && !notesHere) return null;
    return (
      <>
        {findingsHere?.map((entry) => (
          <tr key={`f-${entry.index}`}>
            <td colSpan={columns} className="bg-gray-950">
              <FindingCard
                finding={entry.finding}
                id={findingDomId(entry.finding, entry.index)}
                highlighted={
                  activeFindingId === findingDomId(entry.finding, entry.index)
                }
              />
            </td>
          </tr>
        ))}
        {notesHere?.map((entry) => (
          <tr key={`a-${entry.path}`}>
            <td colSpan={columns} className="bg-gray-950">
              <AnnotationNote
                entry={entry}
                links={links}
                onNavigate={onNavigate}
              />
            </td>
          </tr>
        ))}
      </>
    );
  };

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
        {annotations.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 whitespace-nowrap">
            {annotations.length} syl
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
            />
          ))}

          {offDiffNotes.length > 0 && (
            <div className="border-b border-gray-800/70">
              <button
                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300"
                onClick={() => setShowOffDiff((s) => !s)}
              >
                {showOffDiff ? "▾" : "▸"} {offDiffNotes.length} annotation
                {offDiffNotes.length === 1 ? "" : "s"} elsewhere in this file
              </button>
              {showOffDiff &&
                offDiffNotes.map((entry) => (
                  <AnnotationNote
                    key={entry.path}
                    entry={entry}
                    links={links}
                    onNavigate={onNavigate}
                  />
                ))}
            </div>
          )}

          {file.binary ? (
            <div className="px-3 py-3 text-xs text-gray-500">Binary file</div>
          ) : file.hunks.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">
              No textual changes
            </div>
          ) : (
            <table
              className={`w-full border-collapse font-mono text-[12px] leading-[1.5] ${
                viewMode === "split" ? "table-fixed" : ""
              }`}
            >
              {/* Fixed layout keeps the two panes at equal width regardless of
                  how long the longest line in either of them is. */}
              {viewMode === "split" && (
                <colgroup>
                  <col style={{ width: "3.5rem" }} />
                  <col style={{ width: "calc(50% - 3.5rem)" }} />
                  <col style={{ width: "3.5rem" }} />
                  <col style={{ width: "calc(50% - 3.5rem)" }} />
                </colgroup>
              )}
              <tbody>
                {file.hunks.map((hunk, hunkIndex) => (
                  <Fragment key={hunkIndex}>
                    <tr className="bg-sky-500/5">
                      <td
                        colSpan={columns}
                        className="px-3 py-1 text-[11px] text-sky-300/70 border-y border-gray-800"
                      >
                        {hunk.header}
                      </td>
                    </tr>
                    {viewMode === "split"
                      ? toSplitRows(hunk.lines).map((row, rowIndex) => (
                          <Fragment key={rowIndex}>
                            <tr>
                              <Gutter
                                value={row.left?.oldLine ?? null}
                                type={row.left?.type}
                              />
                              <CodeCell line={row.left} divider />
                              <Gutter
                                value={row.right?.newLine ?? null}
                                type={row.right?.type}
                              />
                              <CodeCell line={row.right} />
                            </tr>
                            {anchoredRows(row.right?.newLine ?? null)}
                          </Fragment>
                        ))
                      : hunk.lines.map((line, lineIndex) => (
                          <Fragment key={lineIndex}>
                            <tr>
                              <Gutter value={line.oldLine} type={line.type} />
                              <Gutter value={line.newLine} type={line.type} />
                              <CodeCell line={line} />
                            </tr>
                            {anchoredRows(line.newLine)}
                          </Fragment>
                        ))}
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
  viewMode,
  annotationData,
  onNavigate,
}: {
  files: DiffFile[];
  findings: Finding[];
  activeFindingId: string | null;
  viewMode: DiffViewMode;
  annotationData: DiffAnnotationData;
  onNavigate?: (target: LinkTarget) => void;
}) {
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
          annotations={annotationData.byFile[file.path] ?? []}
          links={annotationData.linksByFile[file.path] ?? {}}
          activeFindingId={activeFindingId}
          viewMode={viewMode}
          onNavigate={onNavigate}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
