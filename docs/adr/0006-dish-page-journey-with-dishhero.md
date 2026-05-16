# ADR-0006 · Dish page is a four-section journey opening with DishHero

- **Status**: Accepted
- **Date**: 2026-05-17
- **Related**: closes [#73](https://github.com/laichunpongben/foodbook/issues/73); closes [#17](https://github.com/laichunpongben/foodbook/issues/17). Builds on [ADR-0002](0002-content-model-dishes-recipes-restaurants-farms.md) and [ADR-0003](0003-dual-mode-editorial-and-kitchen.md).

## Context

The dish page is the spine of the site ([ADR-0002](0002-content-model-dishes-recipes-restaurants-farms.md)) — most reader paths land here. Two earlier designs got tried and discarded:

1. **AssemblyGraph + LifecycleStepper** — a d3-sankey diagram with a four-dot stepper rendered the source→grow→cook→eat lineage as a visual graph. It was conceptually clean but slow to author (manual graph nodes per dish) and didn't read as editorial. Components went orphaned; `depcheck` flagged `d3-sankey` as unused (#17).
2. **`SunSection` as the opener on every dish page** — the same "every plate begins 93 million miles away" 70vh framing on all 118 dishes (#73). The dish's own identity (origin, era, prologue prose) didn't appear until below the fold. Anti-editorial: NYT Cooking, *Saveur*, Serious Eats all open *with the dish*, not a framing device shared across the catalogue.

What every dish has, by construction in the schema, is dish-specific opening material: `shortTitle`, `tagline` (1/1 populated), `origin` (1/1), `heroUrl` (1/1), `prologue.heading` + `prologue.prose` (1/1). These were already authored — just buried.

## Decision

Each `/dishes/<slug>/` page is composed of one hero plus four narrative sections, in this order:

```
DishHero          ← per-dish opener: eyebrow / title / tagline / hero / prologue
PlantSection      ← ingredients of the dish (sourced from recipes[].ingredients)
CookSection       ← linked recipes
PlateSection      ← the dish entity itself
EatSection        ← meals + restaurants where it was eaten
```

### `DishHero` rules

- Skeleton is identical across all dishes; **only the words and image vary** — magazine model.
- Drives entirely from frontmatter — no per-dish handcoding.
- Eyebrow line: `ORIGIN · ERA` (era derived from `firstMade`), or `ORIGIN` alone if `firstMade` is absent.
- Title is `shortTitle` in display serif (Fraunces).
- Tagline is the existing one-sentence editorial hook.
- Hero image (right column desktop, full-bleed mobile) uses `heroUrl` with `heroFocal` for cropping (see [ADR-0008](0008-wikimedia-image-pipeline.md)).
- Prologue renders as a pull-quote-style block below the hero.
- Scroll cue anchors to whichever of `#plant` / `#cook` / `#plate` is the first non-empty section for this dish.

### Sun is gone from dish pages

The "sun → plate" thesis survives as a *site-level* idea on `/` and `/about` (if it exists). It is **not** a recurring frame on individual entries. The dish page starts at `Plant` for any dish that has ingredients; `Cook` if not; `Plate` otherwise. This matches the "[L-03] drop ClientRouter view transitions" / "[#73] (a) drop SunSection from dish pages entirely" choice that shipped.

### Data layer is unchanged

[ADR-0002](0002-content-model-dishes-recipes-restaurants-farms.md) defines `stages: { source?, grow?, cook?, eat? }` on the dish schema. That data layer **survives intact** — the rename in the renderer (Plant/Cook/Plate/Eat) is presentation, not schema:

| Presentation section | Pulls from |
|---|---|
| PlantSection | Ingredients on `stages.cook[*].recipes[*].ingredients[]` — flattened across all linked recipes |
| CookSection | `stages.cook[*].recipes` resolved against `recipes/` |
| PlateSection | The dish entry itself (`shortTitle`, `tagline`, `heroUrl`, `finale`) |
| EatSection | `stages.eat[*].meals` + `stages.eat[*].restaurants` |

`stages.source` (farms) and `stages.grow` (garden) are reachable from PlantSection via each ingredient's `from:` slug ref. They don't get their own top-level section on the dish page — the Source/Grow story belongs *next to the ingredient that came from there*, not as a separate band.

## Alternatives considered

- **Keep SunSection as a thin transition band** between DishHero and PlantSection (option (b) in #73) — preserved the conceptual frame but still made the first 30vh interchangeable across 118 entries. Same problem, less of it.
- **Per-dish handcoded opener** — every dish page composes its own hero markup. Maximum variation, zero coherence; the site reads as a portfolio of one-offs rather than an archive.
- **Re-skin the Sankey** — the lineage data is already in `stages.*`, render it as a polished diagram. Tried in the AssemblyGraph branch; authoring cost (manual graph nodes per dish) killed it.
- **Five sections incl. Source** (Source/Plant/Cook/Plate/Eat) — would surface farms at the same level as ingredients. Considered, rejected: the farm story is *about* an ingredient, not its peer.

## Consequences

- (+) Every dish opens with its own identity: name, place, era, prologue. The first 70vh is unique by construction, not by editorial discipline.
- (+) The skeleton is single-source (`DishHero.astro` + four section components). Visual coherence is enforced by code, not by reviewer attention.
- (+) Removed ~700 lines of dead code and the `d3-sankey` dependency (#17).
- (+) Schema is unchanged — no migration of 118 existing dishes was required to ship this.
- (−) The renderer's section names (Plant/Cook/Plate/Eat) diverge from the schema's stage names (source/grow/cook/eat). Anyone reading the MDX schema needs to know which is which. Mitigated by the mapping table above and inline comments in `journey.ts`.
- (−) Section ordering is fixed in code. A dish that wants a different rhythm (e.g. fermented sourdough where "Grow" is the slow protagonist) can't reorder. Acceptable — that variation belongs in the *content* of each section, not in the section list.
