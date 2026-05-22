# ADR-0012 · Editorial voice — codifying the prose register

- **Status**: Proposed
- **Date**: 2026-05-22

## Context

[ADR-0010](0010-design-tokens.md) and [ADR-0011](0011-motion-tokens.md) codified the *visual* voice — palette, type scale, spacing, motion. The *editorial* voice has been implicit: every existing dish entry, every ADR, every CONTRIBUTING.md sentence has been written in a recognisable register, but the register has never been named.

This matters because:

1. Future contributors (the author six months from now, another agent on the project) need a yardstick. CONTRIBUTING.md says "the editorial voice is the author's" — that's true for *what* gets written but doesn't help anyone match the *tone* of what's already there.
2. The north star ([ADR-0009](0009-north-star.md)) says foodbook is "readable as prose by humans, queryable as a graph by agents". The graph half has audit scripts policing consistency. The prose half doesn't.
3. AI-assisted authoring ([ADR-0004](0004-ai-first-integration-points.md)) makes it easy to produce prose that *looks* correct but reads off. A named voice gives the maintainer something to push against when reviewing AI-drafted text.

The visual tokens in ADR-0010 worked because they took values already in use across the codebase and named them. The same approach applies here: read the existing dish entries, name what's recurring, surface it.

## Decision

Name **five posture tokens** for the prose voice. Like the visual tokens, each token has a value (what it sounds like), a use site (where it shows up), and an "off-tone" escape hatch (when a deliberate deviation is fine).

### Posture tokens

| Token | Value | Where it shows up |
|---|---|---|
| `--tone-confident` | Plain assertion, no hedging. "Carbonara either *works* or you eat eggs." Not "Carbonara tends to be tricky." | Dish taglines, dish prologue, anywhere a claim is being made. |
| `--tone-specific` | Concrete nouns, named quantities, named places. "Guanciale from a Roman butcher, pecorino in wedges, eggs from a local market" — not "good ingredients sourced locally". | Lifecycle stage notes, recipe ingredient lines, restaurant signature lines. |
| `--tone-honest` | When something is uncertain or sparse, say so. "Origin not yet authored" is preferred over a fabricated provenance. | Empty states, gaps in lifecycle stages, "discovered via" attributions. |
| `--tone-anecdotal` | One concrete sentence preferred over an abstract paragraph. The dish-page finale that lands a memory ("Each diner has a small bowl of sesame oil...") beats a closing summary. | Bookend prose (prologue / finale), restaurant visit notes, garden bed notes. |
| `--tone-minimal-jargon` | Cooking-craft terms (mise en place, sofrito, brunoise) are allowed and welcomed; AI/product jargon (leverage, ecosystem, paradigm, surface area when not literal) is not. | All prose. |

### Anti-patterns

The matching list of things the voice is *not*. Each is a real failure mode the maintainer has caught in AI-assisted drafts.

- **Hedging.** "It's worth noting that..." / "One could argue..." → strike. State the thing.
- **Listicle structure in prose.** "There are three things..." in a paragraph that should be one sentence. Either use a real `<ul>` or commit to a single sentence.
- **Throat-clearing openers.** "When it comes to ragù..." / "In the world of pasta..." → strike. Open in medias res.
- **Adverb stack.** "Surprisingly tender, almost impossibly delicate, remarkably complex." → cut to one adjective if any.
- **Implicit narrator presence.** "I think this dish is special" / "for me, the key is..." — the author's voice is *embedded* in the writing, not narrated.
- **AI-tic phrases.** "Delve into" / "navigate the world of" / "rich tapestry of" / "in conclusion". Strike on sight.

### Per-collection register guidance

| Collection | Register | Length target |
|---|---|---|
| Dish prologue | Set the scene with one specific observation. May contain inline `<em>`. | 2-4 sentences. |
| Dish stage `note` | Concrete factual provenance. No metaphor. | 1-2 sentences. |
| Dish finale | Land on a remembered moment or a held opinion. | 2-3 sentences. |
| Recipe step | Imperative. Times in minutes. Specific temperatures. | 1-2 sentences per step. |
| Recipe notes | Departures, substitutions, "if you don't have X" guidance. | 3-6 sentences total. |
| Restaurant `signature` | Name the dish that earned the entry. | 1 sentence. |
| Restaurant visit note | One specific thing remembered, no general impression. | 1-2 sentences. |
| Farm note | Geography, scale, technique. | 2-3 sentences. |
| Garden `yieldNote` | Quantity + brief outcome. | 1 sentence. |

## Alternatives considered

- **No codification — voice stays implicit.** Status quo. Works as long as the maintainer reviews every commit. Breaks the moment AI-drafted PRs enter the queue (which they will, per ADR-0004). Decision matrix is the line of defence.
- **A single sentence ("write like an opinionated cookbook author").** Punchy but doesn't help in PR review — too subjective. The token-style structure gives reviewers something to point at.
- **Style guide as prose essay.** More flexible than a token list but harder to wield. The token format is intentionally rule-shaped so a reviewer can say "this fails `--tone-specific`" and the author knows exactly what to fix.
- **Borrow an existing voice guide** (NYT manual, BBC house style). Too generic. Those are journalistic; Foodbook is editorial-personal.

## Consequences

- (+) Reviewer + AI both have a yardstick. "This sentence hedges, see ADR-0012 `--tone-confident`" is a faster review note than re-explaining tone from scratch.
- (+) New collection types (eventual `events/` or `producers-extended/`) inherit the matrix instead of inventing per-page registers.
- (+) The CONTRIBUTING.md voice section becomes a one-line link to this ADR rather than re-stating principles.
- (−) The matrix risks formulaic prose if applied mechanically. Off-tone escape hatches exist (a finale that doesn't follow the "remembered moment" pattern is fine if the deviation is deliberate); the ADR is a guide, not a gate.
- (−) Tone-related lint rules (e.g. flagging "delve into" automatically) are tempting but out of scope. Heuristic word-banlist scripts produce false positives often enough that human review stays the gate.

## Adoption signals

- `CONTRIBUTING.md` "What we don't accept in a dish entry" section collapses into a one-liner pointing here.
- A future `scripts/audit-prose.mjs` (out of scope here) could surface entries where the tagline exceeds N words, where a dish prologue lacks an `<em>` etc — mechanical guardrails for the editorial bar.
- AI-assisted drafts under `src/content/recipes/_drafts/` get a header comment naming the relevant tokens before authoring.

---

*Companion to [ADR-0010](0010-design-tokens.md) (visual tokens) and [ADR-0011](0011-motion-tokens.md) (motion tokens). Together the three name what foodbook **sounds**, **looks**, and **moves** like.*
