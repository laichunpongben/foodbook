#!/usr/bin/env node
// check-doc-links.mjs — validate that every `[label](path)` in docs/*.md
// and README.md / CONTRIBUTING.md points to an existing file.
//
// Catches the most common doc-rot pattern: a doc says "see foo.md" but
// foo.md was renamed or moved. External URLs (http://) and anchors
// (#section) are skipped — this is just relative-link validation.
//
// Exit 0 when every link resolves; exit 1 with the list of broken links
// otherwise. Suitable for CI gating.
//
// Run as: `node scripts/check-doc-links.mjs` or `npm run check:doc-links`.

import { readdir, readFile, access } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const ROOTS = ["docs"];
const EXTRA_FILES = ["README.md", "CONTRIBUTING.md"];

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

async function checkFile(file) {
  const raw = await readFile(file, "utf8");
  const fileDir = dirname(file);
  const lines = raw.split("\n");
  const broken = [];

  for (let i = 0; i < lines.length; i++) {
    for (const match of [...lines[i].matchAll(LINK_RE)]) {
      const target = match[2].trim();
      // Skip external URLs, anchors, and mailto: links
      if (
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:") ||
        target.startsWith("#") ||
        target.startsWith("data:")
      ) {
        continue;
      }
      // Strip anchor fragment (foo.md#section -> foo.md)
      const cleanTarget = target.split("#")[0];
      if (!cleanTarget) continue; // pure anchor was already skipped
      const resolved = resolve(fileDir, cleanTarget);
      if (!(await exists(resolved))) {
        broken.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          label: match[1],
          target,
        });
      }
    }
  }
  return broken;
}

async function main() {
  const files = [
    ...(await Promise.all(ROOTS.map((r) => walk(r)))).flat(),
    ...(await Promise.all(EXTRA_FILES.map(async (f) => ((await exists(f)) ? [f] : [])))).flat(),
  ];

  let total = 0;
  const allBroken = [];
  for (const file of files) {
    const broken = await checkFile(file);
    allBroken.push(...broken);
    total += 1;
  }

  console.log(`Checked ${total} markdown files. Broken links: ${allBroken.length}\n`);
  if (allBroken.length > 0) {
    for (const b of allBroken) {
      console.log(`  ${b.file}:${b.line}  [${b.label}](${b.target})`);
    }
    process.exit(1);
  }
  console.log("All relative links resolve.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
