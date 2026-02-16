import { ResolvedAnnotation } from "../annotations/types.js";

export interface OrphanReport {
  orphans: ResolvedAnnotation[];
  total: number;
  orphanCount: number;
}

export function detectOrphans(resolved: ResolvedAnnotation[]): OrphanReport {
  const orphans = resolved.filter((r) => r.orphaned);
  return {
    orphans,
    total: resolved.length,
    orphanCount: orphans.length,
  };
}
