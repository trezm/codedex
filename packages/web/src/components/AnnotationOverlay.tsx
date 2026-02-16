import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { Annotation } from "@syl/core";

export interface AnnotationBracket {
  path: string;
  startLine: number;
  endLine: number;
  column: number;
  body: string;
  count: number;
  annotations: Annotation[];
}

interface AnnotationOverlayProps {
  editorView: EditorView | null;
  annotations: AnnotationBracket[];
  totalLines: number;
  onSelectPath: (path: string | null) => void;
  selectedPath: string | null;
}

const COLUMN_WIDTH = 18;
const TEXT_OFFSET = 8;

export default function AnnotationOverlay({
  editorView,
  annotations,
  totalLines,
  onSelectPath,
  selectedPath,
}: AnnotationOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(18.4);
  const [paddingTop, setPaddingTop] = useState(0);

  // Read line height and padding from editor
  useEffect(() => {
    if (!editorView) return;
    setLineHeight(editorView.defaultLineHeight);
    // The editor content area has top padding from the gutters/content offset
    const contentTop = editorView.contentDOM.getBoundingClientRect().top;
    const scrollTop = editorView.scrollDOM.getBoundingClientRect().top;
    setPaddingTop(contentTop - scrollTop + editorView.scrollDOM.scrollTop);
  }, [editorView, annotations]);

  // Sync scroll with the CodeMirror editor
  useEffect(() => {
    if (!editorView) return;
    const scroller = editorView.scrollDOM;
    const handler = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scroller.scrollTop;
      }
    };
    // Initial sync
    handler();
    scroller.addEventListener("scroll", handler);
    return () => scroller.removeEventListener("scroll", handler);
  }, [editorView]);

  const maxColumn =
    annotations.length > 0
      ? Math.max(...annotations.map((a) => a.column))
      : 0;
  const bracketsWidth = (maxColumn + 1) * COLUMN_WIDTH + TEXT_OFFSET;
  const contentHeight = totalLines * lineHeight + paddingTop;

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-hidden border-l border-gray-800 bg-gray-950/80"
      style={{ minWidth: 200, maxWidth: 400 }}
    >
      <div style={{ height: contentHeight, position: "relative", paddingTop }}>
        {annotations.map((bracket) => {
          const top = (bracket.startLine - 1) * lineHeight;
          const height = (bracket.endLine - bracket.startLine + 1) * lineHeight;
          const left = bracket.column * COLUMN_WIDTH;
          const isSelected = bracket.path === selectedPath;
          const bracketColor = isSelected ? "#60a5fa" : "#4b5563";
          const textColor = isSelected ? "text-blue-300" : "text-gray-500";

          return (
            <div
              key={bracket.path}
              className="absolute cursor-pointer group"
              style={{ top, left, height, right: 0 }}
              onClick={() => onSelectPath(bracket.path)}
            >
              {/* Vertical bracket line */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: bracketColor,
                }}
              />
              {/* Top tick */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: 6,
                  height: 1,
                  backgroundColor: bracketColor,
                }}
              />
              {/* Bottom tick */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  bottom: 0,
                  width: 6,
                  height: 1,
                  backgroundColor: bracketColor,
                }}
              />
              {/* Annotation text */}
              <div
                className={`absolute truncate text-xs leading-tight ${textColor} group-hover:text-gray-300`}
                style={{
                  left: bracketsWidth - left,
                  top: 1,
                  right: 8,
                  lineHeight: `${lineHeight}px`,
                }}
                title={
                  bracket.count > 1
                    ? bracket.annotations
                        .map((a) => `${a.author}: ${a.body}`)
                        .join("\n")
                    : bracket.body
                }
              >
                {bracket.count > 1 && (
                  <span className="text-gray-600 mr-1">[{bracket.count}]</span>
                )}
                {bracket.body}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
