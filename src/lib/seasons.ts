/**
 * seasons — geometry + grouping for the /seasons wheel.
 *
 * Every farm/producer entry carries zero or more `seasonalWindow` rows:
 *
 *   seasonalWindow:
 *     - { product: "tomato", from: 7, to: 9 }
 *     - { product: "winter squash", from: 10, to: 2 }   ← wraps across year
 *
 * This module turns those windows into the data the SeasonalWheel SVG
 * needs: one entry per product (merged across farms), the start/end
 * angles to draw on a 12-month ring, and a flag for whether the
 * product is in season *right now*.
 *
 * Pure functions only — no DOM, no d3. The component handles SVG paths.
 */
import type { CollectionEntry } from "astro:content";

export type Farm = CollectionEntry<"farms">;

export interface FarmRef {
  name: string;
  slug: string;
}

export interface SeasonProduct {
  /** Display name, as authored on the farm entry. */
  product: string;
  /** Lowercased product name — used as the merge key across farms. */
  key: string;
  /** All farms that grow this product, in entry order. */
  farms: FarmRef[];
  /** Month window 1-12. Wraps across year when `from > to`. */
  from: number;
  to: number;
}

/** Tau (one turn). d3-shape's arc treats 0 as 12 o'clock and increases
 *  clockwise, so a full 12-month ring is exactly TAU. */
export const TAU = Math.PI * 2;

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Is month `m` (1-12) inside a window from..to, handling wrap-around. */
export function inSeason(from: number, to: number, m: number): boolean {
  if (from <= to) return m >= from && m <= to;
  return m >= from || m <= to;
}

/** Collect every product across every farm. Same product on multiple
 *  farms merges into one entry — the union of their windows. */
export function collectProducts(farms: readonly Farm[]): SeasonProduct[] {
  const byKey = new Map<string, SeasonProduct>();

  for (const farm of farms) {
    const farmRef: FarmRef = { name: farm.data.name, slug: farm.id };
    for (const win of farm.data.seasonalWindow ?? []) {
      const key = win.product.trim().toLowerCase();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          product: win.product,
          key,
          farms: [farmRef],
          from: win.from,
          to: win.to,
        });
        continue;
      }
      if (!existing.farms.some((f) => f.slug === farmRef.slug)) {
        existing.farms.push(farmRef);
      }
      const merged = mergeWindows(
        { from: existing.from, to: existing.to },
        { from: win.from, to: win.to },
      );
      existing.from = merged.from;
      existing.to = merged.to;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const da = monthSpan(a.from, a.to);
    const db = monthSpan(b.from, b.to);
    if (da !== db) return db - da; // widest windows first (outer rings)
    return a.product.localeCompare(b.product);
  });
}

/** Number of months covered by a window, 1-12 inclusive (wrap-aware). */
export function monthSpan(from: number, to: number): number {
  if (from <= to) return to - from + 1;
  return 12 - from + 1 + to;
}

/** Merge two month windows into the smallest window that contains both.
 *  Disjoint windows aren't representable as one arc, so we fall back to
 *  the union by taking the earlier `from` and later `to` on the same
 *  side of the year. Edge cases here are rare in practice — almost all
 *  product windows on the same item already overlap. */
export function mergeWindows(
  a: { from: number; to: number },
  b: { from: number; to: number },
): { from: number; to: number } {
  if (inSeason(a.from, a.to, b.from) && inSeason(a.from, a.to, b.to)) return a;
  if (inSeason(b.from, b.to, a.from) && inSeason(b.from, b.to, a.to)) return b;

  // Otherwise pick the earlier start and later end (naive union).
  const from = inSeason(b.from, b.to, a.from) ? b.from : a.from;
  const to = inSeason(a.from, a.to, b.to) ? a.to : b.to;
  return { from, to };
}

/** d3-arc start/end angles in radians. 0 = 12 o'clock, clockwise.
 *  endAngle is always > startAngle, even when the window wraps. */
export function windowAngles(from: number, to: number): [number, number] {
  const start = ((from - 1) / 12) * TAU;
  let end = (to / 12) * TAU;
  if (to < from) end += TAU;
  return [start, end];
}

/** SVG position helper. Standard math angle θ from +x axis, but we
 *  rotate -π/2 so θ=0 lands at 12 o'clock (matching the wheel). */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleFromTop: number,
): { x: number; y: number } {
  const a = angleFromTop - Math.PI / 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}
