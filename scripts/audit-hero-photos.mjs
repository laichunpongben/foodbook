#!/usr/bin/env node
/**
 * audit-hero-photos.mjs — score dish `heroUrl` images on cheap visual
 * signals and rank the bottom tier so we know which dishes need a
 * better photo, instead of eyeballing all 118.
 *
 * Signals (all from `sharp` on the fetched bytes):
 *   - resolution (width, height, megapixels)
 *   - file size + bytes-per-pixel (compression heuristic)
 *   - sharpness via luma laplacian variance — low = soft/blurry/upscaled
 *   - luma mean — extreme dark/washed-out shots
 *   - luma stdev — flat/foggy/low-contrast shots
 *
 * Each signal becomes a binary flag against a fixed threshold. The
 * composite score is the flag count; ties broken by sharpness asc.
 * Result writes to /tmp/photo-audit.md (markdown table, worst first).
 *
 * Dry-run only — no MDX writes. Output is meant to drive a manual
 * re-source pass.
 *
 * Usage:
 *   node scripts/audit-hero-photos.mjs              # all dishes
 *   node scripts/audit-hero-photos.mjs --limit 20   # first 20 (for smoke)
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';

import { CONTENT_ROOT, listSlugs } from './lib/content.mjs';
import { getString, readFrontmatter } from './lib/frontmatter.mjs';

const DISHES_DIR = join(CONTENT_ROOT, 'dishes');
const REPORT_PATH = '/tmp/photo-audit.md';
const LABEL_WIDTH = 32;

const argv = process.argv.slice(2);
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? Number(argv[i + 1]) : Infinity;
})();

const UA = 'foodbook-audit/1.0 (https://github.com/laichunpongben/foodbook)';
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

// Thresholds — tuned for landing-card sized food photos. Anything
// flagged is "worth a second look", not "definitely broken". The
// sharpness threshold is calibrated after observing the full-corpus
// distribution; tune again if the median of the clean set drifts.
const TH = {
  minWidth: 1200,          // < 1200px wide can't fill a retina hero
  minMegapixels: 1.5,      // < 1.5 MP usually means thumbnail-tier source
  minSharpness: 1500,      // laplacian variance — < 1500 reads as soft on this corpus
  lumaDarkBelow: 50,       // mean luma < 50 = underexposed
  lumaBrightAbove: 215,    // mean luma > 215 = blown out
  minContrast: 35,         // luma stdev < 35 = flat / hazy
};

// 3x3 Laplacian kernel — high-frequency edge response. Variance of the
// output approximates focus quality: sharp edges → high variance,
// blurry/upscaled → low. Cheap proxy that correlates well with
// perceived sharpness on natural images.
const LAPLACIAN = {
  width: 3,
  height: 3,
  kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
};

async function scoreImage(buf) {
  const img = sharp(buf, { failOn: 'none' });
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const bytes = buf.length;
  const megapixels = (width * height) / 1_000_000;
  const bytesPerPixel = width && height ? bytes / (width * height) : 0;

  // Downsize to a fixed working width before stats — cheaper, and
  // normalizes sharpness across source resolutions so the threshold
  // doesn't have to scale.
  const workWidth = 800;
  const luma = sharp(buf, { failOn: 'none' })
    .resize({ width: workWidth, fit: 'inside', withoutEnlargement: true })
    .greyscale();

  const lumaStats = await luma.clone().stats();
  const lumaMean = lumaStats.channels[0].mean;
  const lumaStdev = lumaStats.channels[0].stdev;

  const edgeStats = await luma
    .clone()
    .convolve(LAPLACIAN)
    .stats();
  // sharp's convolve clips negative values; squaring the stdev gives a
  // variance-equivalent that's monotone in edge strength either way.
  const sharpness = edgeStats.channels[0].stdev ** 2;

  return { width, height, bytes, megapixels, bytesPerPixel, sharpness, lumaMean, lumaStdev };
}

function flagsFor(s) {
  const flags = [];
  if (s.width < TH.minWidth) flags.push('lowres');
  if (s.megapixels < TH.minMegapixels) flags.push('small');
  if (s.sharpness < TH.minSharpness) flags.push('soft');
  if (s.lumaMean < TH.lumaDarkBelow) flags.push('dark');
  if (s.lumaMean > TH.lumaBrightAbove) flags.push('blown-out');
  if (s.lumaStdev < TH.minContrast) flags.push('flat');
  return flags;
}

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

async function main() {
  const slugs = (await listSlugs('dishes')).slice(0, LIMIT);
  const rows = [];
  const errors = [];

  process.stderr.write(`Auditing ${slugs.length} dishes...\n`);
  let i = 0;
  for (const slug of slugs) {
    i += 1;
    const path = join(DISHES_DIR, slug, 'index.mdx');
    const fm = await readFrontmatter(path);
    const heroUrl = getString(fm, 'heroUrl');
    if (!heroUrl) {
      process.stderr.write(`${pad(slug, LABEL_WIDTH)}  no heroUrl, skipping\n`);
      continue;
    }
    try {
      const buf = await fetchBuffer(heroUrl);
      const s = await scoreImage(buf);
      const flags = flagsFor(s);
      rows.push({ slug, heroUrl, ...s, flags });
      process.stderr.write(
        `[${i}/${slugs.length}] ${pad(slug, LABEL_WIDTH)}  ` +
          `${s.width}x${s.height} (${s.megapixels.toFixed(1)}MP, ${(s.bytes / 1024).toFixed(0)}KB)  ` +
          `sharp=${s.sharpness.toFixed(0)}  luma=${s.lumaMean.toFixed(0)}/${s.lumaStdev.toFixed(0)}  ` +
          `${flags.length ? '[' + flags.join(',') + ']' : 'OK'}\n`,
      );
    } catch (err) {
      errors.push({ slug, heroUrl, error: err.message });
      process.stderr.write(`[${i}/${slugs.length}] ${pad(slug, LABEL_WIDTH)}  ERROR ${err.message}\n`);
    }
  }

  rows.sort((a, b) => {
    if (b.flags.length !== a.flags.length) return b.flags.length - a.flags.length;
    return a.sharpness - b.sharpness;
  });

  const flagged = rows.filter((r) => r.flags.length > 0);
  const clean = rows.length - flagged.length;

  const lines = [
    '# Hero Photo Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Scope: dishes (${rows.length} scored, ${errors.length} failed)`,
    `Flagged: ${flagged.length} / ${rows.length}  ·  Clean: ${clean}`,
    '',
    '## Thresholds',
    '',
    '```',
    ...Object.entries(TH).map(([k, v]) => `${k.padEnd(20)} ${v}`),
    '```',
    '',
    '## Flagged (worst first)',
    '',
    '| # | slug | w×h | MP | KB | sharp | luma μ | luma σ | flags |',
    '|---|------|-----|----|----|-------|--------|--------|-------|',
    ...flagged.map((r, idx) => {
      return `| ${idx + 1} | [${r.slug}](${r.heroUrl}) | ${r.width}×${r.height} | ${r.megapixels.toFixed(1)} | ${(r.bytes / 1024).toFixed(0)} | ${r.sharpness.toFixed(0)} | ${r.lumaMean.toFixed(0)} | ${r.lumaStdev.toFixed(0)} | ${r.flags.join(', ')} |`;
    }),
    '',
    '## Clean',
    '',
    ...rows
      .filter((r) => r.flags.length === 0)
      .map((r) => `- ${r.slug} — ${r.width}×${r.height}, sharp=${r.sharpness.toFixed(0)}`),
  ];

  if (errors.length) {
    lines.push('', '## Fetch errors', '');
    for (const e of errors) lines.push(`- ${e.slug} — ${e.error} (${e.heroUrl})`);
  }

  await writeFile(REPORT_PATH, lines.join('\n') + '\n');
  process.stderr.write(`\nReport: ${REPORT_PATH}\n`);
  process.stderr.write(`Flagged: ${flagged.length} / ${rows.length}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
