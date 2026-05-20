import { describe, expect, it, vi } from "vitest";

// journey.ts imports from astro:content; mock it so we can load the module in a unit test.
vi.mock("astro:content", () => ({ getCollection: vi.fn() }));

const { nameFromText } = await import("./journey");

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
