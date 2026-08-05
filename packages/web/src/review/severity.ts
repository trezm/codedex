import type { FindingSeverity, FindingCategory } from "@syl/core";

export const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/40",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};

export const SEVERITY_DOT: Record<FindingSeverity, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-sky-400",
};

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  bug: "bug",
  security: "security",
  performance: "perf",
  correctness: "correctness",
  design: "design",
  test: "test",
};

export const RISK_STYLE: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};
