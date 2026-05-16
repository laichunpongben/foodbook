# ADR-0008 · Dish hero images come from Wikimedia URLs with `heroFocal` crop control, not from an R2-hosted variant pipeline

- **Status**: Accepted. Supersedes the "Cloudflare R2 photo store with 4 resized variants" clause of [ADR-0001](0001-adopt-astro-on-cloudflare.md).
- **Date**: 2026-05-17
- **Related**: [#8](https://github.com/laichunpongben/foodbook/issues/8) (closed via the partial fix in PR #33), photo-wave PRs [#63](https://github.com/laichunpongben/foodbook/pull/63)/[#64](https://github.com/laichunpongben/foodbook/pull/64)/[#76](https://github.com/laichunpongben/foodbook/pull/76)/[#77](https://github.com/laichunpongben/foodbook/pull/77)/[#78](https://github.com/laichunpongben/foodbook/pull/78)/[#79](https://github.com/laichunpongben/foodbook/pull/79)/[#80](https://github.com/laichunpongben/foodbook/pull/80)/[#82](https://github.com/laichunpongben/foodbook/pull/82)/[#83](https://github.com/laichunpongben/foodbook/pull/83), tooling in `scripts/suggest-focal.mjs` + `scripts/audit-hero-photos.mjs`.

## Context

[ADR-0001](0001-adopt-astro-on-cloudflare.md) described the photo pipeline as **"Cloudflare R2 (`foodbook-photos` bucket). Originals + 4 resized variants (500 / 1280 / 2560 / 3840)"**, with an SSR `src/pages/photos/[...path].ts` proxy reading from an R2 binding. [#8](https://github.com/laichunpongben/foodbook/issues/8) proposed the same shape: build-time download → Astro `<Image>` → `srcset`/`sizes` → AVIF/WebP, optionally via Cloudflare Images.

What actually happened during the audit-fix wave and the subsequent 118-dish content push:

- Dish heroes carry **direct Wikimedia URLs** in `heroUrl`, pointed at the highest-resolution `originalimage` variant the source offers (`upload.wikimedia.org/.../3840px-*.jpg` or original).
- The `hero: "/photos/dishes/<slug>/hero"` schema field is **vestigial** — `src/pages/photos/[...path].ts` does not exist; no SSR photo proxy is wired up.
- `wrangler.toml` declares **no R2 binding** — the comment block explicitly says "no bindings required today".
- Per-dish off-center crops are handled by a CSS-level `heroFocal: "75% 50%"` style frontmatter field ([#63](https://github.com/laichunpongben/foodbook/pull/63)), not by build-time crop variants.
- Saliency analysis (`scripts/suggest-focal.mjs`) picks the focal point automatically; an audit script (`scripts/audit-hero-photos.mjs`) scores dish heroes on cheap visual signals so the curator can spot low-quality ones.

[ADR-0001](0001-adopt-astro-on-cloudflare.md) is internally consistent — the R2 + variants design would work — but it's not the system that exists. Future readers debugging "where does this image come from" need a record that points them at Wikimedia, not at an absent R2 bucket.

## Decision

Dish hero photography is **sourced and served from Wikimedia Commons directly**, with the following conventions:

1. **`heroUrl: "https://upload.wikimedia.org/.../<size>px-<file>"`** in dish frontmatter. Prefer the article's `originalimage` (or `3840px` thumb where the original is huge) so the source is sharp on retina displays.
2. **`heroFocal: "<x>% <y>%"`** controls CSS `object-position` / `background-position` wherever the hero is cropped (4:5 card crop on landing, full-bleed plate hero on the dish page). Omit for centered defaults. Used by `WikiImage.astro` and the card components.
3. **No build-time download or re-encoding** of dish heroes. The browser fetches Wikimedia directly. Trade-off accepted: a Wikimedia file rename will break the hero silently — caught by `scripts/audit-hero-photos.mjs` (audit-on-demand) and the `[audit:CRIT]` flow rather than by build.
4. **`<img loading="lazy" decoding="async">` with responsive `srcset`** in `WikiImage.astro` — the partial fix from [#8](https://github.com/laichunpongben/foodbook/issues/8) (shipped in [PR #33](https://github.com/laichunpongben/foodbook/pull/33)). Wikimedia exposes thumb URLs at arbitrary widths; we generate the `srcset` against that scheme rather than hosting our own variants.
5. **Saliency-driven defaults**. `scripts/suggest-focal.mjs --write` runs the saliency analyser across all dishes that lack a `heroFocal`, writes a sensible default, and flags ambiguous picks. The throttled-fetch wrapper (`scripts/lib/throttled-fetch.mjs`) honours Wikimedia's rate limit — a 60-min cold gap clears most HTTP 429s, a 2-hour gap clears the long-tail.
6. **Audit tooling, not gated CI**. `scripts/audit-hero-photos.mjs` scores hero photos (resolution, focal centeredness, file size, dominant-colour drift from page background). It runs on demand during photo-wave content sprints, not on every PR. Build never blocks on hero quality.

### Where the R2 design still applies

The R2-hosted, build-time-variant pipeline described in [ADR-0001](0001-adopt-astro-on-cloudflare.md) is still the **shape for personal-archive photography that doesn't have a public Wikimedia source** — garden plot photos, restaurant visit photos, the user's own meal photos. If/when those collections gain entries with non-public-domain hero assets, the R2 bucket + `src/pages/photos/[...path].ts` proxy + `local-photos/` mirror described in [ADR-0001](0001-adopt-astro-on-cloudflare.md) is the path. None of those entry types currently has photos that need that pipeline.

## Alternatives considered

- **Build-time download + R2 + 4 variants + photo proxy** (the original [ADR-0001](0001-adopt-astro-on-cloudflare.md) shape). Heavier ops surface for a benefit that doesn't materialise on a public-domain corpus: Wikimedia already serves resized variants at any width, on a CDN, for free. Implementing it doubles the photo-publishing cost (sync step + bucket lifecycle) without measurable performance gain over Wikimedia's CDN.
- **Cloudflare Images with Wikimedia as upstream source.** Cheaper to wire than self-hosted R2 variants and would centralise control. Trade-off: an extra paid service with a separate quota; loses the "no third-party dependencies beyond Cloudflare Pages itself" property and ties future migration off Cloudflare to also migrating off Cloudflare Images.
- **Build-time crop variants** (one image per dish × per crop ratio) instead of `heroFocal`. Solves the rename-fragility risk at the cost of 100+ pre-rendered crops to maintain. `heroFocal` is one frontmatter field per dish; saliency picks it; the renderer does the actual cropping in CSS — much less infrastructure for the same visual result.
- **Migrate all heroes to R2 retroactively.** The 118-dish corpus is already loaded with Wikimedia URLs. Migration cost is high and the win is small while the photos themselves are Wikimedia-sourced. If the project ever takes its own dish photography at scale, that migration can be revisited.

## Consequences

- (+) Zero hosting cost for hero photography. Wikimedia's CDN handles delivery, resize, and caching.
- (+) Attribution is implicit in the URL — the file's Wikimedia source is always linkable from the dish page.
- (+) `heroFocal` makes per-dish framing a one-line authoring decision, automatable by `scripts/suggest-focal.mjs`.
- (+) `wrangler.toml` stays trivially small ("no bindings required today"); the deployment surface for the static site is just Pages.
- (−) Hot-link fragility: a Wikimedia file rename breaks the hero silently. Mitigated by `audit-hero-photos.mjs` runs during content sprints; not eliminated.
- (−) Wikimedia rate-limits aggressively. Photo-wave tooling has to honour a throttled fetcher with backoff and cold-gap retries (`scripts/lib/throttled-fetch.mjs`, with sustained 429s clearing only after a 60-min to 2-hour cooldown).
- (−) The `hero: "/photos/dishes/<slug>/hero"` schema field on dish frontmatter is currently dead weight — kept because the R2 path remains the right shape for non-Wikimedia photography (see above), and removing it now would force a schema migration. Document its conditional applicability.
- (−) [ADR-0001](0001-adopt-astro-on-cloudflare.md) and `docs/architecture.md` both describe the original R2-variants design. This ADR supersedes that section in [ADR-0001](0001-adopt-astro-on-cloudflare.md); a follow-up `docs/architecture.md` refresh should reconcile the prose to match.
