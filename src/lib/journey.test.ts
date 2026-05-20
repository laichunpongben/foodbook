import { beforeEach, describe, expect, it, vi } from "vitest";

const getCollection = vi.fn();
vi.mock("astro:content", () => ({ getCollection }));

const { getJourney, nameFromText } = await import("./journey");

describe("nameFromText", () => {
  it("strips a leading weight + unit", () => {
    expect(nameFromText("1.2 kg San Marzano tomatoes")).toBe("San Marzano tomatoes");
    expect(nameFromText("500 g pasta")).toBe("Pasta");
  });

  it("strips a leading volume + unit", () => {
    expect(nameFromText("1/2 cup olive oil")).toBe("Olive oil");
    expect(nameFromText("2 tbsp salt")).toBe("Salt");
  });

  it("strips a leading count + measure-word", () => {
    expect(nameFromText("3 cloves garlic")).toBe("Garlic");
    expect(nameFromText("5 stalks celery")).toBe("Celery");
  });

  it("capitalizes the first character of the remainder", () => {
    expect(nameFromText("tomatoes")).toBe("Tomatoes");
  });

  it("leaves a string with no quantity untouched (beyond capitalization)", () => {
    expect(nameFromText("flaky sea salt")).toBe("Flaky sea salt");
  });
});

type Collections = Partial<{
  farms: unknown[];
  garden: unknown[];
  recipes: unknown[];
  meals: unknown[];
  restaurants: unknown[];
}>;

function stubCollections(c: Collections) {
  getCollection.mockImplementation(async (name: keyof Collections) => c[name] ?? []);
}

const ragu = {
  id: "dishes/ragu/index",
  data: {
    shortTitle: "Ragu",
    title: "<em>Ragu</em>",
    tagline: "Slow-simmered.",
    stages: {
      cook: { recipes: ["nonna-ragu"] },
      eat: { meals: ["sunday-lunch"], restaurants: ["trattoria-da-me-bologna"] },
    },
  },
} as never;

beforeEach(() => {
  getCollection.mockReset();
});

describe("getJourney", () => {
  it("composes ingredients, cook nodes, and eat nodes from a dish's stages", async () => {
    stubCollections({
      farms: [
        {
          id: "farms/san-marzano",
          data: { name: "San Marzano Co-op", location: "Sarno Valley", heroUrl: "h.jpg" },
        },
      ],
      garden: [],
      recipes: [
        {
          id: "recipes/nonna-ragu",
          data: {
            title: "Nonna's Ragu",
            yield: "4 servings",
            timePrep: "15 min",
            timeCook: "3 h",
            ingredients: [{ text: "1.2 kg tomatoes", from: "san-marzano" }, { text: "onion" }],
          },
        },
      ],
      meals: [{ id: "meals/sunday-lunch", data: { title: "Sunday lunch", date: "2026-04-12" } }],
      restaurants: [
        {
          id: "restaurants/trattoria-da-me-bologna",
          data: { name: "Trattoria da Me", city: "Bologna", priceBand: "$$", visits: [{}] },
        },
      ],
    });

    const journey = await getJourney(ragu);

    expect(journey.dish.slug).toBe("ragu");
    expect(journey.dish.label).toBe("Ragu");

    expect(journey.ingredients).toHaveLength(2);
    expect(journey.ingredients[0].origin).toEqual({
      kind: "farm",
      slug: "san-marzano",
      name: "San Marzano Co-op",
      location: "Sarno Valley",
      heroUrl: "h.jpg",
    });
    expect(journey.ingredients[1].name).toBe("Onion");
    expect(journey.ingredients[1].origin).toBeUndefined();

    expect(journey.cook).toHaveLength(1);
    expect(journey.cook[0]).toMatchObject({
      slug: "nonna-ragu",
      label: "Nonna's Ragu",
      meta: "4 servings · 15 min + 3 h",
    });

    expect(journey.eat).toHaveLength(2);
    expect(journey.eat[0]).toMatchObject({ kind: "meal", slug: "sunday-lunch" });
    expect(journey.eat[1]).toMatchObject({
      kind: "restaurant",
      slug: "trattoria-da-me-bologna",
      status: "visited",
    });
  });

  it("returns empty sections when the dish has no stages", async () => {
    stubCollections({});
    const empty = { id: "dishes/empty/index", data: { shortTitle: "", title: "" } } as never;
    const journey = await getJourney(empty);
    expect(journey.ingredients).toEqual([]);
    expect(journey.cook).toEqual([]);
    expect(journey.eat).toEqual([]);
  });

  it("falls back to garden when a recipe's `from:` slug matches no farm", async () => {
    stubCollections({
      farms: [],
      garden: [
        {
          id: "garden/bed-a1",
          data: { plant: "Sweet basil", bed: "Bed A1", heroUrl: "g.jpg" },
        },
      ],
      recipes: [
        {
          id: "recipes/pesto",
          data: {
            title: "Pesto",
            yield: "2 cups",
            ingredients: [{ text: "1 bunch basil", from: "bed-a1" }],
          },
        },
      ],
    });
    const pesto = {
      id: "dishes/pesto/index",
      data: { shortTitle: "Pesto", title: "Pesto", stages: { cook: { recipes: ["pesto"] } } },
    } as never;
    const journey = await getJourney(pesto);
    expect(journey.ingredients[0].origin).toEqual({
      kind: "garden",
      slug: "bed-a1",
      name: "Sweet basil",
      location: "Bed A1",
      heroUrl: "g.jpg",
    });
  });

  it("marks a restaurant without visits as 'discovered'", async () => {
    stubCollections({
      restaurants: [
        {
          id: "restaurants/rezdora-nyc",
          data: {
            name: "Rezdôra",
            city: "New York",
            priceBand: "$$$",
            cuisine: "Emilian",
            visits: [],
            discoveredVia: { source: "TasteAtlas", signature: "Tortellini in brodo" },
          },
        },
      ],
    });
    const dish = {
      id: "dishes/tortellini/index",
      data: {
        shortTitle: "Tortellini",
        title: "Tortellini",
        stages: { eat: { restaurants: ["rezdora-nyc"] } },
      },
    } as never;
    const journey = await getJourney(dish);
    expect(journey.eat[0]).toMatchObject({ status: "discovered", facts: ["Tortellini in brodo"] });
  });
});
