# ADR-0013 · Accessibility commitments — named WCAG targets + the maintainer's contract

- **Status**: Proposed
- **Date**: 2026-05-22

## Context

WCAG references are already scattered through the codebase ("WCAG 2.4.7 / 1.4.11", "WCAG 1.4.3 AA", "WCAG 1.1.1 / 4.1.2" — see `global.css` and `world.astro` comments) but the *posture* hasn't been named. What level does Foodbook commit to? What's the test surface? What's deferred?

The north star ([ADR-0009](0009-north-star.md)) names dual audiences — humans and agents. The design tokens ([ADR-0010](0010-design-tokens.md)), motion ([ADR-0011](0011-motion-tokens.md)), and editorial voice ([ADR-0012](0012-editorial-voice.md)) name visual, motion, and prose voice. Accessibility is the dimension that says the human-readable layer actually reaches *every* human.

This ADR names the level, names the existing accommodations, and names what's deferred — so a future maintainer (or another agent) doesn't have to re-derive what was decided in scattered comments.

## Decision

### Target

**WCAG 2.2 AA** as the baseline for every public page. AAA where it falls out of design choices already made (e.g. body-text contrast against `#0a0d11` exceeds 7:1 with `#faf8f4`).

Not WCAG 2.2 AAA across the board — some AAA criteria (e.g. extended audio descriptions, sign-language alternatives) aren't applicable to a text-and-still-image archive; others (e.g. 7:1 contrast on every UI element) trade off against the editorial design.

### What's already there (audit map)

| Surface | Accommodation | WCAG ref |
|---|---|---|
| Dark editorial body | `#faf8f4` on `#0a0d11` ≈ 14.9:1 | 1.4.3 (AAA tier) |
| Focus indicator | 2px paprika outline + offset, `:focus-visible` | 2.4.7 / 1.4.11 |
| Skip-to-main link | Hidden until keyboard focus, jumps to `<main>` | 2.4.1 |
| Hero scrim | Top opacity 0.75 (bumped from 0.55) so `.lead` text holds ≥4.5:1 | 1.4.3 AA |
| `/world` map | sr-only fallback list with every pin as a real link | 1.1.1 / 4.1.2 |
| Touch targets | 44×44px minimum on nav links, hamburger toggle, cook-mode buttons | 2.5.5 (AAA tier) |
| Reduced motion | Canonical `@media (prefers-reduced-motion: reduce)` collapses motion tokens (ADR-0011) | 2.3.3 |
| Image alt text | Every hero photo has `alt=` derived from dish/farm/restaurant name; dish hero `alt` is descriptive ("Photograph of Carbonara") | 1.1.1 |
| Search input | `<label class="visually-hidden">`, `aria-label`s on submit + results region | 1.3.1 / 4.1.2 |
| Heading hierarchy | One `<h1>` per page; `<h2>` for sections; `<h3>` for sub-sections; no skips | 1.3.1 |
| Lifecycle dots (DishHero) | `aria-label="Lifecycle coverage: N of 4 stages"` on the `<ul>`, decorative dot has `aria-hidden="true"` | 1.3.1 |
| Tag chip rows | `<ul aria-label="Tags">` so the list reads as a group | 1.3.1 |
| Language | `<html lang="en">` set in BaseLayout | 3.1.1 |

### What's deferred / not yet done

| Surface | Gap | Plan |
|---|---|---|
| Per-image alt text richness | Dish hero alt is `"Photograph of <name>"` — minimally accessible but not *evocative*. A blind reader gets the name but not the dish. | Future authoring pass — per-dish hero `altRich` field. |
| Map keyboard navigation | Leaflet supports it but the focus order between markers is browser-default, not curated. | Survey Leaflet's a11y plugins. |
| Cook-mode timer announcement | Timer countdown isn't announced via `aria-live`; sighted users see the number, screen readers don't. | One-line `aria-live="polite"` addition to `.timer-display`. |
| Form-input errors | No forms yet — when one appears (search exists but is non-form), `aria-invalid` + `<fieldset>` patterns are the standard. | When the first form lands. |
| Light-mode contrast in cook mode | Cook mode is hand-tuned (parchment + ink); contrast is decent but hasn't been Lighthouse-audited end-to-end. | Add Lighthouse a11y to CI gate. |
| Animation-disable for `dish-hero-bob` | Animation correctly stops at reduced-motion, but the static state isn't quite as inviting as the moving one — a chance to add an `aria-hidden` after stop. | When the bob is next touched. |

### Maintainer's contract

For every new public surface:

1. **Heading hierarchy** — one `<h1>`, no level skips.
2. **Focus indicator** — every interactive element shows the `:focus-visible` ring; don't `outline: none` without a replacement.
3. **Touch targets ≥ 44×44px** — applies to phones in the kitchen as much as to permanent disabilities.
4. **Reduced-motion respect** — use `var(--motion-*)` from [ADR-0011](0011-motion-tokens.md); don't add new `transition: <literal>s` without the off-motion marker.
5. **Alt text on every `<img>`** — `alt=""` for decorative; descriptive for editorial.
6. **No colour-only signal** — paprika emphasis + `<em>` together, not paprika alone; lifecycle dots have a count in `aria-label`, not just visual fill.

When a PR adds a surface that doesn't meet these, the reviewer cites this ADR by §number; the author either fixes or adds an explicit `aria-hidden` / out-of-scope comment.

## Alternatives considered

- **No commitment, fix-as-we-go.** Status quo. Works as long as nobody asks "what level?". The moment someone does — a contributor with a disability, a compliance review for embedding the corpus in another project, a grant application — there's no answer. Naming the level is half of accessibility work.
- **WCAG 2.2 AAA across the board.** Aspirational but trades off against the editorial design (e.g. paprika accent at AAA contrast would need to be a different colour). AA + selective AAA is the honest commitment.
- **WCAG 2.1 (the last finalised version).** 2.2 added 9 success criteria mostly around dragging movements, target sizing, and consistent help — all aligned with a kitchen-use site. No reason to lag.
- **Defer to platform defaults.** Astro + Pagefind + Leaflet don't ship as-is at AA. Saying "use the stack defaults" leaves real gaps (map alt, search aria, focus rings on dark mode).

## Consequences

- (+) Future PR reviews have a named yardstick — "ADR-0013 §4 says touch targets must be 44×44px" beats "I think it should be bigger".
- (+) New surfaces inherit the contract instead of re-deriving each one. The cook-mode controls + recipe shopping list + `/random` all pick up the same accommodations.
- (+) The "deferred" table is honest about gaps — closes the "is it accessible?" question with "AA today, AAA in these places, plan for X / Y / Z".
- (−) A11y testing tooling is not yet in CI. Lighthouse / axe-core checks should follow but are out of scope here.
- (−) Some accommodations (richer alt text, map keyboard ordering) require ongoing editorial work, not just a code change. The plan column is honest but speculative.

## Adoption signals

- The maintainer's contract section (§Maintainer's contract above) gets quoted into `CONTRIBUTING.md` after merge.
- A future `scripts/audit-a11y.mjs` could grep for `outline: none` without a `:focus-visible` rule nearby, missing `alt=`, missing `aria-label` on landmark `<nav>` / `<aside>` etc.
- The "deferred" table items each become a GitHub issue when prioritised.

---

*The fifth voice ADR. Together: ADR-0009 (north star), ADR-0010 (visual), ADR-0011 (motion), ADR-0012 (editorial), ADR-0013 (access). Foodbook's purpose, look, move, sound, and reach — each named.*
