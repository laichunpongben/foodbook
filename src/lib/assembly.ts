/**
 * assembly — build the "chain that assembles a dish" graph.
 *
 * Given a dish entry, walks its stages + each referenced recipe's
 * ingredient provenance, then resolves each slug to a rich node
 * holding everything the reader needs without clicking through.
 *
 * Four lifecycle stages, in order:
 *
 *   Source  →  Grow  →  Cook  →  Eat
 *
 * The *dish itself* is not a node in the graph — it is the subject of
 * the lifecycle (the page header). Empty stages collapse cleanly so a
 * dish with only eat data renders a single column.
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
  /** Image URL used as the card's visual focal element. Falls back to
   *  the kind-tinted gradient when absent. */
  heroUrl?: string;
}

export type Node =
  | (BaseNode & { kind: 'farm' })
  | (BaseNode & { kind: 'garden' })
  | (BaseNode & { kind: 'recipe' })
  | (BaseNode & { kind: 'meal' })
  | (BaseNode & { kind: 'restaurant'; status: 'visited' | 'discovered'; sourceUrl?: string });

export interface DishHead {
  slug: string;
  label: string;
  tagline?: string;
  origin?: string;
  hero?: string;
  heroUrl?: string;
}

export interface AssemblyGraph {
  /** External providers — farms, markets, producers. */
  source: Node[];
  /** Home garden + foraging. */
  grow: Node[];
  /** Recipes used to cook the dish. */
  cook: Node[];
  /** Where + when the dish was eaten — meals at home, restaurants. */
  eat: Node[];
  /** The dish itself — surfaced separately so the page can render it as
   *  the header / subject rather than as a graph node. */
  dish: DishHead;
}

function uniq<T extends string>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Glob-loader IDs include the collection prefix (e.g. `recipes/foo`),
 * but MDX refs use bare slugs (`foo`). Build a lookup map per
 * collection that strips the prefix and any trailing `/index`.
 */
async function loadMap<T extends 'farms' | 'garden' | 'recipes' | 'restaurants' | 'meals'>(
  collection: T,
): Promise<Map<string, CollectionEntry<T>>> {
  const entries = (await getCollection(collection)) as CollectionEntry<T>[];
  const map = new Map<string, CollectionEntry<T>>();
  const prefix = `${collection}/`;
  for (const e of entries) {
    const slug = e.id.startsWith(prefix) ? e.id.slice(prefix.length) : e.id;
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

  // Each recipe carries its own ingredient-level provenance; pull those
  // farm refs into the Source column transitively.
  for (const r of recipes) {
    for (const ing of r.data.ingredients ?? []) {
      if (ing.from) farmSlugs.push(ing.from);
    }
  }
  const dedupedFarmSlugs = uniq(farmSlugs);

  const source: Node[] = dedupedFarmSlugs
    .map((s) => farmsMap.get(s))
    .filter((f): f is CollectionEntry<'farms'> => Boolean(f))
    .map((f) => ({
      kind: 'farm' as const,
      slug: f.id.replace(/^farms\//, ''),
      label: f.data.name,
      meta: `${f.data.kind} · ${f.data.location}`,
      facts: (f.data.products ?? []).slice(0, 3),
      heroUrl: f.data.heroUrl,
    }));

  const grow: Node[] = gardenSlugs
    .map((s) => gardenMap.get(s))
    .filter((g): g is CollectionEntry<'garden'> => Boolean(g))
    .map((g) => ({
      kind: 'garden' as const,
      slug: g.id.replace(/^garden\//, ''),
      label: g.data.plant,
      meta: `Garden · ${g.data.bed}`,
      facts: [
        g.data.harvested
          ? `Planted ${g.data.planted} · Harvested ${g.data.harvested}`
          : `Planted ${g.data.planted}`,
        ...(g.data.yieldNote ? [g.data.yieldNote] : []),
      ],
      heroUrl: g.data.heroUrl,
    }));

  const cook: Node[] = recipes.map((r) => {
    const time = [r.data.timePrep, r.data.timeCook].filter(Boolean).join(' + ');
    const topIngredients = (r.data.ingredients ?? [])
      .slice(0, 4)
      .map((i) => firstWords(i.text.replace(/^\d+[\d./\s]*[a-zA-Z]*\s+/, ''), 2));
    return {
      kind: 'recipe' as const,
      slug: r.id.replace(/^recipes\//, ''),
      label: r.data.title,
      meta: time ? `${r.data.yield} · ${time}` : r.data.yield,
      facts: topIngredients.length ? [topIngredients.join(', ')] : [],
      heroUrl: r.data.heroUrl,
    };
  });

  const eat: Node[] = [
    ...mealSlugs
      .map((s) => mealsMap.get(s))
      .filter((m): m is CollectionEntry<'meals'> => Boolean(m))
      .map((m) => ({
        kind: 'meal' as const,
        slug: m.id.replace(/^meals\//, ''),
        label: m.data.title,
        meta: [m.data.date, m.data.occasion].filter(Boolean).join(' · '),
        facts: m.data.location && m.data.location !== 'home' ? [`At ${m.data.location}`] : ['At home'],
        heroUrl: m.data.heroUrl,
      })),
    ...restaurantSlugs
      .map((s) => restaurantsMap.get(s))
      .filter((r): r is CollectionEntry<'restaurants'> => Boolean(r))
      .map((r) => {
        const visited = (r.data.visits ?? []).length > 0;
        const status: 'visited' | 'discovered' = visited ? 'visited' : 'discovered';
        const meta = visited
          ? `${r.data.priceBand} · ${r.data.city}`
          : `${r.data.priceBand} · ${r.data.city} · via ${r.data.discoveredVia?.source ?? 'research'}`;
        const facts: string[] = [];
        if (r.data.discoveredVia?.signature) facts.push(r.data.discoveredVia.signature);
        else if (r.data.cuisine) facts.push(r.data.cuisine);
        return {
          kind: 'restaurant' as const,
          slug: r.id.replace(/^restaurants\//, ''),
          label: r.data.name,
          meta,
          facts,
          status,
          sourceUrl: r.data.discoveredVia?.url,
          heroUrl: r.data.heroUrl,
        };
      }),
  ];

  return {
    source,
    grow,
    cook,
    eat,
    dish: {
      slug: dish.id.replace(/^dishes\//, ''),
      label: dish.data.shortTitle,
      tagline: dish.data.tagline,
      origin: dish.data.origin,
      hero: dish.data.hero,
      heroUrl: dish.data.heroUrl,
    },
  };
}
