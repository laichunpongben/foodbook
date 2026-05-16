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
| Static search (Pagefind) | medium | S | medium | Wait 'til ~50 entries. |
| Public landing page redesign | medium | M | low | Default to Travelbook's pattern; revisit once the rest exists. |

## Explicitly *not* on the list

- Public comments, ratings, likes.
- Affiliate links, monetisation.
- Reservations (Resy exists).
- Social feed (Instagram exists).
- Mobile-native app — PWA installable is enough; native app is years premature.
- AI-generated recipes shown as if authored.
