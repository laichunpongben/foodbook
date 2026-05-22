import { describe, expect, it } from "vitest";
import { countTags, countTagsByKind } from "./tag-counts";

interface Sample {
  data: { tags: readonly string[] };
}
const tag = (tags: string[]): Sample => ({ data: { tags } });

describe("countTags", () => {
  it("returns an empty Map for an empty list", () => {
    expect(countTags([])).toEqual(new Map());
  });

  it("tallies single occurrences", () => {
    const result = countTags([tag(["italian", "lunch"])]);
    expect(result.get("italian")).toBe(1);
    expect(result.get("lunch")).toBe(1);
    expect(result.size).toBe(2);
  });

  it("sums repeated tags across entries", () => {
    const result = countTags([
      tag(["italian", "dinner"]),
      tag(["italian", "lunch"]),
      tag(["italian", "lunch"]),
    ]);
    expect(result.get("italian")).toBe(3);
    expect(result.get("lunch")).toBe(2);
    expect(result.get("dinner")).toBe(1);
  });

  it("ignores empty tag arrays", () => {
    expect(countTags([tag([]), tag([])]).size).toBe(0);
  });
});

describe("countTagsByKind", () => {
  it("returns empty Map when every collection is empty", () => {
    expect(countTagsByKind({ dishes: [], recipes: [] })).toEqual(new Map());
  });

  it("carries every kind key on each breakdown, even zero", () => {
    const result = countTagsByKind({
      dishes: [tag(["italian"])],
      recipes: [],
      restaurants: [],
    });
    const italian = result.get("italian");
    expect(italian?.total).toBe(1);
    expect(italian?.byKind).toEqual({ dishes: 1, recipes: 0, restaurants: 0 });
  });

  it("sums totals across kinds and breaks down per-kind", () => {
    const result = countTagsByKind({
      dishes: [tag(["italian", "lunch"]), tag(["italian"])],
      recipes: [tag(["italian", "dinner"])],
      restaurants: [tag(["italian"])],
      meals: [],
    });
    const italian = result.get("italian");
    expect(italian?.total).toBe(4);
    expect(italian?.byKind).toEqual({ dishes: 2, recipes: 1, restaurants: 1, meals: 0 });

    expect(result.get("lunch")?.byKind).toEqual({
      dishes: 1,
      recipes: 0,
      restaurants: 0,
      meals: 0,
    });
  });

  it("treats different-cased tags as distinct (no normalisation)", () => {
    // The schema enum is lower-case; this just documents that the helper
    // does not normalise — callers are expected to feed canonical tags.
    const result = countTagsByKind({
      dishes: [tag(["Italian"]), tag(["italian"])],
    });
    expect(result.size).toBe(2);
  });
});
