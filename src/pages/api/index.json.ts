/**
 * /api/index.json — directory of the Foodbook JSON API.
 *
 * A small endpoint that lists every other /api/*.json route with a
 * one-line description. Lets a programmatic consumer discover the
 * surface without scraping the HTML site or guessing routes.
 */
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const abs = (path: string) => new URL(path, site).toString();

  const body = {
    version: 1,
    name: "Foodbook JSON API",
    description:
      "Structured exports of the Foodbook corpus — one endpoint per collection, plus discovery endpoints.",
    endpoints: [
      {
        url: abs("/api/dishes.json"),
        description: "Every public dish — title, origin, tags, lifecycle-stage refs.",
      },
      {
        url: abs("/api/recipes.json"),
        description:
          "Every public recipe — yield, time, tags, ingredient/step counts, revisions, ingredient provenance refs.",
      },
      {
        url: abs("/api/farms.json"),
        description:
          "Every public farm/producer — kind, location, lat/lng, products, seasonalWindow.",
      },
      {
        url: abs("/api/restaurants.json"),
        description:
          "Every public restaurant — cuisine, city, lat/lng, priceBand, visited/discovered status.",
      },
    ],
    relatedSurfaces: [
      { url: abs("/llms.txt"), description: "Concise TOC for AI crawlers (llmstxt.org)." },
      { url: abs("/llms-full.txt"), description: "Full-prose corpus dump for AI ingestion." },
      { url: abs("/rss.xml"), description: "RSS 2.0 feed." },
      { url: abs("/feed.json"), description: "JSON Feed 1.1 alternative." },
      { url: abs("/sitemap.txt"), description: "Plain-text URL list." },
      { url: abs("/sitemap-index.xml"), description: "Canonical XML sitemap." },
    ],
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
