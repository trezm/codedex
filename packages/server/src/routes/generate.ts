import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AnnotationStore,
  getLanguageForFile,
  createParser,
  buildSemanticPaths,
} from "@syl/core";
import { nodeFs } from "../util/node-fs.js";
import { generateAnnotations } from "../claude/generate.js";

export function generateRoutes(
  projectRoot: string,
  wasmDir: string,
  treeSitterWasmDir: string
) {
  const app = new Hono();
  const sylDir = path.join(projectRoot, ".syl");
  const store = new AnnotationStore(sylDir, nodeFs());

  // GET /api/generate/status — check if API key is configured
  app.get("/status", (c) => {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return c.json({ available: hasKey });
  });

  // POST /api/generate — generate annotations via Claude
  app.post("/", async (c) => {
    const { file, model, semanticPath } = await c.req.json<{
      file: string;
      model: string;
      semanticPath?: string;
    }>();

    if (!file || !model) {
      return c.json({ error: "file and model are required" }, 400);
    }

    const langConfig = getLanguageForFile(file);
    if (!langConfig) {
      return c.json({ error: "Unsupported file type for annotation generation" }, 400);
    }

    try {
      const filePath = path.resolve(projectRoot, file);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const wasmPath = path.join(wasmDir, langConfig.wasmFile);
      const parser = await createParser(wasmPath, treeSitterWasmDir);
      const tree = parser.parse(fileContent);
      const pathResult = buildSemanticPaths(tree, fileContent, langConfig);

      if (semanticPath && !pathResult.pathMap.has(semanticPath)) {
        return c.json({ error: `Semantic path "${semanticPath}" not found in file` }, 404);
      }

      const result = await generateAnnotations({
        model,
        filePath: file,
        fileContent,
        pathResult,
        projectRoot,
        store,
        semanticPath,
      });

      return c.json({ ok: true, count: result.count });
    } catch (e: any) {
      console.error("Generation error:", e);
      return c.json({ error: e.message || "Generation failed" }, 500);
    }
  });

  return app;
}
