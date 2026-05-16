#!/usr/bin/env node
/**
 * suggest-focal.mjs — propose `heroFocal` values for dish entries by
 * running sharp's attention strategy at a 4:5 target crop (matches the
 * .dish-card aspect-ratio) and back-computing the chosen focal as a
 * percentage of the source.
 *
 * Default run is dry: prints per-dish suggestions and a tally. Pass
 * `--write` to insert `heroFocal: "X% Y%"` lines into MDX frontmatter
 * directly under the hero/heroUrl line; the git diff is the safety net.
 *
 * Saliency picks high-contrast regions which for food photos *usually*
 * matches "the dish" — but can lock onto text labels or off-frame
 * garnish at the very edge. Values landing outside the [SALIENCY_TRUST_LO,
 * SALIENCY_TRUST_HI] band are treated as untrustworthy and skipped
 * (default center is at least no worse).
 *
 * Usage:
 *   node scripts/suggest-focal.mjs            # dry run
 *   node scripts/suggest-focal.mjs --write    # apply
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { CONTENT_ROOT, listSlugs } from './lib/content.mjs';
import { getString, readFrontmatter } from './lib/frontmatter.mjs';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DISHES_DIR = join(CONTENT_ROOT, 'dishes');
const LABEL_WIDTH = 28;

const WRITE = process.argv.includes('--write');

// Landing card is 4:5 portrait; this is the surface where off-center
// crops show up most. Detail-page hero shares the same focal but its
// effective aspect depends on viewport — landing card is the binding
// constraint.
const TARGET_W = 400;
const TARGET_H = 500;
// Anything within ±this many percentage points of 50% on both axes is
// left to the centered default. Avoids noise from saliency wobble.
const CENTER_TOLERANCE = 8;
// Saliency outputs at the extremes (≤ LO or ≥ HI) are often edge
// artefacts — text labels, garnish at the frame edge. Clamp into this
// band so a misfire still keeps the dish mostly visible: at 75% we see
// the source's right half, which usually still includes a centered
// plate; at 100% the dish is cropped out entirely. The direction of
// the saliency hint is preserved either way.
const SALIENCY_CLAMP_LO = 25;
const SALIENCY_CLAMP_HI = 75;

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

function clamp(v) {
  return Math.min(SALIENCY_CLAMP_HI, Math.max(SALIENCY_CLAMP_LO, v));
}

// Inserts `heroFocal: "X% Y%"` directly under whichever hero/heroUrl
// line exists. Idempotent guard: if heroFocal already present, no-op.
async function writeHeroFocal(mdxPath, focal) {
  const text = await readFile(mdxPath, 'utf8');
  if (/^heroFocal:/m.test(text)) return false;
  const anchored = text.replace(
    /^(heroUrl:\s*"[^"]*")$/m,
    `$1\nheroFocal: "${focal}"`,
  );
  if (anchored !== text) {
    await writeFile(mdxPath, anchored);
    return true;
  }
  const fallback = text.replace(
    /^(hero:\s*"[^"]*")$/m,
    `$1\nheroFocal: "${focal}"`,
  );
  if (fallback === text) throw new Error('no hero/heroUrl anchor line found');
  await writeFile(mdxPath, fallback);
  return true;
}

const slugs = await listSlugs('dishes');

console.log(`# suggest-focal ${WRITE ? '(WRITE)' : '(dry run)'}\n`);

let applied = 0;
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
  const label = slug.padEnd(LABEL_WIDTH);

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
    const cx = clamp(fx);
    const cy = clamp(fy);
    if (Math.abs(cx - 50) < CENTER_TOLERANCE && Math.abs(cy - 50) < CENTER_TOLERANCE) {
      console.log(`${label}center           (saliency ${fx.toFixed(0)}% ${fy.toFixed(0)}%, ${note})`);
      kept++;
      continue;
    }
    const focal = `${cx.toFixed(0)}% ${cy.toFixed(0)}%`;
    const clampNote = cx === fx && cy === fy ? '' : ` ← saliency ${fx.toFixed(0)}% ${fy.toFixed(0)}%`;
    console.log(`${label}heroFocal: "${focal}"  (${note})${clampNote}`);
    if (WRITE) await writeHeroFocal(mdx, focal);
    applied++;
  } catch (err) {
    console.log(`${label}ERROR: ${err.message}`);
    errored++;
  }
}

console.log(
  `\n# ${applied} ${WRITE ? 'written' : 'suggested'} · ${kept} default-center · ${skipped} skipped · ${errored} error`,
);
