import { LanguagePathConfig, registerLanguage } from "../language-config.js";

const pythonConfig: LanguagePathConfig = {
  id: "python",
  extensions: [".py"],
  pathNodeTypes: [
    "function_definition",
    "class_definition",
  ],
  getNodeName(node) {
    const nameNode = node.childForFieldName("name");
    return nameNode?.text ?? null;
  },
  wasmFile: "tree-sitter-python.wasm",
};

registerLanguage(pythonConfig);

export { pythonConfig };
