import { useState, useEffect } from "react";
import { fetchFileTree, FileNode } from "../api";

interface FileBrowserProps {
  onSelect: (path: string) => void;
  selectedFile: string | null;
}

function FileTreeNode({
  node,
  onSelect,
  selectedFile,
  depth,
}: {
  node: FileNode;
  onSelect: (path: string) => void;
  selectedFile: string | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className="flex items-center w-full text-left px-2 py-0.5 hover:bg-gray-800 text-gray-400 text-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="mr-1 w-4 text-center text-xs">
            {expanded ? "▾" : "▸"}
          </span>
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              onSelect={onSelect}
              selectedFile={selectedFile}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;
  return (
    <button
      className={`flex items-center w-full text-left px-2 py-0.5 text-sm ${
        isSelected
          ? "bg-blue-900/50 text-blue-200"
          : "hover:bg-gray-800 text-gray-300"
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={() => onSelect(node.path)}
    >
      {node.name}
    </button>
  );
}

export default function FileBrowser({
  onSelect,
  selectedFile,
}: FileBrowserProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFileTree()
      .then(setTree)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-gray-950 border-r border-gray-800">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800">
        Files
      </div>
      {loading ? (
        <div className="p-3 text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="py-1">
          {tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              onSelect={onSelect}
              selectedFile={selectedFile}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
