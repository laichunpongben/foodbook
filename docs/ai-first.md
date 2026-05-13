# AI-first — where Claude lives in Foodbook

> AI augments human authoring. Authored prose is the spine; AI helps you build it faster, search it deeper, and use it while cooking. AI never *replaces* the author's voice.

This is the design principle that draws the line. Below, the concrete integration points, in priority order.

## 1. Author-time recipe extraction *(highest leverage)*

The slowest part of running a recipe archive is transcribing recipes off web pages, screenshots, and magazine photos into structured MDX. Claude with vision + tool use turns this from ~15 minutes per recipe into ~1 minute of edit-review.

**Flow**:

```
$ npm run extract -- https://www.bonappetit.com/recipe/some-pasta
                  ↓
       /api/extract  (Cloudflare Pages Function)
                  ↓
       Claude — vision + structured output (tool use)
                  ↓
       writes draft to src/content/recipes/_drafts/<slug>.mdx
                  ↓
       you open + edit + commit
```

Or with a photo:

```
$ npm run extract -- ./scratch/grandma-recipe-card.heic
```

What Claude returns is a draft MDX file with frontmatter (yield, time, source URL, attribution) and a body with ingredient list + numbered steps. **It is never auto-committed.** The author always edits.

Important: the prompt explicitly tells Claude *not* to invent quantities or steps. If something is illegible in the photo, leave a `TODO` marker. Better to flag than to fabricate.

## 2. Reader-side conversational search

Across the corpus, a small chat box answers questions like:

- "What's a good dish for tomatoes in late summer?"
- "Halve the Bolognese recipe."
- "Where do my eggs come from?" (provenance traversal)
- "Find that ramen place we went to in Tokyo last spring."

Implementation: RAG. Build embeddings on each MDX entry's title + frontmatter + 200-word excerpt (Voyage AI `voyage-3` model is currently cheapest and accurate for cookery vocabulary). At query time:

1. Embed the question.
2. Top-k semantic search over the corpus.
3. Hand the matched entries + the question to Claude with a system prompt that *only* answers from supplied context and *cites entries by slug*.

Citations are non-negotiable — every answer includes "from `dishes/tomato-ragu`" or similar. If nothing matches, Claude says "no entry covers that yet" rather than guess.

## 3. Cook mode — voice + chat coach

A recipe rendered at `/recipes/<slug>/cook` is in *kitchen mode*: light theme, huge type, one step at a time, microphone icon in the corner.

The microphone enables a Claude-backed coach that knows the recipe's full text as system context (prompt-cached). The user can ask:

- "What's next?"
- "Halve step 3."
- "Set a timer for 22 minutes." (tool use)
- "Can I substitute pancetta for guanciale?"
- "Done with the sauce, what now?"

Tool use is wired for two tools: `set_timer({ duration_seconds, label })` and `advance_step({ to_step })`. Both produce visible UI changes (timer chip appears, step focus moves).

## 4. Discovery — "more like this"

On every dish entry, a small "related" rail shows the 3 closest entries by embedding distance. Pure semantic — captures things tag-based filtering misses (e.g. "Eastern Mediterranean braised lamb" finds an Iranian khoresh even with no shared tags).

## 5. Authoring assists you'd want once and then forget

These are one-shot or batch scripts, not server routes:

| Script | What it does |
|---|---|
| `npm run tag-meals` | Walks unphotographed `meals/` entries, asks Claude to suggest cuisine + dietary tags from the photos + body text. Suggestions write to a `_suggested-tags:` field; author reviews. |
| `npm run season-audit` | For every dish, derives an "in season" window from the ingredients and compares to authored `seasons` field. Flags mismatches. |
| `npm run provenance-graph` | Renders an SVG of the entity graph (dishes → farms → restaurants) for `docs/provenance.svg`. Useful for sanity-checking links. |
| `npm run check-photo-alt` | Generates alt text for any photo missing it, writes back to frontmatter as `_suggested-alt:` for author review. |

## Where AI does *not* belong

To keep the design honest, explicit non-goals:

- **No AI-generated recipe prose.** If Claude wrote it, attribute it loud — `attribution: AI draft, edited by Ben`. Default to author-only.
- **No AI-generated photos.** Food photography is part of the archive's value. AI fakes are forbidden in `local-photos/`.
- **Reader-side AI is rate-limited, not auth-gated.** `/api/chat` and `/api/coach` are open to the public web, but per-IP rate limited via Cloudflare KV (30/hr and 60/hr respectively) and budget-capped (hard cut at the monthly $ ceiling). The `/api/extract` authoring route is CLI-only, gated by an `EXTRACT_TOKEN` env var. The full corpus is in the public repo anyway — there is no secret to gate.
- **No AI rewriting of existing entries.** Once committed, prose is durable.
- **No AI-led search ranking.** The world map orders pins by date-visited. The seasons wheel orders by month. AI ranks the related rail, but never the canonical lists.

## Cost shape

Rough monthly back-of-envelope for personal use:

| Surface | Calls/mo | Tokens/call | Notes |
|---|---|---|---|
| `/api/extract` | ~20 | ~3k in / 2k out + 1 image | Use Sonnet 4.6; vision capable; cheaper than Opus |
| `/api/chat` | ~50 | ~2k in / 500 out | Sonnet 4.6 with prompt caching on corpus context |
| `/api/coach` | ~30 | ~1k in / 200 out | Sonnet 4.6 with recipe context cached |
| Embeddings | ~1 / deploy | full corpus | Voyage `voyage-3`, ~$0.06/M tokens |

Default model: **Claude Sonnet 4.6** for everything. Bump to Opus 4.7 only if extraction quality degrades on tricky multi-column recipes.

See [ADR-0004](adr/0004-ai-first-integration-points.md) for the decision record.
