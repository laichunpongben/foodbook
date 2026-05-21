/**
 * /api/seasonal.json — products in season right now, plus the full year.
 *
 * Mirrors /seasons in JSON form: every product with its window, and
 * an `inSeasonNow` flag for the current month. Includes the next-month
 * preview (matches the /seasons 'Coming soon' panel). Consumers can
 * filter to inSeasonNow for a quick 'what should I cook this week'
 * lookup without re-computing wrap-aware month math.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { collectProducts, inSeason } from "~/lib/seasons";
import { publicOnly } from "~/lib/visibility";

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be set in astro.config.mjs");
  }

  const farms = await getCollection("farms").then(publicOnly);
  const month = new Date().getMonth() + 1; // 1-12
  const nextMonth = (month % 12) + 1;
  const products = collectProducts(farms);

  const items = products
    .sort((a, b) => a.product.localeCompare(b.product))
    .map((p) => ({
      product: p.product,
      from: p.from,
      to: p.to,
      inSeasonNow: inSeason(p.from, p.to, month),
      comingNextMonth: !inSeason(p.from, p.to, month) && inSeason(p.from, p.to, nextMonth),
      farms: p.farms.map((f) => ({ name: f.name, slug: f.slug })),
    }));

  const body = {
    version: 1,
    generated: new Date().toISOString(),
    currentMonth: month,
    nextMonth,
    count: items.length,
    inSeasonNow: items.filter((p) => p.inSeasonNow).length,
    comingNextMonth: items.filter((p) => p.comingNextMonth).length,
    items,
  };

  // Cache only briefly — the inSeasonNow / comingNextMonth booleans
  // flip when the month rolls over.
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
