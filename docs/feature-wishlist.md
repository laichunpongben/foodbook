# Feature wishlist

Open + deferred backlog. Scored against the project's shape:

- **fit** — does this match the "private editorial archive" identity?
- **effort** — rough sizing.
- **leverage** — how much it improves the daily authoring or reading experience.

When something here ships, move it to `architecture.md` and update the relevant ADR.

| Idea | fit | effort | leverage | Notes |
|---|---|---|---|---|
| Dish entry MVP — four lifecycle stages | high | M | high | The spine. Ship first. |
| World food map | high | M | medium | Reuse Travelbook map module heavily. |
| Recipe MDX + cook mode | high | M | high | Big reader-side win; the only feature that gets used *while* the user has wet hands. |
| Seasonal wheel | high | S | medium | Original to Foodbook; gives the homepage a strong third surface beyond landing + map. |
| AI extract from URL/photo | high | M | high | Biggest authoring multiplier. Lead AI feature. |
| AI reader chat (RAG) | medium | M | medium | Cool, but only valuable past ~30 entries. Defer 'til content exists. |
| Cook-mode voice coach | high | M | high | Differentiating UX. Web Speech API is shaky on Safari; budget time for it. |
| Provenance graph SVG | medium | S | low | Nice-to-have visualisation; do once we have ~5 farms linked. |
| Garden log | high | S | medium | Personal use; ship once a garden bed exists IRL. |
| Pantry "what to cook" | medium | M | medium | Needs garden + pantry + recipes — defer until two are populated. |
| Plate map (hotspot polygons on dish hero) | medium | L | low | Cool but slow to author. Try once. |
| Ingredient terroir registry (sidecar API per #60) | high | M | high | 118 dishes is 6× past the original "premature" threshold. Pending #60 decisions; favored shape is a separate repo (`almanac`) exposing `/terroir/:species`, `/seasonality/:species`, consumed by Foodbook via per-ingredient chips. |
| Wine / sake / pairing entries | low | M | low | Separate spine; revisit if content emerges. |
| Cookware diary | low | S | low | Not enough content. |
| Email digest (monthly meal summary, AI-drafted) | low | M | low | Personal use; nice if it lands automatically. |
| ICS export for planned meals / dinner parties | medium | S | low | Travelbook has this for trip dates; could mirror. |
| Public landing page redesign | medium | M | low | Default to Travelbook's pattern; revisit once the rest exists. |

## Shipped this iteration (move to `architecture.md`)

The design+purpose pivot landed (see [tracking issue #300](https://github.com/laichunpongben/foodbook/issues/300)):

- **Five voice ADRs** — ADR-0009 (north star), ADR-0010 (visual tokens), ADR-0011 (motion tokens), ADR-0012 (editorial voice), ADR-0013 (a11y commitments).
- **Token canon** — `:root` + `tokens.json` for palette / type / spacing / radii / motion.
- **Auditors** — `audit:lineage`, `audit:tokens`, `audit:radii`, `audit:motion`, `audit:prose`, `audit:a11y`, plus operational `audit:tags`, `audit:coords`, `audit:photos`, `audit:api`, plus the graph viewer `npm run graph`.
- **Tooling** — `audit:all` runner, advisory CI step, separate `audit-strict.yml` workflow for graduated gates.
- **Reference docs** — `CONTRIBUTING.md`, `docs/VOICE.md`, `docs/AUDITS.md`, `docs/PROCESS.md`, `docs/README.md`.

When the PRs from this iteration merge, this section moves into `architecture.md` per the standing rule above.

## Explicitly *not* on the list

- Public comments, ratings, likes.
- Affiliate links, monetisation.
- Reservations (Resy exists).
- Social feed (Instagram exists).
- Mobile-native app — PWA installable is enough; native app is years premature.
- AI-generated recipes shown as if authored.
- Algorithmic discovery / "recommended for you" carousels — see [ADR-0009 §Out of scope](adr/0009-north-star.md).
- Multi-author editing — single-author by design per [ADR-0005](adr/0005-public-by-default-no-private-tier.md); collaboration via PRs.
- Supply-chain traceability — [ADR-0009 §Out of scope](adr/0009-north-star.md) makes the distinction: foodbook traces lineage for *meaning*, not for compliance audit.
