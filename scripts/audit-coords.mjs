#!/usr/bin/env node
/**
 * audit-coords.mjs — sanity-check lat/lng on every farm + restaurant.
 *
 * Flags:
 *   - Out-of-range values (lat outside [-90, 90], lng outside [-180, 180]).
 *   - Exactly (0, 0) which is almost always a placeholder, not Null Island.
 *   - Suspiciously low precision (≤ 1 decimal place) — typical for a guess.
 *   - Duplicates across entries (multiple farms / restaurants at the same pin).
 *
 * Exit code is 0 by default; pass `--strict` to exit 1 when anything's flagged
 * so it can be used as a CI gate. Run: `node scripts/audit-coords.mjs`.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const COLLECTIONS = ["src/content/farms", "src/content/restaurants"];

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    if (e.isDirectory()) continue;
    if (!e.name.endsWith(".mdx")) continue;
    out.push(join(dir, e.name));
  }
  return out;
}

function extract(frontmatter, key) {
  const m = frontmatter.match(new RegExp(`^${key}:\\s*([-+]?\\d+(?:\\.\\d+)?)`, "m"));
  return m ? Number.parseFloat(m[1]) : null;
}

async function loadCoords(path) {
  const raw = await readFile(path, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const lat = extract(fm[1], "lat");
  const lng = extract(fm[1], "lng");
  if (lat === null || lng === null) return null;
  return { path, lat, lng };
}

function precisionOf(n) {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

function report(title, items) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}):`);
  for (const it of items) {
    const rel = it.path.replace(`${process.cwd()}/`, "");
    console.log(`  - ${rel}  (${it.lat}, ${it.lng})`);
  }
}

async function main() {
  const strict = process.argv.includes("--strict");
  const all = [];
  for (const dir of COLLECTIONS) {
    const files = await walk(dir);
    for (const f of files) {
      const c = await loadCoords(f);
      if (c) all.push(c);
    }
  }
  console.log(`Audited ${all.length} entries.`);

  const oob = all.filter((c) => c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180);
  const nullIsland = all.filter((c) => c.lat === 0 && c.lng === 0);
  const lowPrecision = all.filter((c) => precisionOf(c.lat) <= 1 || precisionOf(c.lng) <= 1);

  const seen = new Map();
  const dupes = [];
  for (const c of all) {
    const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    const prior = seen.get(key);
    if (prior) dupes.push(c);
    else seen.set(key, c);
  }

  report("Out of valid range", oob);
  report("Null Island (0, 0) — almost always a placeholder", nullIsland);
  report("Suspiciously low precision (≤ 1 dp)", lowPrecision);
  report("Duplicate coordinates (rounded to 4 dp)", dupes);
  console.log("");

  if (strict && (oob.length + nullIsland.length + dupes.length > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
