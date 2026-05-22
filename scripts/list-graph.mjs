#!/usr/bin/env node
// list-graph.mjs — flat report of every cross-collection ref in the corpus.
//
// The north star (ADR-0009) frames foodbook as a walkable graph. This
// script renders the graph as text — one line per edge, grouped by
// source dish. Useful for: spotting orphan refs, finding the most
// densely-connected dishes, eyeballing whether a new lifecycle authoring
// pass landed correctly.
//
// Output shape:
//   dishes/carbonara
//     → farms/kerala-pepper-estate (source)
//     → farms/trapani-salt-pans (source)
//     → recipes/carbonara (cook)
//   dishes/cacio-e-pepe
//     ...
//
// `--stats` adds aggregate counts at the end (edges per kind, most-linked
// targets, dishes with the most outgoing edges).
//
// Run as: `node scripts/list-graph.mjs` or `npm run graph`.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const DISHES_DIR = "src/content/dishes";

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
    out.push({ slug: e.name, file: join(DISHES_DIR, e.name, "index.mdx") });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

// Pull a stage's ref array from the frontmatter via regex. The arrays use
// one of two styles:
//   farms:
//     - 'kerala-pepper-estate'
//   recipes: ['carbonara']
// Both are handled below.
function extractRefs(stageBody, key) {
  const refs = [];
  const inlineRe = new RegExp(`^    ${key}:\\s*\\[([^\\]]*)\\]`, "m");
  const inline = stageBody.match(inlineRe);
  if (inline) {
    for (const m of inline[1].matchAll(/['"]([^'"]+)['"]/g)) refs.push(m[1]);
  }
  const blockRe = new RegExp(`^    ${key}:\\s*\\n((?:\\s+-\\s+['"][^'"]+['"]\\n?)+)`, "m");
  const block = stageBody.match(blockRe);
  if (block) {
    for (const m of block[1].matchAll(/-\s+['"]([^'"]+)['"]/g)) refs.push(m[1]);
  }
  return refs;
}

function extractStage(frontmatter, stage) {
  const stageRe = new RegExp(`\\n  ${stage}:\\s*\\n((?:    .*\\n?)+)`, "m");
  const m = frontmatter.match(stageRe);
  if (!m) return null;
  return {
    farms: extractRefs(m[1], "farms"),
    garden: extractRefs(m[1], "garden"),
    recipes: extractRefs(m[1], "recipes"),
    meals: extractRefs(m[1], "meals"),
    restaurants: extractRefs(m[1], "restaurants"),
  };
}

async function loadDish(dish) {
  const raw = await readFile(dish.file, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const stages = {
    source: extractStage(fm[1], "source") ?? {},
    grow: extractStage(fm[1], "grow") ?? {},
    cook: extractStage(fm[1], "cook") ?? {},
    eat: extractStage(fm[1], "eat") ?? {},
  };
  return { ...dish, stages };
}

async function main() {
  const showStats = process.argv.includes("--stats");
  const files = await listDishFiles();
  const dishes = (await Promise.all(files.map(loadDish))).filter(Boolean);

  const edges = [];
  for (const d of dishes) {
    const lines = [];
    const push = (kind, refs, stage) => {
      for (const r of refs ?? []) {
        lines.push({ kind, target: r, stage });
        edges.push({ from: d.slug, kind, target: r, stage });
      }
    };
    push("farms", d.stages.source?.farms, "source");
    push("garden", d.stages.grow?.garden, "grow");
    push("recipes", d.stages.cook?.recipes, "cook");
    push("meals", d.stages.eat?.meals, "eat");
    push("restaurants", d.stages.eat?.restaurants, "eat");
    if (lines.length === 0) continue;
    console.log(`dishes/${d.slug}`);
    for (const l of lines) console.log(`  → ${l.kind}/${l.target} (${l.stage})`);
  }

  if (showStats) {
    const byKind = new Map();
    const inboundCounts = new Map();
    const outboundCounts = new Map();
    for (const e of edges) {
      byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
      const t = `${e.kind}/${e.target}`;
      inboundCounts.set(t, (inboundCounts.get(t) ?? 0) + 1);
      outboundCounts.set(e.from, (outboundCounts.get(e.from) ?? 0) + 1);
    }
    console.log("\n--- stats ---");
    console.log(`Total edges: ${edges.length}`);
    console.log("By kind:");
    for (const [kind, n] of [...byKind.entries()].sort()) console.log(`  ${kind.padEnd(12)} ${n}`);
    console.log("\nTop 5 most-linked targets (inbound edges):");
    const topIn = [...inboundCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [t, n] of topIn) console.log(`  ${n.toString().padStart(3)}  ${t}`);
    console.log("\nTop 5 dishes with the most outgoing edges:");
    const topOut = [...outboundCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [t, n] of topOut) console.log(`  ${n.toString().padStart(3)}  dishes/${t}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
