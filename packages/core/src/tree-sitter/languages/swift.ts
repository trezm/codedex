import { LanguagePathConfig, registerLanguage } from "../language-config.js";

/** tree-sitter-swift models struct/class/enum/actor/extension as one node type. */
const DECLARATION_KEYWORDS = ["struct", "class", "enum", "actor", "extension"];

const swiftConfig: LanguagePathConfig = {
  id: "swift",
  extensions: [".swift"],
  pathNodeTypes: [
    "function_declaration",
    "protocol_function_declaration",
    "class_declaration",
    "protocol_declaration",
    "property_declaration",
    "enum_entry",
  ],
  getNodeName(node) {
    const name = node.childForFieldName("name")?.text ?? null;
    if (node.type !== "class_declaration" || !name) return name;

    // An extension reuses the name of the type it extends, so `struct Parser`
    // and `extension Parser` both report "Parser" and would collide. The
    // keyword is the only thing telling them apart — it isn't a field, so read
    // it off the children (skipping any attributes or modifiers in front).
    let keyword: string | null = null;
    for (let i = 0; i < node.childCount; i++) {
      const type = node.child(i)?.type;
      if (type && DECLARATION_KEYWORDS.includes(type)) {
        keyword = type;
        break;
      }
    }
    return keyword === "extension" ? `extension ${name}` : name;
  },
  wasmFile: "tree-sitter-swift.wasm",
};

registerLanguage(swiftConfig);

export { swiftConfig };
