# Foodbook docs

Reading order, depending on what you came for.

## I'm a new contributor

1. [`/CONTRIBUTING.md`](../CONTRIBUTING.md) — what makes a dish entry on-mission, the visual + structural conventions, PR rules.
2. [`VOICE.md`](VOICE.md) — quick-reference card for the editorial voice (tone tokens + strike-on-sight phrase list + per-collection register).
3. [`AUDITS.md`](AUDITS.md) — the `audit:*` script family, what each one checks.

## I'm reviewing a PR

1. [`adr/0009-north-star.md`](adr/0009-north-star.md) §Decidability worked examples — the in-scope / out-of-scope table.
2. Then the appropriate canon ADR for what the PR touches:
   - Visual: [ADR-0010](adr/0010-design-tokens.md)
   - Motion: [ADR-0011](adr/0011-motion-tokens.md)
   - Prose: [ADR-0012](adr/0012-editorial-voice.md)
   - Accessibility: [ADR-0013](adr/0013-accessibility-commitments.md)
3. Cite the specific § the PR satisfies (or breaks) in your review.

## I want to understand the system

1. [`architecture.md`](architecture.md) — current state: directory layout, content model, dev workflow, deploy flow.
2. [`PROCESS.md`](PROCESS.md) — the ADR → canon → audit → CI → issue loop the project uses to land each decision.
3. [`adr/README.md`](adr/README.md) — chronological log of every meaningful technical decision.
4. [`ai-first.md`](ai-first.md) — where AI is and isn't allowed.

## I'm picking the next thing to work on

1. [`feature-wishlist.md`](feature-wishlist.md) — backlog of speculative ideas (no commitment).
2. GitHub issues filtered by label.
3. ADR §Deferred tables — each ADR's open work is tracked there.

## Index of every doc

| File | Purpose |
|---|---|
| [`/CONTRIBUTING.md`](../CONTRIBUTING.md) | Contributor entry point. |
| [`architecture.md`](architecture.md) | Snapshot of the current system. |
| [`PROCESS.md`](PROCESS.md) | Meta — the loop every ADR lands. |
| [`VOICE.md`](VOICE.md) | Quick reference — editorial voice. |
| [`AUDITS.md`](AUDITS.md) | Quick reference — audit scripts. |
| [`ai-first.md`](ai-first.md) | AI-assistance posture (refs ADR-0004). |
| [`brainstorm.md`](brainstorm.md) | Idea space, not commitments. |
| [`feature-wishlist.md`](feature-wishlist.md) | Backlog of speculative ideas. |
| [`adr/`](adr/) | One ADR per meaningful decision. |
