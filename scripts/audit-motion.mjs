#!/usr/bin/env node
// audit-motion.mjs — scan .astro / .css files for ADR-0011 motion-token sprawl.
//
// Companion to audit-tokens.mjs (#239, spacing/type). Reads tokens.json
// motion section (or the baked-in fallback) and walks every .astro / .css
// file under src/ looking for `transition: <prop> <duration>` literals
// not on the canon. Lines carrying an "off-motion:" marker comment are
// treated as pre-audited overrides.
//
// Exit 0 always (advisory). --strict exits 1 on any unflagged off-canon
// motion literal.
//
// Run as: `node scripts/audit-motion.mjs` or `npm run audit:motion`.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const TOKENS_FILE = "src/styles/tokens.json";
const ROOTS = ["src"];

const FALLBACK_DURATION_MS = [120, 200, 400, 2400];
const FALLBACK_EASINGS = new Set([
  "cubic-bezier(0.2, 0.7, 0.2, 1)",
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "linear",
]);

async function loadTokens() {
  try {
    const raw = await readFile(TOKENS_FILE, "utf8");
    const json = JSON.parse(raw);
    const durations = new Set();
    const easings = new Set();
    for (const [, v] of Object.entries(json.motion ?? {})) {
      const value = v.$value;
      if (typeof value === "string") {
        const m = value.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
        if (m) {
          const ms = m[2] === "s" ? Number.parseFloat(m[1]) * 1000 : Number.parseFloat(m[1]);
          durations.add(ms);
        }
      }
    }
    for (const [, v] of Object.entries(json.ease ?? {})) {
      if (typeof v.$value === "string") easings.add(v.$value.trim());
    }
    return {
      durations: [...durations].sort((a, b) => a - b),
      easings,
    };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    console.warn(`note: ${TOKENS_FILE} not found — using fallback motion canon.`);
    return {
      durations: FALLBACK_DURATION_MS,
      easings: FALLBACK_EASINGS,
    };
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

const DURATION_RE = /(\d+(?:\.\d+)?)(ms|s)\b/g;
const TRANSITION_LINE_RE = /transition[:\s].*?(\d+(?:\.\d+)?(?:ms|s))/;
const OFF_MOTION_MARKER = /off-motion:/i;

function nearest(value, scale) {
  let best = scale[0];
  let bestDelta = Math.abs(value - best);
  for (const s of scale) {
    const d = Math.abs(value - s);
    if (d < bestDelta) {
      best = s;
      bestDelta = d;
    }
  }
  return best;
}

async function main() {
  const strict = process.argv.includes("--strict");
  const { durations, easings } = await loadTokens();

  let total = 0;
  let matched = 0;
  let flagged = 0;
  const offending = [];

  const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat();
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!TRANSITION_LINE_RE.test(line)) continue;
      if (line.includes("var(--motion-")) {
        // count tokenised durations as matched (one per line is enough for the audit)
        matched += 1;
        continue;
      }
      const isFlagged = OFF_MOTION_MARKER.test(line);
      for (const [, val, unit] of [...line.matchAll(DURATION_RE)]) {
        const ms = unit === "s" ? Number.parseFloat(val) * 1000 : Number.parseFloat(val);
        total += 1;
        if (durations.includes(ms)) {
          matched += 1;
        } else if (isFlagged) {
          flagged += 1;
        } else {
          offending.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            value: `${val}${unit}`,
            nearest: `${nearest(ms, durations)}ms`,
          });
        }
      }
    }
  }

  console.log(`Audited ${files.length} files for motion-token sprawl.`);
  console.log(`Duration literals: ${total} total — ${matched} on-canon, ${flagged} flagged off-motion, ${offending.length} unflagged off-canon.`);

  if (offending.length > 0) {
    console.log("\nUnflagged off-canon motion durations:");
    for (const o of offending) {
      console.log(`  ${o.file}:${o.line}  ${o.value}  (nearest ${o.nearest})`);
    }
  }

  console.log(`\nKnown easings: ${[...easings].join(" · ")}`);

  if (strict && offending.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
