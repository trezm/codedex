import Parser from "web-tree-sitter";

let initialized = false;
let storedLocateDir: string | undefined;

export async function initTreeSitter(locateDir?: string): Promise<void> {
  if (initialized) return;
  if (locateDir) storedLocateDir = locateDir;
  await Parser.init({
    locateFile: (scriptName: string) => {
      if (storedLocateDir) return `${storedLocateDir}/${scriptName}`;
      return scriptName;
    },
  });
  initialized = true;
}

export async function createParser(wasmPath: string, treeSitterWasmDir?: string): Promise<Parser> {
  await initTreeSitter(treeSitterWasmDir);
  const parser = new Parser();
  const lang = await Parser.Language.load(wasmPath);
  parser.setLanguage(lang);
  return parser;
}

export { Parser };
