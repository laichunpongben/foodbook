/**
 * /api/meals.json — structured JSON export of every public meal event.
 *
 * Final companion to the /api/*.json collection set. Returns an empty
 * items[] today since no meals are authored yet — the schema is live
 * and the endpoint will populate as entries arrive.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const meals = await getCollection("meals").then(publicOnly);

  const items = meals
    .sort((a, b) => b.data.date.localeCompare(a.data.date))
    .map((m) => ({
      slug: bare(m.id),
      url: entryUrl(site, "meals", bare(m.id)),
      title: m.data.title,
      date: m.data.date,
      location: m.data.location,
      occasion: m.data.occasion,
      dishes: m.data.dishes,
      tags: m.data.tags,
      companionCount: m.data.companionCount,
    }));

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
