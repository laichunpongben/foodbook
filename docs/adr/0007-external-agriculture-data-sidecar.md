# ADR-0007 · Agriculture data is an external sidecar (`almanac`), not a Foodbook module

- **Status**: Proposed — pending the four decision checkboxes on [#60](https://github.com/laichunpongben/foodbook/issues/60). Flip to Accepted once the user confirms.
- **Date**: 2026-05-17
- **Related**: [#60](https://github.com/laichunpongben/foodbook/issues/60) (research/scoping). Prep work shipped in [#84](https://github.com/laichunpongben/foodbook/pull/84). Coexists with [ADR-0001](0001-adopt-astro-on-cloudflare.md) (static + no-DB) and [ADR-0005](0005-public-by-default-no-private-tier.md) (no auth tier).

## Context

`/world` (terroir map) and `/seasons` (seasonal wheel) both run on **hand-authored** data today — `seasonalWindow: [{ product, from, to }]` on farms, no lat/lng resolution, no live-state signal. With 118 dishes (vs. the wishlist's stale "~20 dishes" threshold), the per-dish-refs strategy is past its useful life: a single ingredient like *lychee* appears across many dishes and isn't worth duplicating ad-hoc.

The natural next step is a queryable, live, global agriculture data backend — fusing GBIF (where a species has been observed), Sentinel-2 NDVI (what the crop is doing this week), USA-NPN (phenology), and iNaturalist (citizen-science timestamps). All four sources are free and permissively licensed. No existing tool (Seasonal Food Guide, Illinois FMA, etc.) combines global coverage + live state + species-level terroir + a programmatic API.

The question is *where that backend lives*.

## Decision

The agriculture data backend lives in a **separate repository and deployment**, peer to Foodbook in the `databookman.com` family. Foodbook consumes it via a small HTTP API with graceful degradation.

### The four scoping decisions (#60)

1. **Architecture** — separate repo + small REST API. Not inside Foodbook.
2. **MVP scope** — 50 ingredients drawn from the *current* Foodbook content, selected by intersecting (a) "geographic specificity in name/text" (e.g. *San Marzano*, *Yubari melon*) and (b) "appears in ≥ 2 recipes". Top-up with high-leverage staples (rice, saffron, lychee) if the intersection is small.
3. **Embed surface (first)** — recipe-page chip behind a feature flag. Not `/seasons`, not `/world`. The chip is additive, opt-in, single-ingredient; if the API 500s the chip vanishes and nothing else regresses.
4. **Name** — `almanac` (covers terroir + seasonality + live-state in one register; less wine-jargon than `terroir-engine`). Code identifier `almanac`; public copy can still say "terroir" as section heading on `/world` later.

### API surface

Three endpoints carry the use cases:

```
GET /terroir/:species
  → { polygons: GeoJSON[], confidence, source_records: [...] }

GET /seasonality/:species?lat&lng&date
  → { in_season: bool, window: { peak_start, peak_end },
      ndvi_now: float, ndvi_5yr_avg: float, source: 'phenology'|'ndvi'|'gbif' }

GET /species/search?q=lychee
  → [{ canonical: 'Litchi chinensis', common_names: [...], gbif_taxon_id }]
```

### Foodbook-side contract

- **Per-ingredient pinning by GBIF taxon ID.** `ingredientSchema` in `src/content.config.ts` carries an optional `gbifTaxonId: z.number().int().positive().optional()` ([#84](https://github.com/laichunpongben/foodbook/pull/84) — shipped). Authors hand-pin the curated MVP 50 so the chip skips common-name disambiguation.
- **Feature-flagged chip on recipe pages.** When the flag is on and `gbifTaxonId` is set on an ingredient, render a "currently in season here" chip. When the flag is off, the API is down, or the field is unset, the chip is absent.
- **No build-time dependency on the sidecar.** Foodbook's `astro check` and `astro build` must succeed with the sidecar unreachable. The chip is fetched at render time (in a small island) and quietly omitted on failure.
- **`/seasons` and `/world` retain their hand-authored data** until a separate decision migrates them. Replacing those surfaces is a follow-up issue, not part of this ADR.

## Alternatives considered

- **Build the data layer inside Foodbook.** Foodbook is `output: 'static'` on Pages with no DB ([ADR-0001](0001-adopt-astro-on-cloudflare.md)). Hosting ClickHouse-shaped storage + a Sentinel-2 fan-out ingest pipeline + a query layer here converts an editorial archive into a data platform — operational surface explodes. Voice also breaks: live-data widgets read as product, not editorial.
- **A `databookman/almanac` Astro middleware route.** Keeps the URL nice but doesn't reduce the operational surface — the ingest pipeline still has to run somewhere with state, and now Foodbook's build artifact depends on data freshness.
- **Skip the sidecar; expand `seasonalWindow` to lat/lng manually.** Trades zero infra cost for permanent authoring cost across 118 dishes × N ingredients per dish. Doesn't scale; doesn't add live state.
- **Pre-bake a static `seasonality.json` from GBIF/NDVI quarterly and commit it.** Cheaper than a live API. Loses "this week's NDVI"; commits a multi-MB JSON to a content-archive repo. Defer as a fallback if the live API proves too expensive.
- **Name `terroir-engine`.** Captures one of three feeds and reads as internal tooling at `terroir-engine.databookman.com`. `almanac.databookman.com` reads as a public surface and frames all three feeds.

## Consequences

- (+) Foodbook stays static, public, and operationally cheap. [ADR-0001](0001-adopt-astro-on-cloudflare.md)'s "no DB" and [ADR-0005](0005-public-by-default-no-private-tier.md)'s "no auth tier" both stay intact — the OLAP store and any rate-limited API key live on the sidecar, not here.
- (+) Sidecar can break, redeploy, rev schema independently. Foodbook degrades gracefully: chip vanishes, rest of page is unaffected.
- (+) Each piece is portfolio-shaped on its own — Foodbook reads as an editorial archive, `almanac` reads as a data platform. Splitting clarifies what each project is.
- (+) Sibling sites (Travelbook etc.) can consume `almanac` too without inheriting Foodbook's content model.
- (−) Two repos to keep in sync. Mitigated by treating the API as the contract (versioned response envelope, `Accept-Version` header).
- (−) The recipe chip is dynamic content on an otherwise static site. Acceptable — it's behind a flag and on a single component class; it doesn't infect the rest of the page.
- (−) `/seasons` keeps running on stale hand-authored data until its own migration ships. Acceptable for now; the chip path is the proof-of-concept.
- (−) Sentinel-2 NDVI compute cost is unknown until the sidecar repo benchmarks it. Budget gate: $0–20/mo before committing. Tracked on the sidecar repo's bootstrap issue.
