/**
 * /llms.txt — emerging convention (llmstxt.org) for AI crawlers.
 *
 * Lists every public dish / recipe / restaurant / farm with a one-line
 * hook, grouped by section. Robots.txt already declares "AI scrapers
 * are not blocked here", so this is the consistent counterpart — a
 * concise table-of-contents AI clients can pull instead of crawling
 * every listing page.
 */
import { getCollection } from 'astro:content';
import { publicOnly } from '~/lib/visibility';
import { entryUrl } from '~/lib/jsonld';
import type { APIRoute } from 'astro';

const bare = (id: string) => id.replace(/^[^/]+\//, '');

function strip(s: string): string {
  return s.replace(/<\/?em>/g, '');
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error('Astro.site must be set in astro.config.mjs');
  }

  const [dishes, recipes, farms, restaurants] = await Promise.all([
    getCollection('dishes').then(publicOnly),
    getCollection('recipes').then(publicOnly),
    getCollection('farms').then(publicOnly),
    getCollection('restaurants').then(publicOnly),
  ]);

  const lines: string[] = [
    '# Foodbook',
    '',
    '> An archive of the food lifecycle — farms, gardens, kitchens, restaurants. Authored prose, AI-assisted authoring (see /about#ai).',
    '',
    '## Dishes',
    '',
    ...dishes
      .slice()
      .sort((a, b) => strip(a.data.shortTitle).localeCompare(strip(b.data.shortTitle)))
      .map((d) => {
        const url = entryUrl(site, 'dishes', bare(d.id));
        const hook = strip(d.data.tagline ?? d.data.shortTitle);
        return `- [${strip(d.data.shortTitle)}](${url}): ${hook}`;
      }),
    '',
    '## Recipes',
    '',
    ...recipes
      .slice()
      .sort((a, b) => strip(a.data.title).localeCompare(strip(b.data.title)))
      .map((r) => {
        const url = entryUrl(site, 'recipes', bare(r.id));
        const meta = [r.data.yield, r.data.timeCook && `cook ${r.data.timeCook}`].filter(Boolean).join(' · ');
        return `- [${strip(r.data.title)}](${url}): ${meta}`;
      }),
    '',
    '## Restaurants',
    '',
    ...restaurants
      .slice()
      .sort((a, b) => a.data.name.localeCompare(b.data.name))
      .map((r) => {
        const url = entryUrl(site, 'restaurants', bare(r.id));
        const where = [r.data.city, r.data.country].filter(Boolean).join(', ');
        return `- [${r.data.name}](${url}): ${r.data.cuisine ?? 'Restaurant'} — ${where}`;
      }),
    '',
    '## Farms & Producers',
    '',
    ...farms
      .slice()
      .sort((a, b) => a.data.name.localeCompare(b.data.name))
      .map((f) => {
        const url = entryUrl(site, 'farms', bare(f.id));
        return `- [${f.data.name}](${url}): ${f.data.kind} — ${f.data.location}`;
      }),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
