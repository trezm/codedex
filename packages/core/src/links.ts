/**
 * Annotation bodies can reference other places in the codebase. Two forms:
 *
 *   `Symbol`            — a code span; linked automatically when it resolves
 *   [[ref]] / [[ref|label]] — an explicit link, always rendered as one
 *
 * Both carry the same reference grammar:
 *
 *   Foo.bar                  symbol, resolved in the current file then project-wide
 *   src/models.ts            a file
 *   src/models.ts#Foo.bar    a symbol in a specific file
 *   src/models.ts:42         a line (or `:42-50` for a range)
 *   @a1b2c3d4                another annotation, by id
 */

export type LinkTarget =
  | {
      kind: "node";
      file: string;
      path: string;
      startLine: number;
      endLine: number;
    }
  | { kind: "line"; file: string; startLine: number; endLine: number }
  | {
      kind: "annotation";
      file: string;
      path: string;
      id: string;
      startLine: number;
      endLine: number;
    };

export interface ParsedRef {
  /** File the ref named, if any. */
  file?: string;
  /** Semantic path — within `file` when present, otherwise a bare symbol to search for. */
  path?: string;
  startLine?: number;
  endLine?: number;
  annotationId?: string;
}

export type BodySegment =
  | { type: "text"; text: string }
  | { type: "code"; text: string; ref: string }
  | { type: "link"; label: string; ref: string };

const FILE_EXTENSION = /\.(ts|tsx|js|jsx|mjs|cjs|py|json|md|css|html)$/i;

/** Distinguishes `src/models.ts` from a dotted semantic path like `Store.load`. */
export function looksLikeFile(ref: string): boolean {
  return ref.includes("/") || FILE_EXTENSION.test(ref);
}

export function parseRef(raw: string): ParsedRef | null {
  const ref = raw.trim();
  if (!ref) return null;

  if (ref.startsWith("@")) {
    const id = ref.slice(1).trim();
    return id ? { annotationId: id } : null;
  }

  const hash = ref.indexOf("#");
  if (hash > 0) {
    const file = ref.slice(0, hash).trim();
    const path = ref.slice(hash + 1).trim();
    return path ? { file, path } : { file };
  }

  // `file:42` or `file:42-50` — the colon must be followed by digits so that
  // TypeScript-ish refs such as `Record<string, X>` aren't mistaken for lines.
  const lineMatch = ref.match(/^(.+):(\d+)(?:-(\d+))?$/);
  if (lineMatch) {
    const startLine = parseInt(lineMatch[2], 10);
    const endLine = lineMatch[3] ? parseInt(lineMatch[3], 10) : startLine;
    return { file: lineMatch[1].trim(), startLine, endLine };
  }

  if (looksLikeFile(ref)) return { file: ref };

  return { path: ref };
}

const SEGMENT_PATTERN = /\[\[([^\]\n]+)\]\]|`([^`\n]+)`/g;

export function parseAnnotationBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(SEGMENT_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ type: "text", text: body.slice(cursor, start) });
    }

    if (match[1] !== undefined) {
      const pipe = match[1].indexOf("|");
      const ref = (pipe === -1 ? match[1] : match[1].slice(0, pipe)).trim();
      const label =
        pipe === -1 ? ref : match[1].slice(pipe + 1).trim() || ref;
      segments.push({ type: "link", ref, label });
    } else {
      segments.push({ type: "code", text: match[2], ref: match[2].trim() });
    }

    cursor = start + match[0].length;
  }

  if (cursor < body.length) {
    segments.push({ type: "text", text: body.slice(cursor) });
  }

  return segments;
}

/** Every distinct reference in a body, for batch resolution. */
export function collectRefs(body: string): string[] {
  const refs = new Set<string>();
  for (const segment of parseAnnotationBody(body)) {
    if (segment.type !== "text" && segment.ref) refs.add(segment.ref);
  }
  return [...refs];
}
