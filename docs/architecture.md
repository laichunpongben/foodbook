# Foodbook architecture

Snapshot of the **current** state of the system: directory layout, content model, dev workflow, deploy flow. Refreshed when the architecture changes. Historical rationale lives in [`docs/adr/`](adr/); open work in `feature-wishlist.md` and GitHub issues.

> If this file is more than ~2 commits behind reality, it's stale — please update.

## Stack summary

| Concern | Choice | Why |
|---|---|---|
| Site framework | Astro 5 (`output: 'static'`) — no SSR adapter today | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Content | Content collections + MDX, Zod schemas in `src/content.config.ts` | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Hosting | Cloudflare Pages, deploy via `wrangler pages deploy` from CI | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Dish hero photography | Direct Wikimedia URLs + `heroFocal` CSS crop control | [ADR-0008](adr/0008-wikimedia-image-pipeline.md) (supersedes the R2-variants clause of [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md)) |
| Visibility | Public + `unlisted` (no private/auth tier) | [ADR-0005](adr/0005-public-by-default-no-private-tier.md) |
| Map | Leaflet + CARTO Dark Matter tiles | inherited from Travelbook ADR-0004 |
| Visual language — primary | Dark editorial, Fraunces + Inter (self-hosted), paprika accent | [ADR-0003](adr/0003-dual-mode-editorial-and-kitchen.md) |
| Visual language — `/recipes/<slug>/cook` | Light "kitchen mode" parchment, same fonts | [ADR-0003](adr/0003-dual-mode-editorial-and-kitchen.md) |
| Content model | Five collections (dishes / recipes / restaurants / farms / meals) + garden + pantry | [ADR-0002](adr/0002-content-model-dishes-recipes-restaurants-farms.md) |
| Dish page structure | `DishHero` + Plant / Cook / Plate / Eat sections | [ADR-0006](adr/0006-dish-page-journey-with-dishhero.md) |
| Agriculture data | External sidecar (`almanac`) — not in this repo | [ADR-0007](adr/0007-external-agriculture-data-sidecar.md) (Proposed) |
| AI integration | Designed in [ADR-0004](adr/0004-ai-first-integration-points.md); **not yet implemented** — see [feature-wishlist.md](feature-wishlist.md) |
| Authoring | PR-based MDX commits — no frontend editor | inherited from Travelbook ADR-0012 |

## The content model

Foodbook has **five** content collections under `src/content/`. They reference each other by slug — a dish entry pulls in a recipe by `recipe: nonna-ragu-v3` rather than duplicating the recipe inline.

```
                       ┌────────────┐
                       │   dishes/  │  ← the spine; weaves the others together
                       └─────┬──────┘
                             │ refs by slug
            ┌────────────────┼────────────────┬─────────────────┐
            ▼                ▼                ▼                 ▼
       ┌─────────┐    ┌──────────┐    ┌──────────────┐    ┌─────────┐
       │ farms/  │    │ recipes/ │    │ restaurants/ │    │ meals/  │
       └─────────┘    └──────────┘    └──────────────┘    └─────────┘
        (SOURCE)        (COOK)             (EAT)            (EAT)
```

Plus two lightweight collections for personal log state:

- `garden/<slug>.mdx` — bed × plant × planted/harvested dates × yield × notes.
- `pantry.mdx` — single MDX file describing current inventory state.

The dish schema's `stages: { source?, grow?, cook?, eat? }` is the data layer. The dish page renders those as four narrative sections — **Plant** (ingredients flattened from `stages.cook[*].recipes[*].ingredients`), **Cook** (the recipes themselves), **Plate** (the dish entity), **Eat** (`stages.eat` meals + restaurants). The schema names and the section names are intentionally different — see [ADR-0006](adr/0006-dish-page-journey-with-dishhero.md) for the mapping.

### Why this shape (vs. one big "entry" type)

A single polymorphic entry would have ~60 fields most of which are unused per entry. Five focused collections keep each schema small and the entry-author UX clear. Cross-refs by slug do the work of joining at render time. See [ADR-0002](adr/0002-content-model-dishes-recipes-restaurants-farms.md).

## Directory layout

```
foodbook/
├── README.md
├── astro.config.mjs                   ← static output; mdx + sitemap + pagefind
├── wrangler.toml                      ← deploy target only; no bindings today
├── package.json                       ← astro, @astrojs/mdx, @astrojs/sitemap, leaflet, sharp, vitest
├── tsconfig.json
│
├── .github/workflows/
│   └── ci.yml                         ← build + checks + content-drift guard + deploy
│
├── docs/
│   ├── architecture.md                ← you are here
│   ├── brainstorm.md                  ← idea space, references
│   ├── ai-first.md                    ← where AI is intended to live (designed, not built)
│   ├── feature-wishlist.md            ← open + deferred backlog
│   └── adr/                           ← Architecture Decision Records (see adr/README.md)
│
├── public/
│   ├── _headers                       ← HSTS + CSP + frame-ancestors + Permissions-Policy + immutable assets
│   ├── _redirects                     ← /* → /404.html  404  catch-all
│   ├── robots.txt                     ← Allow: / ; sitemap pointer (Disallow handled per-entry by `unlisted`)
│   ├── favicon.svg / favicon.ico / icon-32.png / apple-touch-icon.png
│   └── og-default.svg                 ← fallback social card
│
├── scripts/
│   ├── new-dish.sh                    ← scaffold src/content/dishes/<slug>/index.mdx
│   ├── check-refs.mjs                 ← cross-collection slug validation (CI)
│   ├── check-no-leaks.sh              ← secret-pattern scan (CI)
│   ├── audit-hero-photos.mjs          ← score dish heroes on cheap visual signals
│   ├── suggest-focal.mjs              ← saliency-driven heroFocal picker (uses Wikimedia, throttled)
│   ├── seed-ingredient-photos.mjs     ← bulk-attach Wikimedia ingredient heroUrls to recipes
│   ├── upgrade-flagged-photos.mjs     ← promote low-res heroes to Wikimedia originalimage
│   ├── commons-mine-photos.mjs        ← search Commons for replacements when the article hero is poor
│   ├── repair-hero-urls.mjs           ← fix-up pass after Wikimedia file renames
│   ├── research-restaurants.mjs       ← AI-assisted restaurant prefill (see scripts/lib)
│   ├── gen-favicons.mjs               ← favicon set generator
│   └── lib/
│       ├── throttled-fetch.mjs        ← Wikimedia rate-limit-aware fetcher
│       └── (shared helpers — frontmatter read, slug utils, etc.)
│
└── src/
    ├── content.config.ts              ← Zod schemas: dishes / recipes / restaurants / farms / meals / garden / pantry
    ├── content/
    │   ├── dishes/<slug>/index.mdx
    │   ├── recipes/<slug>.mdx
    │   ├── restaurants/<slug>.mdx
    │   ├── farms/<slug>.mdx
    │   ├── meals/<slug>.mdx           ← (empty today — collection defined, no entries yet)
    │   ├── garden/<slug>.mdx
    │   └── pantry.mdx
    │
    ├── layouts/
    │   └── BaseLayout.astro           ← <html> shell, self-hosted Fraunces + Inter, theme switch for /cook
    │
    ├── components/
    │   ├── DishHero.astro             ← per-dish opener (eyebrow / title / tagline / hero / prologue)
    │   ├── PlantSection.astro         ← ingredients on the dish journey
    │   ├── CookSection.astro          ← linked recipes on the dish journey
    │   ├── PlateSection.astro         ← the dish entity itself
    │   ├── EatSection.astro           ← meals + restaurants
    │   ├── EntityBanner.astro         ← shared eyebrow + hero pattern for non-dish entries
    │   ├── DishCard.astro             ← landing + listing card
    │   ├── Card.astro                 ← generic card (farms / restaurants / recipes)
    │   ├── IngredientCard.astro       ← single-ingredient card inside PlantSection
    │   ├── AppearsIn.astro            ← back-refs ("appears in N dishes") via src/lib/back-refs.ts
    │   ├── SeasonalWheel.astro        ← SVG circular calendar on /seasons
    │   ├── WikiImage.astro            ← <img> wrapper with srcset + loading=lazy + heroFocal honoring
    │   ├── SearchBar.astro            ← Pagefind UI
    │   └── JsonLd.astro               ← schema.org emitter (Article / Recipe / Restaurant / Place / Breadcrumb)
    │
    ├── lib/
    │   ├── dom.ts                     ← byId, requireById, prefersReducedMotion, WakeLock types
    │   ├── journey.ts                 ← assembles Plant/Cook/Plate/Eat from a dish's stages
    │   ├── jsonld.ts                  ← SCHEMA_CTX, breadcrumb(), entryUrl()
    │   ├── back-refs.ts               ← reverse index (which dishes reference this farm/recipe/restaurant)
    │   ├── seasons.ts (+ seasons.test.ts) ← season-window math; powers /seasons
    │   ├── visibility.ts (+ visibility.test.ts) ← public/unlisted filter + meta-robots emitter
    │   └── map/
    │       └── food.ts                ← Leaflet bootstrap + farm/restaurant/garden layers, CARTO Dark Matter tiles
    │
    ├── styles/
    │   ├── global.css                 ← dark editorial base, focus-visible, skip link, immutable asset cache
    │   └── cook-mode.css              ← light "kitchen mode" override scoped to /recipes/<slug>/cook
    │
    └── pages/
        ├── 404.astro                  ← reached via public/_redirects catch-all → HTTP 404
        ├── index.astro                ← /
        ├── world.astro                ← /world (food map)
        ├── seasons.astro              ← /seasons (seasonal wheel)
        ├── rss.xml.ts                 ← RSS feed (public entries only)
        ├── llms.txt.ts                ← /llms.txt for AI crawlers (per L-07)
        ├── dishes/index.astro
        ├── dishes/[...slug]/index.astro
        ├── recipes/index.astro
        ├── recipes/[slug]/index.astro
        ├── recipes/[slug]/cook.astro  ← kitchen mode
        ├── restaurants/index.astro
        ├── restaurants/[slug].astro
        ├── farms/index.astro
        ├── farms/[slug].astro
        ├── garden/index.astro
        ├── garden/[slug].astro
        ├── meals/index.astro
        └── meals/[slug].astro
```

## Visibility routing

| Route family | What it shows |
|---|---|
| `/`, `/world`, `/seasons`, collection indexes | listing pages — `visibility: 'public'` entries only |
| `/dishes/<slug>/`, `/recipes/<slug>/`, etc. | entry pages — both `public` and `unlisted` render |
| `sitemap-index.xml`, `rss.xml` | `public` only |

`unlisted` entries emit `<meta name="robots" content="noindex,nofollow">`. They are still in the static build (so direct slugs work for sharing), just not surfaced. Default for `scripts/new-dish.sh` is `public` — only mark an entry `unlisted` if you have a reason. Anything truly sensitive does not enter the repo at all. See [ADR-0005](adr/0005-public-by-default-no-private-tier.md).

`public/robots.txt` is `Allow: /` — opt-out is per-entry via `unlisted`, not site-wide.

## Photo pipeline

[ADR-0008](adr/0008-wikimedia-image-pipeline.md) is the full record. Summary:

- Dish heroes carry direct `heroUrl: "https://upload.wikimedia.org/..."` in frontmatter, pointed at the largest available source (`originalimage` or `3840px` thumb).
- `heroFocal: "<x>% <y>%"` controls CSS crop on cards and full-bleed plates; `WikiImage.astro` honours it.
- No build-time download, no R2 mirror today. Wikimedia's CDN handles delivery, resize, and caching.
- `scripts/suggest-focal.mjs --write` runs the saliency analyser; `scripts/audit-hero-photos.mjs` scores the corpus on cheap visual signals during photo-wave sprints.
- `scripts/lib/throttled-fetch.mjs` honours Wikimedia's rate limit (5s/10s/15s in-script backoff + a 60-min to 2-hour cold-gap retry for sustained 429s).
- A Wikimedia file rename breaks the hero silently. `audit-hero-photos.mjs` is the safety net — not run on every CI, run during sprints.
- The `hero: "/photos/dishes/<slug>/hero"` schema field is retained as the path R2-hosted personal photography (gardens, meals) would take if/when that need arrives; it is not actively read today.

## AI plumbing

**Status: designed, not built.** [ADR-0004](adr/0004-ai-first-integration-points.md) specifies `/api/extract`, `/api/chat`, `/api/coach` as Pages Functions plus `scripts/build-embeddings.mjs` for the related-rail offline build. None of those routes or scripts exist in the repo today. The `npm run extract` script in `package.json` points at `scripts/ai-extract-recipe.mjs`, which is also not yet checked in. See [`ai-first.md`](ai-first.md) for the intended flow and [feature-wishlist.md](feature-wishlist.md) for status.

When the AI surfaces land, they require an SSR adapter on `astro.config.mjs` and matching bindings on `wrangler.toml`.

## Build + deploy

CI is `.github/workflows/ci.yml`, running on `ubicloud-standard-2` with Node 24:

| Step | What it does |
|---|---|
| `npm run check` | Astro type-check across MDX, components, schemas |
| `npm run check:refs` | Walk every cross-collection slug ref; fail on dangling pointer |
| `npm run check:leaks` | Grep staged content for secret patterns (phone, AWS key, etc.) |
| `npm test` | `vitest run` — currently covers `src/lib/seasons.ts` and `src/lib/visibility.ts` |
| `npm run build` | Astro static build |
| Content-drift guard | For dishes / farms / recipes / restaurants: fail CI if `dist/<kind>/` count < `src/content/<kind>/` count. Catches the C-02 class of bug. |
| Upload `dist` artifact | Only on `push` to `main`. |
| `deploy` job | Downloads the artifact and runs `npx wrangler pages deploy dist --project-name=foodbook --branch=main`. Credentials via `CLOUDFLARE_API_TOKEN` secret + `CLOUDFLARE_ACCOUNT_ID` var. |

Cloudflare Pages git-integration is off — the wrangler-cli deploy from CI is the single deploy path. There's no preview deploy on PRs today; the build runs but doesn't publish.

`wrangler.toml` declares no R2 / KV / Pages-Function bindings — `output: 'static'` doesn't need them, and [ADR-0008](adr/0008-wikimedia-image-pipeline.md) explains why the R2 photo-store binding from [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) is dormant.
