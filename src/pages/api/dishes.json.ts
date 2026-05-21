/**
 * /api/dishes.json — structured JSON export of every public dish.
 *
 * For programmatic consumers (AI agents, datasette-style explorers,
 * other static-site indexers) that want the corpus as data rather than
 * crawling HTML. Mirrors the schema in src/content.config.ts but
 * flattened so a consumer doesn't need Astro internals.
 *
 * Companion endpoints:
 *   /api/recipes.json — to be added
 *   /api/farms.json   — to be added
 *
 * Headers: cache-friendly + CORS open so an agent on any origin can fetch.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

const stripEm = (s: string) => s.replace(/<\/?em>/g, "");

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const dishes = await getCollection("dishes").then(publicOnly);

  const items = dishes
    .sort((a, b) => stripEm(a.data.shortTitle).localeCompare(stripEm(b.data.shortTitle)))
    .map((d) => {
      const stages = d.data.stages ?? {};
      return {
        slug: bare(d.id),
        url: entryUrl(site, "dishes", bare(d.id)),
        title: stripEm(d.data.title),
        shortTitle: d.data.shortTitle,
        tagline: d.data.tagline,
        origin: d.data.origin,
        tags: d.data.tags,
        firstMade: d.data.firstMade,
        hasStages: {
          source: Boolean(stages.source),
          grow: Boolean(stages.grow),
          cook: Boolean(stages.cook),
          eat: Boolean(stages.eat),
        },
        refs: {
          farms: [
            ...(stages.source?.farms ?? []),
            // intentionally not deduped — caller can do that; ordering is meaningful per-stage
          ],
          garden: [...(stages.grow?.garden ?? [])],
          recipes: [...(stages.cook?.recipes ?? [])],
          meals: [...(stages.eat?.meals ?? [])],
          restaurants: [...(stages.eat?.restaurants ?? [])],
        },
      };
    });

  const body = {
    version: 1,
    generated: new Date().toISOString(),
    count: items.length,
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
