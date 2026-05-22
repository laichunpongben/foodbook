# Voice — quick reference

A one-page card for prose review. The full register lives in [ADR-0012](adr/0012-editorial-voice.md).

## The five tokens

| Token | Reach for it when… |
|---|---|
| `--tone-confident` | Stating a claim. No hedging. |
| `--tone-specific` | Naming ingredients, places, quantities. |
| `--tone-honest` | Calling out a gap, an uncertainty, a substitution. |
| `--tone-anecdotal` | Closing a section with a remembered moment. |
| `--tone-minimal-jargon` | Cooking terms = fine. Product jargon = strike. |

## Strike on sight

Phrases the prose voice rejects:

- "delve into" · "navigate the world of" · "rich tapestry" · "in conclusion"
- "it's worth noting" · "one could argue" · "needless to say"
- "when it comes to X" · "in the world of X"
- "leverage" · "ecosystem" · "paradigm" (when used metaphorically)
- "embark on a journey" · "unlock the secrets" · "dive deep" · "at the end of the day"
- Adverb stacks: two or more of *remarkably / surprisingly / incredibly / impossibly / extraordinarily* in the same sentence.

`npm run audit:prose` surfaces these mechanically. False positives happen; the script is advisory.

## Per-collection register

| Field | Length | Posture |
|---|---|---|
| Dish `tagline` | 1 line | A posture, not a description. |
| Dish prologue | 2–4 sentences | One specific observation. |
| Dish stage `note` | 1–2 sentences | Concrete provenance. No metaphor. |
| Dish finale | 2–3 sentences | A remembered moment. |
| Recipe step | 1–2 sentences | Imperative. Minutes. Temperatures. |
| Recipe `notes` | 3–6 sentences | Departures + "if you don't have X". |
| Restaurant `signature` | 1 sentence | Name the dish. |
| Restaurant visit note | 1–2 sentences | One specific thing remembered. |
| Farm `note` | 2–3 sentences | Geography, scale, technique. |
| Garden `yieldNote` | 1 sentence | Quantity + outcome. |

## Two examples — before / after

**Before** (AI-tic):
> When it comes to carbonara, it's worth noting that this dish is surprisingly tricky to execute well. One could argue that the key lies in mastering the emulsion technique.

**After** (Foodbook voice):
> *Carbonara either works or you eat eggs.* The pan goes off the heat before the egg goes in — that's the whole trick.

---

Why a separate file? At-a-glance during review is faster than re-loading the full ADR. Both stay in sync — this card is a strict subset of the ADR-0012 content.
