#!/usr/bin/env node
// audit-radii.mjs — scan .astro / .css for border-radius literals not on
// the ADR-0010 canon. Lines carrying `off-radius:` are pre-audited.
//
// Companion to audit-tokens.mjs (#239, spacing/type) and audit-motion.mjs
// (#266). Once tokens.json (#236) is on main with the radius section, the
// canon comes from there; until then, this script uses a baked-in fallback
// matching ADR-0010.
//
// Run as: `node scripts/audit-radii.mjs` or `npm run audit:radii`.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const TOKENS_FILE = "src/styles/tokens.json";
const ROOTS = ["src"];

// Fallback from ADR-0010 §Other primitives. Values are normalised to px
// or kept as the string (for 999px / 50%).
const FALLBACK_RADII = new Set(["999px", "4px", "6px"]);

async function loadCanon() {
  try {
    const raw = await readFile(TOKENS_FILE, "utf8");
    const json = JSON.parse(raw);
    const out = new Set();
    for (const [, v] of Object.entries(json.radius ?? {})) {
      if (typeof v.$value === "string") out.add(v.$value.trim());
    }
    return out.size > 0 ? out : FALLBACK_RADII;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    console.warn(`note: ${TOKENS_FILE} not found — using fallback radius canon.`);
    return FALLBACK_RADII;
  }
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (e.name.endsWith(".astro") || e.name.endsWith(".css")) {
      out.push(p);
    }
  }
  return out;
}

const RADIUS_RE = /border-radius:\s*([^;]+);/g;
const OFF_RADIUS_MARKER = /off-radius:/i;

async function main() {
  const strict = process.argv.includes("--strict");
  const canon = await loadCanon();

  let total = 0;
  let onCanon = 0;
  let flagged = 0;
  const offending = [];

  const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat();
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const [, value] of [...lines[i].matchAll(RADIUS_RE)]) {
        total += 1;
        const v = value.trim();
        if (v.startsWith("var(--radius-")) {
          onCanon += 1;
          continue;
        }
        if (canon.has(v)) {
          onCanon += 1;
          continue;
        }
        if (OFF_RADIUS_MARKER.test(lines[i])) {
          flagged += 1;
          continue;
        }
        offending.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          value: v,
        });
      }
    }
  }

  console.log(`Audited ${files.length} files for ADR-0010 radius-token sprawl.`);
  console.log(`Radius literals: ${total} total — ${onCanon} on-canon, ${flagged} flagged off-radius, ${offending.length} unflagged off-canon.\n`);

  if (offending.length > 0) {
    console.log("Unflagged off-canon radii:");
    for (const o of offending) {
      console.log(`  ${o.file}:${o.line}  ${o.value}`);
    }
  }

  if (strict && offending.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
