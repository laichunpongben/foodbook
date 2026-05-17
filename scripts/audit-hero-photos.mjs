#!/usr/bin/env node
/**
 * audit-hero-photos.mjs — score dish `heroUrl` images on cheap visual
 * signals and rank the bottom tier so we know which dishes need a
 * better photo, instead of eyeballing all 118.
 *
 * Signals (all from `sharp` on the fetched bytes):
 *   - resolution (width, height, megapixels)
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

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import { CONTENT_ROOT, listSlugs } from "./lib/content.mjs";
import { getString, readFrontmatter } from "./lib/frontmatter.mjs";
import { RESOLUTION_GATE } from "./lib/photo-thresholds.mjs";
import { asBuffer, createThrottledFetcher } from "./lib/throttled-fetch.mjs";

const DISHES_DIR = join(CONTENT_ROOT, "dishes");
const REPORT_PATH = "/tmp/photo-audit.md";
// Sidecar consumed by upgrade-flagged-photos.mjs to skip re-measurement.
// Keyed by URL so cache survives slug renames.
const DIMS_CACHE_PATH = "/tmp/photo-audit.json";
const LABEL_WIDTH = 32;

const argv = process.argv.slice(2);
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 ? Number(argv[i + 1]) : Infinity;
})();

const throttledFetch = createThrottledFetcher({
  ua: "foodbook-audit/1.0",
  gapMs: 1200,
});

async function fetchBuffer(url) {
  return asBuffer(await throttledFetch(url));
}

// Thresholds — tuned for landing-card sized food photos. Anything
// flagged is "worth a second look", not "definitely broken". The
// sharpness threshold is calibrated after observing the full-corpus
// distribution; tune again if the median of the clean set drifts.
// Resolution gates are shared with upgrade-flagged-photos so the
// two scripts stay in sync if we change what counts as "low res".
const TH = {
  ...RESOLUTION_GATE,
  minSharpness: 1500, // laplacian variance — < 1500 reads as soft on this corpus
  lumaDarkBelow: 50, // mean luma < 50 = underexposed
  lumaBrightAbove: 215, // mean luma > 215 = blown out
  minContrast: 35, // luma stdev < 35 = flat / hazy
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
  // Single sharp instance — metadata() doesn't consume the pipeline, so
  // we chain the luma stages onto the same input and save a JPEG decode.
  // Downsize to a fixed working width before stats — cheaper, and
  // normalizes sharpness across source resolutions so the threshold
  // doesn't have to scale.
  const img = sharp(buf, { failOn: "none" });
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const megapixels = (width * height) / 1_000_000;

  const luma = img.resize({ width: 800, fit: "inside", withoutEnlargement: true }).greyscale();

  const lumaStats = await luma.clone().stats();
  const edgeStats = await luma.clone().convolve(LAPLACIAN).stats();

  // sharp's convolve clips negative values; squaring the stdev gives a
  // variance-equivalent that's monotone in edge strength either way.
  const sharpness = edgeStats.channels[0].stdev ** 2;

  return {
    width,
    height,
    bytes: buf.length,
    megapixels,
    sharpness,
    lumaMean: lumaStats.channels[0].mean,
    lumaStdev: lumaStats.channels[0].stdev,
  };
}

function flagsFor(s) {
  const flags = [];
  if (s.width < TH.minWidth) flags.push("lowres");
  if (s.megapixels < TH.minMegapixels) flags.push("small");
  if (s.sharpness < TH.minSharpness) flags.push("soft");
  if (s.lumaMean < TH.lumaDarkBelow) flags.push("dark");
  if (s.lumaMean > TH.lumaBrightAbove) flags.push("blown-out");
  if (s.lumaStdev < TH.minContrast) flags.push("flat");
  return flags;
}

async function main() {
  const slugs = (await listSlugs("dishes")).slice(0, LIMIT);
  const rows = [];
  const errors = [];

  process.stderr.write(`Auditing ${slugs.length} dishes...\n`);
  let i = 0;
  for (const slug of slugs) {
    i += 1;
    const label = slug.padEnd(LABEL_WIDTH);
    const path = join(DISHES_DIR, slug, "index.mdx");
    const fm = await readFrontmatter(path);
    const heroUrl = getString(fm, "heroUrl");
    if (!heroUrl) {
      process.stderr.write(`${label}  no heroUrl, skipping\n`);
      continue;
    }
    try {
      const buf = await fetchBuffer(heroUrl);
      const s = await scoreImage(buf);
      const flags = flagsFor(s);
      rows.push({ slug, heroUrl, ...s, flags });
      process.stderr.write(
        `[${i}/${slugs.length}] ${label}  ` +
          `${s.width}x${s.height} (${s.megapixels.toFixed(1)}MP, ${(s.bytes / 1024).toFixed(0)}KB)  ` +
          `sharp=${s.sharpness.toFixed(0)}  luma=${s.lumaMean.toFixed(0)}/${s.lumaStdev.toFixed(0)}  ` +
          `${flags.length ? "[" + flags.join(",") + "]" : "OK"}\n`,
      );
    } catch (err) {
      errors.push({ slug, heroUrl, error: err.message });
      process.stderr.write(`[${i}/${slugs.length}] ${label}  ERROR ${err.message}\n`);
    }
  }

  rows.sort((a, b) => {
    if (b.flags.length !== a.flags.length) return b.flags.length - a.flags.length;
    return a.sharpness - b.sharpness;
  });

  const flagged = rows.filter((r) => r.flags.length > 0);
  const clean = rows.length - flagged.length;

  const lines = [
    "# Hero Photo Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Scope: dishes (${rows.length} scored, ${errors.length} failed)`,
    `Flagged: ${flagged.length} / ${rows.length}  ·  Clean: ${clean}`,
    "",
    "## Thresholds",
    "",
    "```",
    ...Object.entries(TH).map(([k, v]) => `${k.padEnd(20)} ${v}`),
    "```",
    "",
    "## Flagged (worst first)",
    "",
    "| # | slug | w×h | MP | KB | sharp | luma μ | luma σ | flags |",
    "|---|------|-----|----|----|-------|--------|--------|-------|",
    ...flagged.map((r, idx) => {
      return `| ${idx + 1} | [${r.slug}](${r.heroUrl}) | ${r.width}×${r.height} | ${r.megapixels.toFixed(1)} | ${(r.bytes / 1024).toFixed(0)} | ${r.sharpness.toFixed(0)} | ${r.lumaMean.toFixed(0)} | ${r.lumaStdev.toFixed(0)} | ${r.flags.join(", ")} |`;
    }),
    "",
    "## Clean",
    "",
    ...rows
      .filter((r) => r.flags.length === 0)
      .map((r) => `- ${r.slug} — ${r.width}×${r.height}, sharp=${r.sharpness.toFixed(0)}`),
  ];

  if (errors.length) {
    lines.push("", "## Fetch errors", "");
    for (const e of errors) lines.push(`- ${e.slug} — ${e.error} (${e.heroUrl})`);
  }

  const dimsCache = Object.fromEntries(
    rows.map((r) => [r.heroUrl, { width: r.width, height: r.height }]),
  );

  await writeFile(REPORT_PATH, lines.join("\n") + "\n");
  await writeFile(DIMS_CACHE_PATH, JSON.stringify(dimsCache, null, 2) + "\n");
  process.stderr.write(`\nReport: ${REPORT_PATH}\n`);
  process.stderr.write(`Cache:  ${DIMS_CACHE_PATH} (${rows.length} entries)\n`);
  process.stderr.write(`Flagged: ${flagged.length} / ${rows.length}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
