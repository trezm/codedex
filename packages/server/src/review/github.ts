import type {
  GitRemote,
  PullRequestSummary,
  PullRequestMeta,
} from "@syl/core";
import { run, CommandError } from "./exec.js";

/** Extract "owner/repo" from any of the URL shapes git remotes come in. */
export function parseRepoFromUrl(url: string): string | null {
  const cleaned = url.trim().replace(/\.git$/, "");
  const match = cleaned.match(/[/:]([^/:]+\/[^/:]+)$/);
  return match ? match[1] : null;
}

export async function listRemotes(projectRoot: string): Promise<GitRemote[]> {
  const stdout = await run("git", ["remote", "-v"], { cwd: projectRoot });
  const remotes = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
    if (match) remotes.set(match[1], match[2]);
  }
  // Fall back to push URLs if a remote is push-only.
  if (remotes.size === 0) {
    for (const line of stdout.split("\n")) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\(push\)$/);
      if (match) remotes.set(match[1], match[2]);
    }
  }
  return [...remotes].map(([name, url]) => ({
    name,
    url,
    repo: parseRepoFromUrl(url),
  }));
}

async function gh<T>(args: string[], projectRoot: string): Promise<T> {
  const stdout = await run("gh", args, { cwd: projectRoot });
  return JSON.parse(stdout) as T;
}

export async function listPullRequests(
  repo: string,
  projectRoot: string,
  limit = 30
): Promise<PullRequestSummary[]> {
  const prs = await gh<
    {
      number: number;
      title: string;
      author: { login: string } | null;
      headRefName: string;
      state: string;
    }[]
  >(
    [
      "pr",
      "list",
      "-R",
      repo,
      "--state",
      "all",
      "--json",
      "number,title,author,headRefName,state",
      "--limit",
      String(limit),
    ],
    projectRoot
  );

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.author?.login ?? "unknown",
    headRefName: pr.headRefName,
    state: pr.state,
  }));
}

export async function fetchPullRequestMeta(
  repo: string,
  number: number,
  projectRoot: string
): Promise<PullRequestMeta> {
  const meta = await gh<{
    title: string;
    body: string | null;
    author: { login: string } | null;
    baseRefName: string;
    headRefName: string;
    url: string;
  }>(
    [
      "pr",
      "view",
      String(number),
      "-R",
      repo,
      "--json",
      "title,body,author,baseRefName,headRefName,url",
    ],
    projectRoot
  );

  return {
    repo,
    number,
    title: meta.title,
    body: meta.body ?? "",
    base: meta.baseRefName,
    head: meta.headRefName,
    author: meta.author?.login ?? "unknown",
    url: meta.url,
  };
}

export async function fetchPullRequestDiff(
  repo: string,
  number: number,
  projectRoot: string
): Promise<string> {
  return run("gh", ["pr", "diff", String(number), "-R", repo], {
    cwd: projectRoot,
  });
}

/** Turn raw command failures into something worth showing a user. */
export function describeGhError(e: unknown): string {
  if (e instanceof CommandError) {
    if (e.command === "gh" && e.message.includes("not found on PATH")) {
      return "The GitHub CLI (`gh`) is not installed or not on PATH. Install it from cli.github.com.";
    }
    if (/auth|logged in|authentication/i.test(e.message)) {
      return `GitHub CLI is not authenticated — run \`gh auth login\`. (${e.message})`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
