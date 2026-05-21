/**
 * /api/garden.json — structured JSON export of every public garden bed.
 *
 * Companion to /api/dishes.json + /api/recipes.json + /api/farms.json
 * + /api/restaurants.json. Same envelope and headers.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

const MS_PER_DAY = 86_400_000;

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const beds = await getCollection("garden").then(publicOnly);

  const items = beds
    .sort((a, b) => b.data.planted.localeCompare(a.data.planted))
    .map((g) => {
      const plantedDate = new Date(g.data.planted);
      const endDate = g.data.harvested ? new Date(g.data.harvested) : new Date();
      const daysInGround = Math.max(
        0,
        Math.round((endDate.getTime() - plantedDate.getTime()) / MS_PER_DAY),
      );
      return {
        slug: bare(g.id),
        url: entryUrl(site, "garden", bare(g.id)),
        plant: g.data.plant,
        bed: g.data.bed,
        planted: g.data.planted,
        harvested: g.data.harvested,
        daysInGround,
        yieldNote: g.data.yieldNote,
        status: g.data.harvested ? "harvested" : "growing",
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
