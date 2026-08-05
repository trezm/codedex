export type DiffLineType = "context" | "add" | "delete";

export interface DiffLine {
  type: DiffLineType;
  /** Line number in the old file, or null for added lines. */
  oldLine: number | null;
  /** Line number in the new file, or null for deleted lines. */
  newLine: number | null;
  text: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export type DiffFileStatus = "added" | "deleted" | "modified" | "renamed";

export interface DiffFile {
  /** Path in the new tree (or the old one for deletions). */
  path: string;
  oldPath: string | null;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function stripPrefix(path: string): string {
  if (path === "/dev/null") return path;
  return path.replace(/^[ab]\//, "");
}

/**
 * Parses `git diff` / `gh pr diff` output. Tolerant by design: anything it
 * doesn't recognise is skipped rather than throwing, so one odd file header
 * can't blank out an entire review.
 */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diff.split("\n");

  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldCursor = 0;
  let newCursor = 0;

  const closeFile = () => {
    if (file) files.push(file);
    file = null;
    hunk = null;
  };

  for (const raw of lines) {
    if (raw.startsWith("diff --git ")) {
      closeFile();
      const match = raw.match(/^diff --git (.+?) (.+)$/);
      const oldPath = match ? stripPrefix(match[1]) : "";
      const newPath = match ? stripPrefix(match[2]) : "";
      file = {
        path: newPath || oldPath,
        oldPath: oldPath || null,
        status: "modified",
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      continue;
    }

    if (!file) continue;

    if (raw.startsWith("new file mode")) {
      file.status = "added";
      continue;
    }
    if (raw.startsWith("deleted file mode")) {
      file.status = "deleted";
      continue;
    }
    if (raw.startsWith("rename from ")) {
      file.oldPath = raw.slice("rename from ".length).trim();
      file.status = "renamed";
      continue;
    }
    if (raw.startsWith("rename to ")) {
      file.path = raw.slice("rename to ".length).trim();
      file.status = "renamed";
      continue;
    }
    if (raw.startsWith("Binary files ") || raw.startsWith("GIT binary patch")) {
      file.binary = true;
      continue;
    }
    if (raw.startsWith("--- ")) {
      const p = stripPrefix(raw.slice(4).trim());
      if (p !== "/dev/null") file.oldPath = p;
      continue;
    }
    if (raw.startsWith("+++ ")) {
      const p = stripPrefix(raw.slice(4).trim());
      if (p !== "/dev/null") file.path = p;
      continue;
    }
    if (raw.startsWith("index ") || raw.startsWith("similarity index")) {
      continue;
    }

    const hunkMatch = raw.match(HUNK_HEADER);
    if (hunkMatch) {
      hunk = {
        header: raw,
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };
      file.hunks.push(hunk);
      oldCursor = hunk.oldStart;
      newCursor = hunk.newStart;
      continue;
    }

    if (!hunk) continue;

    // "\ No newline at end of file" annotates the previous line.
    if (raw.startsWith("\\")) continue;

    const marker = raw[0];
    const text = raw.slice(1);

    if (marker === "+") {
      hunk.lines.push({ type: "add", oldLine: null, newLine: newCursor, text });
      newCursor++;
      file.additions++;
    } else if (marker === "-") {
      hunk.lines.push({
        type: "delete",
        oldLine: oldCursor,
        newLine: null,
        text,
      });
      oldCursor++;
      file.deletions++;
    } else if (marker === " " || raw === "") {
      hunk.lines.push({
        type: "context",
        oldLine: oldCursor,
        newLine: newCursor,
        text,
      });
      oldCursor++;
      newCursor++;
    }
  }

  closeFile();
  return files;
}

/** One row of a side-by-side diff: old file on the left, new file on the right. */
export interface DiffSplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Rearranges a hunk's lines into side-by-side rows. Runs of deletions and
 * additions are paired positionally, which is what makes a rewritten line read
 * as one row rather than two; a leftover on either side gets an empty cell.
 */
export function toSplitRows(lines: DiffLine[]): DiffSplitRow[] {
  const rows: DiffSplitRow[] = [];
  let deletes: DiffLine[] = [];
  let adds: DiffLine[] = [];

  const flush = () => {
    const pairs = Math.max(deletes.length, adds.length);
    for (let i = 0; i < pairs; i++) {
      rows.push({ left: deletes[i] ?? null, right: adds[i] ?? null });
    }
    deletes = [];
    adds = [];
  };

  for (const line of lines) {
    if (line.type === "delete") {
      deletes.push(line);
    } else if (line.type === "add") {
      adds.push(line);
    } else {
      flush();
      rows.push({ left: line, right: line });
    }
  }
  flush();

  return rows;
}

/** Total added/removed lines across a parsed diff. */
export function diffTotals(files: DiffFile[]): {
  additions: number;
  deletions: number;
} {
  return files.reduce(
    (acc, f) => ({
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions,
    }),
    { additions: 0, deletions: 0 }
  );
}
