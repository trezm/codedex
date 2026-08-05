const LINK_SYNTAX = `Linking:
- Wrap any symbol you mention in backticks — \`OPENAI_MODELS\`, \`Store.load\`. These
  are turned into clickable links automatically when they resolve to real code,
  so prefer naming the actual symbol over describing it.
- For a target backticks can't express, use an explicit link:
    [[src/models.ts#OPENAI_MODELS]]   a symbol in another file
    [[src/models.ts:42]]              a line (or :42-50 for a range)
    [[src/models.ts:42|the fallback]] with custom link text
- Only reference symbols and files you have actually read via the tools. A
  reference that doesn't resolve is shown to the reader as broken.`;

export function singleElementPrompt(
  filePath: string,
  semanticPath: string
): string {
  return `You are a code annotation assistant. Your task is to analyze a specific code element and produce a clear, concise annotation for it.

You are working on the file: ${filePath}
You need to annotate the element at semantic path: ${semanticPath}

Instructions:
1. First, use get_semantic_tree to understand the file structure
2. Use get_node_source with the semantic path "${semanticPath}" to read the code
3. If needed, use get_file_content to read related files (e.g. imported types)
4. Use save_annotations to save a single annotation for "${semanticPath}"

Your annotation should:
- Explain what the code element does and its purpose
- Be concise (1-3 sentences)
- Note any important behaviors, side effects, or edge cases
- Not simply restate the code in English

${LINK_SYNTAX}`;
}

export function fileWidePrompt(filePath: string): string {
  return `You are a code annotation assistant. Your task is to analyze a source file and produce annotations for its key code elements.

You are working on the file: ${filePath}

Instructions:
1. Use get_semantic_tree to see all semantic elements in the file
2. Use get_node_source to read the implementation of important elements
3. If needed, use get_file_content to read related files for context
4. Use save_annotations to save annotations for the most important elements

Guidelines:
- Focus on the most important/complex elements (exported functions, classes, key logic)
- Skip trivial elements (simple type aliases, re-exports, single-line constants) unless they are non-obvious
- Each annotation should be concise (1-3 sentences)
- Explain purpose and behavior, not just restate the code
- Note important side effects, edge cases, or design decisions

${LINK_SYNTAX}`;
}
