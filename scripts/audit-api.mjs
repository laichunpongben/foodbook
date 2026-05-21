#!/usr/bin/env node
/**
 * audit-api.mjs — smoke-test the built /api/*.json endpoints from dist/.
 *
 * After `npm run build`, every API endpoint emits a static .json file
 * under `dist/api/`. This script reads each one, asserts it's well-formed
 * JSON, has the standard `{ version, count, items[] }` envelope, and
 * that count matches items.length. Catches drift between the documented
 * shape and what the endpoints actually emit.
 *
 * Exit 0 on success, 1 if any endpoint fails its checks.
 * Run after a build: `npm run build && node scripts/audit-api.mjs`
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST_API = "dist/api";

async function listJsonFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const files = [];
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listJsonFiles(path)));
    else if (e.name.endsWith(".json")) files.push(path);
  }
  return files;
}

function checkEnvelope(file, body) {
  const errors = [];
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    errors.push("body is not a JSON object");
    return errors;
  }
  if (typeof body.version !== "number") {
    errors.push("missing or non-numeric `version`");
  }
  // /api/index.json is a directory and doesn't carry items[] — skip the rest.
  if (file.endsWith("/api/index.json")) return errors;
  if (!Array.isArray(body.items)) {
    errors.push("`items` is missing or not an array");
  } else if (typeof body.count !== "number") {
    errors.push("missing or non-numeric `count`");
  } else if (body.count !== body.items.length) {
    errors.push(`count=${body.count} but items.length=${body.items.length}`);
  }
  return errors;
}

async function main() {
  // Sanity-check the dir exists; otherwise the user forgot to build.
  try {
    await stat(DIST_API);
  } catch {
    console.error(`No ${DIST_API} directory — run 'npm run build' first.`);
    process.exit(1);
  }

  const files = await listJsonFiles(DIST_API);
  if (files.length === 0) {
    console.error(`No JSON files under ${DIST_API}.`);
    process.exit(1);
  }

  let failed = 0;
  console.log(`Checking ${files.length} API endpoints…`);
  for (const f of files) {
    const raw = await readFile(f, "utf8");
    let body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      console.error(`  ✗ ${f}  — parse error: ${err.message}`);
      failed += 1;
      continue;
    }
    const errors = checkEnvelope(f, body);
    if (errors.length > 0) {
      console.error(`  ✗ ${f}`);
      for (const e of errors) console.error(`      - ${e}`);
      failed += 1;
    } else {
      const sizeKb = (raw.length / 1024).toFixed(1);
      const itemCount = Array.isArray(body.items) ? body.items.length : "n/a";
      console.log(`  ✓ ${f}  (${sizeKb} KB, ${itemCount} items)`);
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(`${failed} endpoint${failed === 1 ? "" : "s"} failed checks.`);
    process.exit(1);
  }
  console.log("All endpoints OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
