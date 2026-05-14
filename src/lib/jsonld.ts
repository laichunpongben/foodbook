/**
 * jsonld — helpers for schema.org structured data.
 * Render the returned objects via <JsonLd data={...} />.
 */

export const SCHEMA_CTX = 'https://schema.org' as const;

/** Absolute URL of an entry, e.g. entryUrl(site, 'recipes', 'carbonara') →
 *  https://food.databookman.com/recipes/carbonara/. Used by both the
 *  entity schema and the breadcrumb leaf. */
export function entryUrl(site: URL, kind: string, slug: string): string {
  return new URL(`/${kind}/${slug}/`, site).toString();
}

/** Absolute URL of a section index, e.g. sectionUrl(site, 'recipes') →
 *  https://food.databookman.com/recipes/. */
export function sectionUrl(site: URL, kind: string): string {
  return new URL(`/${kind}/`, site).toString();
}

/** BreadcrumbList: Home → <section> → <leaf>. */
export function breadcrumb(
  site: URL,
  section: { label: string; kind: string },
  leaf: { label: string; url: string },
): Record<string, unknown> {
  return {
    '@context': SCHEMA_CTX,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', site).toString() },
      { '@type': 'ListItem', position: 2, name: section.label, item: sectionUrl(site, section.kind) },
      { '@type': 'ListItem', position: 3, name: leaf.label, item: leaf.url },
    ],
  };
}
