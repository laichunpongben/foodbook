/**
 * /llms.txt — emerging convention (llmstxt.org) for AI crawlers.
 *
 * Lists every public dish / recipe / restaurant / farm with a one-line
 * hook, grouped by section. Robots.txt already declares "AI scrapers
 * are not blocked here", so this is the consistent counterpart — a
 * concise table-of-contents AI clients can pull instead of crawling
 * every listing page.
 */
import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl, sectionUrl } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

const stripEm = (s: string) => s.replace(/<\/?em>/g, "");

function section<E extends { id: string }>(
  heading: string,
  entries: E[],
  key: (e: E) => string,
  render: (e: E) => string,
): string[] {
  const sorted = entries.sort((a, b) => key(a).localeCompare(key(b)));
  return [`## ${heading}`, "", ...sorted.map(render), ""];
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

  const lines: string[] = [
    "# Foodbook",
    "",
    "> An archive of the food lifecycle — farms, gardens, kitchens, restaurants. Authored prose, AI-assisted authoring (see /about#ai).",
    "",
    "## Hubs",
    "",
    `- [World map](${sectionUrl(site, "world")}): farm/producer/restaurant pins on one map.`,
    `- [Atlas](${new URL("/atlas/", site).toString()}): farms + restaurants grouped by country.`,
    `- [Seasons](${sectionUrl(site, "seasons")}): wheel of products in season this month, drawn from farm windows.`,
    `- [Pantry](${sectionUrl(site, "pantry")}): current inventory snapshot with provenance links.`,
    "",
    "## Rotating content (changes daily/weekly/monthly)",
    "",
    `- [Today](${new URL("/today/", site).toString()}): one dish, rotated daily.`,
    `- [Today's menu](${new URL("/menu/", site).toString()}): three courses (starter, main, dessert), rotated daily.`,
    `- [This week's pairing](${new URL("/pairings/", site).toString()}): two dishes with tag overlap, rotated weekly.`,
    `- [This week](${new URL("/this-week/", site).toString()}): dishes added in the last 7 days.`,
    `- [On this day](${new URL("/anniversary/", site).toString()}): dishes cooked around this time of year (any year).`,
    `- [Live](${new URL("/live/", site).toString()}): every rotating surface in one digest.`,
    "",
    "## Browse axes",
    "",
    `- [Cuisines](${new URL("/cuisines/", site).toString()}): photo-first browse by tradition.`,
    `- [Techniques](${new URL("/techniques/", site).toString()}): browse by cooking method (bake / grill / ferment / raw / preserved / one-pot).`,
    `- [Timeline](${new URL("/timeline/", site).toString()}): dishes chronologically by firstMade date.`,
    `- [Signature](${new URL("/signature/", site).toString()}): fully-traced dishes (cover 3-4 lifecycle stages).`,
    `- [First bite](${new URL("/first-bite/", site).toString()}): 9-dish sampler from 9 angles, monthly rotation.`,
    `- [Inspire](${new URL("/inspire/", site).toString()}): three moods (Quick / Slow / Showpiece), one dish each.`,
    `- [Eat-out](${new URL("/eat-out/", site).toString()}): restaurant gallery view.`,
    `- [Shop](${new URL("/shop/", site).toString()}): printable weekly seasonal shopping list.`,
    `- [Tags](${sectionUrl(site, "tags")}): weighted tag cloud.`,
    "",
    ...section<CollectionEntry<"dishes">>(
      "Dishes",
      dishes,
      (d) => stripEm(d.data.shortTitle),
      (d) => {
        const hook = stripEm(d.data.tagline ?? d.data.shortTitle);
        return `- [${stripEm(d.data.shortTitle)}](${entryUrl(site, "dishes", bare(d.id))}): ${hook}`;
      },
    ),
    ...section<CollectionEntry<"recipes">>(
      "Recipes",
      recipes,
      (r) => stripEm(r.data.title),
      (r) => {
        const meta = [r.data.yield, r.data.timeCook && `cook ${r.data.timeCook}`]
          .filter(Boolean)
          .join(" · ");
        return `- [${stripEm(r.data.title)}](${entryUrl(site, "recipes", bare(r.id))}): ${meta}`;
      },
    ),
    ...section<CollectionEntry<"restaurants">>(
      "Restaurants",
      restaurants,
      (r) => r.data.name,
      (r) => {
        const where = [r.data.city, r.data.country].filter(Boolean).join(", ");
        return `- [${r.data.name}](${entryUrl(site, "restaurants", bare(r.id))}): ${r.data.cuisine ?? "Restaurant"} — ${where}`;
      },
    ),
    ...section<CollectionEntry<"farms">>(
      "Farms & Producers",
      farms,
      (f) => f.data.name,
      (f) =>
        `- [${f.data.name}](${entryUrl(site, "farms", bare(f.id))}): ${f.data.kind} — ${f.data.location}`,
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
