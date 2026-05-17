/**
 * /rss.xml — RSS 2.0 feed of public content.
 *
 * Drives readers (Feedly / Inoreader / NetNewsWire) and AI ingestion
 * crawlers (Perplexity, Kagi, Reader-mode) via the pubDate freshness
 * signal. Dish items sort newest-first by `firstMade`; non-dish items
 * omit pubDate and trail alphabetically.
 */

import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { entryUrl } from "~/lib/jsonld";
import { publicOnly } from "~/lib/visibility";

interface FeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
}

// Reader-friendly cap; without it every farm/recipe/restaurant addition bloats the feed.
const FEED_LIMIT = 50;

const bare = (id: string) => id.replace(/^[^/]+\//, "");

function byDateThenTitle(a: FeedItem, b: FeedItem): number {
  if (a.pubDate && b.pubDate) return b.pubDate.getTime() - a.pubDate.getTime();
  if (a.pubDate) return -1;
  if (b.pubDate) return 1;
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
    ...dishes.map((d) => ({
      title: d.data.shortTitle,
      link: entryUrl(site, "dishes", bare(d.id)),
      description: d.data.tagline,
      pubDate: d.data.firstMade ? new Date(d.data.firstMade) : undefined,
    })),
    // Non-dish items get a kind prefix so a mixed feed reader can tell them apart.
    ...recipes.map((r) => ({
      title: `Recipe · ${r.data.title}`,
      link: entryUrl(site, "recipes", bare(r.id)),
      description: `${r.data.yield}${r.data.timeCook ? ` · ${r.data.timeCook}` : ""}`,
    })),
    ...farms.map((f) => ({
      title: `Farm · ${f.data.name}`,
      link: entryUrl(site, "farms", bare(f.id)),
      description: `${f.data.kind} · ${f.data.location}`,
    })),
    ...restaurants.map((r) => ({
      title: `Restaurant · ${r.data.name}`,
      link: entryUrl(site, "restaurants", bare(r.id)),
      description: `${r.data.cuisine ?? "Restaurant"} in ${r.data.city}`,
    })),
  ];

  items.sort(byDateThenTitle);

  return rss({
    title: "Foodbook",
    description: "An archive of the food lifecycle — farms, gardens, kitchens, restaurants.",
    site,
    items: items.slice(0, FEED_LIMIT),
    customData: "<language>en-us</language>",
  });
};
