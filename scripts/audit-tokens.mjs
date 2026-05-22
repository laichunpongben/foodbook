#!/usr/bin/env node
// audit-tokens.mjs — scan .astro / .css files for design-token sprawl.
//
// Reads the canonical token set from src/styles/tokens.json (ADR-0010),
// then walks every .astro and .css file under src/ looking for raw
// `font-size: <rem>`, `gap: <rem>`, `padding: <rem>`, `margin: <rem>`
// literals. For each literal:
//
//   - If it matches a token value exactly → silently OK.
//   - If it sits between tokens → flag, and name the nearest token(s)
//     so a maintainer can decide: round to token (visual shift) or
//     leave with an explicit "off-scale:" comment.
//
// Lines that already carry an "off-scale:" marker are skipped (the
// author has already audited that one).
//
// Exit 0 always today (advisory). `--strict` flips to exit 1 when any
// unflagged off-scale literal is found, suitable for CI.
//
// Run as: `node scripts/audit-tokens.mjs` or `npm run audit:tokens`.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const TOKENS_FILE = "src/styles/tokens.json";
const ROOTS = ["src"];

// Fallback scale — kept in sync with ADR-0010 / tokens.json so the
// script keeps working before tokens.json lands on main.
const FALLBACK = {
  text: [0.78, 0.92, 1, 1.15, 1.4],
  space: [0.15, 0.3, 0.5, 0.8, 1.2, 1.8, 2.5, 4, 6],
};

async function loadTokens() {
  try {
    const raw = await readFile(TOKENS_FILE, "utf8");
    const json = JSON.parse(raw);
    const text = new Set();
    const space = new Set();
    for (const [, v] of Object.entries(json.text ?? {})) {
      const value = v.$value;
      if (typeof value === "string" && value.endsWith("rem")) text.add(parseFloat(value));
    }
    for (const [, v] of Object.entries(json.space ?? {})) {
      const value = v.$value;
      if (typeof value === "string" && value.endsWith("rem")) space.add(parseFloat(value));
    }
    return {
      text: [...text].sort((a, b) => a - b),
      space: [...space].sort((a, b) => a - b),
    };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    console.warn(`note: ${TOKENS_FILE} not found — using fallback scale baked into this script.`);
    return FALLBACK;
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

function bounds(value, scale) {
  let lower = null;
  let upper = null;
  for (const s of scale) {
    if (s <= value) lower = s;
    if (s >= value && upper === null) upper = s;
  }
  return { lower, upper };
}

const FONT_SIZE_RE = /font-size:\s*(\d+(?:\.\d+)?)rem\b/g;
const SPACE_RE = /(?:gap|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?):\s*(\d+(?:\.\d+)?)rem\b/g;
const OFF_SCALE_MARKER = /off-scale:/i;

async function main() {
  const strict = process.argv.includes("--strict");
  const tokens = await loadTokens();

  let totalChecked = 0;
  let totalMatched = 0;
  let totalOffScaleFlagged = 0;
  const offendingLines = [];

  const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat();
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isFlagged = OFF_SCALE_MARKER.test(line);

      for (const [, value] of [...line.matchAll(FONT_SIZE_RE)]) {
        const v = parseFloat(value);
        totalChecked += 1;
        if (tokens.text.includes(v)) {
          totalMatched += 1;
        } else if (isFlagged) {
          totalOffScaleFlagged += 1;
        } else {
          const { lower, upper } = bounds(v, tokens.text);
          offendingLines.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            kind: "font-size",
            value: `${v}rem`,
            nearest: `${nearest(v, tokens.text)}rem`,
            between: lower !== null && upper !== null && lower !== upper ? `${lower}rem → ${upper}rem` : null,
          });
        }
      }

      for (const [, value] of [...line.matchAll(SPACE_RE)]) {
        const v = parseFloat(value);
        totalChecked += 1;
        if (tokens.space.includes(v)) {
          totalMatched += 1;
        } else if (isFlagged) {
          totalOffScaleFlagged += 1;
        } else {
          const { lower, upper } = bounds(v, tokens.space);
          offendingLines.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            kind: "space",
            value: `${v}rem`,
            nearest: `${nearest(v, tokens.space)}rem`,
            between: lower !== null && upper !== null && lower !== upper ? `${lower}rem → ${upper}rem` : null,
          });
        }
      }
    }
  }

  console.log(`Audited ${files.length} files.`);
  console.log(`Literals checked: ${totalChecked}`);
  console.log(`  on-scale (or already var()): ${totalMatched}`);
  console.log(`  off-scale, flagged with /* off-scale: */: ${totalOffScaleFlagged}`);
  console.log(`  off-scale, unflagged: ${offendingLines.length}`);

  if (offendingLines.length > 0) {
    console.log("\nUnflagged off-scale literals:");
    for (const o of offendingLines) {
      const where = o.between ? `between ${o.between}` : `nearest ${o.nearest}`;
      console.log(`  ${o.file}:${o.line}  ${o.kind}: ${o.value}  (${where})`);
    }
  }

  if (strict && offendingLines.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
