import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";

/**
 * Syntax highlighting, resolved per file extension.
 *
 * Every entry is a dynamic import so the grammars land in their own chunks —
 * loading all of these eagerly adds ~490 kB to the main bundle, versus ~10 kB
 * when they are split. The cost is that highlighting arrives a frame after the
 * text, which `CodeViewer` handles by reconfiguring a compartment.
 *
 * Languages with a real Lezer parser get one; the rest fall back to a
 * `StreamLanguage` from @codemirror/legacy-modes, which is regex-based and
 * coarser (no nesting) but still far better than plain text.
 */
type Loader = () => Promise<Extension>;

/** Wraps a legacy CodeMirror 5 mode as a CodeMirror 6 language. */
function legacy(load: () => Promise<any>, exportName: string): Loader {
  return async () => StreamLanguage.define((await load())[exportName]);
}

const javascript = (options: Record<string, boolean>): Loader =>
  async () => (await import("@codemirror/lang-javascript")).javascript(options);

const clike = (exportName: string): Loader =>
  legacy(() => import("@codemirror/legacy-modes/mode/clike"), exportName);

const LOADERS: Record<string, Loader> = {
  // --- Lezer parsers ---
  ts: javascript({ typescript: true }),
  mts: javascript({ typescript: true }),
  cts: javascript({ typescript: true }),
  tsx: javascript({ typescript: true, jsx: true }),
  js: javascript({}),
  mjs: javascript({}),
  cjs: javascript({}),
  jsx: javascript({ jsx: true }),
  py: async () => (await import("@codemirror/lang-python")).python(),
  pyi: async () => (await import("@codemirror/lang-python")).python(),
  rs: async () => (await import("@codemirror/lang-rust")).rust(),
  go: async () => (await import("@codemirror/lang-go")).go(),
  java: async () => (await import("@codemirror/lang-java")).java(),
  c: async () => (await import("@codemirror/lang-cpp")).cpp(),
  h: async () => (await import("@codemirror/lang-cpp")).cpp(),
  cc: async () => (await import("@codemirror/lang-cpp")).cpp(),
  cpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  cxx: async () => (await import("@codemirror/lang-cpp")).cpp(),
  hpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  php: async () => (await import("@codemirror/lang-php")).php(),
  sql: async () => (await import("@codemirror/lang-sql")).sql(),
  xml: async () => (await import("@codemirror/lang-xml")).xml(),
  svg: async () => (await import("@codemirror/lang-xml")).xml(),
  json: async () => (await import("@codemirror/lang-json")).json(),
  jsonc: async () => (await import("@codemirror/lang-json")).json(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  less: async () => (await import("@codemirror/lang-css")).css(),
  html: async () => (await import("@codemirror/lang-html")).html(),
  htm: async () => (await import("@codemirror/lang-html")).html(),
  yaml: async () => (await import("@codemirror/lang-yaml")).yaml(),
  yml: async () => (await import("@codemirror/lang-yaml")).yaml(),
  vue: async () => (await import("@codemirror/lang-vue")).vue(),
  md: async () => (await import("@codemirror/lang-markdown")).markdown(),
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),

  // --- legacy stream modes ---
  kt: clike("kotlin"),
  kts: clike("kotlin"),
  cs: clike("csharp"),
  scala: clike("scala"),
  sc: clike("scala"),
  dart: clike("dart"),
  m: clike("objectiveC"),
  mm: clike("objectiveCpp"),
  swift: legacy(() => import("@codemirror/legacy-modes/mode/swift"), "swift"),
  rb: legacy(() => import("@codemirror/legacy-modes/mode/ruby"), "ruby"),
  lua: legacy(() => import("@codemirror/legacy-modes/mode/lua"), "lua"),
  sh: legacy(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  bash: legacy(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  zsh: legacy(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  toml: legacy(() => import("@codemirror/legacy-modes/mode/toml"), "toml"),
  scss: legacy(() => import("@codemirror/legacy-modes/mode/sass"), "sass"),
  sass: legacy(() => import("@codemirror/legacy-modes/mode/sass"), "sass"),
  clj: legacy(() => import("@codemirror/legacy-modes/mode/clojure"), "clojure"),
  elm: legacy(() => import("@codemirror/legacy-modes/mode/elm"), "elm"),
  erl: legacy(() => import("@codemirror/legacy-modes/mode/erlang"), "erlang"),
  hs: legacy(() => import("@codemirror/legacy-modes/mode/haskell"), "haskell"),
  groovy: legacy(() => import("@codemirror/legacy-modes/mode/groovy"), "groovy"),
  r: legacy(() => import("@codemirror/legacy-modes/mode/r"), "r"),
  pl: legacy(() => import("@codemirror/legacy-modes/mode/perl"), "perl"),
  pm: legacy(() => import("@codemirror/legacy-modes/mode/perl"), "perl"),
  ps1: legacy(
    () => import("@codemirror/legacy-modes/mode/powershell"),
    "powershell"
  ),
  proto: legacy(
    () => import("@codemirror/legacy-modes/mode/protobuf"),
    "protobuf"
  ),
  ml: legacy(() => import("@codemirror/legacy-modes/mode/mllike"), "oCaml"),
  mli: legacy(() => import("@codemirror/legacy-modes/mode/mllike"), "oCaml"),
  diff: legacy(() => import("@codemirror/legacy-modes/mode/diff"), "diff"),
  patch: legacy(() => import("@codemirror/legacy-modes/mode/diff"), "diff"),
  dockerfile: legacy(
    () => import("@codemirror/legacy-modes/mode/dockerfile"),
    "dockerfile"
  ),
  properties: legacy(
    () => import("@codemirror/legacy-modes/mode/properties"),
    "properties"
  ),
};

/** Filenames that carry their language without an extension. */
const BY_FILENAME: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "properties",
  gemfile: "rb",
  rakefile: "rb",
};

export function hasHighlighting(filePath: string): boolean {
  return resolveLoader(filePath) !== null;
}

function resolveLoader(filePath: string): Loader | null {
  const name = filePath.split("/").pop()?.toLowerCase() ?? "";
  const byName = BY_FILENAME[name];
  if (byName) return LOADERS[byName] ?? null;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return LOADERS[name.slice(dot + 1)] ?? null;
}

/**
 * Resolves the highlighting extension for a file, or null when the language
 * isn't supported. A failed chunk load is treated as "no highlighting" rather
 * than breaking the viewer.
 */
export async function loadLanguageExtension(
  filePath: string
): Promise<Extension | null> {
  const loader = resolveLoader(filePath);
  if (!loader) return null;
  try {
    return await loader();
  } catch (e) {
    console.warn(`Failed to load highlighting for ${filePath}`, e);
    return null;
  }
}
