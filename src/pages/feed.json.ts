/**
 * /feed.json — JSON Feed 1.1 (https://jsonfeed.org/version/1.1) variant
 * of the RSS feed. Some modern readers (NetNewsWire, ReadKit, Mimestream)
 * prefer JSON Feed; AI ingestion crawlers handle it more reliably than
 * the RSS 2.0 dialect.
 *
 * Mirrors the same selection + sort as rss.xml.ts.
 */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { entryUrl, SITE_NAME } from '~/lib/jsonld';
import { bare } from '~/lib/slug';
import { publicOnly } from '~/lib/visibility';

const FEED_LIMIT = 50;

interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  content_text?: string;
  summary?: string;
  date_published?: string;
  tags?: string[];
  image?: string;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Astro.site must be set');

  const [dishes, recipes, restaurants, farms] = await Promise.all([
    getCollection('dishes').then(publicOnly),
    getCollection('recipes').then(publicOnly),
    getCollection('restaurants').then(publicOnly),
    getCollection('farms').then(publicOnly),
  ]);

  const items: JsonFeedItem[] = [];

  for (const d of dishes) {
    const url = entryUrl(site, 'dishes', bare(d.id));
    items.push({
      id: url,
      url,
      title: d.data.shortTitle,
      summary: d.data.tagline,
      ...(d.data.firstMade && { date_published: new Date(`${d.data.firstMade}T00:00:00Z`).toISOString() }),
      ...(d.data.tags && d.data.tags.length > 0 && { tags: [...d.data.tags] }),
      ...(d.data.heroUrl && { image: d.data.heroUrl }),
    });
  }
  for (const r of recipes) {
    const url = entryUrl(site, 'recipes', bare(r.id));
    items.push({
      id: url,
      url,
      title: r.data.title,
      summary: [r.data.yield, r.data.timeCook].filter(Boolean).join(' · '),
      ...(r.data.tags && r.data.tags.length > 0 && { tags: [...r.data.tags] }),
      ...(r.data.heroUrl && { image: r.data.heroUrl }),
    });
  }
  for (const f of farms) {
    const url = entryUrl(site, 'farms', bare(f.id));
    items.push({
      id: url,
      url,
      title: f.data.name,
      summary: `${f.data.kind} · ${f.data.location}`,
      ...(f.data.heroUrl && { image: f.data.heroUrl }),
    });
  }
  for (const r of restaurants) {
    const url = entryUrl(site, 'restaurants', bare(r.id));
    items.push({
      id: url,
      url,
      title: r.data.name,
      summary: `${r.data.cuisine ?? 'Restaurant'} in ${r.data.city}`,
      ...(r.data.heroUrl && { image: r.data.heroUrl }),
    });
  }

  items.sort((a, b) => {
    if (a.date_published && b.date_published) return b.date_published.localeCompare(a.date_published);
    if (a.date_published) return -1;
    if (b.date_published) return 1;
    return a.title.localeCompare(b.title);
  });

  const limited = items.slice(0, FEED_LIMIT);

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_NAME,
    home_page_url: site.toString(),
    feed_url: new URL('/feed.json', site).toString(),
    description: 'An archive of the food lifecycle — farms, gardens, kitchens, restaurants.',
    language: 'en',
    items: limited,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'content-type': 'application/feed+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
