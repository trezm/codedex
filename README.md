# Syl

Annotate codebases without polluting source code. Annotations are stored in separate JSON files, addressed by **tree-sitter semantic paths** — human-readable dot-separated paths like `Parser.parse` derived by walking the syntax tree.

## Quick Start

```bash
npm install
npm run dev
```

This starts both the API server (port 3000) and the web UI (port 5173). Open http://localhost:5173.

By default, Syl annotates the project in the current working directory. To point at a different project:

```bash
SYL_PROJECT_ROOT=/path/to/project npm run dev
```

## How It Works

1. **Select a file** in the sidebar
2. **Click a function/class name** in the code viewer — the annotation panel shows the semantic path
3. **Add an annotation** — it's saved to `.syl/<file>.json` on disk
4. **Rename the function** in source — the annotation shows as orphaned on next load

## Architecture

```
packages/
├── core/       ← tree-sitter path builder + annotation store
├── server/     ← Hono API: file serving + annotation CRUD
└── web/        ← Vite + React: CodeMirror viewer + annotation UI
```

## Storage

Annotations live in `.syl/` at the project root, mirroring the source tree:

```
.syl/
└── src/
    └── parser.ts.json
```

Each file contains annotations keyed by semantic path:

```json
{
  "version": 1,
  "sourceFile": "src/parser.ts",
  "annotations": {
    "Parser.parse": [
      {
        "id": "a1b2c3d4",
        "body": "Uses incremental parsing for performance",
        "author": "pete",
        "created": "2024-01-15T10:30:00Z",
        "updated": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

## Supported Languages

- TypeScript / TSX
- JavaScript / JSX
- Python
