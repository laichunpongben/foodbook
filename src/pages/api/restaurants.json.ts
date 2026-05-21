/**
 * /api/restaurants.json — structured JSON export of every public restaurant.
 *
 * Companion to /api/dishes.json + /api/recipes.json + /api/farms.json.
 * Same envelope and headers.
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

  const restaurants = await getCollection("restaurants").then(publicOnly);

  const items = restaurants
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((r) => {
      const visited = (r.data.visits ?? []).length > 0;
      return {
        slug: bare(r.id),
        url: entryUrl(site, "restaurants", bare(r.id)),
        name: r.data.name,
        cuisine: r.data.cuisine,
        city: r.data.city,
        country: r.data.country,
        lat: r.data.lat,
        lng: r.data.lng,
        priceBand: r.data.priceBand,
        tags: r.data.tags,
        status: visited ? "visited" : r.data.discoveredVia ? "discovered" : "unknown",
        visitCount: (r.data.visits ?? []).length,
        discoveredVia: r.data.discoveredVia
          ? {
              source: r.data.discoveredVia.source,
              url: r.data.discoveredVia.url,
              signature: r.data.discoveredVia.signature,
            }
          : undefined,
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
