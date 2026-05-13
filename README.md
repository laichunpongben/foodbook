# Foodbook

A static-site archive of the **food lifecycle** — farms, gardens, kitchens, restaurants — told as editorial chapters. Astro 5 on Cloudflare Pages, with photos in R2. Inspired by Travelbook, but where Travelbook follows a *trip* through *chapters*, Foodbook follows a *dish* (or ingredient) through four lifecycle stages:

```
SOURCE  →  GROW  →  COOK  →  EAT
 (farm,    (garden,  (recipe,  (meal — at
 producer)  forage)  technique) home or out)
```

## What's different from Travelbook

| Travelbook | Foodbook |
|---|---|
| One *trip* = many *chapters* (one per place) | One *dish* = up to four *stages* (source/grow/cook/eat) |
| World map of *destinations* | World map of *terroir* — ingredient origins, restaurants, farms, foraging spots |
| Trip phase: idea → shortlist → planning → booked → done | Dish phase: curious → cooked → repertoire (favourite); meals: planned → eaten |
| Photos = Wikimedia thumbnails (4 sizes) | Photos = own kitchen / garden / restaurant / market shots (4 sizes), Wikimedia for terroir |
| No AI in authoring | AI-assisted authoring (recipe extraction, dish tagging, season match), reader-side cook coach |

## Documentation

| File | What's in it |
|---|---|
| [`docs/brainstorm.md`](docs/brainstorm.md) | Idea space — concepts, references, what to build, what *not* to build. |
| [`docs/architecture.md`](docs/architecture.md) | Current state — directory layout, content model, dev workflow, deploy flow. |
| [`docs/ai-first.md`](docs/ai-first.md) | Where AI lives in the product (authoring assist, reader assist, cook mode) and where it doesn't. |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records — one file per decision. Append-only. |
| [`docs/feature-wishlist.md`](docs/feature-wishlist.md) | Open + deferred feature backlog. |

## Quick start

```bash
npm install
npm run dev    # http://localhost:4321
```

## Adding content

Foodbook has five content collections — all MDX, all under `src/content/`:

| Collection | What it is | Example slug |
|---|---|---|
| `dishes/` | Editorial entry for a dish or ingredient — the *spine*. Pulls in source/grow/cook/eat stages. | `tomato-ragu` |
| `recipes/` | A cookable recipe — ingredients with provenance, numbered steps, revisions. | `nonna-ragu-v3` |
| `restaurants/` | A place visited — visits[], dishes, location. | `osteria-francescana` |
| `farms/` | A farm or producer — products, location, sourcing notes. | `casa-marrazzo-san-marzano` |
| `meals/` | A single meal — date, where, who, what, photos. | `2026-04-12-easter-lunch` |

Plus `garden/` log entries (planted/harvest dates) and a `pantry/` snapshot for "what can I cook tonight" AI matching.

A dish entry weaves the others together via slug references — its hero photo is its own plated shot, but it links *out* to the farm that grew the tomatoes, the recipe that turned them into ragu, and the meal where it was served.

## Stack

Astro 5 (`output: 'static'`) · MDX content collections · `@astrojs/cloudflare` adapter · Cloudflare Pages + R2 · Leaflet + CARTO Dark Matter tiles · Anthropic Claude API for AI-assist · TypeScript throughout.

For why each piece, see [`docs/adr/`](docs/adr/).

## Visibility model

This repo is public, so the codebase ships **no personal content**. The schema supports an optional `visibility: 'public' | 'unlisted'` flag — `unlisted` entries are rendered at the same paths but excluded from listing pages, sitemap, and RSS, and emit `noindex`. There is no auth-gated "private" surface; if something is too sensitive to surface anywhere on the open web, it does not belong in this repo. Keep personal photos, real names, addresses, and family detail out of MDX bodies.
