import { useEffect, useRef, useMemo } from "react";
import {
  EditorView,
  gutter,
  GutterMarker,
  lineNumbers,
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import { EditorState, StateField, StateEffect, RangeSet } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import type { SemanticPathResult } from "@syl/core";

interface CodeViewerProps {
  content: string;
  filePath: string;
  pathResult: SemanticPathResult | null;
  annotatedPaths: Set<string>;
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
  onViewReady?: (view: EditorView | null) => void;
  /** Scroll to and briefly highlight a line; `nonce` re-triggers the same line. */
  reveal?: { line: number; nonce: number } | null;
}

class AnnotationMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("span");
    el.textContent = "\u25CF";
    el.style.color = "#60a5fa";
    return el;
  }
}

const annotationMarker = new AnnotationMarker();

const setAnnotationLines = StateEffect.define<Set<number>>();

const annotationLinesField = StateField.define<Set<number>>({
  create() {
    return new Set();
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setAnnotationLines)) return effect.value;
    }
    return value;
  },
});

function annotationGutter() {
  return gutter({
    class: "cm-annotation-gutter",
    markers(view) {
      const lines = view.state.field(annotationLinesField);
      return RangeSet.of(
        Array.from(lines)
          .filter((line) => line >= 1 && line <= view.state.doc.lines)
          .sort((a, b) => a - b)
          .map((line) => annotationMarker.range(view.state.doc.line(line).from))
      );
    },
    initialSpacer: () => annotationMarker,
  });
}

const setHighlightLine = StateEffect.define<number | null>();

const highlightLineDecoration = Decoration.line({
  class: "cm-syl-target-line",
});

const highlightLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setHighlightLine)) continue;
      const line = effect.value;
      if (line === null || line < 1 || line > tr.state.doc.lines) {
        return Decoration.none;
      }
      return Decoration.set([
        highlightLineDecoration.range(tr.state.doc.line(line).from),
      ]);
    }
    return tr.docChanged ? Decoration.none : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function getLanguageExtension(filePath: string) {
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath))
    return javascript({
      typescript: /\.tsx?$/.test(filePath),
      jsx: /\.[jt]sx$/.test(filePath),
    });
  if (/\.py$/.test(filePath)) return python();
  return [];
}

export default function CodeViewer({
  content,
  filePath,
  pathResult,
  annotatedPaths,
  selectedPath,
  onSelectPath,
  onViewReady,
  reveal,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const clickRef = useRef(onSelectPath);
  const pathResultRef = useRef(pathResult);
  clickRef.current = onSelectPath;
  pathResultRef.current = pathResult;

  const annotatedLines = useMemo(() => {
    if (!pathResult) return new Set<number>();
    const lines = new Set<number>();
    for (const [path, node] of pathResult.pathMap) {
      if (annotatedPaths.has(path)) {
        lines.add(node.startLine);
      }
    }
    return lines;
  }, [pathResult, annotatedPaths]);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          getLanguageExtension(filePath),
          oneDark,
          lineNumbers(),
          annotationLinesField,
          annotationGutter(),
          highlightLineField,
          EditorView.domEventHandlers({
            click(event, view) {
              const pr = pathResultRef.current;
              if (!pr) return;
              const pos = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              });
              if (pos === null) return;
              const line = view.state.doc.lineAt(pos).number;
              const paths = pr.lineToPath.get(line);
              if (paths && paths.length > 0) {
                clickRef.current(paths[paths.length - 1]);
              } else {
                clickRef.current(null);
              }
            },
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px" },
            ".cm-scroller": { overflow: "auto" },
            ".cm-annotation-gutter": { width: "16px" },
            ".cm-gutters": { borderRight: "1px solid #374151" },
            ".cm-lineNumbers .cm-gutterElement": {
              color: "#6b7280",
              fontSize: "12px",
            },
            ".cm-syl-target-line": {
              backgroundColor: "rgba(96, 165, 250, 0.18)",
              outline: "1px solid rgba(96, 165, 250, 0.35)",
            },
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    onViewReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
      onViewReady?.(null);
    };
  }, [content, filePath]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setAnnotationLines.of(annotatedLines) });
  }, [annotatedLines]);

  // Deliberately keyed on `reveal` alone: re-running this when `content`
  // changes would re-apply a stale line number to a newly opened file.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (!reveal) {
      view.dispatch({ effects: setHighlightLine.of(null) });
      return;
    }
    const line = Math.min(Math.max(reveal.line, 1), view.state.doc.lines);
    const pos = view.state.doc.line(line).from;
    view.dispatch({
      effects: [
        setHighlightLine.of(line),
        EditorView.scrollIntoView(pos, { y: "center" }),
      ],
    });
  }, [reveal]);

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
