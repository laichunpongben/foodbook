import { describe, expect, it } from "vitest";
import { bare, bareSlug } from "./slug";

describe("bare", () => {
  it("strips the collection prefix from an entry id", () => {
    expect(bare("farms/san-marzano")).toBe("san-marzano");
    expect(bare("recipes/carbonara")).toBe("carbonara");
  });

  it("keeps any trailing path segments intact (dish ids include /index)", () => {
    expect(bare("dishes/ragu/index")).toBe("ragu/index");
  });

  it("returns the input unchanged when there is no prefix to strip", () => {
    expect(bare("standalone")).toBe("standalone");
  });
});

describe("bareSlug", () => {
  it("strips both the collection prefix and a trailing /index", () => {
    expect(bareSlug("dishes/ragu/index")).toBe("ragu");
  });

  it("matches bare() output for non-dish ids (no /index to strip)", () => {
    expect(bareSlug("farms/san-marzano")).toBe("san-marzano");
  });
});
