import { describe, expect, it } from "vitest";
import { resolveProducer } from "./producers";

type Farm = { id: string; data: { name: string } };
type Garden = { id: string; data: { plant: string } };

const farms = [
  { id: "farms/casa-marrazzo", data: { name: "Casa Marrazzo" } },
  { id: "farms/yuasa-shoyu-brewery", data: { name: "Yuasa Shoyu Brewery" } },
] as unknown as Farm[];

const gardens = [{ id: "garden/basil-pots", data: { plant: "Basil" } }] as unknown as Garden[];

const catalog = { farms: farms as never, gardens: gardens as never };

describe("resolveProducer", () => {
  it("resolves a farm slug to its detail page link", () => {
    expect(resolveProducer("casa-marrazzo", catalog)).toEqual({
      href: "/farms/casa-marrazzo/",
      label: "Casa Marrazzo",
    });
  });

  it("falls through to gardens when no farm matches", () => {
    expect(resolveProducer("basil-pots", catalog)).toEqual({
      href: "/garden/basil-pots/",
      label: "Basil",
    });
  });

  it("returns null when no farm or garden matches the slug", () => {
    expect(resolveProducer("not-in-catalog", catalog)).toBeNull();
  });

  it("prefers a farm match when slugs collide", () => {
    const collide = {
      farms: [{ id: "farms/x", data: { name: "X-farm" } }] as never,
      gardens: [{ id: "garden/x", data: { plant: "X-plant" } }] as never,
    };
    expect(resolveProducer("x", collide)).toEqual({ href: "/farms/x/", label: "X-farm" });
  });
});
