/**
 * tag-counts — count tag occurrences across one or more entry collections.
 *
 * Used by /tags overview, /tags/[tag] index pages, /404 recovery chips,
 * /api/tags.json, /api/stats.json — anywhere that needs to know how many
 * entries carry each tag, optionally broken down by kind.
 *
 * Pure data shaping: takes plain arrays of {tags} objects, returns a Map.
 * Callers compose with their own kind labels (Dish/Recipe/etc.) and sort
 * orders. The Map preserves insertion order, but callers are expected to
 * sort the result themselves (alphabetical / by count / however).
 */

export interface Tagged {
  readonly tags: readonly string[];
}

/**
 * Tally tag occurrences across one flat list of entries.
 *
 *   countTags(dishes) // → Map<'lunch' → 87, 'italian' → 7, …>
 */
export function countTags<T extends { data: Tagged }>(entries: readonly T[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.data.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Tally tag occurrences across multiple labeled collections, returning
 * both the total count and a per-kind breakdown for each tag.
 *
 *   countTagsByKind({ dishes, recipes, restaurants, meals })
 *   // → Map<'italian' → { total: 14, byKind: { dishes: 7, recipes: 5, … } }, …>
 *
 * The byKind object always carries an entry for every key in the input
 * (zero where the tag is absent), so consumers can use a stable shape.
 */
export interface TagBreakdown {
  total: number;
  byKind: Record<string, number>;
}

export function countTagsByKind<T extends { data: Tagged }>(
  collectionsByKind: Record<string, readonly T[]>,
): Map<string, TagBreakdown> {
  const kinds = Object.keys(collectionsByKind);
  const out = new Map<string, TagBreakdown>();
  for (const [kind, entries] of Object.entries(collectionsByKind)) {
    for (const e of entries) {
      for (const t of e.data.tags) {
        let stats = out.get(t);
        if (!stats) {
          stats = { total: 0, byKind: Object.fromEntries(kinds.map((k) => [k, 0])) };
          out.set(t, stats);
        }
        stats.total += 1;
        stats.byKind[kind] += 1;
      }
    }
  }
  return out;
}
