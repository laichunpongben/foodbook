/**
 * /api/world.json — every mappable pin (farms + restaurants) in one fetch.
 *
 * Mirrors what /world feeds into Leaflet. A consumer can re-render the
 * map in any tile / map library without re-aggregating the two
 * collection endpoints. Each pin carries `kind` ('farm' / 'producer' /
 * 'dairy' / 'restaurant' / etc.) and a `status` for restaurants
 * ('visited' / 'discovered').
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { publicOnly } from "~/lib/visibility";

interface Pin {
  slug: string;
  url: string;
  name: string;
  lat: number;
  lng: number;
  kind: string;
  city?: string;
  location?: string;
  country?: string;
  status?: "visited" | "discovered";
  priceBand?: string;
  cuisine?: string;
  heroUrl?: string;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const [farms, restaurants] = await Promise.all([
    getCollection("farms").then(publicOnly),
    getCollection("restaurants").then(publicOnly),
  ]);

  const farmPins: Pin[] = farms.map((f) => ({
    slug: f.id,
    url: new URL(`/farms/${f.id}/`, site).toString(),
    name: f.data.name,
    lat: f.data.lat,
    lng: f.data.lng,
    kind: f.data.kind,
    location: f.data.location,
    country: f.data.country,
    heroUrl: f.data.heroUrl,
  }));

  const restaurantPins: Pin[] = restaurants.map((r) => ({
    slug: r.id,
    url: new URL(`/restaurants/${r.id}/`, site).toString(),
    name: r.data.name,
    lat: r.data.lat,
    lng: r.data.lng,
    kind: "restaurant",
    city: r.data.city,
    country: r.data.country,
    status: r.data.visits.length > 0 ? "visited" : r.data.discoveredVia ? "discovered" : undefined,
    priceBand: r.data.priceBand,
    cuisine: r.data.cuisine,
    heroUrl: r.data.heroUrl,
  }));

  const pins: Pin[] = [...farmPins, ...restaurantPins].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const body = {
    version: 1,
    generated: new Date().toISOString(),
    count: pins.length,
    farmCount: farmPins.length,
    restaurantCount: restaurantPins.length,
    items: pins,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
