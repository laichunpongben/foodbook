import { describe, expect, it } from "vitest";
import { breadcrumb, collectionPage, entryUrl, SCHEMA_CTX, SITE_NAME, sectionUrl } from "./jsonld";

const BASE = "https://food.example.com";
const SITE = new URL(BASE);

describe("entryUrl", () => {
  it("composes an absolute entry URL with a trailing slash", () => {
    expect(entryUrl(SITE, "recipes", "carbonara")).toBe(`${BASE}/recipes/carbonara/`);
  });
});

describe("sectionUrl", () => {
  it("composes an absolute section URL with a trailing slash", () => {
    expect(sectionUrl(SITE, "farms")).toBe(`${BASE}/farms/`);
  });
});

describe("breadcrumb", () => {
  const crumb = breadcrumb(
    SITE,
    { label: "Recipes", kind: "recipes" },
    { label: "Carbonara", url: `${BASE}/recipes/carbonara/` },
  );

  it("emits the schema.org context and BreadcrumbList type", () => {
    expect(crumb["@context"]).toBe(SCHEMA_CTX);
    expect(crumb["@type"]).toBe("BreadcrumbList");
  });

  it("lists Home → section → leaf in order", () => {
    expect(crumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Recipes", item: `${BASE}/recipes/` },
      { "@type": "ListItem", position: 3, name: "Carbonara", item: `${BASE}/recipes/carbonara/` },
    ]);
  });

  it("omits the leaf when called without one (section index)", () => {
    const section = breadcrumb(SITE, { label: "Recipes", kind: "recipes" });
    expect(section.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Recipes", item: `${BASE}/recipes/` },
    ]);
  });
});

describe("collectionPage", () => {
  const items = [
    { name: "Carbonara", url: `${BASE}/recipes/carbonara/` },
    { name: "Ragù", url: `${BASE}/recipes/ragu/` },
  ];
  const ld = collectionPage(
    SITE,
    { label: "Recipes", kind: "recipes", description: "2 recipes in the archive." },
    items,
  );

  it("emits a CollectionPage with the section URL and an itemized ItemList", () => {
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.name).toBe("Recipes");
    expect(ld.url).toBe(`${BASE}/recipes/`);
    expect(ld.mainEntity).toEqual({
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Carbonara", url: `${BASE}/recipes/carbonara/` },
        { "@type": "ListItem", position: 2, name: "Ragù", url: `${BASE}/recipes/ragu/` },
      ],
    });
  });

  it("links isPartOf back to the WebSite root", () => {
    expect(ld.isPartOf).toEqual({
      "@type": "WebSite",
      url: `${BASE}/`,
      name: SITE_NAME,
    });
  });

  it("handles empty collections — numberOfItems 0, empty itemListElement", () => {
    const empty = collectionPage(SITE, { label: "Recipes", kind: "recipes", description: "" }, []);
    expect(empty.mainEntity).toEqual({
      "@type": "ItemList",
      numberOfItems: 0,
      itemListElement: [],
    });
  });

  it("includes per-item description when provided, omits when absent", () => {
    const mixed = collectionPage(SITE, { label: "Recipes", kind: "recipes", description: "" }, [
      { name: "A", url: `${BASE}/recipes/a/`, description: "4 servings" },
      { name: "B", url: `${BASE}/recipes/b/` },
    ]);
    const list = (mixed.mainEntity as { itemListElement: Record<string, unknown>[] })
      .itemListElement;
    expect(list[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "A",
      url: `${BASE}/recipes/a/`,
      description: "4 servings",
    });
    expect(list[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "B",
      url: `${BASE}/recipes/b/`,
    });
  });
});
