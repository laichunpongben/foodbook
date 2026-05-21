/**
 * /api/all.json — every public entry across every collection, slug-keyed.
 *
 * Heavyweight: a single fetch returns the entire corpus structure (not
 * the prose — for that use /llms-full.txt). Useful for backups, graph
 * visualisations, or AI agents that want the whole graph in one request
 * instead of N round-trips against the per-collection endpoints.
 *
 * Response is intentionally not deduplicated against the per-collection
 * endpoints — those stay the canonical shapes; this is a convenience
 * roll-up.
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

  const [dishes, recipes, farms, restaurants, garden, meals] = await Promise.all([
    getCollection("dishes").then(publicOnly),
    getCollection("recipes").then(publicOnly),
    getCollection("farms").then(publicOnly),
    getCollection("restaurants").then(publicOnly),
    getCollection("garden").then(publicOnly),
    getCollection("meals").then(publicOnly),
  ]);

  const body = {
    version: 1,
    generated: new Date().toISOString(),
    counts: {
      dishes: dishes.length,
      recipes: recipes.length,
      farms: farms.length,
      restaurants: restaurants.length,
      garden: garden.length,
      meals: meals.length,
    },
    dishes: dishes.map((d) => ({
      slug: bare(d.id),
      url: entryUrl(site, "dishes", bare(d.id)),
      title: stripEm(d.data.title),
      shortTitle: d.data.shortTitle,
      origin: d.data.origin,
      tags: d.data.tags,
      firstMade: d.data.firstMade,
    })),
    recipes: recipes.map((r) => ({
      slug: bare(r.id),
      url: entryUrl(site, "recipes", bare(r.id)),
      title: stripEm(r.data.title),
      yield: r.data.yield,
      timePrep: r.data.timePrep,
      timeCook: r.data.timeCook,
      tags: r.data.tags,
    })),
    farms: farms.map((f) => ({
      slug: bare(f.id),
      url: entryUrl(site, "farms", bare(f.id)),
      name: f.data.name,
      kind: f.data.kind,
      location: f.data.location,
      country: f.data.country,
      lat: f.data.lat,
      lng: f.data.lng,
    })),
    restaurants: restaurants.map((r) => ({
      slug: bare(r.id),
      url: entryUrl(site, "restaurants", bare(r.id)),
      name: r.data.name,
      city: r.data.city,
      country: r.data.country,
      lat: r.data.lat,
      lng: r.data.lng,
      cuisine: r.data.cuisine,
      priceBand: r.data.priceBand,
    })),
    garden: garden.map((g) => ({
      slug: bare(g.id),
      url: entryUrl(site, "garden", bare(g.id)),
      plant: g.data.plant,
      bed: g.data.bed,
      planted: g.data.planted,
      harvested: g.data.harvested,
    })),
    meals: meals.map((m) => ({
      slug: bare(m.id),
      url: entryUrl(site, "meals", bare(m.id)),
      title: m.data.title,
      date: m.data.date,
      location: m.data.location,
    })),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
