import type { PullRequestMeta, ScoutResult } from "@syl/core";

/**
 * Schemas are shared by both providers, so they satisfy OpenAI strict mode:
 * every property listed in `required`, `additionalProperties: false` throughout.
 */
export const SCOUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: "One short paragraph: what this PR is trying to do.",
    },
    focus_areas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          reason: { type: "string" },
          risk: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["file", "reason", "risk"],
        additionalProperties: false,
      },
    },
  },
  required: ["intent", "focus_areas"],
  additionalProperties: false,
};

export const REVIEW_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: {
            type: "integer",
            description: "Best guess at the line in the NEW version of the file.",
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          category: {
            type: "string",
            enum: [
              "bug",
              "security",
              "performance",
              "correctness",
              "design",
              "test",
            ],
          },
          title: { type: "string" },
          description: { type: "string" },
          suggestion: { type: "string" },
        },
        required: [
          "file",
          "line",
          "severity",
          "category",
          "title",
          "description",
          "suggestion",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
};

export const SCOUT_SYSTEM = `You are the SCOUT in a two-stage AI code review.
Your job is cheap, fast triage — NOT a deep review. Read the pull request diff and
decide which parts deserve a careful look and why. Be concise. Do not report style
nits or speculative concerns.`;

export const REVIEWER_SYSTEM = `You are the REVIEWER in a two-stage AI code review.
A scout has already triaged this pull request. Produce only high-confidence,
actionable findings: real bugs, security issues, correctness problems,
resource/performance issues, missing tests for risky logic, and genuine design
concerns. Skip style nits and anything speculative. If there are no real issues,
return an empty findings array.

Report every finding you are confident in — do not filter for importance beyond
the bar above. For each finding, "line" is your best guess of the affected line
number in the NEW version of the file, and "file" must match a path in the diff.`;

function prSection(meta: PullRequestMeta, diff: string): string {
  return `PR #${meta.number}: ${meta.title}
Repository: ${meta.repo}
Base: ${meta.base}   Head: ${meta.head}   Author: @${meta.author}

Description:
${meta.body || "(no description)"}

Unified diff:
${diff}`;
}

export function scoutPrompt(meta: PullRequestMeta, diff: string): string {
  return prSection(meta, diff);
}

export function reviewerPrompt(
  meta: PullRequestMeta,
  diff: string,
  scout: ScoutResult
): string {
  return `Scout triage:
${JSON.stringify(scout, null, 2)}

${prSection(meta, diff)}`;
}
