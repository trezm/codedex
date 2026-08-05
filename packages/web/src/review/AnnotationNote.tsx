import type { LinkTarget } from "@syl/core";
import AnnotationBody, { type ResolvedLinks } from "../components/AnnotationBody";
import type { DiffAnnotation } from "./useDiffAnnotations";

/**
 * An existing Syl annotation shown inside the review diff. Read-only on
 * purpose: the diff is the pull request's code, while annotations belong to the
 * working copy, so editing happens in the annotate tab.
 */
export default function AnnotationNote({
  entry,
  links,
  onNavigate,
}: {
  entry: DiffAnnotation;
  links: ResolvedLinks;
  onNavigate?: (target: LinkTarget) => void;
}) {
  return (
    <div className="my-2 mx-3 rounded-md border border-violet-500/30 bg-violet-500/5">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-violet-500/20">
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
      </div>
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
    </div>
  );
}
