# ADR-0010 · Design tokens — formalised palette, type scale, spacing rhythm

- **Status**: Proposed
- **Date**: 2026-05-22

## Context

The dual-mode visual language is set ([ADR-0003](0003-dual-mode-editorial-and-kitchen.md)). The token *vocabulary* — colour vars, fonts, measure, gutter — is named in `:root` at the top of `src/styles/global.css`. The token *application* is not. A grep across the codebase finds ~22 distinct `font-size` literals scattered across pages and components (`0.78rem`, `0.82rem`, `0.85rem`, `0.86rem`, `0.88rem`, `0.92rem`, `0.95rem`, `1rem`, `1.05rem`, `1.08rem`, `1.1rem`, `1.15rem`, `1.2rem`, `1.25rem`, `1.4rem`, `1.6rem`, `1.8rem`, plus four `clamp(...)` heading rules and ~10 component-local one-offs); spacing values sprawl across ~30 rem-scale literals.

This is sprawl-by-accretion: every new page is a one-off rather than a step on a shared scale. When the dishes A–Z bar (#149), lifecycle dots (#150), weighted tag cloud (#162), shopping-list view (#194), `/lifecycle` (#197), `/colophon` (#198), `/credits` (#196), `/keyboard` (#202) all introduced their own micro-decisions, each reasonable in isolation, the overall rhythm started losing the editorial discipline the dark-editorial theme was meant to embody.

The north star ([ADR-0009](0009-north-star.md)) is "walkable food archive, readable as prose, queryable as a graph". A walk should *feel* consistent — same rhythm across every node. Type and spacing sprawl breaks that.

2026 design practice points at the same thing from another angle: **design tokens as a three-layer system** (primitive → semantic → component) so a token name carries intent, not just value. Mature dark themes are designed dark-first with subtle greys for elevation, not "inverted from a light theme". A proportional type scale (4th, 5th, or "musical" major-second / minor-third ratio) keeps the eye trained as it moves down the page.

## Decision

Adopt a tighter, formalised token system in two stages: **document the canon**, then **migrate the call sites**.

### Stage 1 — the canon (this ADR)

Three layers, all expressed as CSS custom properties on `:root` in `src/styles/global.css`. Layers cascade: components read **semantic** tokens; semantic tokens reference **primitive** tokens; primitives carry raw values.

#### Colour (primitive → semantic)

Already in shape. Keep:

| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#0a0d11` | Page background (dark editorial mode) |
| `--ink` | `#faf8f4` | Primary text on dark |
| `--ink-soft` | `#c2c8d0` | Secondary text (lead, body prose) |
| `--ink-mute` | `#8b95a3` | Tertiary text (meta, captions, eyebrows) |
| `--paprika` | `#d2543b` | Editorial accent (links, emphasis, active state) |
| `--olive` | `#5d6e44` | Secondary accent + kitchen-mode primary |
| `--rule` | `rgba(250,248,244,0.08)` | Hairlines, borders |

No additions. The 7-colour palette is part of the brand; growing it loosens the dark-editorial discipline.

#### Type (proportional scale)

Replace the ad-hoc literals with a **minor-third ratio** scale (×1.2 per step) anchored at the body size. Six steps cover everything currently shipped:

| Token | Value | Purpose | Replaces |
|---|---|---|---|
| `--text-xs` | `0.78rem` | Eyebrows, kbd, meta caption | the 0.78/0.82/0.85 cluster |
| `--text-sm` | `0.92rem` | Tag chip text, dense list meta | the 0.88/0.92/0.95 cluster |
| `--text-base` | `1rem` | Body prose | itself |
| `--text-md` | `1.15rem` | Lead, large lead-in list item | the 1.05/1.08/1.1/1.15 cluster |
| `--text-lg` | `1.4rem` | Sub-section title, `h3` | the 1.2/1.25/1.4 cluster |
| `--text-xl` | `clamp(1.7rem, 3.5vw, 2.6rem)` | Section head (`h2`) | itself |
| `--text-2xl` | `clamp(2.4rem, 5.5vw, 4.4rem)` | Page hero (`h1`) | itself |

Two clamps survive because hero typography genuinely needs viewport-relative sizing — readability on a phone with one hand and presence on a 27" display are real-different needs. The rest collapses to fixed rem values.

Line-heights ride the type tokens:

| Token | Value | Pairs with |
|---|---|---|
| `--leading-tight` | `1.04` | `--text-2xl` |
| `--leading-display` | `1.18` | `--text-xl` |
| `--leading-snug` | `1.3` | `--text-lg`, `--text-md` |
| `--leading-body` | `1.55` | `--text-base` |
| `--leading-relaxed` | `1.7` | Lead paragraphs |

#### Spacing (one-axis musical scale)

Replace ~30 rem literals with a **9-step scale** following a roughly 1.3× ratio. Names follow the t-shirt convention so they're easy to read in component CSS:

| Token | Value | Common use |
|---|---|---|
| `--space-3xs` | `0.15rem` | Tag-chip vertical padding, dot offsets |
| `--space-2xs` | `0.3rem` | Eyebrow margin, tag-cloud gap-x |
| `--space-xs` | `0.5rem` | List gap, chip padding |
| `--space-sm` | `0.8rem` | Card padding, section-head gap |
| `--space-md` | `1.2rem` | Component-block padding |
| `--space-lg` | `1.8rem` | Section-internal vertical rhythm |
| `--space-xl` | `2.5rem` | Section break, group separator |
| `--space-2xl` | `4rem` | Page top/bottom padding |
| `--space-3xl` | `6rem` | Hero / 404 / index-page outer rhythm |

The existing `--gutter: clamp(1rem, 4vw, 2.5rem)` stays as a separate token because it's *horizontal-only* (page-edge gutter) and uses viewport math — keeping it distinct from the vertical scale avoids accidental cross-axis use.

#### Other primitives

Keep as-is. These don't sprawl:

- `--measure: 68ch` — paragraph max-width
- `--font-display: 'Fraunces Variable', Georgia, serif`
- `--font-body: 'Inter Variable', -apple-system, ..., system-ui, sans-serif`
- `--radius-pill: 999px` (new — chip borders use it inconsistently as `999px` literal)
- `--radius-card: 4px` (new — card borders + tile borders)
- `--radius-pop: 6px` (new — popup / modal)

### Stage 2 — migrate the call sites (follow-up PRs)

Per-component, one PR each, on a `style(<component>)` prefix. Each PR:
1. Replaces font-size / spacing / radius literals with the tokens above.
2. Confirms the rendered output is visually equivalent (these are the *existing* values, just named).
3. Touches no behaviour.

No big-bang migration. Stage-2 PRs land independently so any visual regression can be bisected to one component.

### Forward-looking

The token block is also exported as a **structured JSON** at `src/styles/tokens.json` so:
- A future design-system page (`/design-system`) can render the canon as live swatches + type samples without parsing CSS.
- A future Figma plugin or other tooling can pull the same source of truth.
- A future light mode (or a per-entry colour shift — paprika dishes, olive seasons) builds on the same primitive layer.

(`tokens.json` is *out of scope* for this ADR — it ships in stage 2 once the migration validates the token set in real use.)

## Alternatives considered

- **Tailwind v4 + utility classes.** Modern, mature, well-trodden. Rejected: foodbook's whole point is hand-written editorial; class-soup HTML works against the prose-first authoring model. Tokens-as-CSS-vars keeps the markup quiet.
- **Tachyons / classless CSS.** Would eliminate utility classes entirely but loses the ability to tune per-component without a fork. The middle road — semantic CSS vars + component-scoped CSS — is the existing pattern; we're just shrinking the vocabulary.
- **Major-second ratio (1.125×).** Tighter scale, more steps to cover the same range. Rejected: needs 8+ steps for the same coverage, harder to name memorably. Minor-third (1.2×) lands at 6 steps for foodbook's range.
- **Defer the spacing scale; just tokenise type.** Half-measure: the spacing sprawl is the larger inconsistency. If we're naming the canon, name all of it.
- **Match the [Tailwind v4 design-token spec](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/) verbatim.** Tempting for tool-interop. Rejected: their primitive layer assumes Tailwind's class names; our layer assumes plain CSS vars. Same shape, different names. Can map either way if a tool needs it.

## Consequences

- (+) Every future page or component starts from a constrained menu — six type sizes, nine spacing steps — instead of inventing one-offs. The "walkable" sensation from [ADR-0009](0009-north-star.md) extends from data to design.
- (+) The dark-editorial mode stays dark-first per 2026 practice — no light-theme inversion shortcut; light mode (if ever) gets its own primitive map.
- (+) Variable fonts (Fraunces, Inter) already loaded — no new font payload. The proportional scale just *uses* them more consistently.
- (+) `tokens.json` (stage 2) enables a self-documenting `/design-system` reference page when we want one.
- (−) Migration PRs are visually-equivalent refactors — they ship 0 user-visible change. The cost is review effort against no obvious payoff per-PR. We accept that.
- (−) Components that genuinely need an off-scale value (e.g. the leaflet map control overrides) are now explicitly off-system — must be commented as such or moved into a `--*-override` token to keep the audit honest.
- (−) Stage-2 migrations will touch files some other PRs are also editing. We coordinate by doing them one-component-at-a-time and matching the merge order of the in-flight queue.

## Adoption signals

- `tokens.json` ships in stage 2 along with the first three component migrations (header, dish-card, index-list).
- An `audit-tokens.mjs` script grows alongside `audit-tags` / `audit-coords` to surface CSS-literal sprawl that should be a token.
- New PRs reference this ADR when they introduce a new color or scale value, or get rejected with a pointer here.

---

*See also: [Penpot — using design tokens for a proportional typographic scale](https://penpot.app/blog/using-design-tokens-for-a-proportional-typographic-scale/), [Mavik Labs — design tokens in 2026](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/).*
