import { describe, expect, it } from "vitest";
import { isPublic, publicOnly } from "./visibility";

// Minimal stand-in for `CollectionEntry<...>` — we only touch `.data.visibility`.
type FakeEntry = { id: string; data: { visibility?: "public" | "unlisted" } };

const PUBLIC: FakeEntry = { id: "a", data: { visibility: "public" } };
const UNLISTED: FakeEntry = { id: "b", data: { visibility: "unlisted" } };
const DEFAULT: FakeEntry = { id: "c", data: {} }; // visibility undefined → treated as public

describe("isPublic", () => {
  it("returns true for entries with visibility: public", () => {
    expect(isPublic(PUBLIC as never)).toBe(true);
  });

  it("returns false for entries with visibility: unlisted", () => {
    expect(isPublic(UNLISTED as never)).toBe(false);
  });

  it("treats absent visibility as public (schema default)", () => {
    expect(isPublic(DEFAULT as never)).toBe(true);
  });
});

describe("publicOnly", () => {
  it("drops unlisted entries and keeps public/default ones", () => {
    const all = [PUBLIC, UNLISTED, DEFAULT] as never[];
    const out = publicOnly(all);
    expect(out).toEqual([PUBLIC, DEFAULT]);
  });

  it("returns an empty list for empty input", () => {
    expect(publicOnly([])).toEqual([]);
  });
});
