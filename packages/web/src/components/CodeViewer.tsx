import { useEffect, useRef, useMemo } from "react";
import { EditorView, gutter, GutterMarker, lineNumbers } from "@codemirror/view";
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

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
