import { beforeEach, describe, expect, it, vi } from "vitest";

const getCollection = vi.fn();
vi.mock("astro:content", () => ({ getCollection }));

const { siblingsOf } = await import("./siblings");

type Visibility = "public" | "unlisted";
// Populate every collection's sort-key field; the SUT pulls whichever the
// caller asks for via the sortKey callback.
const entry = (id: string, key: string, visibility: Visibility = "public") =>
  ({ id, data: { name: key, title: key, plant: key, planted: key, visibility } }) as never;

beforeEach(() => {
  getCollection.mockReset();
});

describe("siblingsOf", () => {
  it("returns alphabetical neighbours by the supplied sort key", async () => {
    getCollection.mockResolvedValueOnce([
      entry("farms/a", "Apple Farm"),
      entry("farms/c", "Cherry Farm"),
      entry("farms/b", "Banana Farm"),
    ]);
    const { prev, next } = await siblingsOf("farms", "farms/b", (f) => f.data.name);
    expect(prev?.id).toBe("farms/a");
    expect(next?.id).toBe("farms/c");
  });

  it("returns null for prev at the start and null for next at the end", async () => {
    getCollection.mockResolvedValueOnce([
      entry("farms/a", "Apple Farm"),
      entry("farms/b", "Banana Farm"),
    ]);
    const first = await siblingsOf("farms", "farms/a", (f) => f.data.name);
    expect(first.prev).toBeNull();
    expect(first.next?.id).toBe("farms/b");

    getCollection.mockResolvedValueOnce([
      entry("farms/a", "Apple Farm"),
      entry("farms/b", "Banana Farm"),
    ]);
    const last = await siblingsOf("farms", "farms/b", (f) => f.data.name);
    expect(last.prev?.id).toBe("farms/a");
    expect(last.next).toBeNull();
  });

  it("reverses the order when direction is 'desc'", async () => {
    getCollection.mockResolvedValueOnce([
      entry("meals/x", "A"),
      entry("meals/y", "C"),
      entry("meals/z", "B"),
    ]);
    // Desc order: C, B, A → current = B → prev = C, next = A
    const { prev, next } = await siblingsOf("meals", "meals/z", (m) => m.data.title, "desc");
    expect(prev?.id).toBe("meals/y");
    expect(next?.id).toBe("meals/x");
  });

  it("treats accent-insensitive equivalents as adjacent", async () => {
    getCollection.mockResolvedValueOnce([
      entry("recipes/a", "Crème brûlée"),
      entry("recipes/b", "Daube"),
      entry("recipes/c", "Crepe"),
    ]);
    const { prev, next } = await siblingsOf("recipes", "recipes/c", (r) => r.data.title);
    expect(prev?.id).toBe("recipes/a");
    expect(next?.id).toBe("recipes/b");
  });

  it("returns null/null when the current entry is unlisted (filtered out by publicOnly)", async () => {
    getCollection.mockResolvedValueOnce([
      entry("farms/a", "Apple Farm"),
      entry("farms/hidden", "Hidden Farm", "unlisted"),
      entry("farms/b", "Banana Farm"),
    ]);
    const { prev, next } = await siblingsOf("farms", "farms/hidden", (f) => f.data.name);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("links public neighbours past a filtered-out unlisted entry", async () => {
    getCollection.mockResolvedValueOnce([
      entry("farms/a", "Apple Farm"),
      entry("farms/hidden", "Banana Hidden", "unlisted"),
      entry("farms/c", "Cherry Farm"),
    ]);
    const { prev, next } = await siblingsOf("farms", "farms/a", (f) => f.data.name);
    expect(prev).toBeNull();
    expect(next?.id).toBe("farms/c");
  });

  it("returns null/null when the current id matches no entry", async () => {
    getCollection.mockResolvedValueOnce([entry("farms/a", "Apple Farm")]);
    const { prev, next } = await siblingsOf("farms", "farms/missing", (f) => f.data.name);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});
