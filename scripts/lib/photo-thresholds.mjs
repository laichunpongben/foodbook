// Resolution gates shared by audit-hero-photos (flag low-res sources)
// and upgrade-flagged-photos (decide which dishes are upgrade
// candidates). Sharpness/luma/contrast stay audit-local — they're not
// fixable by swapping URLs.
export const RESOLUTION_GATE = {
  minWidth: 1200,        // < 1200px wide can't fill a retina hero
  minMegapixels: 1.5,    // < 1.5 MP usually means thumbnail-tier source
};
