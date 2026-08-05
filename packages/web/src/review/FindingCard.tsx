import type { Finding } from "@syl/core";
import { SEVERITY_STYLE, CATEGORY_LABEL } from "./severity";

export default function FindingCard({
  finding,
  id,
  highlighted,
}: {
  finding: Finding;
  id?: string;
  highlighted?: boolean;
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
