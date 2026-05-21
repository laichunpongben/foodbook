import { describe, expect, it } from "vitest";
import { relatedByTags } from "./related";

interface Item {
  id: string;
  data: { tags: readonly string[] };
  name: string;
}

const name = (e: Item) => e.name;

describe("relatedByTags", () => {
  const a: Item = { id: "a", data: { tags: ["italian", "dinner"] }, name: "A" };
  const b: Item = { id: "b", data: { tags: ["italian", "dinner", "one-pot"] }, name: "B" };
  const c: Item = { id: "c", data: { tags: ["italian"] }, name: "C" };
  const d: Item = { id: "d", data: { tags: ["dinner"] }, name: "D" };
  const e: Item = { id: "e", data: { tags: ["dessert"] }, name: "E" };
  const all = [a, b, c, d, e];

  it("excludes the current entry from results", () => {
    expect(relatedByTags(all, a, name)).not.toContainEqual(a);
  });

  it("orders by overlap descending; ties break by name", () => {
    expect(relatedByTags(all, a, name)).toEqual([b, c, d]);
  });

  it("returns an empty list when the current entry has no tags", () => {
    const tagless: Item = { id: "x", data: { tags: [] }, name: "X" };
    expect(relatedByTags(all, tagless, name)).toEqual([]);
  });

  it("filters out candidates with zero overlap", () => {
    expect(relatedByTags(all, a, name)).not.toContainEqual(e);
  });

  it("respects the limit", () => {
    expect(relatedByTags(all, a, name, 1)).toEqual([b]);
  });
});
