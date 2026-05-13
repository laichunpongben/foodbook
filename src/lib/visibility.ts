/**
 * visibility — public / unlisted filtering.
 *
 * Listing pages (/, /world, /seasons, sitemap, RSS) show `public` only.
 * Entry pages render both — `unlisted` entries emit <meta robots noindex>
 * via the layout's `unlisted` prop. See ADR-0005.
 */

import type { CollectionEntry } from 'astro:content';

type Listable =
  | CollectionEntry<'dishes'>
  | CollectionEntry<'recipes'>
  | CollectionEntry<'restaurants'>
  | CollectionEntry<'farms'>
  | CollectionEntry<'meals'>
  | CollectionEntry<'garden'>;

export function isPublic(entry: Listable): boolean {
  return (entry.data as { visibility?: string }).visibility !== 'unlisted';
}

export function publicOnly<T extends Listable>(entries: T[]): T[] {
  return entries.filter(isPublic);
}
