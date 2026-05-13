/**
 * assembly — build the "chain that assembles a dish" graph.
 *
 * Given a dish entry, walks its stages + each referenced recipe's
 * ingredient provenance, then resolves each slug to a rich node
 * holding everything needed to display the *full* picture without
 * clicking through. Single-screen by design.
 *
 *   sources  →  recipes  →  dish  →  eats
 *
 * Used by <AssemblyGraph> on the dish page. See ADR-0002.
 */

import { getCollection, type CollectionEntry } from 'astro:content';

interface BaseNode {
  slug: string;
  label: string;
  /** A short context line ("Producer · Example Valley"). */
  meta?: string;
  /** Up to ~3 free-text bullets shown beneath the label so the reader
   *  gets the gist of *what this thing is* without opening it. */
  facts?: string[];
}

export type Node =
  | (BaseNode & { kind: 'farm' })
  | (BaseNode & { kind: 'garden' })
  | (BaseNode & { kind: 'recipe' })
  | (BaseNode & { kind: 'dish'; hero?: string; tagline?: string; origin?: string })
  | (BaseNode & { kind: 'meal' })
  | (BaseNode & { kind: 'restaurant' });

export interface AssemblyGraph {
  sources: Node[];
  recipes: Node[];
  dish: Node;
  eats: Node[];
}

function uniq<T extends string>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Glob-loader IDs include the collection prefix (e.g. `recipes/foo`),
 * but our MDX refs use bare slugs (`foo`). Build a lookup map per
 * collection that strips the prefix so we can resolve refs without
 * forcing authors to write the prefix.
 */
async function loadMap<T extends 'farms' | 'garden' | 'recipes' | 'restaurants' | 'meals'>(
  collection: T,
): Promise<Map<string, CollectionEntry<T>>> {
  const entries = (await getCollection(collection)) as CollectionEntry<T>[];
  const map = new Map<string, CollectionEntry<T>>();
  const prefix = `${collection}/`;
  for (const e of entries) {
    const slug = e.id.startsWith(prefix) ? e.id.slice(prefix.length) : e.id;
    // Some collections (dishes) have id like `<slug>/index`; trim the suffix.
    const trimmed = slug.replace(/\/index$/, '');
    map.set(trimmed, e);
  }
  return map;
}

function firstWords(text: string, n: number): string {
  const ws = text.trim().split(/\s+/);
  return ws.length <= n ? text.trim() : ws.slice(0, n).join(' ') + '…';
}

export async function getAssemblyGraph(dish: CollectionEntry<'dishes'>): Promise<AssemblyGraph> {
  const stages = dish.data.stages ?? {};

  const farmSlugs = uniq([
    ...(stages.source?.farms ?? []),
    ...(stages.grow?.farms ?? []),
  ]);
  const gardenSlugs = uniq([
    ...(stages.source?.garden ?? []),
    ...(stages.grow?.garden ?? []),
  ]);
  const recipeSlugs = uniq(stages.cook?.recipes ?? []);
  const mealSlugs = uniq(stages.eat?.meals ?? []);
  const restaurantSlugs = uniq(stages.eat?.restaurants ?? []);

  const [farmsMap, gardenMap, recipesMap, mealsMap, restaurantsMap] = await Promise.all([
    loadMap('farms'),
    loadMap('garden'),
    loadMap('recipes'),
    loadMap('meals'),
    loadMap('restaurants'),
  ]);

  const recipes = recipeSlugs
    .map((s) => recipesMap.get(s))
    .filter((r): r is CollectionEntry<'recipes'> => Boolean(r));

  // Pull ingredient-level provenance from each recipe into the farms column.
  for (const r of recipes) {
    for (const ing of r.data.ingredients ?? []) {
      if (ing.from) farmSlugs.push(ing.from);
    }
  }
  const dedupedFarmSlugs = uniq(farmSlugs);

  const sources: Node[] = [
    ...dedupedFarmSlugs
      .map((s) => farmsMap.get(s))
      .filter((f): f is CollectionEntry<'farms'> => Boolean(f))
      .map<Node>((f) => ({
        kind: 'farm',
        slug: f.id.replace(/^farms\//, ''),
        label: f.data.name,
        meta: `${f.data.kind} · ${f.data.location}`,
        facts: (f.data.products ?? []).slice(0, 3),
      })),
    ...gardenSlugs
      .map((s) => gardenMap.get(s))
      .filter((g): g is CollectionEntry<'garden'> => Boolean(g))
      .map<Node>((g) => ({
        kind: 'garden',
        slug: g.id.replace(/^garden\//, ''),
        label: g.data.plant,
        meta: `Garden · ${g.data.bed}`,
        facts: [
          g.data.harvested
            ? `Planted ${g.data.planted} · Harvested ${g.data.harvested}`
            : `Planted ${g.data.planted}`,
          ...(g.data.yieldNote ? [g.data.yieldNote] : []),
        ],
      })),
  ];

  const recipeNodes: Node[] = recipes.map((r) => {
    const time = [r.data.timePrep, r.data.timeCook].filter(Boolean).join(' + ');
    const topIngredients = (r.data.ingredients ?? [])
      .slice(0, 4)
      .map((i) => firstWords(i.text.replace(/^\d+[\d./\s]*[a-zA-Z]*\s+/, ''), 2));
    return {
      kind: 'recipe',
      slug: r.id.replace(/^recipes\//, ''),
      label: r.data.title,
      meta: time ? `${r.data.yield} · ${time}` : r.data.yield,
      facts: topIngredients.length ? [topIngredients.join(', ')] : [],
    };
  });

  const eats: Node[] = [
    ...mealSlugs
      .map((s) => mealsMap.get(s))
      .filter((m): m is CollectionEntry<'meals'> => Boolean(m))
      .map<Node>((m) => ({
        kind: 'meal',
        slug: m.id.replace(/^meals\//, ''),
        label: m.data.title,
        meta: [m.data.date, m.data.occasion].filter(Boolean).join(' · '),
        facts: m.data.location && m.data.location !== 'home' ? [`At ${m.data.location}`] : ['At home'],
      })),
    ...restaurantSlugs
      .map((s) => restaurantsMap.get(s))
      .filter((r): r is CollectionEntry<'restaurants'> => Boolean(r))
      .map<Node>((r) => ({
        kind: 'restaurant',
        slug: r.id.replace(/^restaurants\//, ''),
        label: r.data.name,
        meta: `${r.data.priceBand} · ${r.data.city}`,
        facts: r.data.cuisine ? [r.data.cuisine] : [],
      })),
  ];

  return {
    sources,
    recipes: recipeNodes,
    dish: {
      kind: 'dish',
      slug: dish.id.replace(/^dishes\//, ''),
      label: dish.data.shortTitle,
      tagline: dish.data.tagline,
      origin: dish.data.origin,
      hero: dish.data.hero,
    },
    eats,
  };
}
