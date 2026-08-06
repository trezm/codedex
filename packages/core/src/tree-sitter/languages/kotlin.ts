import {
  LanguagePathConfig,
  registerLanguage,
  firstChildOfType,
} from "../language-config.js";

const kotlinConfig: LanguagePathConfig = {
  id: "kotlin",
  extensions: [".kt", ".kts"],
  pathNodeTypes: [
    "function_declaration",
    // Covers `class`, `interface`, `enum class` and `data class` alike.
    "class_declaration",
    "object_declaration",
    "companion_object",
    "property_declaration",
    "enum_entry",
  ],
  /**
   * tree-sitter-kotlin exposes no `name` field on any declaration, so the
   * shared field lookup finds nothing and every node would be dropped. Names
   * come from the first identifier child instead, past any `modifiers` node
   * (`data class Pair` puts `data` first).
   */
  getNodeName(node) {
    if (node.type === "companion_object") {
      // Anonymous in the source; Kotlin itself calls it Companion.
      return firstChildOfType(node, "type_identifier")?.text ?? "Companion";
    }

    if (node.type === "property_declaration") {
      const declaration = firstChildOfType(node, "variable_declaration");
      return (
        firstChildOfType(declaration, "simple_identifier")?.text ??
        declaration?.text ??
        null
      );
    }

    return (
      firstChildOfType(node, "type_identifier", "simple_identifier")?.text ??
      null
    );
  },
  wasmFile: "tree-sitter-kotlin.wasm",
};

registerLanguage(kotlinConfig);

export { kotlinConfig };
