# ADR-0005 · Public by default; `unlisted` (noindex) instead of an auth-gated private tier

- **Status**: Accepted
- **Date**: 2026-05-13

## Context

Travelbook (the sibling project) splits content into `visibility: public` and `visibility: private`, with `/private/*` gated behind Cloudflare Access. The repo itself is private. That works because: (a) trip plans contain hotel confirmation numbers, flight reservations, real travel dates with a real address pin, all of which are sensitive; (b) the private repo can hold those without leaking them to anyone with the URL.

Foodbook is different on both axes:

- The GitHub repo is **public**. Everything in MDX gets indexed by anyone with `git clone`. Putting "sensitive" content in MDX and hoping a route guard hides it is a fake guarantee — the data is already public.
- Foodbook's "sensitive" surface is narrower: a few personal details (companion names in meal entries, exact home garden coordinates, possibly home address). The right move is to **keep those out of the repo entirely**, not gate them behind auth.

But not every entry deserves to be on the homepage. Draft entries, half-cooked recipe ideas, and meals that are too niche for the front page still want a stable URL for direct linking.

## Decision

Two visibility states, no auth-gated tier:

- **`visibility: 'public'`** (default) — entry renders at its slug *and* appears in listing pages (`/`, `/world`, `/seasons`), sitemap, RSS, and the related rail.
- **`visibility: 'unlisted'`** — entry renders at its slug, but is excluded from listings, sitemap, RSS, and the related rail. Page emits `<meta name="robots" content="noindex,nofollow">`. Direct links work; discovery does not.

No `/private/*` namespace. No Cloudflare Access. The codebase has zero auth concept for content.

### Authoring rules

Anything that should not be in a public repo does **not** enter the repo:

- Real names of family members / dining companions → use first-name initials or skip.
- Home address / home garden coordinates → omit; if a garden entry needs a location, use the nearest neighbourhood, not coordinates.
- Restaurant reservation confirmation numbers, payment data → never.
- Private opinions about a real restaurant that you wouldn't say in public → don't write them at all.

A pre-commit hook (`scripts/check-no-leaks.sh`) greps the staging diff for obvious patterns (phone numbers, common confirmation-code formats, the strings `home_lat`/`home_lng`) and refuses the commit if it matches.

### Authoring CLI

`scripts/new-*.sh` scaffolds default to `visibility: 'public'`. The scaffolds use generic placeholder names like `Example Producer Ltd` so an unedited stub is obviously a placeholder, not a real entry.

## Alternatives considered

- **Mirror Travelbook's public/private + Cloudflare Access model** — overkill for a public repo. Auth in front of MDX whose contents are visible on `git clone` is theatre.
- **`unlisted` + optional auth-gated `private`** for the rare truly sensitive case — adds complexity for a vanishingly small use case. Better to keep sensitive content out entirely.
- **No `unlisted` at all** — every committed entry surfaces on the homepage. Bad for drafts and half-baked ideas.

## Consequences

- (+) Codebase has no auth concept — fewer moving parts, no Cloudflare Access dependency.
- (+) Open repo is a feature, not a liability: visitors can read the schema, fork the engine, etc.
- (+) `unlisted` handles the soft case (drafts, niche entries) without inventing privacy.
- (−) Authoring discipline required — easy to accidentally type a real name. Mitigated by the pre-commit grep.
- (−) Cannot store anything genuinely confidential at all. Acceptable — that's not what this archive is for.
