import fs from "node:fs/promises";
import type { FileSystem } from "@syl/core";

export function nodeFs(): FileSystem {
  return {
    async readFile(p: string) {
      return fs.readFile(p, "utf-8");
    },
    async writeFile(p: string, content: string) {
      await fs.writeFile(p, content, "utf-8");
    },
    async mkdir(p: string) {
      await fs.mkdir(p, { recursive: true });
    },
    async exists(p: string) {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    },
  };
}
