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

## PR Review

The **Review** tab runs a two-stage review over a GitHub pull request, in the
style of [firstpass](https://github.com/trezm/firstpass): a cheap **scout** model
triages the diff into focus areas, then a stronger **reviewer** produces only
high-confidence findings.

Syl reads the git remotes of whatever project it is pointed at, you pick a remote
and a PR number, and the result opens as a GitHub-style review page: the diff with
findings anchored as inline comments on the line they refer to, plus a findings
sidebar and the reviewer's summary. The diff renders **unified or side-by-side** —
the toggle sits next to "New review" and is remembered between reviews.

Your own annotations show up in that diff too. For every file the pull request
touches, Syl resolves the annotations in `.syl/` and drops them inline, anchored
to the first line of the annotated node the diff actually shows — so a note on a
function appears next to the changed line inside it. Annotations whose node isn't
in the diff at all are collapsed behind a per-file toggle, and links inside them
jump to the annotate tab. Annotations live in your working copy rather than in
the pull request, so this is best-effort: a file your checkout doesn't have (or a
symbol that has since moved) simply contributes nothing. Editing stays in the
annotate tab — the review diff shows them read-only.

Requires the [GitHub CLI](https://cli.github.com/) on your `PATH` and
authenticated (`gh auth login`) — it is used for `pr list`, `pr view`,
`pr diff`, and posting reviews.

### Posting comments back to GitHub

Findings aren't read-only. Each one has an **Add to review** button that stages
it as an inline comment pre-filled with the finding's body, and every line of
the diff has a `+` in the gutter for writing your own. Staged comments show as
`PENDING` at the line they'll land on and can be edited or deleted first.

This works in both view modes. In side-by-side, the left gutter comments on
deleted lines and the right on added or unchanged ones, matching the side
GitHub files them under.

The **Review** bar at the bottom submits them as a *single* GitHub review —
optional overall body, plus Comment / Request changes / Approve — which is the
same thing as reviewing on github.com, not a scatter of standalone comments.

Two things worth knowing:

- GitHub only accepts inline comments on lines the diff touches. Syl checks
  every anchor against the parsed diff before staging and refuses early, rather
  than letting the whole submission fail. A finding that names a line outside
  the diff is marked *Not on a diff line* and can't be staged.
- Submitting posts publicly as your authenticated `gh` user and can't be undone
  from Syl. The button always names the exact payload — comment count, repo and
  PR — before you press it. Drafts live in memory with the run, so restarting
  the server discards anything unsubmitted.

Model defaults are `claude-haiku-4-5` for the scout and `claude-opus-5` for the
reviewer, falling back to whatever is actually runnable. Both stages go through
the `claude`/`codex` CLI when available, so a review costs subscription usage
rather than API tokens. Runs are held in memory, so restarting the server clears
them.

## Links in Annotations

Annotations can point at other places in the codebase. Any symbol you wrap in
backticks becomes a link when it resolves:

```
Replaced by the `SYL_OPENAI_MODELS` env override — see `OPENAI_MODELS`.
```

Resolution runs against a project-wide index: the current file first, then the
whole project. A backtick span that is ambiguous or matches nothing stays plain
text, so prose is never mangled into a wrong link.

For targets a bare symbol can't express, use an explicit link:

| Syntax | Links to |
| --- | --- |
| `[[src/models.ts]]` | a file |
| `[[src/models.ts#OPENAI_MODELS]]` | a symbol in a specific file |
| `[[src/models.ts:42]]` / `[[src/models.ts:42-50]]` | a line or line range |
| `[[@a1b2c3d4]]` | another annotation, by id |
| `[[src/models.ts:42\|the fallback]]` | any of the above, with custom link text |

Unlike backticks, an explicit `[[...]]` that fails to resolve is shown struck
through — a broken link is surfaced rather than silently rendered as prose.

Clicking a link opens the target file and highlights the line. Generated
annotations use this syntax too; the prompt tells the model to reference real
symbols rather than describe them.

## AI-Generated Annotations

Syl can draft annotations for you with either Claude or ChatGPT.

**Syl prefers the CLIs.** If [`claude`](https://docs.claude.com/en/docs/claude-code)
or [`codex`](https://developers.openai.com/codex/cli) is on your `PATH`, model
calls go through it — which means they run on your existing subscription instead
of per-token API billing. API keys are the fallback for whichever provider has no
CLI installed:

| Provider | Preferred | Fallback |
| --- | --- | --- |
| Claude | `claude` CLI | `ANTHROPIC_API_KEY` |
| ChatGPT | `codex` CLI | `OPENAI_API_KEY` |

The model picker marks each model `· cli` or `· api` so you can see which one is
about to bill you, and the review page records the backend used for each stage.
Set `SYL_PREFER_SDK=1` to force the API path.

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # only needed without the claude CLI
export OPENAI_API_KEY=sk-...          # only needed without the codex CLI
```

| Provider | Models |
| --- | --- |
| Claude | Opus 5 (default), Sonnet 5, Haiku 4.5 |
| ChatGPT | GPT-5, GPT-5 mini, GPT-4.1, GPT-4o |

OpenAI model availability varies by account and tier. To use a different set,
override the list:

```bash
SYL_OPENAI_MODELS=gpt-5,o4-mini npm run dev
```

Generated annotations are stored with an author of `claude` or `chatgpt`, so you
can tell them apart from your own.

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
