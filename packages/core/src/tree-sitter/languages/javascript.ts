import { LanguagePathConfig, registerLanguage } from "../language-config.js";

const javascriptConfig: LanguagePathConfig = {
  id: "javascript",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  pathNodeTypes: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "variable_declarator",
  ],
  getNodeName(node) {
    const nameNode = node.childForFieldName("name");
    return nameNode?.text ?? null;
  },
  wasmFile: "tree-sitter-javascript.wasm",
};

registerLanguage(javascriptConfig);

export { javascriptConfig };
