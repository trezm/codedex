import { LanguagePathConfig, registerLanguage } from "../language-config.js";

const typescriptConfig: LanguagePathConfig = {
  id: "typescript",
  extensions: [".ts", ".tsx"],
  pathNodeTypes: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "interface_declaration",
    "enum_declaration",
    "type_alias_declaration",
    "variable_declarator",
  ],
  getNodeName(node) {
    const nameNode = node.childForFieldName("name");
    return nameNode?.text ?? null;
  },
  wasmFile: "tree-sitter-typescript.wasm",
};

registerLanguage(typescriptConfig);

export { typescriptConfig };
