#!/usr/bin/env node
// pr-queue.mjs — list open PRs from the maintainer, grouped by axis,
// with their CI status. Pure-read helper for triage sessions.
//
// Calls `gh pr list --json` and `gh pr checks` under the hood. No
// secrets, no mutations. Outputs a plain-text table.
//
// Run as: `node scripts/pr-queue.mjs` or `npm run pr-queue`.

import { spawnSync } from "node:child_process";

function gh(args) {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed:\n${r.stderr}`);
  }
  return r.stdout;
}

function classify(title) {
  if (/ADR-?\d+|adr\b/i.test(title)) return "ADR";
  if (/^docs?\(/i.test(title)) return "docs";
  if (/^ci\(/i.test(title)) return "ci";
  if (/^chore\(scripts\)|audit/i.test(title)) return "tooling";
  if (/^style\(/i.test(title)) return "style/migration";
  if (/^feat\(/i.test(title)) return "feature";
  if (/^content\(/i.test(title)) return "content";
  if (/^fix\(/i.test(title)) return "fix";
  if (/^refactor\(/i.test(title)) return "refactor";
  return "other";
}

async function main() {
  const raw = gh(["pr", "list", "--state", "open", "--author", "@me", "--limit", "100", "--json", "number,title,headRefName,createdAt,statusCheckRollup"]);
  const prs = JSON.parse(raw);

  prs.sort((a, b) => a.number - b.number);

  const byCategory = new Map();
  for (const p of prs) {
    const cat = classify(p.title);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(p);
  }

  console.log(`Open PRs from @me: ${prs.length}\n`);

  const ORDER = ["ADR", "tooling", "ci", "style/migration", "feature", "content", "docs", "fix", "refactor", "other"];
  for (const cat of ORDER) {
    const list = byCategory.get(cat) ?? [];
    if (list.length === 0) continue;
    console.log(`--- ${cat} (${list.length}) ---`);
    for (const p of list) {
      const checks = p.statusCheckRollup ?? [];
      const failing = checks.filter((c) => c.conclusion === "FAILURE").length;
      const pending = checks.filter((c) => c.status !== "COMPLETED").length;
      const tag = failing > 0 ? "✗" : pending > 0 ? "·" : "✓";
      console.log(`  ${tag} #${p.number}  ${p.title.slice(0, 80)}`);
    }
    console.log();
  }

  const failing = prs.filter((p) => (p.statusCheckRollup ?? []).some((c) => c.conclusion === "FAILURE")).length;
  const pending = prs.filter((p) => (p.statusCheckRollup ?? []).every((c) => c.status === "COMPLETED")).length;
  console.log(`Status: ${pending} green · ${failing} failing · ${prs.length - pending - failing} pending`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
