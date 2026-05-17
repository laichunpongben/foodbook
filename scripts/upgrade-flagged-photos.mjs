#!/usr/bin/env node
/**
 * upgrade-flagged-photos.mjs — for dishes currently failing the audit's
 * resolution gates (lowres < 1200px, small < 1.5MP), check whether the
 * Wikipedia article's `originalimage` is meaningfully larger than the
 * current heroUrl and propose a swap when so.
 *
 * Resolution thresholds mirror audit-hero-photos.mjs. Sharpness / luma
 * / contrast issues are content quality, not URL-swappable, and are
 * out of scope here.
 *
 * Dry by default. Pass `--write` to rewrite `heroUrl:` lines in MDX;
 * the git diff is the safety net.
 *
 * What this does NOT fix: dishes whose current heroUrl is already the
 * Wikipedia article's lead image — Wikipedia simply doesn't have a
 * bigger version. Those need a different source (Commons category
 * mining or manual replacement).
 *
 * Usage:
 *   node scripts/upgrade-flagged-photos.mjs            # dry run
 *   node scripts/upgrade-flagged-photos.mjs --write    # apply
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import { CONTENT_ROOT, listSlugs } from "./lib/content.mjs";
import { getString, readFrontmatter } from "./lib/frontmatter.mjs";
import { rewriteHeroUrl } from "./lib/mdx-hero.mjs";
import { megapixels, RESOLUTION_GATE } from "./lib/photo-thresholds.mjs";
import { asBuffer, createThrottledFetcher } from "./lib/throttled-fetch.mjs";
import { lookupArticle, slugToTitle } from "./lib/wiki-titles.mjs";

const DISHES_DIR = join(CONTENT_ROOT, "dishes");
// Dim cache written by audit-hero-photos.mjs. Lets us skip measuring
// URLs that were just sized — Wikimedia rate-limits a back-to-back
// audit + upgrade pass otherwise.
const DIMS_CACHE_PATH = "/tmp/photo-audit.json";
const LABEL_WIDTH = 28;

const WRITE = process.argv.includes("--write");

// Require the new image to be at least this much bigger (in MP) than
// the current one before proposing. Below this, the swap is churn.
const UPGRADE_RATIO = 1.5;

// Gap is intentionally generous — every dish image is fetched from
// upload.wikimedia.org in sequence, and an 800ms cadence got
// rate-limited on a third of the corpus in testing.
const throttledFetch = createThrottledFetcher({
  ua: "foodbook-upgrade/1.0",
  gapMs: 1500,
  backoffBaseMs: 6000,
  allowStatus: [404],
});

let dimsCache = {};
try {
  dimsCache = JSON.parse(await readFile(DIMS_CACHE_PATH, "utf8"));
  console.log(
    `# loaded ${Object.keys(dimsCache).length} cached dimensions from ${DIMS_CACHE_PATH}\n`,
  );
} catch {
  console.log(
    `# no dims cache at ${DIMS_CACHE_PATH} — will measure every image (slower, rate-limited)\n`,
  );
}

async function measureCurrent(url) {
  const cached = dimsCache[url];
  if (cached) return cached;
  const res = await throttledFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await asBuffer(res);
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

const slugs = await listSlugs("dishes");

console.log(`# upgrade-flagged-photos ${WRITE ? "(WRITE)" : "(dry run)"}\n`);

let scanned = 0;
let flagged = 0;
let upgraded = 0;
let noBetter = 0;
let needsOverride = 0;
let errored = 0;

for (const slug of slugs) {
  const mdx = join(DISHES_DIR, slug, "index.mdx");
  const label = slug.padEnd(LABEL_WIDTH);
  let fm;
  try {
    fm = await readFrontmatter(mdx);
  } catch (err) {
    console.log(`${label}ERROR  frontmatter: ${err.message}`);
    errored++;
    continue;
  }
  const heroUrl = getString(fm, "heroUrl");
  if (!heroUrl) continue;

  scanned++;

  let current;
  try {
    current = await measureCurrent(heroUrl);
  } catch (err) {
    console.log(`${label}ERROR  measure: ${err.message}`);
    errored++;
    continue;
  }

  const currentMP = megapixels(current);
  // Skip dishes already meeting the resolution gates — nothing to upgrade.
  if (current.width >= RESOLUTION_GATE.minWidth && currentMP >= RESOLUTION_GATE.minMegapixels)
    continue;
  flagged++;

  const title = slugToTitle(slug);
  let article;
  try {
    article = await lookupArticle(throttledFetch, title);
  } catch (err) {
    console.log(`${label}ERROR  lookup "${title}": ${err.message}`);
    errored++;
    continue;
  }
  if (!article) {
    console.log(`${label}404    title="${title}" — add to TITLE_OVERRIDES`);
    needsOverride++;
    continue;
  }
  if (article.type !== "standard") {
    console.log(
      `${label}${article.type.toUpperCase().padEnd(6)} "${article.title}" — set TITLE_OVERRIDES`,
    );
    needsOverride++;
    continue;
  }
  const img = article.originalimage;
  if (!img?.source) {
    console.log(`${label}NO-IMG "${article.title}" — article has no originalimage`);
    noBetter++;
    continue;
  }
  if (img.source === heroUrl) {
    console.log(`${label}SAME   already on article originalimage (${img.width}×${img.height})`);
    noBetter++;
    continue;
  }
  const newMP = megapixels(img);
  if (newMP < currentMP * UPGRADE_RATIO) {
    console.log(
      `${label}WEAK   current ${current.width}×${current.height} (${currentMP.toFixed(1)}MP) vs article ${img.width}×${img.height} (${newMP.toFixed(1)}MP)`,
    );
    noBetter++;
    continue;
  }

  console.log(
    `${label}UPGRADE ${current.width}×${current.height} (${currentMP.toFixed(1)}MP) → ${img.width}×${img.height} (${newMP.toFixed(1)}MP)`,
  );
  console.log(`${" ".repeat(LABEL_WIDTH)}        → ${img.source}`);
  if (WRITE) {
    try {
      await rewriteHeroUrl(mdx, img.source);
    } catch (err) {
      console.log(`${" ".repeat(LABEL_WIDTH)}        write failed: ${err.message}`);
      errored++;
      continue;
    }
  }
  upgraded++;
}

console.log(
  `\n# scanned ${scanned} · ${flagged} below resolution gate · ${upgraded} ${WRITE ? "rewritten" : "upgradable"} · ${noBetter} no better source · ${needsOverride} need title override · ${errored} error`,
);
