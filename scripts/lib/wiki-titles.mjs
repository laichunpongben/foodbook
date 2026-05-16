// Slug → Wikipedia article mapping + the lookup that consumes it.
// Shared between repair-hero-urls (re-source dead heroUrls) and
// upgrade-flagged-photos (re-source low-quality heroUrls).

// Slugs whose Wikipedia article title isn't `Slug_with_underscores` —
// disambiguation pages (Hopper, Momo, Adobo all collide with non-food
// meanings), missing dedicated articles (shoyu-ramen folds into Ramen),
// and known romanization mismatches (pad-kra-pao vs Phat_kaphrao).
export const TITLE_OVERRIDES = {
  adobo: 'Philippine_adobo',
  hoppers: 'Appam',
  kimbap: 'Gimbap',
  'lasagne-bolognese': 'Lasagne',
  momo: 'Momo_(food)',
  'pad-kra-pao': 'Phat_kaphrao',
  'pesto-alla-genovese': 'Pesto',
  'risotto-milanese': 'Risotto',
  'shoyu-ramen': 'Ramen',
  'taiwanese-beef-noodle-soup': 'Beef_noodle_soup',
  'tom-yum-goong': 'Tom_yum',
  'wonton-noodle-soup': 'Wonton_noodles',
};

export function slugToTitle(slug) {
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];
  const parts = slug.split('-');
  parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.join('_');
}

// Fetch the Wikipedia REST summary for an article title. Returns the
// parsed body, or null on 404. The throttled fetcher is passed in so
// each caller keeps its own UA / rate budget — `allowStatus: [404]`
// must be set on it for the null-on-miss contract to hold.
export async function lookupArticle(throttledFetch, title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await throttledFetch(url);
  if (!res.ok) return null;
  return res.json();
}
