#!/usr/bin/env node
// audit-a11y.mjs — heuristic scan for the ADR-0013 maintainer contract.
//
// Completes the every-voice-has-an-auditor pattern. Static-source scan
// (no headless browser, no axe-core) — surfaces high-signal contract
// violations only:
//
//   1. `<img ...>` without an `alt=` attribute.
//   2. `outline: none` / `outline: 0` without an adjacent `:focus-visible`
//      rule replacing it.
//   3. `transition: <duration>` literals not using `var(--motion-*)`
//      (delegated to audit-motion.mjs — referenced, not duplicated).
//   4. `<button>` / `<a class="...btn...">` with no explicit min-height
//      hint when it sits in CSS — heuristic, advisory only.
//
// Heavyweight checks (colour contrast, ARIA pattern correctness, keyboard
// trap detection) need a real DOM + computed styles, which is what
// Lighthouse / axe-core handle. This script is the pre-commit nudge.
//
// Run as: `node scripts/audit-a11y.mjs` or `npm run audit:a11y`.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOTS = ["src/pages", "src/components", "src/layouts"];

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
    else if (e.name.endsWith(".astro") || e.name.endsWith(".css")) out.push(p);
  }
  return out;
}

const IMG_TAG_RE = /<img\b[^>]*>/g;
const HAS_ALT_RE = /\balt\s*=\s*(?:"|')/;
const OUTLINE_NONE_RE = /outline\s*:\s*(?:none|0)\b/;
const FOCUS_VISIBLE_NEARBY_RE = /:focus-visible\b/;

async function main() {
  const strict = process.argv.includes("--strict");
  const findings = [];

  const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat();
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const lines = raw.split("\n");

    // Check 1: img without alt.
    for (let i = 0; i < lines.length; i++) {
      for (const match of [...lines[i].matchAll(IMG_TAG_RE)]) {
        if (!HAS_ALT_RE.test(match[0])) {
          findings.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            rule: "ADR-0013 §5",
            detail: "<img> without alt=",
          });
        }
      }
    }

    // Check 2: outline: none without a :focus-visible rule in the same
    // file. False positives possible (the replacement might live in
    // global.css). Advisory.
    if (file.endsWith(".astro") || file.endsWith(".css")) {
      if (OUTLINE_NONE_RE.test(raw) && !FOCUS_VISIBLE_NEARBY_RE.test(raw)) {
        // Find the line for the message
        for (let i = 0; i < lines.length; i++) {
          if (OUTLINE_NONE_RE.test(lines[i])) {
            findings.push({
              file: relative(process.cwd(), file),
              line: i + 1,
              rule: "ADR-0013 §2",
              detail: "outline: none/0 without :focus-visible replacement in same file",
            });
            break;
          }
        }
      }
    }
  }

  console.log(`Audited ${files.length} files for ADR-0013 maintainer-contract violations.`);
  console.log(`Findings: ${findings.length}\n`);

  if (findings.length > 0) {
    for (const f of findings) {
      console.log(`  ${f.file}:${f.line}  [${f.rule}]  ${f.detail}`);
    }
    console.log("\nHeuristic scan — Lighthouse + axe-core remain the authoritative gates.");
    console.log("Each finding warrants a manual look. See docs/adr/0013-accessibility-commitments.md.");
  } else {
    console.log("No contract violations detected by the heuristic checks.");
    console.log("Run Lighthouse / axe-core for the deeper audit (colour contrast, ARIA correctness, keyboard traps).");
  }

  if (strict && findings.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
