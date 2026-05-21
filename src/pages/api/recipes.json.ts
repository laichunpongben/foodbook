/**
 * /api/recipes.json — structured JSON export of every public recipe.
 *
 * Companion to /api/dishes.json. Same envelope: { version, generated, count, items[] }.
 * Cache-friendly + CORS open for cross-origin programmatic consumers.
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

  const recipes = await getCollection("recipes").then(publicOnly);

  const items = recipes
    .sort((a, b) => stripEm(a.data.title).localeCompare(stripEm(b.data.title)))
    .map((r) => {
      const revisions = r.data.revisions ?? [];
      const datePublished = revisions[0]?.date;
      const dateModified = revisions[revisions.length - 1]?.date;
      return {
        slug: bare(r.id),
        url: entryUrl(site, "recipes", bare(r.id)),
        title: stripEm(r.data.title),
        yield: r.data.yield,
        timePrep: r.data.timePrep,
        timeCook: r.data.timeCook,
        tags: r.data.tags,
        attribution: r.data.attribution,
        sourceUrl: r.data.sourceUrl,
        ingredientCount: r.data.ingredients.length,
        stepCount: r.data.steps.length,
        revisionCount: revisions.length,
        datePublished,
        dateModified: dateModified !== datePublished ? dateModified : undefined,
        // List ingredient provenance refs so a consumer can walk
        // recipe → farm/garden without re-parsing each ingredient.
        ingredientProvenance: [
          ...new Set(r.data.ingredients.map((i) => i.from).filter(Boolean)),
        ],
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
