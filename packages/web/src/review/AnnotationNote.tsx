import { useEffect, useState } from "react";
import { parseAnnotationBody, type LinkTarget } from "@syl/core";
import AnnotationBody, { type ResolvedLinks } from "../components/AnnotationBody";
import type { DiffAnnotation } from "./useDiffAnnotations";

/** Body text with the `code` and [[ref]] markup stripped, for the collapsed preview. */
function plainText(body: string): string {
  return parseAnnotationBody(body)
    .map((segment) => (segment.type === "link" ? segment.label : segment.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An existing Syl annotation shown inside the review diff. Read-only on
 * purpose: the diff is the pull request's code, while annotations belong to the
 * working copy, so editing happens in the annotate tab.
 *
 * The header collapses the note so a heavily annotated file can still be read as
 * a diff. `defaultCollapsed` carries the review-wide setting; a note that the
 * reader has since toggled themselves keeps their choice until that setting
 * changes again.
 */
export default function AnnotationNote({
  entry,
  links,
  defaultCollapsed = false,
  onNavigate,
}: {
  entry: DiffAnnotation;
  links: ResolvedLinks;
  defaultCollapsed?: boolean;
  onNavigate?: (target: LinkTarget) => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  useEffect(() => setCollapsed(defaultCollapsed), [defaultCollapsed]);

  const count = entry.annotations.length;
  const preview = count > 0 ? plainText(entry.annotations[0].body) : "";

  return (
    <div className="my-2 mx-3 rounded-md border border-violet-500/30 bg-violet-500/5">
      <button
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-500/10 ${
          collapsed ? "" : "border-b border-violet-500/20"
        }`}
        title={collapsed ? "Expand annotation" : "Collapse annotation"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-violet-400/70 text-[10px] w-2">
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-violet-500/40 bg-violet-500/15 text-violet-300">
          syl
        </span>
        <span className="font-mono text-[11px] text-gray-400 truncate">
          {entry.path}
        </span>
        <span className="text-[10px] text-gray-600 whitespace-nowrap">
          L{entry.startLine}
          {entry.startLine !== entry.endLine ? `–${entry.endLine}` : ""}
        </span>
        {collapsed && (
          <>
            <span className="text-[11px] text-gray-500 truncate flex-1 min-w-0">
              {preview}
            </span>
            {count > 1 && (
              <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                +{count - 1} more
              </span>
            )}
          </>
        )}
      </button>
      {!collapsed && (
        <div className="px-3 py-2 space-y-2">
          {entry.annotations.map((annotation) => (
            <div key={annotation.id} className="text-xs text-gray-300 leading-relaxed">
              <AnnotationBody
                body={annotation.body}
                links={links}
                onNavigate={onNavigate}
              />
              <div className="text-[10px] text-gray-500 mt-0.5">
                {annotation.author}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
