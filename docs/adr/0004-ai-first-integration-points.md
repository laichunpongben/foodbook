# ADR-0004 · AI-first integration points — author-time extract + reader-time assist

- **Status**: Accepted
- **Date**: 2026-05-13

## Context

The site is positioned as "AI-first". The lazy interpretation of that would be "let AI generate recipes / dish descriptions on demand". A 2026 study found home cooks are 300% more likely to use food blogs than AI for recipes, and 125% more likely to reach for a cookbook ([source](https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/)). Trust drops as AI exposure rises. Generating recipe prose with an LLM and pretending it's authored undermines the whole premise of an editorial archive.

But AI is genuinely transformative on three axes the site needs:

1. **Authoring throughput** — transcribing a recipe from a web page or a photo of a cookbook page is ~15 minutes of tedious typing. Claude with vision + structured output reduces it to ~1 minute of review-and-edit.
2. **Search and discovery** — semantic search across the corpus answers "what's a good summer tomato dish" in a way tags never will.
3. **Cook mode** — a voice/chat coach that knows the recipe's context can answer technique questions, substitutions, scaling math, and timers without forcing the cook to scroll.

The decision is *where* AI lives, *what's authored vs. inferred*, and how to keep trust intact.

## Decision

**AI augments human authoring; AI never substitutes for it.** Concretely:

### Author-time

- **`/api/extract`** (CLI-invoked, env-token gated):
  - Input: a recipe URL, a photo file, or a magazine page scan.
  - Process: Claude Sonnet 4.6 with vision + tool use (`emit_recipe(yield, time, ingredients, steps, source_url, attribution)`).
  - Output: a draft MDX written to `src/content/recipes/_drafts/<slug>.mdx`.
  - Never auto-committed. The author opens it, edits it, commits it.
  - The system prompt explicitly forbids invention: illegible / missing data becomes a `TODO:` marker, not a fabricated value.

### Reader-time

- **`/api/chat`** (public, rate-limited 30/hr/IP via Cloudflare KV):
  - RAG over the MDX corpus. Voyage `voyage-3` embeddings, top-k semantic match, Claude Sonnet 4.6 answers with strict instruction "only from supplied context; cite entries by slug; if nothing matches, say so".
  - Every answer carries citations — `from dishes/example-tomato-ragu`. This is enforced in the response renderer, not just the prompt.

- **`/api/coach`** (public, rate-limited 60/hr/IP):
  - Cook-mode chat. Recipe text is prompt-cached so multi-turn questions are cheap.
  - Two tools: `set_timer(duration_seconds, label)`, `advance_step(to_step)`. Both produce visible UI changes in the cook page.

- **Related rail** — built offline at deploy time. `scripts/build-embeddings.mjs` embeds every entry, writes `embeddings.json` to R2. Rail pulls top-3 nearest entries — pure semantic, no Claude call at read time.

### Where AI does not live

- **No AI-generated prose in committed MDX.** If something was AI-drafted, attribute it: `attribution: AI draft, edited by <author>`. The default is author-only.
- **No AI-generated photos.** Food photography is part of the archive's value.
- **No AI rewriting of existing entries.** Once committed, prose is durable.
- **No AI ranking on canonical lists** — world map orders by date visited, seasons wheel orders by month. AI only ranks the related rail.

### Default model + cost shape

All three routes use **Claude Sonnet 4.6** as the default. Bump to Opus 4.7 only on extraction quality regressions. Per-route prompt caching is on. Voyage `voyage-3` for embeddings.

| Route | Calls/mo (personal) | Tokens/call | Notes |
|---|---|---|---|
| `/api/extract` | ~20 | 3k in + 2k out + 1 image | Sonnet 4.6 vision |
| `/api/chat` | ~50 | 2k in + 500 out | Sonnet 4.6 + cache |
| `/api/coach` | ~30 | 1k in + 200 out | Sonnet 4.6 + cache |
| Embeddings | 1 / deploy | full corpus | Voyage `voyage-3` |

Hard monthly cap implemented as a Cloudflare KV counter — once exceeded, AI routes return `503` with a copy explaining "AI quota for the month is full; the static archive is unaffected".

## Alternatives considered

- **All-AI recipe generation** — see Context; demonstrably erodes trust.
- **AI only at author-time, none at reader-time** — leaves the discovery + cook-mode wins on the table; both are high-leverage.
- **Self-hosted local model** (Llama, etc.) — saves API cost but loses vision quality and tool use; revisit once personal scale exceeds the API monthly cap (unlikely).
- **OpenAI or Gemini instead of Claude** — Claude 4-class vision and tool use are currently best-in-class for recipe extraction; sibling Travelbook project also uses Claude API, which keeps the auth + observability surface single.
- **Pre-baking all chat answers as static FAQs** — kills the long-tail "halve this recipe" / "substitute X for Y" use cases.

## Consequences

- (+) Trust stays high — readers can see that prose is authored and AI-generated material is attributed.
- (+) Authoring throughput ~10× on imports, which is the slowest part of running the archive.
- (+) Reader-side wins (search, cook coach) are the kind of thing a static blog physically cannot do.
- (+) Costs cap-able and observable per route.
- (−) Three Pages Functions to maintain + their prompts to keep tuned.
- (−) Public AI routes are an abuse target. Mitigated by KV rate limits and monthly budget cap.
- (−) Citations enforcement is in the response renderer — if a future refactor forgets to re-apply it, the model could answer without a slug. Add a test.
