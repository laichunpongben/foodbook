/**
 * /api/tags.json — every tag with its count and per-collection breakdown.
 *
 * Lets a consumer rebuild the tag cloud / index without having to fetch
 * /api/dishes.json + /api/recipes.json + … and re-aggregate. Mirrors
 * the surface of /tags overview but in JSON.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl, sectionUrl } from "~/lib/jsonld";
import { publicOnly } from "~/lib/visibility";

interface TagStats {
  tag: string;
  url: string;
  total: number;
  byKind: Record<string, number>;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const [dishes, recipes, restaurants, meals] = await Promise.all([
    getCollection("dishes").then(publicOnly),
    getCollection("recipes").then(publicOnly),
    getCollection("restaurants").then(publicOnly),
    getCollection("meals").then(publicOnly),
  ]);

  const counts = new Map<string, TagStats>();
  const bump = (tags: readonly string[], kind: string) => {
    for (const t of tags) {
      const existing = counts.get(t) ?? {
        tag: t,
        url: entryUrl(site, "tags", t),
        total: 0,
        byKind: { dishes: 0, recipes: 0, restaurants: 0, meals: 0 },
      };
      existing.total += 1;
      existing.byKind[kind] = (existing.byKind[kind] ?? 0) + 1;
      counts.set(t, existing);
    }
  };
  for (const d of dishes) bump(d.data.tags, "dishes");
  for (const r of recipes) bump(r.data.tags, "recipes");
  for (const r of restaurants) bump(r.data.tags, "restaurants");
  for (const m of meals) bump(m.data.tags, "meals");

  const items = [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag));

  const body = {
    version: 1,
    generated: new Date().toISOString(),
    count: items.length,
    indexUrl: sectionUrl(site, "tags"),
    items,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
