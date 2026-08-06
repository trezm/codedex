/**
 * Subsequence fuzzy matching, tuned for file paths.
 *
 * Scoring rewards the things that make a path feel like "the one you meant":
 * characters that land on a word boundary, runs of consecutive characters, and
 * matches inside the filename rather than its directories. Gaps cost a little,
 * so `parser.ts` beats `p...a...r...s...e...r.ts` for the query `parser`.
 */

export interface FuzzyMatch {
  score: number;
  /** Indices into the target that matched, ascending — for highlighting. */
  positions: number[];
}

const BONUS_FIRST_CHAR = 12;
const BONUS_BOUNDARY = 8;
const BONUS_CAMEL = 6;
const BONUS_CONSECUTIVE = 5;
const BONUS_IN_BASENAME = 4;
const PENALTY_PER_GAP = 1;
/** Gaps stop mattering past this, so one long path can't drown out its matches. */
const MAX_GAP_PENALTY = 20;

const SEPARATORS = new Set(["/", "\\", "_", "-", ".", " "]);

function isBoundary(target: string, index: number): boolean {
  if (index === 0) return true;
  return SEPARATORS.has(target[index - 1]);
}

function isCamelHump(target: string, index: number): boolean {
  if (index === 0) return false;
  const prev = target[index - 1];
  const current = target[index];
  return prev === prev.toLowerCase() && current !== current.toLowerCase();
}

/**
 * Greedy left-to-right match starting at `from`, taking the earliest position
 * for each character. Greedy alone would rank `test` in a directory above
 * `test.ts`, so the caller runs a second pass anchored at the basename and
 * keeps whichever scores higher — that covers the case greedy gets wrong
 * without the cost of a full backtracking search.
 */
function matchFrom(
  query: string,
  target: string,
  lowerQuery: string,
  lowerTarget: string,
  from: number
): FuzzyMatch | null {
  const positions: number[] = [];
  let score = 0;
  let cursor = from;
  let previousMatch = -1;

  for (let q = 0; q < lowerQuery.length; q++) {
    const wanted = lowerQuery[q];
    const found = lowerTarget.indexOf(wanted, cursor);
    if (found === -1) return null;

    if (found === 0) score += BONUS_FIRST_CHAR;
    else if (isBoundary(target, found)) score += BONUS_BOUNDARY;
    else if (isCamelHump(target, found)) score += BONUS_CAMEL;

    if (previousMatch !== -1) {
      if (found === previousMatch + 1) {
        score += BONUS_CONSECUTIVE;
      } else {
        score -= Math.min(found - previousMatch - 1, MAX_GAP_PENALTY) * PENALTY_PER_GAP;
      }
    }

    positions.push(found);
    previousMatch = found;
    cursor = found + 1;
  }

  return { score, positions };
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const trimmed = query.trim();
  if (!trimmed) return { score: 0, positions: [] };

  const lowerQuery = trimmed.toLowerCase();
  const lowerTarget = target.toLowerCase();
  if (lowerQuery.length > lowerTarget.length) return null;

  const basenameStart = target.lastIndexOf("/") + 1;

  // Characters landing in the filename count for more than ones spent walking
  // through directories. Scored from where the matches actually fall rather
  // than from which pass produced them, so a root-level file isn't quietly
  // denied the bonus just because it has no directory to skip.
  const withBasenameBonus = (match: FuzzyMatch): FuzzyMatch => ({
    ...match,
    score:
      match.score +
      match.positions.filter((p) => p >= basenameStart).length *
        BONUS_IN_BASENAME,
  });

  const candidates: FuzzyMatch[] = [];
  const fromStart = matchFrom(trimmed, target, lowerQuery, lowerTarget, 0);
  if (fromStart) candidates.push(withBasenameBonus(fromStart));

  // A second pass anchored at the filename, because a query almost always
  // means the file rather than a directory along the way.
  if (basenameStart > 0) {
    const fromBasename = matchFrom(
      trimmed,
      target,
      lowerQuery,
      lowerTarget,
      basenameStart
    );
    if (fromBasename) candidates.push(withBasenameBonus(fromBasename));
  }

  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));

  // Shorter targets win ties: with equal evidence, the more specific path is
  // more likely to be the one being looked for.
  return { ...best, score: best.score - target.length * 0.05 };
}

export interface FuzzyResult<T> {
  item: T;
  match: FuzzyMatch;
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  toText: (item: T) => string,
  limit = 50
): FuzzyResult<T>[] {
  const results: FuzzyResult<T>[] = [];
  for (const item of items) {
    const match = fuzzyMatch(query, toText(item));
    if (match) results.push({ item, match });
  }
  results.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    return toText(a.item).localeCompare(toText(b.item));
  });
  return results.slice(0, limit);
}
