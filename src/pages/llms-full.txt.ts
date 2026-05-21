/**
 * /llms-full.txt — verbose companion to /llms.txt (llmstxt.org convention).
 *
 * Where /llms.txt is a one-line-per-entry index that fits in a few KB,
 * this endpoint dumps the *full editorial body* of every public dish and
 * recipe so an AI client can ingest the prose without crawling N entry
 * pages. Restaurants and farms emit their data-derived blurb only (no
 * body text was authored beyond the schema fields).
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { entryUrl, SITE_NAME } from "~/lib/jsonld";
import { bare } from "~/lib/slug";
import { publicOnly } from "~/lib/visibility";

const stripEm = (s: string) => s.replace(/<\/?em>/g, "");

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
    `# ${SITE_NAME} — full corpus`,
    "",
    "> Verbose dump for AI crawlers. The concise table-of-contents lives at /llms.txt; this file inlines the full prose of every public dish and recipe so the corpus can be ingested in one fetch. Restaurants and farms emit only their data-derived blurb (no body prose was authored beyond schema fields).",
    "",
  ];

  // Dishes — title, tagline, origin, tags, prologue, MDX body, finale.
  lines.push("## Dishes");
  lines.push("");
  const sortedDishes = [...dishes].sort((a, b) =>
    stripEm(a.data.shortTitle).localeCompare(stripEm(b.data.shortTitle)),
  );
  for (const d of sortedDishes) {
    const url = entryUrl(site, "dishes", bare(d.id));
    lines.push(`### [${stripEm(d.data.shortTitle)}](${url})`);
    if (d.data.tagline) lines.push(`*${stripEm(d.data.tagline)}*`);
    const meta: string[] = [];
    if (d.data.origin) meta.push(`Origin: ${d.data.origin}`);
    if (d.data.firstMade) meta.push(`First made: ${d.data.firstMade}`);
    if (d.data.tags.length > 0) meta.push(`Tags: ${d.data.tags.join(", ")}`);
    if (meta.length > 0) lines.push(meta.join(" · "));
    if (d.data.prologue) {
      lines.push("");
      lines.push(`**${stripEm(d.data.prologue.heading)}**`);
      lines.push("");
      lines.push(stripEm(d.data.prologue.prose));
    }
    if (d.body && d.body.trim()) {
      lines.push("");
      lines.push(d.body.trim());
    }
    if (d.data.finale) {
      lines.push("");
      lines.push(`**${stripEm(d.data.finale.heading)}**`);
      lines.push("");
      lines.push(stripEm(d.data.finale.prose));
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Recipes — title, yield/time, ingredients (text only), steps, body, notes.
  lines.push("## Recipes");
  lines.push("");
  const sortedRecipes = [...recipes].sort((a, b) =>
    stripEm(a.data.title).localeCompare(stripEm(b.data.title)),
  );
  for (const r of sortedRecipes) {
    const url = entryUrl(site, "recipes", bare(r.id));
    lines.push(`### [${stripEm(r.data.title)}](${url})`);
    const meta: string[] = [r.data.yield];
    if (r.data.timePrep) meta.push(`prep ${r.data.timePrep}`);
    if (r.data.timeCook) meta.push(`cook ${r.data.timeCook}`);
    if (r.data.attribution) meta.push(`via ${r.data.attribution}`);
    lines.push(meta.join(" · "));
    lines.push("");
    lines.push("**Ingredients**");
    for (const ing of r.data.ingredients) {
      const fromHint = ing.from ? ` (from ${ing.from})` : "";
      lines.push(`- ${ing.text}${fromHint}`);
    }
    lines.push("");
    lines.push("**Method**");
    r.data.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step.text}`);
    });
    if (r.body && r.body.trim()) {
      lines.push("");
      lines.push(r.body.trim());
    }
    if (r.data.notes) {
      lines.push("");
      lines.push("**Notes**");
      lines.push(r.data.notes);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Restaurants — data-derived blurb only.
  if (restaurants.length > 0) {
    lines.push("## Restaurants");
    lines.push("");
    const sortedRest = [...restaurants].sort((a, b) => a.data.name.localeCompare(b.data.name));
    for (const x of sortedRest) {
      const url = entryUrl(site, "restaurants", bare(x.id));
      const where = [x.data.city, x.data.country].filter(Boolean).join(", ");
      lines.push(`- [${x.data.name}](${url}) — ${x.data.cuisine ?? "Restaurant"} in ${where} (${x.data.priceBand})`);
    }
    lines.push("");
  }

  // Farms — data-derived blurb only.
  if (farms.length > 0) {
    lines.push("## Farms & Producers");
    lines.push("");
    const sortedFarms = [...farms].sort((a, b) => a.data.name.localeCompare(b.data.name));
    for (const f of sortedFarms) {
      const url = entryUrl(site, "farms", bare(f.id));
      lines.push(`- [${f.data.name}](${url}) — ${f.data.kind} at ${f.data.location}`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
