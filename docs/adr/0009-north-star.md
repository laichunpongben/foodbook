# ADR-0009 · North star — a walkable food archive, readable as prose and queryable as a graph

- **Status**: Proposed
- **Date**: 2026-05-22

## Context

Foodbook has shipped its first run of pages, schemas, and feeds. The four-stage lifecycle (source → grow → cook → eat, [ADR-0002](0002-content-model-dishes-recipes-restaurants-farms.md)) is the data model; the dual-mode visual language (editorial + kitchen, [ADR-0003](0003-dual-mode-editorial-and-kitchen.md)) is the design language; the dish-page journey ([ADR-0006](0006-dish-page-journey-with-dishhero.md)) is the editorial spine.

What's missing: a one-line **north star** to anchor the next year of editorial and product decisions. Without it, every new feature is a coin-flip — is this a "yes, that's foodbook" or a "no, that's drift"? The recent surge in shipped feeds (`/rss.xml`, `/feed.json`, `/llms.txt`, `/llms-full.txt`, `/sitemap.txt`, `/sitemap.json`, the `/api/*.json` set) and discovery affordances (`/recent`, `/random`, `/tags`, `/lifecycle`, `/colophon`, `/credits`, `/keyboard`) is the right direction *if* it's serving the north star, and scope creep if it isn't. This ADR names it so we can tell.

The framing has to be:
1. **Unique** — not interchangeable with NYT Cooking, Food52, Eater, Substack food letters, or any commercial-traceability supply-chain platform. Most of those are either community-curated content feeds or B2B compliance tools. Foodbook is neither.
2. **Forward-looking** — describes where Foodbook is going, not just what it does today. A north star that just summarises existing pages is a tagline, not a star.
3. **Decidable** — when we propose a new feature or entry, the north star must let us answer "in scope?" with confidence.

## Decision

### The north star

> **Foodbook is a walkable food archive — readable as prose by humans, queryable as a graph by agents — where every dish's lineage runs backward to soil and forward to table in both directions.**

Three load-bearing words:

- **Walkable** — every entry is a node in a cross-collection graph. A reader (or agent) can start from any dish, recipe, farm, restaurant, or season and traverse the lineage in either direction without dead ends. The graph is the experience.
- **Lineage** — what we trace, what every entry carries. Not just "where it came from"; the *full* chain that produced this plate at this moment.
- **Both** (humans + agents) — first-class equal-citizen consumption. Prose for humans, [`/api/*.json`](../../src/pages/api/) + [`/llms-full.txt`](../../src/pages/llms-full.txt.ts) for agents. Not "machine-readable as an afterthought." Built so an agent can answer "What's in season this week that I have a recipe for and a producer for nearby?" by walking the same graph a reader walks visually.

### What this means in practice

**In scope:**
- Anything that strengthens cross-collection links. A "more like this" rail, a back-ref, a graph view, a per-tag index, a JSON export — all serve walkability.
- Anything that makes the same lineage data legible to humans *and* agents in parallel. Dish detail HTML + `/api/dishes.json` from the same source. JSON-LD on every entity page. Stable slugs.
- Anything that surfaces *seasonality, terroir, technique* as first-class navigation axes — alongside the obvious "by dish name" axis.
- Editorial entries that document the full lineage of a single dish — even a sparse two-stage one is on-mission; a recipe with no provenance is *off* mission.
- AI features that read the corpus to assist authoring or reader exploration ([ADR-0004](0004-ai-first-integration-points.md)). The corpus *being* walkable by agents is the precondition.

**Out of scope:**
- A community feed. Comments, ratings, reviews, follower counts. Foodbook is single-author by design ([ADR-0005](0005-public-by-default-no-private-tier.md)); collaboration happens via PRs.
- An algorithmic discovery layer. Tag chips, related-by-overlap rails, season filters — yes. "Recommended for you" / "people who cooked this also cooked" — no.
- A recipe app. Cook mode exists ([ADR-0003](0003-dual-mode-editorial-and-kitchen.md)) but Foodbook is not competing with Yummly / Paprika / NYT Cooking on grocery-list shopping or meal-planning workflows. Those tools optimise for *frictionless cooking*; we optimise for *visible lineage*.
- A supply-chain traceability product. Commercial provenance platforms (Provenance.org, blockchain-traceability vendors) solve B2B compliance and food-safety recalls. Foodbook is editorial; we trace lineage for *meaning*, not for audit.
- Scaling up the author count. Forks welcome; co-editing is not the path.

### Tenets the north star implies

1. **Provenance is the editorial.** A dish without lineage is a recipe card. A dish entry that names the producer, the variety, the season, the recipe used, the meal it became — that's foodbook.
2. **Read as prose, walk as a graph.** Every page is hand-written prose. Every page is also a node with structured edges. Neither layer is the afterthought.
3. **Public by default, citable forever.** Stable slugs, canonical URLs, JSON-LD, CC-attributed photos, open feeds. The archive should still resolve in five years; agents that ingest it today should still find it tomorrow.
4. **Dense, not exhaustive.** A small number of fully-traced dishes beats a large flat catalogue. The lineage is what we sell; the dish count isn't.
5. **AI is a tool, not the voice.** Claude assists extraction and discovery ([ADR-0004](0004-ai-first-integration-points.md)); the prose remains hand-written. The corpus is built so future AI surfaces can be readers, not authors.

### Decidability worked examples

| Proposal | Verdict | Why |
|---|---|---|
| Add a "More like this" rail by tag overlap on dish pages | **In scope** | Strengthens walkability — a new traversal edge a reader can take. |
| Add a JSON endpoint exposing every dish's lifecycle refs | **In scope** | Same lineage, agent-readable. The walk doesn't depend on rendering. |
| Add an upvote button on each recipe | **Out of scope** | Community-feed pattern; "out of scope" item above. |
| Backfill cuisine tags on 38 dishes so /tags/korean populates | **In scope** | Strengthens the cuisine-axis traversal that already exists. |
| Add "recommended for you" carousel on the homepage | **Out of scope** | Algorithmic discovery; foodbook surfaces lineage, not personalised picks. |
| Document the four-stage model on a /lifecycle page | **In scope** | Makes the graph's *shape* legible to first-time readers. |
| Build a grocery-list export from a recipe | **Borderline** | Shopping list exists (/recipes/<slug>/shopping) as a derivative print view; expanding it into a meal-planner workflow would drift toward "recipe app." Cap at one printable artifact. |
| Open the editor to multiple authors | **Out of scope** | Single-author by design; collaboration via PRs. |
| Ship a `<dishes-graph>` 3-D visualisation showing every cross-ref | **In scope** | The graph made literally visible. Forward-looking but on-axis. |

## Alternatives considered

- **"Trace every dish from soil to plate."** Caught the lineage angle but missed the dual-audience point and read as a slogan, not a star.
- **"The personal cookbook, with provenance."** Accurate but defensive — defines Foodbook by what it adds to an existing genre rather than by what it *is*.
- **"An atlas of one cook's repertoire."** Owned the single-author angle but missed the agent-readable / forward-looking dimension.
- **"Provenance over performance."** Punchy, but too internal — reads as an engineering tenet, not a product north star.

## Consequences

- (+) New features can be evaluated against the table above instead of relitigated each time.
- (+) The recent burst of `/api/*.json`, `/llms.txt`, `/llms-full.txt`, and graph-style cross-collection rails is retroactively coherent — they all serve "walkable by agents".
- (+) Editorial decisions have a yardstick: a new dish entry without lineage is below the bar; a dish with even a two-stage lineage is on-mission.
- (−) Some shipped surfaces are off-axis when measured strictly (e.g. the keyboard-reference page is genuinely UX-polish, not lineage-strengthening). We accept that — the north star is a heading, not a wall.
- (−) The AI-agent-readable framing creates pressure to maintain backwards-compatibility on the JSON / llms surfaces. Document changes there as versioned, not silently.
- (−) "Walkable" implies graph-completeness as an editorial obligation. A dish that references a recipe that doesn't exist is now a north-star violation (`scripts/check-refs.mjs` catches the technical case; the editorial case lives in `scripts/audit-tags.mjs` and is the next layer).

## Adoption signals

- /about gets a fresh top section quoting the north star (follow-up PR).
- Future ADRs cite this one in their *Context* when the proposal is on-mission.
- `feature-wishlist.md` gets re-grouped under "serves the star" / "doesn't" / "borderline".
- The two existing audit scripts (`audit-tags`, `audit-coords`) are joined by a third — `audit-lineage` — that surfaces dishes whose lifecycle is *under*-populated. Surfacing the under-traced dishes is how we live the star.

---

*This ADR will be the load-bearing reference for future scope debates. If a proposal can't be placed on the table above with a clear verdict, the proposal isn't ready — refine it until it can.*
