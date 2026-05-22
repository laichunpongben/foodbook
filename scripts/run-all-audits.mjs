#!/usr/bin/env node
// run-all-audits.mjs — runner that invokes every audit:* script in turn,
// captures their output, and prints a one-line per-script summary at
// the end. Resolves issue #305.
//
// Key behaviour: unlike `npm run audit:all` (which chains scripts with
// && and short-circuits on the first failure), this runner always runs
// every script. Failures are reported in the summary; exit code is 0
// unless one or more scripts ran in --strict mode and failed.
//
// Run as: `node scripts/run-all-audits.mjs` or `npm run audit:all` once
// package.json is repointed to this script.

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

const AUDITS = [
  "audit-tags",
  "audit-coords",
  "audit-lineage",
  "audit-tokens",
  "audit-radii",
  "audit-motion",
  "audit-prose",
  "audit-a11y",
];

const strict = process.argv.includes("--strict");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(script) {
  return new Promise((resolve) => {
    const args = strict ? ["--strict"] : [];
    const child = spawn("node", [`scripts/${script}.mjs`, ...args], {
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  const results = [];

  for (const audit of AUDITS) {
    const path = `scripts/${audit}.mjs`;
    if (!(await exists(path))) {
      console.log(`\n— ${audit} —\n(${path} not present; skipping)`);
      results.push({ audit, status: "skipped", code: null });
      continue;
    }
    console.log(`\n— ${audit} —`);
    const code = await run(audit);
    results.push({ audit, status: code === 0 ? "ok" : "failed", code });
  }

  console.log("\n=== summary ===");
  let failed = 0;
  for (const r of results) {
    const tag = r.status === "ok" ? "✓" : r.status === "skipped" ? "·" : "✗";
    const codeLabel = r.code === null ? "" : ` (exit ${r.code})`;
    console.log(`  ${tag} ${r.audit}${codeLabel}`);
    if (r.status === "failed") failed += 1;
  }

  if (failed > 0) {
    console.log(`\n${failed} audit${failed === 1 ? "" : "s"} failed.`);
    process.exit(strict ? 1 : 0);
  }
  console.log("\nAll audits passed (advisory mode — strict gate is opt-in via --strict).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
