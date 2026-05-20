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
  const ld = collectionPage(
    SITE,
    { label: "Recipes", kind: "recipes", description: "5 recipes in the archive." },
    5,
  );

  it("emits a CollectionPage with the section URL and item count", () => {
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.name).toBe("Recipes");
    expect(ld.url).toBe(`${BASE}/recipes/`);
    expect(ld.mainEntity).toEqual({ "@type": "ItemList", numberOfItems: 5 });
  });

  it("links isPartOf back to the WebSite root", () => {
    expect(ld.isPartOf).toEqual({
      "@type": "WebSite",
      url: `${BASE}/`,
      name: SITE_NAME,
    });
  });
});
