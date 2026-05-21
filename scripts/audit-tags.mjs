#!/usr/bin/env node
/**
 * audit-tags.mjs — report tag-coverage gaps across the corpus.
 *
 * Reads every dish / recipe / restaurant / meal MDX frontmatter (minimal
 * regex parse — no Astro runtime needed) and surfaces:
 *
 *   1. Entries with no `tags:` at all (or empty array).
 *   2. Dishes / recipes missing a meal-type tag
 *      (breakfast / lunch / dinner / snack / dessert / drink).
 *   3. Dishes / recipes missing a cuisine tag from the canonical set.
 *
 * Exit code is always 0 — this is an editorial pass, not a CI gate.
 * Run with: node scripts/audit-tags.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MEAL_TAGS = new Set(["breakfast", "lunch", "dinner", "snack", "dessert", "drink"]);
const CUISINE_TAGS = new Set([
  "italian",
  "japanese",
  "chinese",
  "french",
  "mexican",
  "thai",
  "indian",
  "levantine",
  "iberian",
  "nordic",
]);

const COLLECTIONS = {
  dishes: { dir: "src/content/dishes", pattern: /\/index\.mdx$/ },
  recipes: { dir: "src/content/recipes", pattern: /\.mdx$/ },
  restaurants: { dir: "src/content/restaurants", pattern: /\.mdx$/ },
  meals: { dir: "src/content/meals", pattern: /\.mdx$/ },
};

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
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(path)));
    } else {
      out.push(path);
    }
  }
  return out;
}

function extractTags(frontmatter) {
  const m = frontmatter.match(/^tags:\s*\[(.*?)\]/m);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((t) => t.trim().replace(/^['"]/, "").replace(/['"]$/, ""))
    .filter(Boolean);
}

async function loadEntries(kind, conf) {
  const files = (await walk(conf.dir)).filter((f) => conf.pattern.test(f));
  const out = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const fm = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const tags = extractTags(fm[1]);
    out.push({ kind, file, tags });
  }
  return out;
}

function report(title, entries) {
  if (entries.length === 0) return;
  console.log(`\n${title} (${entries.length}):`);
  for (const e of entries) {
    const rel = e.file.replace(`${process.cwd()}/`, "");
    console.log(`  - ${rel}${e.tags.length ? `  [${e.tags.join(", ")}]` : ""}`);
  }
}

async function main() {
  const all = [];
  for (const [kind, conf] of Object.entries(COLLECTIONS)) {
    all.push(...(await loadEntries(kind, conf)));
  }

  const untagged = all.filter((e) => e.tags.length === 0);
  const dishOrRecipe = all.filter((e) => e.kind === "dishes" || e.kind === "recipes");
  const missingMeal = dishOrRecipe.filter((e) => !e.tags.some((t) => MEAL_TAGS.has(t)));
  const missingCuisine = dishOrRecipe.filter((e) => !e.tags.some((t) => CUISINE_TAGS.has(t)));

  console.log(`Audited ${all.length} entries across ${Object.keys(COLLECTIONS).length} collections.`);
  report("Untagged entirely", untagged);
  report("Missing a meal-type tag (dishes + recipes)", missingMeal);
  report("Missing a cuisine tag (dishes + recipes)", missingCuisine);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
