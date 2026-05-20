/**
 * jsonld — helpers for schema.org structured data.
 * Render the returned objects via <JsonLd data={...} />.
 */

export const SCHEMA_CTX = "https://schema.org" as const;
export const SITE_NAME = "Foodbook" as const;

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

/** CollectionPage: a listing page like /dishes/ or /recipes/. `count` is
 *  the size of the listing — search engines use it as a hint at the
 *  collection's scale without spidering every entry. */
export function collectionPage(
  site: URL,
  section: { label: string; kind: string; description: string },
  count: number,
): Record<string, unknown> {
  return {
    "@context": SCHEMA_CTX,
    "@type": "CollectionPage",
    name: section.label,
    url: sectionUrl(site, section.kind),
    description: section.description,
    isPartOf: { "@type": "WebSite", url: new URL("/", site).toString(), name: SITE_NAME },
    mainEntity: { "@type": "ItemList", numberOfItems: count },
  };
}

/** BreadcrumbList: Home → <section>, optionally → <leaf>.
 *  Omit `leaf` on collection index pages; supply it on entity-detail pages. */
export function breadcrumb(
  site: URL,
  section: { label: string; kind: string },
  leaf?: { label: string; url: string },
): Record<string, unknown> {
  const itemListElement: Record<string, unknown>[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: new URL("/", site).toString() },
    {
      "@type": "ListItem",
      position: 2,
      name: section.label,
      item: sectionUrl(site, section.kind),
    },
  ];
  if (leaf) {
    itemListElement.push({ "@type": "ListItem", position: 3, name: leaf.label, item: leaf.url });
  }
  return { "@context": SCHEMA_CTX, "@type": "BreadcrumbList", itemListElement };
}
