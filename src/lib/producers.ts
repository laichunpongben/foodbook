/**
 * producers — resolve a free-text `from:` slug to its farm or garden
 * entry. Pages render the result as a link; an unresolved slug means
 * the author referenced something the catalog doesn't carry yet.
 */

import type { CollectionEntry } from "astro:content";
import { bare } from "~/lib/slug";

type Farm = CollectionEntry<"farms">;
type Garden = CollectionEntry<"garden">;

export interface ResolvedProducer {
  href: string;
  label: string;
}

export function resolveProducer(
  slug: string,
  catalog: { farms: Farm[]; gardens: Garden[] },
): ResolvedProducer | null {
  const farm = catalog.farms.find((f) => bare(f.id) === slug);
  if (farm) return { href: `/farms/${bare(farm.id)}/`, label: farm.data.name };
  const garden = catalog.gardens.find((g) => bare(g.id) === slug);
  if (garden) return { href: `/garden/${bare(garden.id)}/`, label: garden.data.plant };
  return null;
}
