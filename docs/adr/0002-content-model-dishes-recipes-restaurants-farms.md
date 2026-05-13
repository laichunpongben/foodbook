# ADR-0002 · Five-collection content model — dishes / recipes / restaurants / farms / meals

- **Status**: Accepted
- **Date**: 2026-05-13

## Context

The food lifecycle has four conceptual stages — **source → grow → cook → eat** — but the *entities* that fill those stages are different kinds of things. A farm has a location and a product list. A recipe has ingredients and steps. A restaurant has visits. A meal is a single event in time. Forcing them into one schema would produce a 60-field union type where most fields are unused per entry. Forcing every reader-facing page to be the *dish* page hides the farms / restaurants / recipes that are interesting on their own.

We also need cross-linking: a Tomato Ragu dish entry wants to say "this used tomatoes from `farms/example-san-marzano`, recipe at `recipes/example-ragu-v3`, eaten at `meals/2026-04-12-example-lunch`".

## Decision

Five top-level MDX content collections, each with a focused Zod schema, plus two single-entry collections for log state:

| Collection | Purpose | Key fields |
|---|---|---|
| `dishes/<slug>/index.mdx` | Editorial entry for a dish or ingredient — weaves the lifecycle. | `title`, `hero`, `stages: { source?, grow?, cook?, eat? }`, refs to other collections |
| `recipes/<slug>.mdx` | A cookable recipe. | `title`, `yield`, `time`, `ingredients[]` (with optional `from:` ref), `steps[]`, `revisions[]` |
| `restaurants/<slug>.mdx` | Place visited. | `name`, `city`, `lat`, `lng`, `priceBand`, `visits[]`, `dishes[]` |
| `farms/<slug>.mdx` | Farm / producer / market. | `name`, `lat`, `lng`, `products[]`, `visits[]`, `seasonalWindow[]` |
| `meals/<slug>.mdx` | One meal — home or out. | `date`, `location` (refs `restaurants/` or `'home'`), `dishes[]`, `companions?`, `photos[]` |
| `garden/<slug>.mdx` | Single planting × bed entry. | `plant`, `bed`, `planted`, `harvested?`, `yield?` |
| `pantry.mdx` | Single file — current inventory snapshot. | `items[]` keyed by ingredient slug |

Cross-references are by **slug string**, validated at build time. `dishes/` is the "spine" — it's where a reader lands first; the other collections are nodes the dish entry pulls in.

A `lifecycle` block on a dish has up to four stages, each *optional*. The `<LifecycleStepper>` renders only the stages present (greys out the empty ones), so a "Saffron" entry with only source + grow makes sense.

```yaml
# dishes/example-tomato-ragu/index.mdx — illustrative only, not a real entry
title: "Tomato Ragu"
hero: "/photos/dishes/example-tomato-ragu/hero"
stages:
  source:
    farms: [example-san-marzano]
    note: "DOP zone south of Naples."
  grow:
    garden: [example-tomato-2026]
  cook:
    recipes: [example-ragu-v3]
  eat:
    meals: [2026-04-12-example-lunch]
```

## Alternatives considered

- **Single polymorphic `entries/` collection** with a `kind` discriminator — minimises route count but produces an unreadable mega-schema; loses Zod's per-collection typing benefits in MDX components.
- **DB-backed model (e.g. SQLite via Astro DB)** — overkill for personal-scale archive; loses the "content is git" property.
- **Dish-as-only-entity, others-inline** — restaurants/farms exist independently of any specific dish (a restaurant you keep going back to, a farm you visit every September). They need their own pages.
- **`ingredients/` as its own collection** — considered, but slug-string refs from recipes + inline content in dishes covers it until ~20 dishes. Deferred to [feature-wishlist](../feature-wishlist.md).

## Consequences

- (+) Each schema is small and readable; authoring a recipe doesn't require knowing the dish schema.
- (+) Cross-refs are slug strings — easy to grep, easy to refactor (rename a farm → grep all `from: example-san-marzano`).
- (+) Listing pages can be type-narrow: `/world` knows it's iterating farms/restaurants; `/seasons` knows it's iterating dishes.
- (+) A "Saffron" or "Sourdough Starter" ingredient-style entry fits — they're just dishes with only source+grow stages, no cook recipe.
- (−) Five schemas to maintain. Mitigated by keeping each one small and Zod-typed.
- (−) Broken slug refs only fail at build, not in the editor. Mitigated by `astro check` in CI and a `scripts/check-refs.mjs` that pre-flights links.
