import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class CommandError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly stderr: string
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export interface RunOptions {
  cwd: string;
  /** Diffs can be large; default 32 MB. */
  maxBuffer?: number;
  /** Written to the child's stdin, for commands that read a payload there. */
  input?: string;
}

export async function run(
  command: string,
  args: string[],
  options: RunOptions
): Promise<string> {
  try {
    const child = execFileAsync(command, args, {
      cwd: options.cwd,
      maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    });
    if (options.input !== undefined) {
      child.child.stdin?.end(options.input);
    }
    const { stdout } = await child;
    return stdout;
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      throw new CommandError(
        `\`${command}\` was not found on PATH.`,
        command,
        ""
      );
    }
    const stderr = (e?.stderr ?? "").toString().trim();
    throw new CommandError(
      stderr || e?.message || `\`${command}\` failed`,
      command,
      stderr
    );
  }
}
