import { useState, useEffect, useRef } from "react";
import type { SemanticNode } from "@syl/core";
import { buildSemanticPaths, getLanguageForFile } from "@syl/core";
import type { SemanticPathResult } from "@syl/core";
import Parser from "web-tree-sitter";

let initPromise: Promise<void> | null = null;
const parserCache = new Map<string, Parser>();

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: (scriptName: string) => `/wasm/${scriptName}`,
    });
  }
  return initPromise;
}

async function getParser(wasmFile: string): Promise<Parser> {
  if (parserCache.has(wasmFile)) return parserCache.get(wasmFile)!;
  await ensureInit();
  const parser = new Parser();
  const lang = await Parser.Language.load(`/wasm/${wasmFile}`);
  parser.setLanguage(lang);
  parserCache.set(wasmFile, parser);
  return parser;
}

export interface UseTreeSitterResult {
  pathResult: SemanticPathResult | null;
  loading: boolean;
  error: string | null;
}

export function useTreeSitter(
  filePath: string | null,
  content: string | null
): UseTreeSitterResult {
  const [pathResult, setPathResult] = useState<SemanticPathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath || content === null) {
      setPathResult(null);
      return;
    }

    const langConfig = getLanguageForFile(filePath);
    if (!langConfig) {
      setPathResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const parser = await getParser(langConfig.wasmFile);
        const tree = parser.parse(content);
        const result = buildSemanticPaths(tree, content, langConfig);
        if (!cancelled) {
          setPathResult(result);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath, content]);

  return { pathResult, loading, error };
}
