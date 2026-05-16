// Slug → Wikipedia article title mapping. Shared between
// repair-hero-urls (re-source dead heroUrls) and
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
