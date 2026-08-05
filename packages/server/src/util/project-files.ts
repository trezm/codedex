import fs from "node:fs/promises";
import path from "node:path";

export const IGNORED = new Set([
  "node_modules",
  ".git",
  ".syl",
  "dist",
  ".next",
  "__pycache__",
  ".DS_Store",
]);

/** Directories and dotfiles the file browser and the link index both skip. */
export function isIgnoredEntry(name: string): boolean {
  return IGNORED.has(name) || name.startsWith(".");
}

export interface WalkedFile {
  /** Path relative to the project root, with forward slashes. */
  relPath: string;
  absPath: string;
}

export async function walkProjectFiles(
  projectRoot: string,
  limit = 5000
): Promise<WalkedFile[]> {
  const found: WalkedFile[] = [];

  async function walk(dir: string): Promise<void> {
    if (found.length >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= limit) return;
      if (isIgnoredEntry(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        found.push({
          relPath: path.relative(projectRoot, abs).split(path.sep).join("/"),
          absPath: abs,
        });
      }
    }
  }

  await walk(projectRoot);
  return found;
}
