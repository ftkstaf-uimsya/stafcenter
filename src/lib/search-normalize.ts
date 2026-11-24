/**
 * Normalizes a string to lowercase alphanumeric characters only so searches like
 * "MPI23A" or "MPI 23A" match stored codes like "MPI-23A".
 */
export function normalizeCompactSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Matches a search query against a haystack while ignoring hyphens, spaces,
 * and punctuation differences, and supporting multi-token space-separated queries.
 */
export function matchesFlexibleQuery(haystack: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const rawHaystack = haystack.toLowerCase();
  const compactHaystack = normalizeCompactSearch(haystack);
  const compactQuery = normalizeCompactSearch(trimmed);

  if (compactQuery.length > 0 && compactHaystack.includes(compactQuery)) {
    return true;
  }

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((tok) => {
    const compactTok = normalizeCompactSearch(tok);
    return (
      rawHaystack.includes(tok) ||
      (compactTok.length > 0 && compactHaystack.includes(compactTok))
    );
  });
}
