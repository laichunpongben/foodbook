/**
 * related — score entries by tag overlap with a current entry.
 *
 * Caller filters to public entries. Ties break alphabetically on the
 * display name so the rail is deterministic across builds.
 */

interface Tagged {
  id: string;
  data: { tags: readonly string[] };
}

export function relatedByTags<T extends Tagged>(
  candidates: T[],
  current: T,
  name: (e: T) => string,
  limit = 3,
): T[] {
  const currentTags = new Set(current.data.tags);
  if (currentTags.size === 0) return [];
  const scored = candidates
    .filter((c) => c.id !== current.id)
    .map((c) => ({
      entry: c,
      overlap: c.data.tags.reduce((n, t) => n + (currentTags.has(t) ? 1 : 0), 0),
    }))
    .filter(({ overlap }) => overlap > 0);
  scored.sort((a, b) => b.overlap - a.overlap || name(a.entry).localeCompare(name(b.entry)));
  return scored.slice(0, limit).map(({ entry }) => entry);
}
