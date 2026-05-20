/**
 * slug — strip the collection prefix from a content-entry id.
 *
 * Astro's glob loader returns ids like `farms/san-marzano`,
 * `recipes/carbonara`, `dishes/ragu`. Pages, listings, and feeds
 * all want the bare slug for URLs and ref comparisons.
 */
export function bare(id: string): string {
  return id.replace(/^[^/]+\//, "");
}

/** Dish ids carry a trailing `/index` from `dishes/<slug>/index.mdx`.
 *  Use this when comparing a dish id to a bare slug ref. */
export function bareSlug(id: string): string {
  return bare(id).replace(/\/index$/, "");
}
