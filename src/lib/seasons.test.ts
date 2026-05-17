import { describe, expect, it } from "vitest";
import { inSeason, mergeWindows, monthSpan, TAU, windowAngles } from "./seasons";

describe("inSeason", () => {
  it("matches months inside a non-wrapping window", () => {
    expect(inSeason(5, 9, 7)).toBe(true);
    expect(inSeason(5, 9, 5)).toBe(true);
    expect(inSeason(5, 9, 9)).toBe(true);
  });

  it("rejects months outside a non-wrapping window", () => {
    expect(inSeason(5, 9, 4)).toBe(false);
    expect(inSeason(5, 9, 10)).toBe(false);
  });

  it("matches months inside a year-wrapping window", () => {
    expect(inSeason(10, 2, 11)).toBe(true);
    expect(inSeason(10, 2, 1)).toBe(true);
    expect(inSeason(10, 2, 10)).toBe(true);
    expect(inSeason(10, 2, 2)).toBe(true);
  });

  it("rejects months outside a year-wrapping window", () => {
    expect(inSeason(10, 2, 5)).toBe(false);
    expect(inSeason(10, 2, 9)).toBe(false);
    expect(inSeason(10, 2, 3)).toBe(false);
  });
});

describe("monthSpan", () => {
  it("counts inclusive months for a non-wrapping window", () => {
    expect(monthSpan(5, 9)).toBe(5);
    expect(monthSpan(1, 12)).toBe(12);
    expect(monthSpan(7, 7)).toBe(1);
  });

  it("counts inclusive months for a wrapping window", () => {
    expect(monthSpan(10, 2)).toBe(5); // Oct, Nov, Dec, Jan, Feb
    expect(monthSpan(12, 1)).toBe(2);
  });
});

describe("mergeWindows", () => {
  it("returns the larger window when one contains the other", () => {
    const big = { from: 4, to: 10 };
    const small = { from: 5, to: 9 };
    expect(mergeWindows(big, small)).toEqual(big);
    expect(mergeWindows(small, big)).toEqual(big);
  });

  it("returns the same window when both are identical", () => {
    const w = { from: 6, to: 8 };
    expect(mergeWindows(w, w)).toEqual(w);
  });
});

describe("windowAngles", () => {
  it("produces ordered [start, end] angles for a non-wrapping window", () => {
    const [start, end] = windowAngles(1, 12);
    expect(start).toBeCloseTo(0);
    expect(end).toBeCloseTo(TAU);
  });

  it("keeps endAngle > startAngle when the window wraps", () => {
    const [start, end] = windowAngles(10, 2);
    expect(end).toBeGreaterThan(start);
  });
});
