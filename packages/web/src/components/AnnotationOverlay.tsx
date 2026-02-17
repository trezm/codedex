import { useEffect, useRef, useState, useCallback } from "react";
import type { EditorView } from "@codemirror/view";
import type { Annotation } from "@syl/core";
import { addAnnotation, updateAnnotation, deleteAnnotation } from "../api";

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
  filePath: string;
  onSelectPath: (path: string | null) => void;
  selectedPath: string | null;
  onAnnotationsChanged: () => void;
}

const COLUMN_WIDTH = 18;

const BRACKET_COLORS = [
  { line: "#8b5cf6", text: "text-violet-400" },
  { line: "#3b82f6", text: "text-blue-400" },
  { line: "#10b981", text: "text-emerald-400" },
  { line: "#f59e0b", text: "text-amber-400" },
  { line: "#ef4444", text: "text-red-400" },
  { line: "#ec4899", text: "text-pink-400" },
  { line: "#06b6d4", text: "text-cyan-400" },
  { line: "#84cc16", text: "text-lime-400" },
];

function getColor(column: number) {
  return BRACKET_COLORS[column % BRACKET_COLORS.length];
}

function ExpandableContent({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    if (expanded) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      // Read current height first so transition works from actual → 0
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [expanded]);

  // After expand transition ends, switch to auto height so content can reflow
  const handleTransitionEnd = useCallback(() => {
    if (expanded && contentRef.current) {
      contentRef.current.style.height = "auto";
    }
  }, [expanded]);

  return (
    <div
      ref={contentRef}
      style={{
        height: expanded ? height : 0,
        opacity: expanded ? 1 : 0,
        overflow: "hidden",
        transition: "height 200ms ease-out, opacity 150ms ease-out",
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}

function InlineAnnotationCard({
  annotation,
  filePath,
  semanticPath,
  onChanged,
}: {
  annotation: Annotation;
  filePath: string;
  semanticPath: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(annotation.body);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateAnnotation(annotation.id, filePath, semanticPath, body);
    setEditing(false);
    onChanged();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteAnnotation(annotation.id, filePath, semanticPath);
    onChanged();
  };

  if (editing) {
    return (
      <div
        className="mb-1 bg-gray-900/90 rounded px-2 py-1.5 border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded p-1.5 text-xs resize-none focus:outline-none focus:border-blue-500"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 mt-1">
          <button
            className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 rounded text-white"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(false);
              setBody(annotation.body);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1 bg-gray-900/90 rounded px-2 py-1 border border-gray-700/50 group/card">
      <div className="whitespace-pre-wrap break-words">{annotation.body}</div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="text-[10px] text-gray-500">{annotation.author}</div>
        <div className="flex gap-2 text-[10px] text-gray-600 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <button
            className="hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button className="hover:text-red-400" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAnnotationForm({
  filePath,
  semanticPath,
  onChanged,
  onClose,
}: {
  filePath: string;
  semanticPath: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");

  const submit = async () => {
    if (!body.trim()) return;
    await addAnnotation(filePath, semanticPath, body.trim(), author.trim() || "anonymous");
    setBody("");
    onChanged();
    onClose();
  };

  return (
    <div
      className="mt-1 bg-gray-900/90 rounded px-2 py-1.5 border border-gray-700/50"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded px-1.5 py-0.5 text-xs mb-1 focus:outline-none focus:border-blue-500"
        placeholder="Author (optional)"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <textarea
        className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded p-1.5 text-xs resize-none focus:outline-none focus:border-blue-500"
        rows={2}
        placeholder="Write annotation..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.metaKey) {
            e.preventDefault();
            submit();
          }
        }}
        autoFocus
      />
      <div className="flex gap-2 mt-1">
        <button
          className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 rounded text-white"
          onClick={(e) => { e.stopPropagation(); submit(); }}
        >
          Add
        </button>
        <button
          className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AnnotationOverlay({
  editorView,
  annotations,
  totalLines,
  filePath,
  onSelectPath,
  selectedPath,
  onAnnotationsChanged,
}: AnnotationOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(18.4);
  const [paddingTop, setPaddingTop] = useState(0);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [addingPath, setAddingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!editorView) return;
    setLineHeight(editorView.defaultLineHeight);
    const contentTop = editorView.contentDOM.getBoundingClientRect().top;
    const scrollTop = editorView.scrollDOM.getBoundingClientRect().top;
    setPaddingTop(contentTop - scrollTop + editorView.scrollDOM.scrollTop);
  }, [editorView, annotations]);

  useEffect(() => {
    if (!editorView) return;
    const scroller = editorView.scrollDOM;
    const handler = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scroller.scrollTop;
      }
    };
    handler();
    scroller.addEventListener("scroll", handler);
    return () => scroller.removeEventListener("scroll", handler);
  }, [editorView]);

  const maxColumn =
    annotations.length > 0
      ? Math.max(...annotations.map((a) => a.column))
      : 0;
  const bracketsWidth = (maxColumn + 1) * COLUMN_WIDTH;
  const contentHeight = totalLines * lineHeight + paddingTop;

  const handleClick = (bracket: AnnotationBracket) => {
    onSelectPath(bracket.path);
    setExpandedPath((prev) => (prev === bracket.path ? null : bracket.path));
  };

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-hidden border-l border-gray-800 bg-gray-950/80 flex-shrink-0"
      style={{ width: Math.max(bracketsWidth + 220, 280), maxWidth: 500 }}
    >
      <div style={{ height: contentHeight, position: "relative", paddingTop }}>
        {annotations.map((bracket) => {
          const top = (bracket.startLine - 1) * lineHeight;
          const height =
            (bracket.endLine - bracket.startLine + 1) * lineHeight;
          const left = bracket.column * COLUMN_WIDTH;
          const isExpanded = expandedPath === bracket.path;
          const isSelected = bracket.path === selectedPath;
          const color = getColor(bracket.column);
          const bracketColor = color.line;
          const opacity = isSelected || isExpanded ? 1 : 0.5;

          return (
            <div
              key={bracket.path}
              className="absolute cursor-pointer group"
              style={{ top, left, height, right: 0 }}
              onClick={() => handleClick(bracket)}
            >
              {/* Vertical bracket line */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: bracketColor,
                  opacity,
                  borderRadius: 1,
                  transition: "opacity 200ms ease",
                }}
              />
              {/* Top tick */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: isExpanded ? 12 : 8,
                  height: 2,
                  backgroundColor: bracketColor,
                  opacity,
                  borderRadius: 1,
                  transition: "opacity 200ms ease, width 200ms ease",
                }}
              />
              {/* Bottom tick */}
              <div
                className="absolute"
                style={{
                  left: 0,
                  bottom: 0,
                  width: isExpanded ? 12 : 8,
                  height: 2,
                  backgroundColor: bracketColor,
                  opacity,
                  borderRadius: 1,
                  transition: "opacity 200ms ease, width 200ms ease",
                }}
              />
              {/* Annotation content — smooth expand/collapse */}
              <div
                className={`absolute ${color.text}`}
                style={{
                  left: bracketsWidth - left + 8,
                  top: 0,
                  right: 8,
                  minWidth: 200,
                }}
              >
                <ExpandableContent expanded={isExpanded}>
                  <div style={{ lineHeight: `${lineHeight}px` }} className="text-xs">
                    <div className="text-[10px] font-mono text-gray-500 mb-1 truncate">
                      {bracket.path}
                      <span className="ml-1 text-gray-600">
                        L{bracket.startLine}
                        {bracket.startLine !== bracket.endLine
                          ? `\u2013${bracket.endLine}`
                          : ""}
                      </span>
                    </div>
                    {bracket.annotations.map((a) => (
                      <InlineAnnotationCard
                        key={a.id}
                        annotation={a}
                        filePath={filePath}
                        semanticPath={bracket.path}
                        onChanged={onAnnotationsChanged}
                      />
                    ))}
                    {addingPath === bracket.path ? (
                      <AddAnnotationForm
                        filePath={filePath}
                        semanticPath={bracket.path}
                        onChanged={onAnnotationsChanged}
                        onClose={() => setAddingPath(null)}
                      />
                    ) : (
                      <button
                        className="w-full mt-1 px-2 py-0.5 text-[10px] bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingPath(bracket.path);
                        }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </ExpandableContent>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
