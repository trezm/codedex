import { useState } from "react";
import type { Annotation, SemanticNode } from "@syl/core";
import { addAnnotation, updateAnnotation, deleteAnnotation } from "../api";

interface AnnotationPanelProps {
  filePath: string | null;
  selectedPath: string | null;
  selectedNode: SemanticNode | null;
  annotations: Annotation[];
  orphanedPaths: { path: string; annotations: Annotation[] }[];
  onAnnotationsChanged: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AnnotationCard({
  annotation,
  filePath,
  semanticPath,
  onChanged,
  startLine,
  endLine,
}: {
  annotation: Annotation;
  filePath: string;
  semanticPath: string;
  onChanged: () => void;
  startLine?: number;
  endLine?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(annotation.body);

  const handleSave = async () => {
    await updateAnnotation(annotation.id, filePath, semanticPath, body);
    setEditing(false);
    onChanged();
  };

  const handleDelete = async () => {
    await deleteAnnotation(annotation.id, filePath, semanticPath);
    onChanged();
  };

  return (
    <div className="border border-gray-700 rounded-md p-3 bg-gray-900/50">
      {editing ? (
        <div>
          <textarea
            className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded p-2 text-sm resize-none focus:outline-none focus:border-blue-500"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
              onClick={() => {
                setEditing(false);
                setBody(annotation.body);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {annotation.body}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>
              {annotation.author} &middot; {formatDate(annotation.updated)}
              {startLine != null && endLine != null && (
                <>
                  {" "}&middot;{" "}
                  <span className="font-mono">
                    L{startLine}{startLine !== endLine ? `\u2013${endLine}` : ""}
                  </span>
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button
                className="hover:text-gray-300"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="hover:text-red-400"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnotationPanel({
  filePath,
  selectedPath,
  selectedNode,
  annotations,
  orphanedPaths,
  onAnnotationsChanged,
}: AnnotationPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  const handleAdd = async () => {
    if (!filePath || !selectedPath || !newBody.trim()) return;
    await addAnnotation(filePath, selectedPath, newBody.trim(), newAuthor.trim() || "anonymous");
    setNewBody("");
    setAdding(false);
    onAnnotationsChanged();
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-950 border-l border-gray-800">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800">
        Annotations
      </div>

      <div className="p-3">
        {!filePath && (
          <p className="text-gray-500 text-sm">Select a file to view annotations</p>
        )}

        {filePath && !selectedPath && (
          <p className="text-gray-500 text-sm">
            Click on a function, class, or variable name in the code to select it
          </p>
        )}

        {filePath && selectedPath && (
          <div>
            <div className="mb-3">
              <div className="text-sm font-mono text-blue-300 bg-gray-900 px-2 py-1 rounded border border-gray-700">
                {selectedPath}
              </div>
              {selectedNode && (
                <div className="text-xs text-gray-500 mt-1">
                  {selectedNode.kind.replace(/_/g, " ")} &middot; lines{" "}
                  {selectedNode.startLine}–{selectedNode.endLine}
                </div>
              )}
            </div>

            <div className="space-y-2 mb-3">
              {annotations.length === 0 && !adding && (
                <p className="text-gray-500 text-sm">No annotations yet</p>
              )}
              {annotations.map((a) => (
                <AnnotationCard
                  key={a.id}
                  annotation={a}
                  filePath={filePath}
                  semanticPath={selectedPath}
                  onChanged={onAnnotationsChanged}
                  startLine={selectedNode?.startLine}
                  endLine={selectedNode?.endLine}
                />
              ))}
            </div>

            {adding ? (
              <div className="border border-gray-700 rounded-md p-3 bg-gray-900/50">
                <input
                  className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-blue-500"
                  placeholder="Author (optional)"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
                <textarea
                  className="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded p-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Write your annotation..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white"
                    onClick={handleAdd}
                  >
                    Add
                  </button>
                  <button
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    onClick={() => {
                      setAdding(false);
                      setNewBody("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-blue-300"
                onClick={() => setAdding(true)}
              >
                + Add Annotation
              </button>
            )}
          </div>
        )}

        {orphanedPaths.length > 0 && (
          <div className="mt-6 border-t border-gray-800 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-yellow-500 mb-2">
              Orphaned Annotations
            </div>
            {orphanedPaths.map(({ path, annotations: orphanAnnotations }) => (
              <div key={path} className="mb-2">
                <div className="text-xs font-mono text-yellow-400/70 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
                  {path}
                </div>
                <div className="mt-1 space-y-1">
                  {orphanAnnotations.map((a) => (
                    <div
                      key={a.id}
                      className="text-xs text-gray-400 pl-2 border-l border-yellow-700/30"
                    >
                      {a.body}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
