/**
 * visibility — public / unlisted / example filtering.
 *
 * Listing pages (/, /world, /seasons, sitemap, RSS) show `public` only.
 * Entry pages render `unlisted` and `example` too — they emit
 * <meta robots noindex> via the layout's `unlisted` prop. See ADR-0005.
 *
 *   'public'   (default) — listed and indexed.
 *   'unlisted'           — page exists, excluded from listings, noindex.
 *   'example'            — placeholder/demo seed; excluded from listings, noindex.
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
  return (entry.data as { visibility?: string }).visibility === 'public';
}

export function publicOnly<T extends Listable>(entries: T[]): T[] {
  return entries.filter(isPublic);
}

/** True if the entry should emit <meta robots noindex>. */
export function isHidden(entry: Listable): boolean {
  const v = (entry.data as { visibility?: string }).visibility ?? 'public';
  return v !== 'public';
}
