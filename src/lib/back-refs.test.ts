import { beforeEach, describe, expect, it, vi } from "vitest";

const getCollection = vi.fn();
vi.mock("astro:content", () => ({ getCollection }));

const { dishesReferencing } = await import("./back-refs");

const dish = (id: string, stages: Record<string, unknown>) => ({ id, data: { stages } }) as never;

beforeEach(() => {
  getCollection.mockReset();
});

describe("dishesReferencing", () => {
  it("matches farms across source and grow stages", async () => {
    getCollection.mockResolvedValueOnce([
      dish("dishes/ragu", { source: { farms: ["san-marzano"] } }),
      dish("dishes/herb-salad", { grow: { farms: ["herbarium"] } }),
      dish("dishes/pesto", { source: { farms: ["liguria-basil"] } }),
    ]);
    const out = await dishesReferencing("farm", "san-marzano");
    expect(out.map((d) => d.id)).toEqual(["dishes/ragu"]);

    getCollection.mockResolvedValueOnce([
      dish("dishes/herb-salad", { grow: { farms: ["herbarium"] } }),
    ]);
    expect((await dishesReferencing("farm", "herbarium")).map((d) => d.id)).toEqual([
      "dishes/herb-salad",
    ]);
  });

  it("matches garden across source and grow stages", async () => {
    getCollection.mockResolvedValueOnce([
      dish("dishes/basil-pasta", { grow: { garden: ["bed-a1"] } }),
      dish("dishes/ragu", { source: { garden: ["other-bed"] } }),
    ]);
    const out = await dishesReferencing("garden", "bed-a1");
    expect(out.map((d) => d.id)).toEqual(["dishes/basil-pasta"]);
  });

  it("matches recipes on the cook stage", async () => {
    getCollection.mockResolvedValueOnce([
      dish("dishes/ragu", { cook: { recipes: ["nonna-ragu-v3"] } }),
      dish("dishes/lasagne", { cook: { recipes: ["lasagne-v1"] } }),
    ]);
    expect((await dishesReferencing("recipe", "nonna-ragu-v3")).map((d) => d.id)).toEqual([
      "dishes/ragu",
    ]);
  });

  it("matches restaurants on the eat stage", async () => {
    getCollection.mockResolvedValueOnce([
      dish("dishes/risotto", { eat: { restaurants: ["bombana"] } }),
    ]);
    expect((await dishesReferencing("restaurant", "bombana")).map((d) => d.id)).toEqual([
      "dishes/risotto",
    ]);
  });

  it("returns an empty list when no dish references the slug or has no stages", async () => {
    getCollection.mockResolvedValueOnce([
      dish("dishes/ragu", { source: { farms: ["san-marzano"] } }),
      { id: "dishes/empty", data: {} } as never,
    ]);
    expect(await dishesReferencing("farm", "nonexistent")).toEqual([]);
  });
});
