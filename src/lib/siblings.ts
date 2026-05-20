/**
 * siblings — the entry-detail page's "what comes before / after this one".
 *
 * Pages render a Pager at the bottom; this helper does the sort + find
 * step in a single shape so every entity-detail page can call it the
 * same way. Unlisted entries are filtered out; if the current entry is
 * itself unlisted, both sides return null.
 */

import { type CollectionEntry, getCollection } from "astro:content";
import { publicOnly } from "~/lib/visibility";

type Kind = "dishes" | "recipes" | "restaurants" | "farms" | "meals" | "garden";
type Direction = "asc" | "desc";

interface Siblings<T extends Kind> {
  prev: CollectionEntry<T> | null;
  next: CollectionEntry<T> | null;
}

export async function siblingsOf<T extends Kind>(
  collection: T,
  currentId: string,
  sortKey: (e: CollectionEntry<T>) => string,
  direction: Direction = "asc",
): Promise<Siblings<T>> {
  // Case-insensitive (`sensitivity: 'base'`) so "creme" / "crème" / "Crème"
  // sort adjacently, regardless of how the entry was authored. Dates are
  // ISO 8601 so sensitivity is a no-op for them.
  const sign = direction === "asc" ? 1 : -1;
  const entries = (await getCollection(collection)) as CollectionEntry<T>[];
  const all = publicOnly(entries).sort(
    (a, b) => sign * sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: "base" }),
  );
  const i = all.findIndex((e) => e.id === currentId);
  return {
    prev: i > 0 ? all[i - 1] : null,
    next: i >= 0 && i < all.length - 1 ? all[i + 1] : null,
  };
}
