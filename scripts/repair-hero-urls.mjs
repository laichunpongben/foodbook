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

import { join } from "node:path";

import { CONTENT_ROOT, listSlugs } from "./lib/content.mjs";
import { getString, readFrontmatter } from "./lib/frontmatter.mjs";
import { rewriteHeroUrl } from "./lib/mdx-hero.mjs";
import { createThrottledFetcher } from "./lib/throttled-fetch.mjs";
import { lookupArticle, slugToTitle } from "./lib/wiki-titles.mjs";

const DISHES_DIR = join(CONTENT_ROOT, "dishes");
const LABEL_WIDTH = 28;

const WRITE = process.argv.includes("--write");

// 404 is allowed so the HEAD-probe / page-summary callers can
// distinguish "URL is dead" from a transient error and decide whether
// to repair, rather than re-trying past a real miss.
const throttledFetch = createThrottledFetcher({
  ua: "foodbook-repair/1.0",
  gapMs: 800,
  backoffBaseMs: 4000,
  allowStatus: [404],
});

// Throws on network/transient errors so the caller can surface them
// rather than mistaking a DNS blip for a 404 (which would --write a
// "repair" over a good URL).
async function isLive(url) {
  const res = await throttledFetch(url, { method: "HEAD" });
  return res.ok;
}

const slugs = await listSlugs("dishes");

console.log(`# repair-hero-urls ${WRITE ? "(WRITE)" : "(dry run)"}\n`);

let live = 0;
let repaired = 0;
let needsOverride = 0;
let noPhoto = 0;
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
    article = await lookupArticle(throttledFetch, title);
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
  if (article.type !== "standard") {
    console.log(
      `${label}${article.type.toUpperCase().padEnd(6)} "${article.title}" — non-standard page, set TITLE_OVERRIDES`,
    );
    needsOverride++;
    continue;
  }
  const newUrl = article.originalimage?.source ?? article.thumbnail?.source;
  if (!newUrl) {
    console.log(`${label}NO-IMG "${article.title}" — article has no lead image`);
    needsOverride++;
    continue;
  }

  console.log(`${label}REPAIR "${article.title}" — ${article.description ?? "(no description)"}`);
  console.log(`${" ".repeat(LABEL_WIDTH)}       → ${newUrl}`);

  if (WRITE) {
    try {
      await rewriteHeroUrl(mdx, newUrl);
    } catch (err) {
      console.log(`${" ".repeat(LABEL_WIDTH)}       write failed: ${err.message}`);
      errored++;
      continue;
    }
  }
  repaired++;
}

console.log(
  `\n# ${live} live · ${repaired} ${WRITE ? "rewritten" : "repairable"} · ${needsOverride} need override · ${noPhoto} no photo · ${errored} error`,
);
