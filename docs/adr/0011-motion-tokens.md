# ADR-0011 · Motion tokens — formalised duration + easing scale

- **Status**: Proposed
- **Date**: 2026-05-22

## Context

[ADR-0010](0010-design-tokens.md) named the canon for palette, type, spacing, and radii. Motion was deferred. A grep across the codebase finds ~10 distinct `transition`-duration literals (`0.15s`, `0.18s`, `0.2s`, `0.3s`, `0.35s`, `0.4s`, `0.6s`, `2.4s`) and two distinct easing functions (`ease`, `ease-in-out`, `cubic-bezier(0.2, 0.7, 0.2, 1)`) scattered across `global.css`, `cook-mode.css`, `SeasonalWheel`, `IngredientCard`, `DishHero`, `Card`, `tags/index`.

The sprawl pattern is exactly what type and spacing had before [#235](https://github.com/laichunpongben/foodbook/pull/235): every new component invents its own micro-decisions, the overall rhythm drifts, and a reader's eye gets nudged by inconsistent timings without knowing why. The north star ([ADR-0009](0009-north-star.md)) frames foodbook as a *walkable* archive — walking should feel consistent across nodes, and motion is part of that feel.

## Decision

Add a fourth token category to `:root` in `global.css` (and `tokens.json`): **motion**. Two axes: duration and easing.

### Duration scale

Four steps. Anchored at 200ms (Material Design's [conventional baseline](https://material.io/design/motion/the-motion-system.html#easing) for "responsive interface feedback") and scaled by integer multiples — no irrational ratios for motion, which the human visual system reads in chunks anyway.

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | `120ms` | Micro-feedback (link hover colour, chip border, kbd tap). |
| `--motion-base` | `200ms` | Standard interactive transitions (card hover, button press). |
| `--motion-slow` | `400ms` | Larger reveals (hero image scale, popup enter). |
| `--motion-deliberate` | `2400ms` | Author-intent animations (the dish-hero scroll-bob). |

The 2400ms tier is named "deliberate" rather than "very slow" because it's *not* about being slow — it's about being *noticed*. The dish-hero scroll-bob animation lives at 2.4s by design; renaming it as a token makes the choice explicit.

### Easing scale

Three named easings. No more than three keeps the editorial discipline.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Default for the cook-mode progress bar, card hovers, photo zooms — perceived as "responsive" because it decelerates into rest. |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric easings — page-level transitions, modal in/out. |
| `--ease-linear` | `linear` | Continuous animations (the scroll-bob) where any cubic curve makes the loop feel uneven. |

`ease` (the CSS keyword default) is *not* in the canon — it's a `cubic-bezier(0.25, 0.1, 0.25, 1)` that's pleasant but indistinct. Components that use it today either round to `--ease-out` (if responsive feedback) or stay literal with an `/* off-easing: */` comment.

### Reduced-motion contract

`@media (prefers-reduced-motion: reduce)` blocks already exist in `global.css` and `DishHero.astro`. The token system enables a single canonical reduced-motion override:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0.001ms;
    --motion-base: 0.001ms;
    --motion-slow: 0.001ms;
    --motion-deliberate: 0.001ms;
  }
}
```

Every component that uses `var(--motion-*)` instantly respects user preference; component-specific `@media (prefers-reduced-motion)` blocks can be deleted as part of the migration.

## Adoption signals (deferred to follow-up PRs)

- `tokens.json` gets a new `motion` category alongside `color` / `text` / `space` / `radius`.
- `/design-system` page renders the durations as a row of animated test bars (1× / 2× / 4× / 24× the base unit, side-by-side).
- `audit-tokens.mjs` learns a new mode — flag `transition: <number>s` literals not on the canon.
- Per-component stage-2 migrations follow the same one-PR-per-component pattern established for spacing/type (#237 onwards).

## Alternatives considered

- **Three duration tokens (fast / base / slow), no "deliberate".** Cleaner but forces the dish-hero bob into `--motion-slow` (it isn't slow, it's deliberate) or out-of-canon literal. The fourth tier names a real editorial intent, so it earns its keep.
- **Use `prefers-reduced-motion` only at the component level (status quo).** Works, but every new motion-using component has to remember the override. Single canonical override is one decision instead of N.
- **Adopt the Material Design easing curves verbatim.** Their `standard`/`accelerate`/`decelerate` set is mature. Rejected as duplicative: we already have `cubic-bezier(0.2, 0.7, 0.2, 1)` doing the decelerate job for the cook-mode progress bar — naming it `--ease-out` keeps continuity.

## Consequences

- (+) Motion gets the same one-decision-per-axis discipline that type and spacing already have. The walkable feel from [ADR-0009](0009-north-star.md) extends to interaction timing.
- (+) Reduced-motion becomes a single override line in `:root` instead of N component blocks.
- (+) Future motion choices have a constrained menu — fewer one-off `0.27s` decisions.
- (−) Per-component stage-2 migrations are required and ship 0 visual change (visually equivalent refactors). Same accepted cost as the spacing/type migrations.
- (−) Components that genuinely need an off-scale duration (rare) must comment as such or grow a per-component override token.

---

*See also: [Material — easing system](https://material.io/design/motion/the-motion-system.html), [Smashing — modern CSS easing](https://www.smashingmagazine.com/), and ADR-0010 §Stage 2 for the per-component migration pattern.*
