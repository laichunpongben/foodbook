/**
 * content.config.ts — content collection schemas.
 *
 * Five primary collections, each anchored under src/content/<collection>/.
 * Cross-references between collections are slug strings, validated at build
 * time by scripts/check-refs.mjs (called from `npm run check:refs`).
 *
 *   dishes/<slug>/index.mdx
 *     The editorial spine. Weaves up to four lifecycle stages
 *     (source / grow / cook / eat), each referencing entries in the
 *     other collections by slug.
 *
 *   recipes/<slug>.mdx
 *     A cookable recipe — yield, time, ingredients (optionally with
 *     provenance refs back to farms/), numbered steps, revisions.
 *
 *   restaurants/<slug>.mdx
 *     A place visited. lat/lng, price band, visits[], dishes ordered.
 *
 *   farms/<slug>.mdx
 *     A farm, producer, or market. lat/lng, products[], seasonal windows.
 *
 *   meals/<slug>.mdx
 *     A single meal event. Date, location (a restaurant slug or
 *     `home`), dishes referenced, photos.
 *
 * Plus two lightweight log collections:
 *
 *   garden/<slug>.mdx — planting × bed × date × yield.
 *   pantry.mdx       — single file, current inventory snapshot.
 *
 * Visibility model (see ADR-0005):
 *   - 'public'   (default) — listed in /, /world, /seasons, sitemap, RSS.
 *   - 'unlisted'           — page exists at its slug but excluded from
 *                            listings; renders <meta robots noindex>.
 *   No auth-gated tier; sensitive content does not enter this repo.
 */

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* ----- shared primitives ----- */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const visibility = z.enum(['public', 'unlisted']).default('public');
const priceBand = z.enum(['$', '$$', '$$$', '$$$$']);

/** Tags. Open set — add as needed. Keeps `/seasons` and the related rail
 *  workable. Not a substitute for embedding-based discovery. */
const dishTags = [
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink',
  'vegetarian', 'vegan', 'pescatarian',
  'spring', 'summer', 'autumn', 'winter',
  'italian', 'japanese', 'chinese', 'french', 'mexican', 'thai',
  'indian', 'levantine', 'iberian', 'nordic',
  'one-pot', 'baking', 'fermentation', 'grill', 'raw', 'preserved',
] as const;

/** One revision of a recipe. Latest entry surfaces as "Updated …" on
 *  the recipe page; the body of the entry itself holds the latest text. */
const revisionSchema = z.object({
  date: isoDate,
  summary: z.string(),
  label: z.string().optional(), // e.g. "v3"
});

/** Bookends — heading + prose for a dish entry's intro / outro. May
 *  contain inline <em>. Same pattern as Travelbook. */
const bookendSchema = z.object({
  heading: z.string(),
  prose: z.string(),
});

/* ----- dishes — the editorial spine ----- */

/** One lifecycle stage on a dish entry. All optional — a dish can have
 *  any subset of the four. The renderer greys out the empty ones. */
const dishStageSchema = z.object({
  /** Free prose for the stage. May contain inline <em>. */
  note: z.string().optional(),
  /** Slug refs to other collections, by stage. Validated at build time. */
  farms: z.array(z.string()).default([]),         // SOURCE
  garden: z.array(z.string()).default([]),        // GROW
  recipes: z.array(z.string()).default([]),       // COOK
  meals: z.array(z.string()).default([]),         // EAT
  restaurants: z.array(z.string()).default([]),   // EAT (eaten out)
});

const dishes = defineCollection({
  loader: glob({ pattern: 'dishes/*/index.mdx', base: './src/content' }),
  schema: z.object({
    title: z.string(),                              // may contain <em>
    shortTitle: z.string(),                         // plain text for stats/tooltips
    /** Path stem (no size suffix): /photos/dishes/<slug>/hero */
    hero: z.string(),
    /** Absolute URL to an external image (e.g. Wikimedia). Takes precedence
     *  over `hero` when set — used for entries that don't have local R2
     *  photos yet. Renderer should not append size suffixes to this. */
    heroUrl: z.string().url().optional(),
    /** CSS `object-position` / `background-position` value applied to the
     *  hero photo wherever it's cropped (landing-page card's 4:5 crop and
     *  the dish detail page's full-bleed plate hero). Omit for the
     *  centered default. Use percentages (e.g. "50% 30%" pulls the focal
     *  point higher) or keywords (e.g. "center top"). Photos sourced
     *  from Wikimedia often need a vertical nudge because the plate
     *  isn't always centered in the source frame. */
    heroFocal: z.string().optional(),
    /** One-line editorial tagline under the title. */
    tagline: z.string().optional(),
    /** Geographic / cultural origin label, e.g. "Naples, Italy". Free text. */
    origin: z.string().optional(),
    tags: z.array(z.enum(dishTags)).default([]),
    visibility,
    /** Lifecycle stages — up to four, all optional. */
    stages: z.object({
      source: dishStageSchema.optional(),
      grow: dishStageSchema.optional(),
      cook: dishStageSchema.optional(),
      eat: dishStageSchema.optional(),
    }).default({}),
    /** Authored opening + closing bookends. Both optional — short
     *  entries skip them. */
    prologue: bookendSchema.optional(),
    finale: bookendSchema.optional(),
    /** First-tasted / first-cooked date — drives "in repertoire since" pill. */
    firstMade: isoDate.optional(),
  }),
});

/* ----- recipes ----- */

const ingredientSchema = z.object({
  /** Free-text quantity + ingredient, e.g. "1.2 kg San Marzano tomatoes". */
  text: z.string(),
  /** Short display name for the ingredient ("Plum tomatoes"). Required
   *  for the journey view to render each ingredient as its own card.
   *  Without it the renderer falls back to a stripped form of `text`. */
  name: z.string().optional(),
  /** Absolute URL for the ingredient's hero image. Used by the Plant
   *  section to show each ingredient as a card with its own photo. */
  heroUrl: z.string().url().optional(),
  /** Optional growth note — "ripens 80 days from seed", "pressed in
   *  early autumn", "fermented for 3 years". Shown on the ingredient
   *  card. */
  growthNote: z.string().optional(),
  /** Optional provenance — slug of a farm/garden/producer entry. The
   *  renderer links the ingredient to its origin. */
  from: z.string().optional(),
  /** Optional ingredient group, e.g. "for the sauce" / "for finishing". */
  group: z.string().optional(),
  /** Optional GBIF taxon ID — pins the ingredient to a canonical species
   *  (e.g. 2874875 for Litchi chinensis). Lets the almanac sidecar resolve
   *  terroir/seasonality without name-matching. Lookup at gbif.org/species. */
  gbifTaxonId: z.number().int().positive().optional(),
});

const stepSchema = z.object({
  text: z.string(),
  /** Optional duration in seconds — surfaces a one-tap timer in cook mode. */
  durationSeconds: z.number().int().positive().optional(),
  /** Optional photo stem for this step. */
  photo: z.string().optional(),
});

const recipes = defineCollection({
  loader: glob({ pattern: 'recipes/*.mdx', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    yield: z.string(),                              // "4 servings"
    timePrep: z.string().optional(),                // "15 min"
    timeCook: z.string().optional(),                // "2 h"
    hero: z.string().optional(),
    heroUrl: z.string().url().optional(),
    tags: z.array(z.enum(dishTags)).default([]),
    visibility,
    /** Attribution. If AI was used in extraction, say so — never lie about
     *  authorship. See ADR-0004 + docs/ai-first.md. */
    attribution: z.string().optional(),
    /** Source URL if adapted from elsewhere. */
    sourceUrl: z.string().url().optional(),
    ingredients: z.array(ingredientSchema),
    steps: z.array(stepSchema),
    notes: z.string().optional(),
    revisions: z.array(revisionSchema).default([]),
  }),
});

/* ----- restaurants ----- */

const visitSchema = z.object({
  date: isoDate,
  /** Dishes ordered, as free text or refs to dishes/. */
  dishes: z.array(z.string()).default([]),
  /** Free prose — what was memorable. */
  note: z.string().optional(),
  /** Slug ref into meals/ if this visit warranted a full meal entry. */
  meal: z.string().optional(),
});

/** If a restaurant entry was added via research rather than a personal
 *  visit, `discoveredVia` documents the source. The Eat column on the
 *  dish page reads this and renders the card as "Discovered · …"
 *  instead of "Visited · …". `visits` is typically empty in this case
 *  but is not required to be — a visited restaurant can also carry a
 *  discovery note documenting how you first heard of it. */
const discoveredViaSchema = z.object({
  source: z.string(),                          // "TasteAtlas", "Eating Europe"
  url: z.string().url().optional(),
  /** Specific signature that matches the dish — "Tagliatelle al ragù". */
  signature: z.string().optional(),
});

const restaurants = defineCollection({
  loader: glob({ pattern: 'restaurants/*.mdx', base: './src/content' }),
  schema: z.object({
    name: z.string(),
    cuisine: z.string().optional(),
    city: z.string(),
    country: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    priceBand,
    /** Path stem for a hero photo, if any. */
    hero: z.string().optional(),
    heroUrl: z.string().url().optional(),
    tags: z.array(z.enum(dishTags)).default([]),
    visibility,
    visits: z.array(visitSchema).default([]),
    discoveredVia: discoveredViaSchema.optional(),
  }),
});

/* ----- farms ----- */

/** Seasonal window for a product. Months are 1–12. Wraps across the year
 *  if `from` > `to` (e.g. winter squash from=10 to=2). */
const seasonalWindowSchema = z.object({
  product: z.string(),
  from: z.number().int().min(1).max(12),
  to: z.number().int().min(1).max(12),
});

const farms = defineCollection({
  loader: glob({ pattern: 'farms/*.mdx', base: './src/content' }),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['farm', 'producer', 'market', 'fishery', 'forager', 'mill', 'dairy', 'orchard']),
    /** Plain-text location, e.g. "Sarno Valley, Campania". Real address
     *  not required and discouraged. */
    location: z.string(),
    country: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    /** Product slugs as free strings — link to dishes via ingredient `from:` */
    products: z.array(z.string()).default([]),
    seasonalWindow: z.array(seasonalWindowSchema).default([]),
    hero: z.string().optional(),
    heroUrl: z.string().url().optional(),
    visibility,
    /** Free editorial note about the producer. */
    note: z.string().optional(),
    url: z.string().url().optional(),
  }),
});

/* ----- meals ----- */

const meals = defineCollection({
  loader: glob({ pattern: 'meals/*.mdx', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    date: isoDate,
    /** Either a restaurant slug or the literal string 'home'. */
    location: z.string(),
    occasion: z.string().optional(),                // "Easter", "weeknight", "tasting menu"
    /** Dish slugs referenced. */
    dishes: z.array(z.string()).default([]),
    /** Path stems for photos. */
    photos: z.array(z.string()).default([]),
    heroUrl: z.string().url().optional(),
    tags: z.array(z.enum(dishTags)).default([]),
    visibility,
    /** Companion count, no names. Names should not enter the repo. */
    companionCount: z.number().int().min(0).max(50).optional(),
  }),
});

/* ----- garden + pantry (log state) ----- */

const garden = defineCollection({
  loader: glob({ pattern: 'garden/*.mdx', base: './src/content' }),
  schema: z.object({
    plant: z.string(),
    bed: z.string(),                                // "Bed A1", "balcony pot 3"
    planted: isoDate,
    harvested: isoDate.optional(),
    yieldNote: z.string().optional(),               // "≈ 2 kg over 4 weeks"
    heroUrl: z.string().url().optional(),
    visibility,
    note: z.string().optional(),
  }),
});

const pantry = defineCollection({
  loader: glob({ pattern: 'pantry.mdx', base: './src/content' }),
  schema: z.object({
    updated: isoDate,
    items: z.array(z.object({
      slug: z.string(),                             // e.g. "olive-oil-arbequina"
      label: z.string(),                            // human-readable
      quantity: z.string().optional(),
      from: z.string().optional(),                  // farm slug
    })),
  }),
});

export const collections = { dishes, recipes, restaurants, farms, meals, garden, pantry };
