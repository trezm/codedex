import {
  LanguagePathConfig,
  registerLanguage,
  firstChildOfType,
} from "../language-config.js";

const goConfig: LanguagePathConfig = {
  id: "go",
  extensions: [".go"],
  pathNodeTypes: [
    "function_declaration",
    "method_declaration",
    // `type`/`const`/`var` declarations hold no name themselves; the spec
    // nodes inside them do, and they also handle grouped `type ( … )` blocks.
    "type_spec",
    "type_alias",
    "const_spec",
    "var_spec",
  ],
  getNodeName(node) {
    const name = node.childForFieldName("name")?.text ?? null;
    if (node.type !== "method_declaration" || !name) return name;

    // Methods are top-level in Go, so without the receiver every `String()` in
    // a package collides. Qualifying gives `Parser.Advance`, which is both
    // stable and how the method is written about.
    const receiver = node.childForFieldName("receiver");
    const declaration = firstChildOfType(receiver, "parameter_declaration");
    const receiverType = declaration
      ?.childForFieldName("type")
      ?.text.replace(/^\*/, "");
    return receiverType ? `${receiverType}.${name}` : name;
  },
  wasmFile: "tree-sitter-go.wasm",
};

registerLanguage(goConfig);

export { goConfig };
