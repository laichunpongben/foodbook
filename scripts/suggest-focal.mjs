#!/usr/bin/env node
/**
 * suggest-focal.mjs — one-off helper that suggests `heroFocal` values
 * for dish entries by running sharp's attention strategy at a 4:5
 * target crop (matches .dish-card's aspect-ratio) and back-computing
 * the chosen focal as a percentage of the source.
 *
 * Saliency is a hint — it picks high-contrast regions which for food
 * photos usually but not always matches "the dish". Eyeball the
 * output before pasting into frontmatter.
 *
 * Usage: node scripts/suggest-focal.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { CONTENT_ROOT, listSlugs } from './lib/content.mjs';
import { getString, readFrontmatter } from './lib/frontmatter.mjs';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DISHES_DIR = join(CONTENT_ROOT, 'dishes');

// Landing card is 4:5 portrait; this is the surface where off-center
// crops show up most. Detail-page hero shares the same focal but its
// effective aspect depends on viewport — landing card is the binding
// constraint.
const TARGET_W = 400;
const TARGET_H = 500;
// Anything within ±this many percentage points of 50% on both axes is
// left to the centered default. Avoids noise from saliency wobble.
const CENTER_TOLERANCE = 8;

// Wikimedia 404/403s requests without a descriptive User-Agent. Spread
// requests with a small delay so we don't trip rate-limiting.
const UA = 'foodbook-focal/1.0 (https://github.com/laichunpongben/foodbook)';
const REQUEST_GAP_MS = 1200;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 5000;
let lastFetchAt = 0;

async function fetchBuffer(url) {
  const wait = Math.max(0, lastFetchAt + REQUEST_GAP_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('exhausted retries');
}

async function loadPhoto({ heroUrl, hero }) {
  if (heroUrl) return fetchBuffer(heroUrl);
  if (hero) return readFile(join(PUBLIC_DIR, `${hero}-1280.jpg`));
  throw new Error('no photo source');
}

async function suggest(buf) {
  // Reuse one sharp instance so the JPEG is only decoded once across
  // the metadata call and the resize.
  const img = sharp(buf);
  const { width: W, height: H } = await img.metadata();
  if (!W || !H) throw new Error('cannot read dimensions');
  const { info } = await img
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: sharp.strategy.attention })
    .toBuffer({ resolveWithObject: true });
  // Map sharp's attention crop to a CSS `object-position` value:
  // cropOffsetLeft/Top are returned as negative translations of the
  // scaled image (negative = shifted to expose the right/bottom).
  // CSS X% places the X% point of the image at the X% point of the box,
  // i.e. the visible window starts at X% * slack within the scaled image.
  const s = Math.max(TARGET_W / W, TARGET_H / H);
  const slackW = W * s - TARGET_W;
  const slackH = H * s - TARGET_H;
  const fx = slackW > 0.5 ? (-(info.cropOffsetLeft || 0) / slackW) * 100 : 50;
  const fy = slackH > 0.5 ? (-(info.cropOffsetTop || 0) / slackH) * 100 : 50;
  return { fx, fy, srcW: W, srcH: H };
}

function aspectNote(W, H) {
  const a = W / H;
  if (a > 0.85) return `${W}×${H} landscape`;
  if (a < 0.75) return `${W}×${H} portrait`;
  return `${W}×${H} ~4:5`;
}

const slugs = await listSlugs('dishes');

console.log('# heroFocal suggestions — paste keepers into dish frontmatter');
console.log('# (saliency is a hint; eyeball before applying)\n');

let suggested = 0;
let kept = 0;
let skipped = 0;
let errored = 0;

for (const slug of slugs) {
  const mdx = join(DISHES_DIR, slug, 'index.mdx');
  let fm;
  try {
    fm = await readFrontmatter(mdx);
  } catch {
    continue;
  }
  const heroFocal = getString(fm, 'heroFocal');
  const heroUrl = getString(fm, 'heroUrl');
  const hero = getString(fm, 'hero');
  const label = slug.padEnd(28);

  if (heroFocal) {
    console.log(`${label}already set: "${heroFocal}"`);
    skipped++;
    continue;
  }
  if (!heroUrl && !hero) {
    console.log(`${label}(no photo)`);
    skipped++;
    continue;
  }

  try {
    const buf = await loadPhoto({ heroUrl, hero });
    const { fx, fy, srcW, srcH } = await suggest(buf);
    const note = aspectNote(srcW, srcH);
    const dx = Math.abs(fx - 50);
    const dy = Math.abs(fy - 50);
    if (dx < CENTER_TOLERANCE && dy < CENTER_TOLERANCE) {
      console.log(`${label}default fine    (saliency ${fx.toFixed(0)}% ${fy.toFixed(0)}%, ${note})`);
      kept++;
    } else {
      console.log(`${label}heroFocal: "${fx.toFixed(0)}% ${fy.toFixed(0)}%"   (${note})`);
      suggested++;
    }
  } catch (err) {
    console.log(`${label}ERROR: ${err.message}`);
    errored++;
  }
}

console.log(`\n# ${suggested} suggested · ${kept} default-fine · ${skipped} skipped · ${errored} error`);
