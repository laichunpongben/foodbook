/**
 * /api/stats.json — small aggregate stats about the corpus.
 *
 * Counts per collection, plus a few derived metrics:
 *   - Dishes with all four lifecycle stages covered (complete entries).
 *   - Dishes by cuisine tag (only the canonical cuisine enum).
 *   - Recipes by meal-type tag.
 *   - Unique countries represented across farms + restaurants.
 *   - Unique tags total.
 *
 * For consumers that want a dashboard view without re-aggregating
 * across the per-collection endpoints.
 */
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { publicOnly } from "~/lib/visibility";

const CUISINE_TAGS = ["italian", "japanese", "chinese", "french", "mexican", "thai", "indian", "levantine", "iberian", "nordic"];
const MEAL_TAGS = ["breakfast", "lunch", "dinner", "snack", "dessert", "drink"];

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

  // Lifecycle completeness: a dish is "complete" when all four stages have
  // a non-empty note OR at least one ref.
  const stageCovered = (s: { note?: string; farms?: unknown[]; garden?: unknown[]; recipes?: unknown[]; meals?: unknown[]; restaurants?: unknown[] } | undefined): boolean => {
    if (!s) return false;
    if (s.note && s.note.trim().length > 0) return true;
    return (
      (s.farms?.length ?? 0) +
        (s.garden?.length ?? 0) +
        (s.recipes?.length ?? 0) +
        (s.meals?.length ?? 0) +
        (s.restaurants?.length ?? 0) >
      0
    );
  };
  const completeDishes = dishes.filter((d) =>
    (["source", "grow", "cook", "eat"] as const).every((k) => stageCovered(d.data.stages?.[k])),
  ).length;

  // Cuisine breakdown for dishes.
  const dishesByCuisine: Record<string, number> = {};
  for (const c of CUISINE_TAGS) {
    dishesByCuisine[c] = dishes.filter((d) => d.data.tags.includes(c)).length;
  }
  // Meal-type breakdown for recipes.
  const recipesByMealType: Record<string, number> = {};
  for (const m of MEAL_TAGS) {
    recipesByMealType[m] = recipes.filter((r) => r.data.tags.includes(m)).length;
  }

  // Unique countries.
  const countries = new Set<string>();
  for (const f of farms) if (f.data.country) countries.add(f.data.country);
  for (const r of restaurants) if (r.data.country) countries.add(r.data.country);

  // Unique tags.
  const allTags = new Set<string>();
  for (const d of dishes) for (const t of d.data.tags) allTags.add(t);
  for (const r of recipes) for (const t of r.data.tags) allTags.add(t);
  for (const r of restaurants) for (const t of r.data.tags) allTags.add(t);
  for (const m of meals) for (const t of m.data.tags) allTags.add(t);

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
    derived: {
      completeDishes,
      uniqueCountries: countries.size,
      uniqueTags: allTags.size,
      dishesByCuisine,
      recipesByMealType,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
