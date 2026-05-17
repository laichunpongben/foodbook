/**
 * journey — the food's journey from sunlight to stomach.
 *
 * Walks a dish's referenced recipe(s) and turns the structured
 * ingredients into a vertical narrative the page can render:
 *
 *   Sun  →  Plant  →  Cook  →  Plate  →  Eat
 *
 * Ingredients are the protagonists. Each ingredient carries its own
 * name, image, quantity, optional growth note, and an optional origin
 * (a farm or garden entry). The dish + recipes + eats are bundled
 * alongside so the page can compose all sections from a single data
 * structure.
 */

import { type CollectionEntry, getCollection } from "astro:content";

export interface JourneyOrigin {
  kind: "farm" | "garden";
  slug: string;
  name: string;
  /** Plain-text location ("Sarno Valley, Campania") or bed label
   *  ("Bed A1"). Shown as small meta beneath the origin name. */
  location?: string;
  heroUrl?: string;
}

export interface JourneyIngredient {
  /** Short display label — "Plum tomatoes". */
  name: string;
  /** Quantity + descriptor line — "1.2 kg ripe plum tomatoes". */
  text: string;
  /** Image URL for the ingredient. May be absent. */
  heroUrl?: string;
  /** One-line note about how/when it grew. May be absent. */
  growthNote?: string;
  /** Resolved origin entity, if the recipe set `from:` to a real slug. */
  origin?: JourneyOrigin;
  /** Recipe-side ingredient group ("for the sauce" / "to finish"). */
  group?: string;
}

export interface JourneyCookNode {
  slug: string;
  label: string;
  meta?: string;
  facts?: string[];
  heroUrl?: string;
}

export interface JourneyEatNode {
  kind: "meal" | "restaurant";
  slug: string;
  label: string;
  meta?: string;
  facts?: string[];
  heroUrl?: string;
  /** restaurants only — whether this entry was personally visited or
   *  surfaced via web research. */
  status?: "visited" | "discovered";
  sourceUrl?: string;
}

export interface JourneyDish {
  slug: string;
  /** Plain-text title for tooltips, ICS, og:title. */
  label: string;
  /** Display title, may contain inline `<em>`. */
  title: string;
  tagline?: string;
  origin?: string;
  hero?: string;
  heroUrl?: string;
  heroFocal?: string;
}

export interface Journey {
  dish: JourneyDish;
  ingredients: JourneyIngredient[];
  cook: JourneyCookNode[];
  eat: JourneyEatNode[];
}

async function loadMap<T extends "farms" | "garden" | "recipes" | "restaurants" | "meals">(
  collection: T,
): Promise<Map<string, CollectionEntry<T>>> {
  const entries = (await getCollection(collection)) as CollectionEntry<T>[];
  const map = new Map<string, CollectionEntry<T>>();
  const prefix = `${collection}/`;
  for (const e of entries) {
    const slug = e.id.startsWith(prefix) ? e.id.slice(prefix.length) : e.id;
    const trimmed = slug.replace(/\/index$/, "");
    map.set(trimmed, e);
  }
  return map;
}

/** When a recipe doesn't carry an explicit `name:` on an ingredient,
 *  strip the leading quantity from the `text:` line so the card has
 *  something readable to show. */
function nameFromText(text: string): string {
  const stripped = text.replace(
    /^[\d.,/\s]*(kg|g|ml|l|tsp|tbsp|cup|cups|cloves?|stalks?|bunch|bunches|pcs?|pieces?)\s+/i,
    "",
  );
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export async function getJourney(dish: CollectionEntry<"dishes">): Promise<Journey> {
  const stages = dish.data.stages ?? {};

  const [farmsMap, gardenMap, recipesMap, mealsMap, restaurantsMap] = await Promise.all([
    loadMap("farms"),
    loadMap("garden"),
    loadMap("recipes"),
    loadMap("meals"),
    loadMap("restaurants"),
  ]);

  /* ---------- recipes ---------- */
  const recipeSlugs = stages.cook?.recipes ?? [];
  const recipes = recipeSlugs
    .map((s) => recipesMap.get(s))
    .filter((r): r is CollectionEntry<"recipes"> => Boolean(r));

  /* ---------- ingredients (the protagonists) ---------- */
  const ingredients: JourneyIngredient[] = [];
  for (const r of recipes) {
    for (const ing of r.data.ingredients ?? []) {
      let origin: JourneyOrigin | undefined;
      if (ing.from) {
        const farm = farmsMap.get(ing.from);
        if (farm) {
          origin = {
            kind: "farm",
            slug: farm.id.replace(/^farms\//, ""),
            name: farm.data.name,
            location: farm.data.location,
            heroUrl: farm.data.heroUrl,
          };
        } else {
          const garden = gardenMap.get(ing.from);
          if (garden) {
            origin = {
              kind: "garden",
              slug: garden.id.replace(/^garden\//, ""),
              name: garden.data.plant,
              location: garden.data.bed,
              heroUrl: garden.data.heroUrl,
            };
          }
        }
      }

      ingredients.push({
        name: ing.name ?? nameFromText(ing.text),
        text: ing.text,
        heroUrl: ing.heroUrl,
        growthNote: ing.growthNote,
        origin,
        group: ing.group,
      });
    }
  }

  /* ---------- cook ---------- */
  const cook: JourneyCookNode[] = recipes.map((r) => {
    const time = [r.data.timePrep, r.data.timeCook].filter(Boolean).join(" + ");
    return {
      slug: r.id.replace(/^recipes\//, ""),
      label: r.data.title,
      meta: time ? `${r.data.yield} · ${time}` : r.data.yield,
      facts: [],
      heroUrl: r.data.heroUrl,
    };
  });

  /* ---------- eat ---------- */
  const mealSlugs = stages.eat?.meals ?? [];
  const restaurantSlugs = stages.eat?.restaurants ?? [];
  const meals = mealSlugs
    .map((s) => mealsMap.get(s))
    .filter((m): m is CollectionEntry<"meals"> => Boolean(m));
  const restaurants = restaurantSlugs
    .map((s) => restaurantsMap.get(s))
    .filter((r): r is CollectionEntry<"restaurants"> => Boolean(r));

  const eat: JourneyEatNode[] = [
    ...meals.map<JourneyEatNode>((m) => ({
      kind: "meal",
      slug: m.id.replace(/^meals\//, ""),
      label: m.data.title,
      meta: [m.data.date, m.data.occasion].filter(Boolean).join(" · "),
      facts:
        m.data.location && m.data.location !== "home" ? [`At ${m.data.location}`] : ["At home"],
      heroUrl: m.data.heroUrl,
    })),
    ...restaurants.map<JourneyEatNode>((r) => {
      const visited = (r.data.visits ?? []).length > 0;
      const status: "visited" | "discovered" = visited ? "visited" : "discovered";
      const facts: string[] = [];
      if (r.data.discoveredVia?.signature) facts.push(r.data.discoveredVia.signature);
      else if (r.data.cuisine) facts.push(r.data.cuisine);
      return {
        kind: "restaurant",
        slug: r.id.replace(/^restaurants\//, ""),
        label: r.data.name,
        meta: visited
          ? `${r.data.priceBand} · ${r.data.city}`
          : `${r.data.priceBand} · ${r.data.city} · via ${r.data.discoveredVia?.source ?? "research"}`,
        facts,
        heroUrl: r.data.heroUrl,
        status,
        sourceUrl: r.data.discoveredVia?.url,
      };
    }),
  ];

  return {
    dish: {
      slug: dish.id.replace(/^dishes\//, ""),
      label: dish.data.shortTitle,
      title: dish.data.title,
      tagline: dish.data.tagline,
      origin: dish.data.origin,
      hero: dish.data.hero,
      heroUrl: dish.data.heroUrl,
      heroFocal: dish.data.heroFocal,
    },
    ingredients,
    cook,
    eat,
  };
}
