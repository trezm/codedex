import { useState, useCallback, useEffect, useMemo } from "react";
import type { Annotation, SemanticNode } from "@syl/core";
import type { EditorView } from "@codemirror/view";
import FileBrowser from "./components/FileBrowser";
import CodeViewer from "./components/CodeViewer";
import AnnotationOverlay, {
  AnnotationBracket,
} from "./components/AnnotationOverlay";
import ModelSelector, { useSelectedModel } from "./components/ModelSelector";
import GenerateButton from "./components/GenerateButton";
import { useTreeSitter } from "./hooks/useTreeSitter";
import {
  fetchFileContent,
  resolveAnnotations,
  generateAnnotation,
  generateFileAnnotations,
  checkGenerateStatus,
  ResolveResponse,
} from "./api";

function buildBrackets(
  nodes: SemanticNode[],
  annotations: Record<string, Annotation[]>,
  depth: number
): AnnotationBracket[] {
  const result: AnnotationBracket[] = [];
  for (const node of nodes) {
    const anns = annotations[node.path] ?? [];
    result.push({
      path: node.path,
      startLine: node.startLine,
      endLine: node.endLine,
      column: depth,
      body: anns.length > 0 ? anns[0].body : "",
      count: anns.length,
      annotations: anns,
    });
    result.push(...buildBrackets(node.children, annotations, depth + 1));
  }
  return result;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [resolvedData, setResolvedData] = useState<ResolveResponse | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [generateAvailable, setGenerateAvailable] = useState(false);
  const { model, selectModel } = useSelectedModel();

  const { pathResult } = useTreeSitter(selectedFile, fileContent);

  // Check if generation is available (API key is set)
  useEffect(() => {
    checkGenerateStatus().then((s) => setGenerateAvailable(s.available)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      setSelectedPath(null);
      setResolvedData(null);
      return;
    }
    let cancelled = false;
    fetchFileContent(selectedFile).then((data) => {
      if (!cancelled) setFileContent(data.content);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    resolveAnnotations(selectedFile).then((data) => {
      if (!cancelled) setResolvedData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFile, refreshKey]);

  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path);
    setSelectedPath(null);
  }, []);

  const handleSelectPath = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const handleAnnotationsChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleGenerate = useCallback(
    async (semanticPath: string) => {
      if (!selectedFile) return;
      await generateAnnotation(selectedFile, model, semanticPath);
    },
    [selectedFile, model]
  );

  const handleGenerateFile = useCallback(async () => {
    if (!selectedFile) return;
    await generateFileAnnotations(selectedFile, model);
    handleAnnotationsChanged();
  }, [selectedFile, model, handleAnnotationsChanged]);

  const annotatedPaths = new Set(
    resolvedData ? Object.keys(resolvedData.annotations) : []
  );

  const annotationBrackets = useMemo(() => {
    if (!pathResult || !resolvedData) return [];
    return buildBrackets(pathResult.roots, resolvedData.annotations, 0);
  }, [pathResult, resolvedData]);

  const totalLines = fileContent ? fileContent.split("\n").length : 0;

  const showOverlay = selectedFile && annotationBrackets.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center px-4 py-2 border-b border-gray-800 bg-gray-950">
        <h1 className="text-sm font-semibold tracking-wide text-gray-300">
          syl
        </h1>
        {selectedFile && (
          <span className="ml-3 text-xs text-gray-500 font-mono">
            {selectedFile}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {generateAvailable && (
            <>
              <ModelSelector model={model} onSelect={selectModel} />
              {selectedFile && pathResult && pathResult.roots.length > 0 && (
                <GenerateButton
                  label="Generate File"
                  onClick={handleGenerateFile}
                  size="md"
                />
              )}
            </>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 flex-shrink-0">
          <FileBrowser
            onSelect={handleFileSelect}
            selectedFile={selectedFile}
          />
        </div>
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {fileContent !== null && selectedFile ? (
              <CodeViewer
                content={fileContent}
                filePath={selectedFile}
                pathResult={pathResult}
                annotatedPaths={annotatedPaths}
                selectedPath={selectedPath}
                onSelectPath={handleSelectPath}
                onViewReady={setEditorView}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">
                Select a file to view
              </div>
            )}
          </div>
          {showOverlay && (
            <AnnotationOverlay
              editorView={editorView}
              annotations={annotationBrackets}
              totalLines={totalLines}
              filePath={selectedFile!}
              onSelectPath={handleSelectPath}
              selectedPath={selectedPath}
              onAnnotationsChanged={handleAnnotationsChanged}
              onGenerate={generateAvailable ? handleGenerate : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
