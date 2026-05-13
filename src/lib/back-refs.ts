/**
 * back-refs — reverse-lookup which dishes reference a given farm,
 * garden, recipe, meal, or restaurant entry.
 *
 * Used by each entity-detail page to render "Appears in" — closing
 * the navigation loop so a reader who landed on a restaurant page
 * can jump to all the dishes it's known to serve.
 */

import { getCollection, type CollectionEntry } from 'astro:content';

type Kind = 'farm' | 'garden' | 'recipe' | 'meal' | 'restaurant';

export async function dishesReferencing(kind: Kind, slug: string): Promise<CollectionEntry<'dishes'>[]> {
  const dishes = await getCollection('dishes');
  return dishes.filter((d) => {
    const stages = d.data.stages ?? {};
    switch (kind) {
      case 'farm':
        return [
          ...(stages.source?.farms ?? []),
          ...(stages.grow?.farms ?? []),
        ].includes(slug);
      case 'garden':
        return [
          ...(stages.source?.garden ?? []),
          ...(stages.grow?.garden ?? []),
        ].includes(slug);
      case 'recipe':
        return (stages.cook?.recipes ?? []).includes(slug);
      case 'meal':
        return (stages.eat?.meals ?? []).includes(slug);
      case 'restaurant':
        return (stages.eat?.restaurants ?? []).includes(slug);
    }
  });
}
