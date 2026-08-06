import { LanguagePathConfig, registerLanguage } from "../language-config.js";

const rustConfig: LanguagePathConfig = {
  id: "rust",
  extensions: [".rs"],
  pathNodeTypes: [
    "function_item",
    // Trait method signatures, so a trait's members are addressable too.
    "function_signature_item",
    "struct_item",
    "enum_item",
    "union_item",
    "trait_item",
    "impl_item",
    "mod_item",
    "type_item",
    "const_item",
    "static_item",
    "macro_definition",
  ],
  getNodeName(node) {
    // `impl` blocks carry no `name` field — they have `type`, plus `trait` for
    // trait impls. The keyword is kept in the segment on purpose: `struct
    // Parser` and `impl Parser` are both top-level and would otherwise collide
    // into Parser[1]/Parser[2], where inserting an impl block renumbers the
    // other and orphans its annotations.
    if (node.type === "impl_item") {
      const target = node.childForFieldName("type")?.text;
      if (!target) return null;
      const trait = node.childForFieldName("trait")?.text;
      return trait ? `impl ${trait} for ${target}` : `impl ${target}`;
    }
    return node.childForFieldName("name")?.text ?? null;
  },
  wasmFile: "tree-sitter-rust.wasm",
};

registerLanguage(rustConfig);

export { rustConfig };
