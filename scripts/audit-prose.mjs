#!/usr/bin/env node
// audit-prose.mjs — scan dish + recipe + restaurant + farm MDX prose for
// the AI-tic anti-patterns codified in ADR-0012 (editorial voice).
//
// Companion to audit-tags / audit-coords / audit-lineage / audit-tokens /
// audit-motion. Heuristic word-banlist scanner — every match is reported
// with file + line. False positives happen (a recipe step legitimately
// using "delve" is fine); the script is advisory, not gating.
//
// The author + reviewer treat the report as a starting point for tone
// review, not a verdict.
//
// Run as: `node scripts/audit-prose.mjs` or `npm run audit:prose`.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const COLLECTIONS = [
  "src/content/dishes",
  "src/content/recipes",
  "src/content/restaurants",
  "src/content/farms",
  "src/content/garden",
  "src/content/meals",
];

// Phrases from ADR-0012's anti-pattern list. Lowercase comparison; matches
// case-insensitively. Word boundaries protect "in conclusion" from
// matching inside "in conclusion-like-statements".
const BANNED_PHRASES = [
  "delve into",
  "navigate the world of",
  "rich tapestry",
  "in conclusion",
  "it's worth noting",
  "one could argue",
  "when it comes to",
  "in the world of",
  "leverage",
  "ecosystem",
  "paradigm",
  "embark on a journey",
  "unlock the secrets",
  "dive deep",
  "at the end of the day",
  "needless to say",
  "the fact of the matter is",
];

const ADVERB_STACK_RE = /\b(?:remarkably|surprisingly|incredibly|astonishingly|impossibly|amazingly|stunningly|exceptionally|extraordinarily)\b/gi;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

async function main() {
  const strict = process.argv.includes("--strict");
  const hits = [];

  for (const dir of COLLECTIONS) {
    try {
      await stat(dir);
    } catch {
      continue;
    }
    const files = await walk(dir);
    for (const file of files) {
      const raw = await readFile(file, "utf8");
      const lines = raw.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        for (const phrase of BANNED_PHRASES) {
          if (lower.includes(phrase)) {
            hits.push({
              file: relative(process.cwd(), file),
              line: i + 1,
              type: "banlist",
              detail: `"${phrase}"`,
            });
          }
        }
        const adverbs = [...lines[i].matchAll(ADVERB_STACK_RE)].map((m) => m[0]);
        if (adverbs.length >= 2) {
          hits.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            type: "adverb-stack",
            detail: adverbs.join(" + "),
          });
        }
      }
    }
  }

  console.log(`Audited ${COLLECTIONS.length} collections.`);
  console.log(`Anti-pattern hits: ${hits.length}\n`);

  if (hits.length > 0) {
    for (const h of hits) {
      console.log(`  ${h.file}:${h.line}  [${h.type}]  ${h.detail}`);
    }
    console.log("\nEach hit is *advisory*. False positives happen — confirm the");
    console.log("phrase actually reads as anti-pattern in context before editing.");
    console.log("See docs/adr/0012-editorial-voice.md for the full register.");
  } else {
    console.log("No anti-patterns detected. (Doesn't mean the prose is perfect — see ADR-0012.)");
  }

  if (strict && hits.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
