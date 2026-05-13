# Foodbook — brainstorm

> Idea space, not commitments. The ADRs and `architecture.md` codify which of these we're actually building. Everything else stays here as raw material.

## The premise

Travelbook captures a *trip*; Foodbook captures a *food's life*. The lifecycle has four stages — pick any subset for any given entry:

```
SOURCE        GROW            COOK            EAT
─────         ────            ────            ───
farm visit    garden bed      recipe          restaurant visit
producer      hydroponics     technique       home meal
market run    foraging        equipment       picnic / event
fishmonger    sprouting       lesson learned  tasting menu
forager       composting      family memory   street food
terroir       seasonality     substitution    leftover lunch
```

A given **dish** entry can have all four (Tomato Ragu: visit San Marzano farms → grow them at home → cook the ragu → eat it at Easter lunch). An **ingredient** entry might only have source + grow (saffron — never cooked solo). A **restaurant** entry sits in EAT and references back to dishes. A **garden bed** entry is GROW-only but links forward to dishes that used the harvest.

## Differentiators vs. other food sites

| Reference site | What it nails | What we'd do differently |
|---|---|---|
| NYT Cooking | Recipe format, notes, ratings, scaling. | Authored not aggregated; ingredient *provenance* not just quantities. |
| Eater | City restaurant lists, neighborhood guides. | Personal visit diary, not editorial guide. |
| Food52 | Community + provenance angle. | Single-author archive, no community. |
| Substack food letters (Vittles, Boat) | Voice, long-form essay. | Same voice, but with structured map + season + provenance overlays. |
| Yelp / Resy | Restaurant DB + reservations. | No social feed, no reviews — just *visits*. |
| The Sill / Smart Garden apps | Plant care reminders. | Garden as *log*, not assistant. |
| Cooked.com (Bourdain-era) | Editorial cookbook digitized. | Same shape, MDX-native, photos as first-class. |

## What's worth building

### Tier 1 — must (for v1)

- **Dish entries** with up to 4 lifecycle stages — the spine of the site.
- **Recipe MDX** — ingredients (with optional provenance refs), numbered steps, time estimates, yield, revisions.
- **Restaurant entries** — name, lat/lng, visits[], dishes ordered, who I was with, what was memorable.
- **World food map** at `/world` — pins for restaurants visited, farms visited, foraging spots, optionally ingredient terroir.
- **Seasonal landing** at `/seasons` — "what's in season near me right now" wheel, with links to in-season dishes/recipes.
- **Photo pipeline** identical to Travelbook (4 sizes, R2, `<ResponsiveBackdrop>`).
- **Public + unlisted visibility** — every entry is either listed (in `/`, `/world`, sitemap, RSS) or `unlisted` (still rendered at its slug for direct links, but excluded from listings + `noindex`). There is no auth-gated tier; sensitive content does not enter the repo. See ADR-0005.

### Tier 2 — nice (for v1.x)

- **Garden log** — planted/harvest timeline, yields, what cooked with.
- **Pantry snapshot** — manually edited inventory, fuels "what can I cook tonight" AI matcher.
- **Cook mode** — a clean, high-contrast, voice-friendly recipe view designed for messy hands. Big type, step-at-a-time, "next" by voice or space-bar.
- **Provenance overlay** — on a recipe, hover an ingredient → see which farm/market/forage spot it came from. Pin on the map.
- **Seasonal wheel** — circular calendar of what's in season, links into dishes/recipes that use it.

### Tier 3 — defer

- **Wine/sake/pairing** entries — interesting but a separate spine; revisit when there are >10 candidates.
- **Cookware diary** — pans, knives, kettles I love. Small backlog; not enough content yet.
- **Restaurant *wishlists*** (vs. visited) — Travelbook has this for hotel/restaurant candidates; for Foodbook, leave to a private Notion or skip — visiting *is* the entry.
- **Social features** — comments, likes, sharing widgets. This is a private archive.
- **Search bar** — Astro static-search can wait until content count crosses ~50.

### Tier 4 — explicitly no

- **AI-generated recipes** — readers don't trust them (see research notes). Recipes are authored or attributed.
- **Affiliate links / monetization** — this is personal archive.
- **Community / reviews / ratings** — Yelp exists.
- **Booking / reservations** — Resy exists. We just log *what happened*.

## Interactive ideas worth prototyping

- **Hero Ken Burns slideshow** of plated dishes (like Travelbook does for chapter heroes).
- **Lifecycle stepper** at the top of a dish entry — four dots (source/grow/cook/eat), click to jump to that stage. Empty stages render greyed.
- **Provenance map inline** in a recipe — small Leaflet map showing where each ingredient came from. Toggle "show only Tier 1 ingredients" to declutter.
- **Seasonal wheel** — SVG circle, 12 months, ingredients arc'd onto their windows. Click an ingredient → its dishes.
- **Activity hover crossfade** — Travelbook's pattern where hovering an activity row swaps the backdrop. We do the same for ingredients in a recipe: hover an ingredient → photo of *that* ingredient slides in from the side.
- **Plate map** — for a finished dish photo, define hotspot polygons over each ingredient on the plate; hover/click to dive into that ingredient's terroir.
- **Cook-mode keyboard nav** — j/k or space-bar to advance steps, no mouse needed.

## AI-first — where it lives

See [`ai-first.md`](ai-first.md) for the full breakdown. Short version: **AI augments human authoring, never replaces it.**

- **Authoring** — paste a recipe URL or photograph a magazine page → AI extracts structured MDX as a draft. Author then edits + commits. This is the highest-leverage AI usage.
- **Reader-side** — "explain this technique", "halve this recipe", "what should I cook tonight with: chicken, lemon, rice", "what's in season near me now". Pulls from MDX corpus.
- **Cook mode** — voice / chat coach during a cook. Knows the recipe context, answers technique questions, sets timers.
- **Discovery** — embeddings (Voyage AI) on dishes/recipes/restaurants; "more like this" within the corpus.
- **Provenance traversal** — graph walk over entity refs ("where do my tomatoes come from in summer?" → traverses ingredient → farms → seasonal windows).

## Visual direction

Two contenders, leaning A:

**A. "Dark editorial" — same as Travelbook**
- `#0a0d11` bg, `#faf8f4` text, Fraunces + Inter, accent reused as alpenglow → call it **paprika** here (`#d2543b`).
- Pro: consistency with sibling site; food photos pop on dark like trip photos do.
- Con: recipes are tough to read on dark while cooking with hands wet.

**B. "Cookbook parchment" — light**
- Cream `#f5efe4`, ink `#1a1a18`, Fraunces + Inter, accent **olive** `#5d6e44`.
- Pro: better legibility for recipes / cook mode.
- Con: drift from Travelbook visual identity.

**Verdict (see ADR-0003):** ship **dark editorial** as the primary mode, with a high-contrast **"kitchen mode"** light theme that only activates on `/recipes/<slug>/cook`. Best of both — editorial weight on the showcase, parchment legibility when it actually matters (cooking).

## Open questions / things to revisit

- Should restaurants be visited-only, or also wishlist-with-status (like trip hotel candidates)? *Lean visited-only; less authoring overhead.*
- Should we ingest geo-tagged camera-roll photos to scaffold meal entries? Mobile workflow is the bottleneck for meals out — many photos die in camera roll. Maybe a `npm run scaffold:meal -- <heic>` later.
- AI cook mode — server-side (Claude API) or also support a tiny on-device Llama for offline cooking? Defer until v2.
- Should ingredient terroir pins be authored-per-dish or a shared `ingredients/` collection? Shared registry probably wins at >20 dishes; YAGNI until then.

## References that informed the design

- Travelbook (`~/workspace/travelbook/`) — content model, photo pipeline, dark editorial design, ADR cadence, view transitions.
- Trade press: ["AI startups want to crack open the recipe book in Big Food's test kitchens"](https://www.cnbc.com/2026/02/14/big-food-ai-recipes.html) — AI on the production side; we sit on the consumer/author side.
- ["Food blogs beat AI for recipes — what a 2026 study found"](https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/) — trust skews to human authorship 3× over AI; reinforces "AI augments, never authors prose" stance.
- [Google AI Mode recipe update, March 2026](https://almcorp.com/blog/google-ai-mode-recipe-update-2026/) — SEO no longer strip-mining recipes; long-form structured content is back in favor.
- [FarmstandApp — sharing farm stories through visual media](https://www.farmstandapp.com/63905/7-ideas-for-showcasing-farm-to-table-stories-online/) — interactive field-to-fork timelines, QR-coded provenance, seasonal-shift menus.
