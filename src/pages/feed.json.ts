/**
 * /feed.json — JSON Feed 1.1 alternative to /rss.xml.
 *
 * Some modern readers (NetNewsWire, Reeder, FeedLand) prefer JSON Feed
 * over RSS — it's easier to parse and round-trips Unicode without XML
 * escaping. Mirrors the structure of /rss.xml: dishes by `firstMade`,
 * recipes by latest revision date, capped at 50, interleaved newest-first.
 * Spec: https://www.jsonfeed.org/version/1.1/
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl, SITE_NAME } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

interface FeedItem {
  id: string;
  url: string;
  title: string;
  summary?: string;
  date_published?: string;
}

const FEED_LIMIT = 50;

function byDateThenTitle(a: FeedItem, b: FeedItem): number {
  if (a.date_published && b.date_published) {
    return b.date_published.localeCompare(a.date_published);
  }
  if (a.date_published) return -1;
  if (b.date_published) return 1;
  return a.title.localeCompare(b.title);
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const [dishes, recipes, farms, restaurants] = await Promise.all([
    getCollection("dishes").then(publicOnly),
    getCollection("recipes").then(publicOnly),
    getCollection("farms").then(publicOnly),
    getCollection("restaurants").then(publicOnly),
  ]);

  const items: FeedItem[] = [
    ...dishes.map((d): FeedItem => {
      const url = entryUrl(site, "dishes", bare(d.id));
      return {
        id: url,
        url,
        title: d.data.shortTitle,
        ...(d.data.tagline && { summary: d.data.tagline }),
        ...(d.data.firstMade && { date_published: `${d.data.firstMade}T00:00:00Z` }),
      };
    }),
    ...recipes.map((r): FeedItem => {
      const url = entryUrl(site, "recipes", bare(r.id));
      const latest = r.data.revisions[r.data.revisions.length - 1];
      const summary = `${r.data.yield}${r.data.timeCook ? ` · ${r.data.timeCook}` : ""}`;
      return {
        id: url,
        url,
        title: `Recipe · ${r.data.title}`,
        summary,
        ...(latest && { date_published: `${latest.date}T00:00:00Z` }),
      };
    }),
    ...farms.map((f): FeedItem => {
      const url = entryUrl(site, "farms", bare(f.id));
      return {
        id: url,
        url,
        title: `Farm · ${f.data.name}`,
        summary: `${f.data.kind} · ${f.data.location}`,
      };
    }),
    ...restaurants.map((x): FeedItem => {
      const url = entryUrl(site, "restaurants", bare(x.id));
      return {
        id: url,
        url,
        title: `Restaurant · ${x.data.name}`,
        summary: `${x.data.cuisine ?? "Restaurant"} in ${x.data.city}`,
      };
    }),
  ];

  items.sort(byDateThenTitle);

  const body = {
    version: "https://jsonfeed.org/version/1.1",
    title: SITE_NAME,
    home_page_url: site.toString(),
    feed_url: new URL("/feed.json", site).toString(),
    description: "An archive of the food lifecycle — farms, gardens, kitchens, restaurants.",
    language: "en",
    items: items.slice(0, FEED_LIMIT),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
};
