#!/usr/bin/env node
/**
 * commons-mine-photos.mjs — for dishes still failing the audit's
 * resolution gates after upgrade-flagged-photos has run, search
 * Wikimedia Commons by category and propose the largest acceptable
 * photo when meaningfully better than the current heroUrl.
 *
 * Process:
 *   1. Read `/tmp/photo-audit.json` (dim cache, URL-keyed)
 *   2. For each dish whose current width × height fails RESOLUTION_GATE,
 *      query Commons categorymembers for `Category:<slugToCategory(slug)>`
 *   3. Batch imageinfo for the file titles, filter by mime + size + aspect
 *   4. Pick largest landscape-friendly candidate; propose if ≥1.5× current MP
 *
 * Quality-flagged dishes (sharpness/luma/contrast) aren't handled here —
 * the audit cache only carries dims. Process them in a follow-up that
 * extends the cache schema.
 *
 * Dry by default. `--write` rewrites `heroUrl:` lines.
 *
 * Usage:
 *   node scripts/commons-mine-photos.mjs            # dry run
 *   node scripts/commons-mine-photos.mjs --write    # apply
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CONTENT_ROOT, listSlugs } from './lib/content.mjs';
import { getString, readFrontmatter } from './lib/frontmatter.mjs';
import { rewriteHeroUrl } from './lib/mdx-hero.mjs';
import { RESOLUTION_GATE } from './lib/photo-thresholds.mjs';
import { createThrottledFetcher } from './lib/throttled-fetch.mjs';
import { slugToTitle } from './lib/wiki-titles.mjs';

const DISHES_DIR = join(CONTENT_ROOT, 'dishes');
const DIMS_CACHE_PATH = '/tmp/photo-audit.json';
const LABEL_WIDTH = 28;

const WRITE = process.argv.includes('--write');

// New image must be ≥ this many × current megapixels to be worth the
// swap. Below this, churn outweighs the gain.
const UPGRADE_RATIO = 1.5;

// Commons categorymembers limit. 50 is the API max; food-category
// pages typically have dozens to a few hundred members — 50 is
// enough to find a high-res hero without over-paginating.
const CATEGORY_LIMIT = 50;

// Commons category names that don't follow slugToTitle. Expanded as
// dry-runs surface "Category:X empty or missing" misses. Cases:
// - diacritics dropped from slug (banh-mi → Bánh mì)
// - British vs American spelling (chili → chilli)
// - parenthetical disambiguation absent from slug (bao → Bao (food))
// - localized name folded into broader topic (kottbullar → Swedish meatballs)
const CATEGORY_OVERRIDES = {
  'banh-mi': 'Bánh_mì',
  'chili-crab': 'Chilli_crab',
  'gado-gado': 'Gado-gado',
  'gua-bao': 'Gua_bao',
  kottbullar: 'Köttbullar',
  'rogan-josh': 'Rogan_Josh',
  'roti-canai': 'Roti_prata',
  'tonkotsu-ramen': 'Tonkotsu',
};

// Aspect bounds — skip extreme portraits (often menu cards or
// vertical-stack snapshots) and ultra-wide panoramas. The hero card
// is 4:5, so we want roughly square to landscape.
const MIN_ASPECT = 0.7;
const MAX_ASPECT = 2.5;

// File-title substrings that almost always mean the image isn't a
// clean shot of the finished dish. Cheap heuristic to avoid auto-
// picking partial/contextual/ingredient photos. Case-insensitive
// substring match against the title with underscores → spaces.
const TITLE_DENYLIST = [
  'half-eaten', 'half eaten', 'leftover', 'bitten', 'one bite',
  'vending', 'restocking', 'restock',
  'raw ingredients', 'preparation', 'making',
  'menu', 'storefront', 'restaurant exterior',
];

// Slug → exact Commons file title (without `File:` prefix) to bypass
// the auto-picker. Use when the algorithmic top pick has a flaw the
// denylist can't catch (wrong regional variant, dish in unusual
// presentation, etc.) and you've manually browsed for a better one.
const MANUAL_PICKS = {
  // banh-mi: auto-pick is "Banh Mi Burger" — fusion, not the classic.
  'banh-mi': '20240704 越式烤豬肉法國麵包.jpg',
  // bouillabaisse: auto-pick is dieppoise (Normandy variant); this
  // is the classic Marseille-style preparation.
  bouillabaisse: 'Bouillabaisse at restaurant Belge.jpg',
  // chili-crab: auto-pick is HK "Crab Sauce with Bun"; this is the
  // classic Singapore chili crab preparation.
  'chili-crab': 'Chilli crab-01.jpg',
};

const throttledFetch = createThrottledFetcher({
  ua: 'foodbook-commons-mine/1.0',
  gapMs: 1500,
  backoffBaseMs: 6000,
});

function slugToCategory(slug) {
  return CATEGORY_OVERRIDES[slug] ?? slugToTitle(slug);
}

async function listCategoryFiles(category) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmtype: 'file',
    cmlimit: String(CATEGORY_LIMIT),
  });
  const res = await throttledFetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.query?.categorymembers?.map((m) => m.title) ?? [];
}

async function getImageInfo(titles) {
  if (!titles.length) return [];
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    titles: titles.join('|'),
    iiprop: 'size|url|mime',
  });
  const res = await throttledFetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = data.query?.pages ?? {};
  return Object.values(pages)
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      return { title: p.title, width: info.width, height: info.height, url: info.url, mime: info.mime };
    })
    .filter(Boolean);
}

function passesDenylist(title) {
  const lower = title.toLowerCase().replace(/_/g, ' ');
  return !TITLE_DENYLIST.some((bad) => lower.includes(bad));
}

function rankCandidates(candidates, current, currentUrl) {
  const currentMP = (current.width * current.height) / 1_000_000;
  const minBetterMP = currentMP * UPGRADE_RATIO;
  return candidates
    .filter((c) => {
      if (c.url === currentUrl) return false;
      if (c.mime !== 'image/jpeg' && c.mime !== 'image/png') return false;
      if (c.width < RESOLUTION_GATE.minWidth) return false;
      const mp = (c.width * c.height) / 1_000_000;
      if (mp < RESOLUTION_GATE.minMegapixels) return false;
      if (mp < minBetterMP) return false;
      const aspect = c.width / c.height;
      if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return false;
      if (!passesDenylist(c.title)) return false;
      return true;
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);
}

const dimsCache = JSON.parse(await readFile(DIMS_CACHE_PATH, 'utf8'));
const slugs = await listSlugs('dishes');

console.log(`# commons-mine-photos ${WRITE ? '(WRITE)' : '(dry run)'}\n`);

let scanned = 0;
let flagged = 0;
let upgraded = 0;
let noBetter = 0;
let needsOverride = 0;
let errored = 0;

for (const slug of slugs) {
  const mdx = join(DISHES_DIR, slug, 'index.mdx');
  const label = slug.padEnd(LABEL_WIDTH);
  let fm;
  try {
    fm = await readFrontmatter(mdx);
  } catch (err) {
    console.log(`${label}ERROR  frontmatter: ${err.message}`);
    errored++;
    continue;
  }
  const heroUrl = getString(fm, 'heroUrl');
  if (!heroUrl) continue;

  scanned++;

  const current = dimsCache[heroUrl];
  if (!current) continue;  // not in cache — was rate-limited last audit
  const currentMP = (current.width * current.height) / 1_000_000;
  if (current.width >= RESOLUTION_GATE.minWidth && currentMP >= RESOLUTION_GATE.minMegapixels) continue;
  flagged++;

  const category = slugToCategory(slug);

  let titles;
  try {
    titles = await listCategoryFiles(category);
  } catch (err) {
    console.log(`${label}ERROR  category "${category}": ${err.message}`);
    errored++;
    continue;
  }
  if (!titles.length) {
    console.log(`${label}NOCAT  "Category:${category}" empty or missing — add to CATEGORY_OVERRIDES`);
    needsOverride++;
    continue;
  }

  let candidates;
  try {
    candidates = await getImageInfo(titles);
  } catch (err) {
    console.log(`${label}ERROR  imageinfo: ${err.message}`);
    errored++;
    continue;
  }

  const ranked = rankCandidates(candidates, current, heroUrl);
  if (!ranked.length) {
    console.log(`${label}NONE   ${titles.length} files in Category:${category}, none meet gates`);
    noBetter++;
    continue;
  }
  // Manual override wins if the named title is in the ranked set.
  const manual = MANUAL_PICKS[slug];
  const manualHit = manual && ranked.find((c) => c.title === `File:${manual}` || c.title === manual);
  const best = manualHit ?? ranked[0];
  const bestMP = (best.width * best.height) / 1_000_000;
  const tag = manualHit ? 'MANUAL' : 'PICK  ';
  console.log(
    `${label}${tag} ${current.width}×${current.height} (${currentMP.toFixed(1)}MP) → ${best.width}×${best.height} (${bestMP.toFixed(1)}MP) ${best.title.replace(/^File:/, '')}`,
  );
  console.log(`${' '.repeat(LABEL_WIDTH)}        → ${best.url}`);
  // Print runners-up so the reviewer can spot a better one and add a MANUAL_PICK.
  for (const c of ranked.slice(1, 4)) {
    const mp = (c.width * c.height) / 1_000_000;
    console.log(`${' '.repeat(LABEL_WIDTH)}  alt: ${c.width}×${c.height} (${mp.toFixed(1)}MP) ${c.title.replace(/^File:/, '')}`);
  }
  if (WRITE) {
    try {
      await rewriteHeroUrl(mdx, best.url);
    } catch (err) {
      console.log(`${' '.repeat(LABEL_WIDTH)}        write failed: ${err.message}`);
      errored++;
      continue;
    }
  }
  upgraded++;
}

console.log(
  `\n# scanned ${scanned} · ${flagged} below resolution gate · ${upgraded} ${WRITE ? 'rewritten' : 'pickable'} · ${noBetter} no acceptable candidate · ${needsOverride} need category override · ${errored} error`,
);
