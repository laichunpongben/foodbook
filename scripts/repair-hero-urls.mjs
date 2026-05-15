#!/usr/bin/env node
/**
 * repair-hero-urls.mjs — detects broken Wikimedia `heroUrl`s on dish
 * entries and suggests replacements from the corresponding Wikipedia
 * article's current lead image (`/api/rest_v1/page/summary`).
 *
 * Default run is dry: prints status + Wikipedia title + article
 * description per dish so you can eyeball disambiguation hits before
 * pasting. Pass `--write` to rewrite the broken `heroUrl:` lines in
 * place; the git diff is the safety net.
 *
 * Usage:
 *   node scripts/repair-hero-urls.mjs            # dry run
 *   node scripts/repair-hero-urls.mjs --write    # apply
 *
 * Limitations:
 * - English Wikipedia only.
 * - Slug → title heuristic is "capitalize first word, hyphen→underscore".
 *   When that lands on a wrong article (e.g. `adobo` → Iberian marinade,
 *   not the Filipino dish), use TITLE_OVERRIDES below.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CONTENT_ROOT, listSlugs } from './lib/content.mjs';
import { getString, readFrontmatter } from './lib/frontmatter.mjs';

const DISHES_DIR = join(CONTENT_ROOT, 'dishes');
const LABEL_WIDTH = 28;

const WRITE = process.argv.includes('--write');

// Slugs whose Wikipedia article title isn't `Slug_with_underscores` —
// disambiguation pages (Hopper, Momo, Adobo all collide with non-food
// meanings), missing dedicated articles (shoyu-ramen folds into Ramen),
// and known romanization mismatches (pad-kra-pao vs Phat_kaphrao).
const TITLE_OVERRIDES = {
  adobo: 'Philippine_adobo',
  hoppers: 'Appam',
  kimbap: 'Gimbap',
  momo: 'Momo_(food)',
  'pad-kra-pao': 'Phat_kaphrao',
  'risotto-milanese': 'Risotto',
  'shoyu-ramen': 'Ramen',
  'taiwanese-beef-noodle-soup': 'Beef_noodle_soup',
  'tom-yum-goong': 'Tom_yum',
  'wonton-noodle-soup': 'Wonton_noodles',
};

const UA = 'foodbook-repair/1.0 (https://github.com/laichunpongben/foodbook)';
// Gap is enforced on request *start*, not completion — slow requests
// don't earn extra credit. Wikimedia rate-limits on starts too.
const REQUEST_GAP_MS = 800;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 4000;
let lastFetchAt = 0;

async function throttledFetch(url, init) {
  const wait = Math.max(0, lastFetchAt + REQUEST_GAP_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, ...init });
    if (res.ok || res.status === 404) return res;
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('exhausted retries');
}

// Throws on network/transient errors so the caller can surface them
// rather than mistaking a DNS blip for a 404 (which would --write a
// "repair" over a good URL).
async function isLive(url) {
  const res = await throttledFetch(url, { method: 'HEAD' });
  return res.ok;
}

function slugToTitle(slug) {
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];
  const parts = slug.split('-');
  parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.join('_');
}

async function lookupArticle(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await throttledFetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function rewriteHeroUrl(mdxPath, newUrl) {
  const text = await readFile(mdxPath, 'utf8');
  const updated = text.replace(/^heroUrl:\s*"[^"]*"$/m, `heroUrl: "${newUrl}"`);
  if (updated === text) throw new Error('heroUrl: line not found');
  await writeFile(mdxPath, updated);
}

const slugs = await listSlugs('dishes');

console.log(`# repair-hero-urls ${WRITE ? '(WRITE)' : '(dry run)'}\n`);

let live = 0;
let repaired = 0;
let needsOverride = 0;
let noPhoto = 0;
let errored = 0;

for (const slug of slugs) {
  const mdx = join(DISHES_DIR, slug, 'index.mdx');
  let fm;
  try {
    fm = await readFrontmatter(mdx);
  } catch {
    continue;
  }
  const heroUrl = getString(fm, 'heroUrl');
  const label = slug.padEnd(LABEL_WIDTH);

  if (!heroUrl) {
    console.log(`${label}(no heroUrl)`);
    noPhoto++;
    continue;
  }

  let alive;
  try {
    alive = await isLive(heroUrl);
  } catch (err) {
    console.log(`${label}ERROR  liveness check: ${err.message}`);
    errored++;
    continue;
  }
  if (alive) {
    live++;
    continue;
  }

  const title = slugToTitle(slug);
  let article;
  try {
    article = await lookupArticle(title);
  } catch (err) {
    console.log(`${label}ERROR  ${err.message}`);
    errored++;
    continue;
  }

  if (!article) {
    console.log(`${label}404    title="${title}" — add to TITLE_OVERRIDES`);
    needsOverride++;
    continue;
  }
  // Wikipedia returns `disambiguation`, `no-extract`, etc. for pages
  // that don't carry usable content. Only `standard` articles have a
  // reliable lead image worth pasting.
  if (article.type !== 'standard') {
    console.log(`${label}${article.type.toUpperCase().padEnd(6)} "${article.title}" — non-standard page, set TITLE_OVERRIDES`);
    needsOverride++;
    continue;
  }
  const newUrl = article.originalimage?.source ?? article.thumbnail?.source;
  if (!newUrl) {
    console.log(`${label}NO-IMG "${article.title}" — article has no lead image`);
    needsOverride++;
    continue;
  }

  console.log(`${label}REPAIR "${article.title}" — ${article.description ?? '(no description)'}`);
  console.log(`${' '.repeat(LABEL_WIDTH)}       → ${newUrl}`);

  if (WRITE) {
    try {
      await rewriteHeroUrl(mdx, newUrl);
    } catch (err) {
      console.log(`${' '.repeat(LABEL_WIDTH)}       write failed: ${err.message}`);
      errored++;
      continue;
    }
  }
  repaired++;
}

console.log(
  `\n# ${live} live · ${repaired} ${WRITE ? 'rewritten' : 'repairable'} · ${needsOverride} need override · ${noPhoto} no photo · ${errored} error`,
);
