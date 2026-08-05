import { parseAnnotationBody, type LinkTarget } from "@syl/core";

export type ResolvedLinks = Record<string, LinkTarget | null>;

function targetTitle(target: LinkTarget): string {
  if (target.kind === "node") return `${target.file} · ${target.path}`;
  if (target.kind === "annotation") {
    return `annotation on ${target.path} in ${target.file}`;
  }
  const lines =
    target.startLine === target.endLine
      ? `L${target.startLine}`
      : `L${target.startLine}–${target.endLine}`;
  return `${target.file} · ${lines}`;
}

function LinkChip({
  label,
  target,
  mono,
  onNavigate,
}: {
  label: string;
  target: LinkTarget;
  mono: boolean;
  onNavigate: (target: LinkTarget) => void;
}) {
  return (
    <button
      className={`underline decoration-dotted underline-offset-2 hover:text-blue-300 hover:decoration-solid ${
        mono ? "font-mono text-[11px] bg-gray-800/60 rounded px-1" : ""
      }`}
      title={targetTitle(target)}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(target);
      }}
    >
      {label}
    </button>
  );
}

/**
 * Renders an annotation body, turning `code spans` and [[refs]] into links when
 * the server managed to resolve them. Unresolved refs stay readable text.
 */
export default function AnnotationBody({
  body,
  links,
  onNavigate,
}: {
  body: string;
  links: ResolvedLinks;
  onNavigate?: (target: LinkTarget) => void;
}) {
  const segments = parseAnnotationBody(body);

  return (
    <div className="whitespace-pre-wrap break-words">
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          return <span key={i}>{segment.text}</span>;
        }

        const target = links[segment.ref];
        const label = segment.type === "code" ? segment.text : segment.label;

        if (target && onNavigate) {
          return (
            <LinkChip
              key={i}
              label={label}
              target={target}
              mono={segment.type === "code"}
              onNavigate={onNavigate}
            />
          );
        }

        if (segment.type === "code") {
          return (
            <code
              key={i}
              className="font-mono text-[11px] bg-gray-800/60 rounded px-1"
            >
              {label}
            </code>
          );
        }

        // An explicit [[ref]] that didn't resolve — flag it rather than hiding it.
        return (
          <span
            key={i}
            className="text-gray-500 line-through decoration-gray-600"
            title={`Unresolved reference: ${segment.ref}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
