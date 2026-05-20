import { describe, expect, it } from "vitest";
import { breadcrumb, entryUrl, SCHEMA_CTX, sectionUrl } from "./jsonld";

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
});
