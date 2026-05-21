/**
 * /api/farms.json — structured JSON export of every public farm / producer.
 *
 * Companion to /api/dishes.json + /api/recipes.json. Includes the
 * lat/lng so a consumer can render the corpus on its own map without
 * scraping /world.
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

  const farms = await getCollection("farms").then(publicOnly);

  const items = farms
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((f) => ({
      slug: bare(f.id),
      url: entryUrl(site, "farms", bare(f.id)),
      name: f.data.name,
      kind: f.data.kind,
      location: f.data.location,
      country: f.data.country,
      lat: f.data.lat,
      lng: f.data.lng,
      products: f.data.products,
      seasonalWindow: f.data.seasonalWindow,
      externalUrl: f.data.url,
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
