# ADR-0003 · Dual visual mode — dark editorial + light "kitchen mode" for cook view

- **Status**: Accepted
- **Date**: 2026-05-13

## Context

Two surfaces fight each other on a food site:

1. **Discovery / editorial** — landing, dish entries, world map, seasons wheel. Photos dominate; type sits on top of photos; the design wants drama. Dark backgrounds make food photos pop and keep the editorial feeling magazine-like (cf. Travelbook).
2. **Cook mode** — the recipe view you stare at *while cooking*. Hands are wet, lighting is variable, glance time is short. Wants very high contrast, big type, lots of whitespace, single-step focus. Dark themes hurt here — pale text on dark fights legibility under kitchen lighting; recipes printed on a tablet against a dough-flecked counter need parchment, not editorial moodiness.

We considered just picking one. Neither is satisfactory in both contexts.

## Decision

Two themes, deterministic per-route:

- **Dark editorial** (default everywhere else):
  - Background `#0a0d11`, primary text `#faf8f4`.
  - Accent **paprika** `#d2543b` (a warmer pivot of Travelbook's "alpenglow" — keeps the family resemblance).
  - Display **Fraunces**; body **Inter**. No italic — `<em>` uses the paprika color, matching Travelbook ADR-0003.
  - Multi-layer text-shadow + 2-layer overlay (gradient + radial scrim) so chapter text stays legible on any photo backdrop.

- **Kitchen mode** (only on `/recipes/<slug>/cook`):
  - Background `#f5efe4` (parchment), ink `#1a1a18`.
  - Accent **olive** `#5d6e44` for active step + tappable controls.
  - Same Fraunces + Inter pairing — but the body bumps to 20px / 32px line-height for arm's-length reading.
  - Step-at-a-time layout: only the active step rendered prominently; prev/next as small chips below.

Both modes share the same component library; `cook-mode.css` is a tightly-scoped override loaded only on the `/cook` route.

## Alternatives considered

- **One mode** — see Context. Either editorial fails in the kitchen, or parchment fails in editorial.
- **User-toggleable light/dark** everywhere — adds a settings concept that nothing else in the site needs; doubles the visual-QA surface; defeats the editorial-intent of the dark landing.
- **Pure-CSS prefers-color-scheme respecting** — same downside; the *editorial* surface should be dark regardless of system preference because the photos demand it.
- **Print stylesheet for recipes** — solves cook-mode for printers, not for the more common tablet-on-counter case.

## Consequences

- (+) Each surface looks designed for its job. Editorial does not apologise for being dramatic; cook mode does not apologise for being utilitarian.
- (+) Kitchen-mode CSS is small (~80 lines) and gated to one route — low maintenance cost.
- (+) The route boundary makes the mode obvious to the reader: `/recipes/<slug>/` = editorial, `/recipes/<slug>/cook` = kitchen.
- (−) Two modes to QA on photo / chart / map components if they ever land in `/cook` (currently they don't).
- (−) Slightly more thinking required when adding a new component: which mode(s) does it need to look right in?
