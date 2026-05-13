#!/usr/bin/env node
/**
 * check-refs.mjs — verify cross-collection slug references resolve.
 *
 * Dishes reference recipes/, farms/, restaurants/, meals/ by slug
 * (see ADR-0002). Zod can't validate that those slugs *exist*; this
 * script does. Runs as `npm run check:refs` and in CI.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../src/content/', import.meta.url).pathname;

async function listSlugs(collection, opts = {}) {
  const dir = join(ROOT, collection);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return new Set();
  }
  const out = new Set();
  for (const name of entries) {
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) out.add(name);
    else if (name.endsWith('.mdx')) out.add(name.replace(/\.mdx$/, ''));
  }
  return out;
}

async function readFrontmatter(path) {
  const text = await readFile(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1] ?? '';
}

function extractRefs(fm) {
  // Naive: matches `farms: ['a', 'b']` style arrays.
  const out = { farms: [], recipes: [], restaurants: [], meals: [], garden: [], dishes: [] };
  const re = /\b(farms|recipes|restaurants|meals|garden|dishes):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(fm))) {
    const key = m[1];
    const items = m[2]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    out[key].push(...items);
  }
  return out;
}

const collections = ['dishes', 'recipes', 'restaurants', 'farms', 'meals', 'garden'];
const slugs = Object.fromEntries(
  await Promise.all(collections.map(async (c) => [c, await listSlugs(c)])),
);

let broken = 0;
for (const c of collections) {
  for (const slug of slugs[c]) {
    const path =
      c === 'dishes' ? join(ROOT, c, slug, 'index.mdx') : join(ROOT, c, `${slug}.mdx`);
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
  }
}

if (broken > 0) {
  console.error(`\n${broken} broken reference(s).`);
  process.exit(1);
}
console.log('✓ all cross-references resolve');
