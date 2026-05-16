# ADR-0001 · Astro 5 (static output) on Cloudflare Pages + R2

- **Status**: Accepted. **Photo-store clause superseded by [ADR-0008](0008-wikimedia-image-pipeline.md)** — dish heroes are served direct from Wikimedia with `heroFocal`, not from R2 with build-time variants. R2 remains the path for non-Wikimedia photography (gardens, restaurants, meals); none ships today.
- **Date**: 2026-05-13

## Context

Foodbook is a content-heavy archive — long-form editorial entries, lots of photos, occasional interactivity (map, seasonal wheel, recipe cook-mode). It needs to be cheap to host indefinitely, fast on a phone in a kitchen with one bar of signal, and authorable by editing local files. There is a sibling project — Travelbook — that has been running on Astro + Cloudflare for ~year with no regrets.

## Decision

- **Astro 5**, `output: 'static'` — pre-render every page at build time, ship zero JS by default; only the islands that need behaviour (map, lifecycle scroll-spy, cook-mode timers, AI chat box) load JS.
- **MDX content collections** for everything — dishes, recipes, restaurants, farms, meals, garden, pantry. Zod schemas in `src/content.config.ts` enforce shape at build time.
- **Cloudflare Pages** for hosting, via `@astrojs/cloudflare` adapter. Photo proxy route (`src/pages/photos/[...path].ts`) runs as SSR on Pages Functions and reads from an R2 binding.
- **Cloudflare R2** for the photo store (`foodbook-photos` bucket). Originals + 4 resized variants (500 / 1280 / 2560 / 3840).
- A handful of **Pages Functions** for the AI surfaces: `/api/extract`, `/api/chat`, `/api/coach` (see [ADR-0004](0004-ai-first-integration-points.md)).

## Alternatives considered

- **Next.js + Vercel** — heavier defaults; we don't need server components for a static archive. Bundle size suffers vs. Astro out of the box.
- **Eleventy** — minimal and proven, but the MDX + content-collection + view-transitions ergonomics in Astro 5 are notably better.
- **Self-hosted (VPS + nginx)** — non-zero ops; Cloudflare's free tier covers personal-scale traffic.
- **Static site generator without MDX** (Hugo, Zola) — JSX-style components inside markdown is a real authoring win for ingredients-with-provenance and lifecycle-steppers.

## Consequences

- (+) Zero JS by default; islands are opt-in per component.
- (+) Content is grep-able plain MDX in git — no DB.
- (+) Hosting costs ≈ $0 for personal scale (Pages free + R2 free egress).
- (+) Sibling site (Travelbook) is on the same stack — patterns and modules port across.
- (−) Pages Functions cold-start adds ~50–100ms on first AI request after idle. Acceptable.
- (−) MDX schema changes require build-time fixes across all entries — no schema migration step. Mitigated by Zod failing loudly with a per-file error.
