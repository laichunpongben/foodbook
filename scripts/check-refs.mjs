#!/usr/bin/env node
/**
 * check-refs.mjs — verify cross-collection slug references resolve.
 *
 * Dishes reference recipes/, farms/, restaurants/, meals/ by slug
 * (see ADR-0002). Recipe ingredients also carry a scalar `from:` slug
 * pointing at a farm or a garden bed — also validated here. Zod can't
 * check existence; this script can. Runs as `npm run check:refs` and
 * in CI.
 */

import { join } from "node:path";

import { CONTENT_ROOT, listSlugs } from "./lib/content.mjs";
import { readFrontmatter } from "./lib/frontmatter.mjs";

function extractRefs(fm) {
  // Naive: matches `farms: ['a', 'b']` style arrays.
  const out = { farms: [], recipes: [], restaurants: [], meals: [], garden: [], dishes: [] };
  const re = /\b(farms|recipes|restaurants|meals|garden|dishes):\s*\[([^\]]*)\]/g;
  for (const m of fm.matchAll(re)) {
    const key = m[1];
    const items = m[2]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    out[key].push(...items);
  }
  return out;
}

/**
 * Recipe ingredients carry a scalar `from:` slug pointing at a farm or
 * a garden bed. The recipe page renders these as `/farms/...` or
 * `/garden/...` cross-links — bad slugs soft-404, so validate at build.
 */
function extractIngredientFroms(fm) {
  const out = [];
  const re = /^ {4}from:\s*['"]?([^'"\n]+)['"]?\s*$/gm;
  for (const m of fm.matchAll(re)) out.push(m[1].trim());
  return out;
}

const collections = ["dishes", "recipes", "restaurants", "farms", "meals", "garden"];
const slugs = Object.fromEntries(
  await Promise.all(collections.map(async (c) => [c, new Set(await listSlugs(c))])),
);

let broken = 0;
const producerSlugs = new Set([...slugs.farms, ...slugs.garden]);
for (const c of collections) {
  for (const slug of slugs[c]) {
    const path =
      c === "dishes"
        ? join(CONTENT_ROOT, c, slug, "index.mdx")
        : join(CONTENT_ROOT, c, `${slug}.mdx`);
    let fm;
    try {
      fm = await readFrontmatter(path);
    } catch {
      continue;
    }
    const refs = extractRefs(fm);
    for (const [refKey, refList] of Object.entries(refs)) {
      for (const target of refList) {
        if (!slugs[refKey]?.has(target)) {
          console.error(`✗ ${c}/${slug} → ${refKey}/${target} — missing`);
          broken++;
        }
      }
    }
    if (c === "recipes") {
      for (const target of extractIngredientFroms(fm)) {
        if (!producerSlugs.has(target)) {
          console.error(
            `✗ recipes/${slug} → ingredient from:${target} — missing in farms or garden`,
          );
          broken++;
        }
      }
    }
  }
}

if (broken > 0) {
  console.error(`\n${broken} broken reference(s).`);
  process.exit(1);
}
console.log("✓ all cross-references resolve");
