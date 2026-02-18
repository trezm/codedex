import type Anthropic from "@anthropic-ai/sdk";

export const toolSchemas: Anthropic.Tool[] = [
  {
    name: "get_semantic_tree",
    description:
      "Get the semantic tree of the current file being annotated. Returns a hierarchical structure of named code elements (functions, classes, variables, etc.) with their semantic paths, kinds, and line ranges. Use this to understand the file structure before annotating.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_node_source",
    description:
      "Get the source code of a specific semantic node by its path. Use this to read the implementation details of a function, class, or other code element before writing an annotation for it.",
    input_schema: {
      type: "object" as const,
      properties: {
        semantic_path: {
          type: "string",
          description:
            "The semantic path of the node (e.g. 'MyClass.myMethod', 'processData')",
        },
      },
      required: ["semantic_path"],
    },
  },
  {
    name: "get_file_content",
    description:
      "Read the full content of a file in the project. Use this to understand imports, dependencies, or related code in other files.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Relative path to the file from the project root",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "save_annotations",
    description:
      "Save annotations for one or more semantic paths. Call this when you have analyzed the code and are ready to write annotations. Each annotation should be a concise, insightful description of what the code element does, its purpose, and any important details.",
    input_schema: {
      type: "object" as const,
      properties: {
        annotations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              semantic_path: {
                type: "string",
                description: "The semantic path of the code element",
              },
              body: {
                type: "string",
                description:
                  "The annotation text. Should be concise but informative.",
              },
            },
            required: ["semantic_path", "body"],
          },
          description: "Array of annotations to save",
        },
      },
      required: ["annotations"],
    },
  },
];
