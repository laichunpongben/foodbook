#!/usr/bin/env node
/**
 * research-restaurants.mjs <dish-slug>
 *
 * Author-time helper for finding restaurants that serve a given dish.
 * Calls the Anthropic API with the web-search tool, asks Claude to
 * propose 5–8 restaurants worldwide known for the dish, then writes
 * draft MDX entries to src/content/restaurants/_drafts/<slug>.mdx.
 *
 * Drafts are NEVER auto-committed. The author reviews each one,
 * trims/edits, moves it out of _drafts/, and adds the slug to the
 * dish's stages.eat.restaurants. See docs/ai-first.md + ADR-0004.
 *
 *   ANTHROPIC_API_KEY=sk-... node scripts/research-restaurants.mjs <dish-slug>
 *
 * Requires Node 22+ for global fetch.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const slug = process.argv[2];
if (!slug) {
  console.error('usage: node scripts/research-restaurants.mjs <dish-slug>');
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY not set. Source .env or export it.');
  process.exit(1);
}

const dishPath = join(ROOT, 'src/content/dishes', slug, 'index.mdx');
if (!existsSync(dishPath)) {
  console.error(`dish not found: ${dishPath}`);
  process.exit(1);
}
const dishMdx = await readFile(dishPath, 'utf8');
const frontmatter = (dishMdx.match(/^---\r?\n([\s\S]*?)\r?\n---/) ?? ['', ''])[1];
const title = (frontmatter.match(/^title:\s*"?([^"\n]+)"?/m) ?? ['', slug])[1].replace(/<[^>]*>/g, '');
const origin = (frontmatter.match(/^origin:\s*"?([^"\n]+)"?/m) ?? ['', ''])[1];

console.error(`▷ Researching restaurants serving: ${title}${origin ? ` (${origin})` : ''}`);

const systemPrompt = `You are a culinary researcher. Given a dish name and origin, find 5-8 restaurants worldwide known for serving an authentic or signature version of that dish.

For each restaurant, return:
- name
- city, country
- cuisine label (e.g. "Emilia-Romagna", "Neapolitan", "Italian")
- approximate price band: $, $$, $$$, or $$$$
- approximate lat/lng (4 decimal places)
- one short signature note describing what makes it relevant to THIS dish
- one source URL (Michelin Guide, TasteAtlas, reputable food press)

Spread the picks geographically when possible — at least 2 in the dish's origin region, the rest worldwide. Prefer restaurants with public reviews. Never invent: if you cannot verify a restaurant exists, omit it.

Output ONLY a JSON array, no prose.`;

const userPrompt = `Dish: ${title}${origin ? `\nOrigin: ${origin}` : ''}\n\nFind 5-8 restaurants serving this dish or a signature version of it. Use the web_search tool to verify each. Return the JSON array.`;

const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
    messages: [{ role: 'user', content: userPrompt }],
  }),
});
if (!resp.ok) {
  console.error(`API error ${resp.status}: ${await resp.text()}`);
  process.exit(1);
}
const body = await resp.json();
const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
const jsonMatch = text.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  console.error('No JSON array in response. Raw output:\n', text);
  process.exit(1);
}
const restaurants = JSON.parse(jsonMatch[0]);

const draftsDir = join(ROOT, 'src/content/restaurants/_drafts');
await mkdir(draftsDir, { recursive: true });

function toSlug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const newSlugs = [];
for (const r of restaurants) {
  const rSlug = toSlug(`${r.name}-${r.city}`);
  newSlugs.push(rSlug);
  const path = join(draftsDir, `${rSlug}.mdx`);
  const mdx = `---
name: "${r.name.replace(/"/g, '\\"')}"
cuisine: "${(r.cuisine ?? 'Italian').replace(/"/g, '\\"')}"
city: "${r.city.replace(/"/g, '\\"')}"
country: "${r.country ?? ''}"
lat: ${r.lat}
lng: ${r.lng}
priceBand: "${r.priceBand ?? '$$'}"
tags: ['dinner']
visibility: public
visits: []
discoveredVia:
  source: "${(r.source ?? 'web research').replace(/"/g, '\\"')}"
  url: "${r.url ?? ''}"
  signature: "${(r.signature ?? '').replace(/"/g, '\\"')}"
---

${r.note ?? ''}
`;
  await writeFile(path, mdx, 'utf8');
  console.error(`  wrote ${path}`);
}

console.error(`\n✓ ${restaurants.length} drafts written to src/content/restaurants/_drafts/`);
console.error('\nNext steps:');
console.error('  1. Review each draft. Trim / correct facts.');
console.error('  2. Move accepted drafts out of _drafts/ into restaurants/.');
console.error(`  3. Append to ${dishPath} under stages.eat.restaurants:`);
for (const s of newSlugs) console.error(`       - '${s}'`);
