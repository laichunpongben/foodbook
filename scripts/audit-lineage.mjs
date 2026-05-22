#!/usr/bin/env node
/**
 * audit-lineage.mjs — surface dishes whose four-stage lifecycle is sparse.
 *
 * Implements the editorial side of ADR-0009 (north star — walkable food
 * archive). A dish entry with only 1 of 4 lifecycle stages is still useful
 * but isn't yet living the star; this script ranks them so the maintainer
 * can prioritise tracing forward / backward.
 *
 * Coverage rule (matches DishHero's lifecycle-dot logic):
 *   A stage is "covered" if it has a non-empty `note:` field OR at least
 *   one ref (farms / garden / recipes / meals / restaurants).
 *
 * Output groups:
 *   - 0 of 4 — dish with no stages at all (rare; needs a starter).
 *   - 1 of 4 — single-thread; usually a fresh entry waiting for siblings.
 *   - 2 of 4 — half-traced; the common 'not-yet-done' state.
 *   - 3 of 4 — almost-complete; the easiest wins.
 *   - 4 of 4 — complete (good; not reported by default).
 *
 * Exit 0 always. Use `--strict` to exit 1 when any dish has < 2 stages
 * covered (north-star floor for new entries).
 *
 * Run as: `node scripts/audit-lineage.mjs` or `npm run audit:lineage`.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const DISHES_DIR = "src/content/dishes";
const STAGES = ["source", "grow", "cook", "eat"];

async function listDishFiles() {
  const out = [];
  let entries;
  try {
    entries = await readdir(DISHES_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    out.push(join(DISHES_DIR, e.name, "index.mdx"));
  }
  return out.sort();
}

/**
 * Extract the `stages:` block from MDX frontmatter and return a Set of
 * covered stage keys. This is a regex parse — not a YAML parser — and is
 * deliberately conservative: it walks lines after `stages:` and treats
 * any sub-key with either a `note:` value OR any non-empty list entry as
 * "covered". When the frontmatter format gets fancier, swap for `yaml`
 * (it's already a peer dep via @astrojs/mdx). For today's flat author
 * style this is enough.
 */
function extractCoveredStages(frontmatter) {
  const covered = new Set();
  const stagesIdx = frontmatter.indexOf("\nstages:");
  if (stagesIdx === -1) return covered;
  const stagesBlock = frontmatter.slice(stagesIdx);
  for (const stage of STAGES) {
    // Match `  source:` followed by either a `    note: "non-empty"` line
    // or any ref-array line with at least one entry inside [].
    const stageRegex = new RegExp(
      `\\n  ${stage}:\\s*\\n((?:    .*\\n?)+)`,
      "m",
    );
    const m = stagesBlock.match(stageRegex);
    if (!m) continue;
    const body = m[1];
    // Body starts at the first indented line, no leading newline. Use
    // `^` with the multiline flag so checks fire on every line in turn.
    const hasNonEmptyNote =
      /^    note:\s*"[^"]+"/m.test(body) || /^    note:\s*'[^']+'/m.test(body);
    const hasRefEntry =
      /^    (?:farms|garden|recipes|meals|restaurants):\s*\n\s*-\s/m.test(body) ||
      /^    (?:farms|garden|recipes|meals|restaurants):\s*\[\s*['"]/m.test(body);
    if (hasNonEmptyNote || hasRefEntry) covered.add(stage);
  }
  return covered;
}

async function loadDish(file) {
  const raw = await readFile(file, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const titleMatch = fm[1].match(/^shortTitle:\s*"([^"]+)"/m);
  const visibilityMatch = fm[1].match(/^visibility:\s*(\w+)/m);
  return {
    file,
    title: titleMatch?.[1] ?? file,
    visibility: visibilityMatch?.[1] ?? "public",
    covered: extractCoveredStages(fm[1]),
  };
}

function report(title, items) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}):`);
  for (const it of items) {
    const stages = STAGES.map((s) => (it.covered.has(s) ? s[0].toUpperCase() : "·")).join("");
    const rel = it.file.replace(`${process.cwd()}/`, "");
    console.log(`  [${stages}] ${it.title}  ${rel}`);
  }
}

async function main() {
  const strict = process.argv.includes("--strict");
  const files = await listDishFiles();
  const dishes = (await Promise.all(files.map(loadDish))).filter(Boolean);
  const publicDishes = dishes.filter((d) => d.visibility === "public");

  const byCoverage = [0, 1, 2, 3, 4].map((n) => ({
    n,
    items: publicDishes.filter((d) => d.covered.size === n),
  }));

  console.log(`Audited ${publicDishes.length} public dish entries.`);
  console.log(
    `Distribution: ${byCoverage.map((b) => `${b.n}=${b.items.length}`).join("  ")}`,
  );
  console.log("Stage letters: S=source · G=grow · C=cook · E=eat · '·' = uncovered.");

  report("No stages at all", byCoverage[0].items);
  report("Single-thread (1 of 4)", byCoverage[1].items);
  report("Half-traced (2 of 4)", byCoverage[2].items);
  report("Almost-complete (3 of 4)", byCoverage[3].items);
  console.log("");

  if (strict) {
    const belowFloor = publicDishes.filter((d) => d.covered.size < 2);
    if (belowFloor.length > 0) {
      console.error(
        `${belowFloor.length} dish${belowFloor.length === 1 ? "" : "es"} below the north-star floor (< 2 stages covered).`,
      );
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
