# Contributing to Foodbook

This file codifies the editorial + design principles that ADRs [0009](docs/adr/0009-north-star.md) (north star) and [0010](docs/adr/0010-design-tokens.md) (design tokens) name, so any new entry — yours, mine, or another agent's — stays on-mission without re-reading the full ADRs each time.

## North star

> **Foodbook is a walkable food archive — readable as prose by humans, queryable as a graph by agents — where every dish's lineage runs backward to soil and forward to table in both directions.**

Three load-bearing words: **walkable** (cross-collection graph), **lineage** (the chain we trace), **both** (humans + agents as equal-citizen consumers). Anything you propose should make at least one of those words *more true*. See [ADR-0009](docs/adr/0009-north-star.md) for the worked in-scope / out-of-scope table.

## Authoring a dish entry

A dish entry weaves up to four lifecycle stages — **Source · Grow · Cook · Eat** ([ADR-0002](docs/adr/0002-content-model-dishes-recipes-restaurants-farms.md)). Stages are *optional* but the editorial bar is **at least two stages covered**, where "covered" means a non-empty `note:` *or* at least one ref (`farms` / `garden` / `recipes` / `meals` / `restaurants`). `npm run audit:lineage` ranks every public dish by coverage.

A dish entry needs, at minimum:

- `title` (may contain inline `<em>` for editorial emphasis) and `shortTitle` (plain text, used in sort keys and stats).
- `hero` and either `heroUrl` (Wikimedia direct, preferred) or a local `/photos/...` stem. See [ADR-0008](docs/adr/0008-wikimedia-image-pipeline.md).
- `tagline` — one editorial line that distinguishes this dish from its siblings. Not a description; a posture.
- `origin` — free-text "place + lineage" (`"Naples, Italy"`, `"Klang, Malaysia → Singapore (Hokkien and Teochew)"`).
- `tags` — at least one meal-type (`breakfast` / `lunch` / `dinner` / `snack` / `dessert` / `drink`) and one cuisine when applicable. `npm run audit:tags` surfaces gaps.
- At least two `stages:` blocks with either a `note:` or a ref array.
- A `firstMade:` ISO date when the dish entered the repertoire (drives /recent ordering and the "In repertoire since" pill).

Optional but strongly preferred:

- `prologue` and `finale` — bookend prose that frames the entry. Skip on short entries; use for ones worth lingering on.
- `heroFocal` — `object-position` value when the source photo's plate isn't centered.

What we don't accept in a dish entry:

- AI-generated prose. AI assists extraction and discovery only ([ADR-0004](docs/adr/0004-ai-first-integration-points.md)).
- Provenance fabrication. If you don't know which farm grew the tomatoes, leave the `source` stage out — don't invent one.
- Personal data about other people. `meals.companionCount` is the only personal-other surface; names never enter the repo ([ADR-0005](docs/adr/0005-public-by-default-no-private-tier.md)).

## Authoring a recipe

A recipe carries ingredients (with optional `from:` provenance refs back to `farms/` or `garden/`), numbered steps, time estimates, and a `revisions[]` log. The honesty bar: if a recipe is adapted from elsewhere, name the source via `attribution` and (where licence permits) `sourceUrl`.

`npm run check:refs` validates that every `from:` ref resolves to a real entry.

## Visual + structural conventions

The design tokens live in [`src/styles/tokens.json`](src/styles/tokens.json) and `:root` in [`src/styles/global.css`](src/styles/global.css). When you write component CSS:

- **Reach for a token first.** New `font-size`, `gap`, `padding`, `margin` literals should pick from `--text-*` / `--space-*` / `--radius-*`. `/design-system` renders the canon as live swatches.
- **If the existing value isn't on the scale,** leave it as a literal and add an `/* off-scale: between --space-xs (0.5) and --space-sm (0.8) */` comment naming the nearest tokens. `npm run audit:tokens` reports unflagged off-scale literals.
- **Colours are sealed.** The seven-colour palette in `:root` is part of the brand; growing it is an ADR-level change, not a per-component choice.

When you write component markup:

- **Astro `<style>` blocks are scoped by default** — keep them. Promote a class to `:global` only when a runtime-inserted node (e.g. Leaflet popup HTML) lives outside Astro's scope.
- **Tag chips, related rails, divided lists** — global classes already exist (`.tag-chips`, `.related-rail`, `.divided`). Don't redefine them locally.

## PR conventions

- **One topic per PR.** A bug fix + a refactor + a new feature is three PRs, not one.
- **Conventional commits.** `feat(<scope>): …`, `fix(<scope>): …`, `refactor(<scope>): …`, `style(<scope>): …`, `chore(<scope>): …`, `docs(<scope>): …`.
- **Run `npm run lint` and `npm run check` locally** before pushing — CI is the last line, not the first.
- **PR body uses a real file** (`gh pr create --body-file <path>`), never inline `--body "$(cat <<EOF ...)"` — escapes break.

## When in doubt

Check the worked examples in [ADR-0009 §Decidability worked examples](docs/adr/0009-north-star.md#decidability-worked-examples) and place your proposal on that table. If it doesn't fit either column, the proposal needs more shape before it's ready for a PR.
