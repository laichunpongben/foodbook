# Foodbook architecture

Snapshot of the **current** state of the system: directory layout, content model, dev workflow, deploy flow. Refreshed when the architecture changes. Historical rationale lives in [`docs/adr/`](adr/); open work in `feature-wishlist.md` and GitHub issues.

> If this file is more than ~2 commits behind reality, it's stale — please update.

## Stack summary

| Concern | Choice | Why |
|---|---|---|
| Site framework | Astro 5 (`output: 'static'`) | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Content | Content collections + MDX | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Hosting | Cloudflare Pages via `@astrojs/cloudflare` | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Photo storage | Cloudflare R2 (`foodbook-photos` bucket) | [ADR-0001](adr/0001-adopt-astro-on-cloudflare.md) |
| Visibility | Public + `unlisted` (no private/auth tier) | [ADR-0005](adr/0005-public-by-default-no-private-tier.md) |
| Map | Leaflet + CARTO Dark Matter tiles | inherited from Travelbook ADR-0004 |
| Visual language — primary | Dark editorial, Fraunces + Inter, paprika accent | [ADR-0003](adr/0003-dual-mode-editorial-and-kitchen.md) |
| Visual language — `/cook` | Light "kitchen mode" parchment, same fonts | [ADR-0003](adr/0003-dual-mode-editorial-and-kitchen.md) |
| Content model | Five collections: dishes, recipes, restaurants, farms, meals | [ADR-0002](adr/0002-content-model-dishes-recipes-restaurants-farms.md) |
| AI integration | Author-time extract + reader-time assist; no AI prose generation | [ADR-0004](adr/0004-ai-first-integration-points.md) |
| Authoring | PR-based MDX commits — no frontend editor | inherited from Travelbook ADR-0012 |

## The content model

Foodbook has **five** content collections, all under `src/content/`. They reference each other by slug — a dish entry pulls in a recipe by `recipe: nonna-ragu-v3` rather than duplicating the recipe inline.

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

- `garden/` — bed × plant × planted/harvested dates × yield × notes.
- `pantry/` — single MDX file describing current inventory state (manually edited; powers AI "what can I cook tonight" matching).

### Why this shape (vs. one big "entry" type)

A single polymorphic entry would have ~60 fields most of which are unused per entry. Five focused collections keep each schema small + the entry-author UX clear. Cross-refs by slug do the work of joining at render time.

See [ADR-0002](adr/0002-content-model-dishes-recipes-restaurants-farms.md).

## Directory layout

```
foodbook/
├── README.md
├── astro.config.mjs                   ← static + cloudflare adapter
├── wrangler.toml                      ← R2 binding (PHOTOS = foodbook-photos)
├── package.json                       ← astro, @astrojs/mdx, @astrojs/cloudflare
├── tsconfig.json
│
├── docs/
│   ├── architecture.md                ← you are here
│   ├── brainstorm.md                  ← idea space, references
│   ├── ai-first.md                    ← where AI lives in product + author flow
│   ├── feature-wishlist.md            ← open + deferred backlog
│   └── adr/                           ← Architecture Decision Records
│       ├── README.md
│       └── NNNN-*.md
│
├── public/
│   └── robots.txt                     ← Disallow: /  (private archive)
│
├── scripts/
│   ├── new-dish.sh                    ← scaffold src/content/dishes/<slug>/index.mdx
│   ├── new-recipe.sh
│   ├── new-restaurant.sh
│   ├── new-farm.sh
│   ├── new-meal.sh
│   ├── ai-extract-recipe.mjs          ← URL or photo → MDX draft via Claude API
│   ├── fetch-photos.sh                ← Wikimedia (for terroir / ingredients)
│   └── sync-photos.sh                 ← bulk upload local-photos/ → R2
│
├── local-photos/                      ← gitignored mirror of R2
│   └── <collection>/<slug>/*.jpg     ← at sizes 500/1280/2560/3840
├── photos -> local-photos/            ← gitignored symlink for local dev
│
└── src/
    ├── content.config.ts              ← Zod schemas: dishes/recipes/restaurants/farms/meals/garden/pantry
    ├── content/
    │   ├── dishes/<slug>/index.mdx
    │   ├── recipes/<slug>.mdx
    │   ├── restaurants/<slug>.mdx
    │   ├── farms/<slug>.mdx
    │   ├── meals/<slug>.mdx
    │   ├── garden/<slug>.mdx
    │   └── pantry.mdx
    │
    ├── layouts/
    │   └── BaseLayout.astro           ← <html> shell + ClientRouter + async fonts
    │
    ├── components/
    │   ├── LandingPage.astro          ← /
    │   ├── WorldPage.astro            ← /world (food map)
    │   ├── SeasonsPage.astro          ← /seasons (seasonal wheel)
    │   ├── DishPage.astro             ← /dishes/<slug>/
    │   ├── RecipePage.astro           ← /recipes/<slug>/
    │   ├── CookModePage.astro         ← /recipes/<slug>/cook  (light high-contrast)
    │   ├── RestaurantPage.astro       ← /restaurants/<slug>/
    │   ├── FarmPage.astro             ← /farms/<slug>/
    │   ├── DishCard.astro             ← landing card
    │   ├── LifecycleStepper.astro     ← four dots: source/grow/cook/eat
    │   ├── IngredientList.astro       ← with optional provenance refs
    │   ├── ProvenanceMap.astro        ← small inline Leaflet
    │   ├── SeasonalWheel.astro        ← SVG circular calendar
    │   └── ResponsiveBackdrop.astro   ← srcset/sizes wrapper
    │
    ├── lib/
    │   ├── dom.ts                     ← byId, requireById, prefersReducedMotion
    │   ├── slugs.ts                   ← url helpers
    │   ├── photos.ts                  ← BACKDROP_WIDTHS, srcset helpers
    │   ├── visibility.ts              ← `public` / `unlisted` filter + meta-robots emitter
    │   ├── seasons.ts                 ← season-window math (hemisphere-aware)
    │   ├── provenance.ts              ← graph walk over slug refs
    │   ├── ai/
    │   │   ├── client.ts              ← Anthropic client wrapper
    │   │   ├── extract.ts             ← URL/photo → recipe MDX
    │   │   ├── chat.ts                ← reader-side chat (RAG over MDX)
    │   │   ├── embeddings.ts          ← Voyage AI embeddings + cache
    │   │   └── cook-coach.ts          ← step-aware coach for cook mode
    │   ├── editorial/
    │   │   ├── slideshow.ts           ← Ken Burns hero cycler
    │   │   ├── lifecycleSteps.ts      ← scroll-spy the four stage dots
    │   │   ├── lightbox.ts
    │   │   └── ingredientHover.ts     ← hover an ingredient → backdrop swap
    │   ├── cook/
    │   │   ├── stepNav.ts             ← j/k, space, voice "next"
    │   │   └── timer.ts               ← embedded multi-timer
    │   └── map/
    │       ├── food.ts                ← terroir + restaurants + farms layer
    │       ├── routes.ts
    │       └── types.ts
    │
    ├── styles/
    │   ├── global.css                 ← dark editorial base
    │   └── cook-mode.css              ← light "kitchen mode" override
    │
    └── pages/
        ├── index.astro                ← /
        ├── world.astro                ← /world
        ├── seasons.astro              ← /seasons
        ├── dishes/[slug]/index.astro
        ├── recipes/[slug]/index.astro
        ├── recipes/[slug]/cook.astro  ← kitchen mode
        ├── restaurants/[slug].astro
        ├── farms/[slug].astro
        ├── photos/[...path].ts        ← R2 proxy (SSR route)
        └── api/
            ├── extract.ts             ← POST recipe URL/photo → MDX (CLI tool, env-token)
            ├── chat.ts                ← POST reader question → answer (rate-limited)
            └── coach.ts               ← POST cook-mode question (rate-limited)
```

## Visibility routing

| Route family | What it shows |
|---|---|
| `/`, `/world`, `/seasons` | listing pages — `visibility: 'public'` entries only |
| `/dishes/<slug>/`, `/recipes/<slug>/`, etc. | entry pages — both `public` and `unlisted` render |
| `sitemap.xml`, `rss.xml` | `public` only |

`unlisted` entries emit `<meta name="robots" content="noindex,nofollow">`. They are still in the static build (so direct slugs work for sharing), just not surfaced. Default for the scaffold scripts is `public` — only explicitly mark an entry `unlisted` if you have a reason. Anything truly sensitive does not enter the repo at all. See [ADR-0005](adr/0005-public-by-default-no-private-tier.md).

## Photo pipeline

Identical to Travelbook:

1. Save originals to `local-photos/<collection>/<slug>/<n>.jpg`.
2. `scripts/fetch-photos.sh` resizes to 500/1280/2560/3840 widths (when sourcing from Wikimedia for ingredient terroir).
3. `scripts/sync-photos.sh` uploads to R2 bucket `foodbook-photos`.
4. SSR route at `src/pages/photos/[...path].ts` reads from R2 binding and serves with long-cache headers.
5. `<ResponsiveBackdrop>` writes the `srcset` so the browser picks the right size.

The proxy route does the same access-gating Travelbook learned the hard way (Travelbook ADR-0016) — a photo path under `/photos/private/...` requires Access auth even though it's served by the same handler.

## AI plumbing

Three server routes, all `POST`-only, all behind Cloudflare Access (no anonymous AI for the public web):

| Route | What it does | Cost shape |
|---|---|---|
| `/api/extract` | Recipe URL or photo → structured MDX (Claude vision + tool use) | One-shot per import |
| `/api/chat` | Reader question → answer over MDX corpus (RAG via Voyage embeddings + Claude) | Per query; prompt-cached |
| `/api/coach` | Cook-mode question with recipe context | Per query; recipe text prompt-cached |

Embeddings build is offline (`scripts/build-embeddings.mjs`) and lives in a single `embeddings.json` in R2 — cheap to refresh on each deploy.

See [`ai-first.md`](ai-first.md) for the full flow and `adr/0004-ai-first-integration-points.md` for the decision.

## Build + deploy

Same shape as Travelbook (target it once Foodbook has >5 entries):

- GitHub Actions runs `astro check` + `npm run build` on PR + main.
- `main` push deploys via `cloudflare/wrangler-action@v3` from a workflow artifact.
- Cloudflare Pages git-integration **off** — single deploy path.

Until v0.1 ships, ad-hoc CLI deploy via `./scripts/deploy.sh` is fine.
