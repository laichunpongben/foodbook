# Maintenance — when to run what

Quick reference for the maintainer (and future agents). Each audit / inspection script has a different useful cadence — running them all every push burns time; running none lets drift accumulate.

## Daily

Nothing required. CI runs the advisory audit step on every push.

## After authoring 1+ dish entries

```sh
npm run audit:lineage      # confirm new entries meet the 2/4-stage floor
npm run audit:prose        # catch AI-tic phrases before they ship
npm run audit:tags         # tag consistency
```

Especially when the entry was AI-assisted — the prose audit catches the obvious giveaways.

## After authoring 1+ farm / restaurant entries

```sh
npm run audit:coords       # coordinate sanity
npm run audit:photos       # hero photo health
```

## After touching .css / .astro components

```sh
npm run audit:tokens       # spacing + type sprawl
npm run audit:radii        # border-radius sprawl
npm run audit:motion       # transition / animation sprawl
```

Stage-2 migration pattern: one file per PR, off-flag markers for intentional out-of-canon. See [ADR-0010](adr/0010-design-tokens.md) and [ADR-0011](adr/0011-motion-tokens.md).

## After touching anything user-facing

```sh
npm run audit:a11y         # heuristic checks: img alt, focus indicator
```

Plus run Lighthouse in DevTools on the changed page when [issue #285](https://github.com/laichunpongben/foodbook/issues/285) hasn't landed yet.

## Before a content-heavy push

```sh
npm run audit:all          # everything in one shot (advisory)
npm run graph -- --stats   # walkable-graph health: edge counts, top targets
```

The `--stats` output catches editorial drift like the salt-pan over-provenance pattern surfaced as [issue #291](https://github.com/laichunpongben/foodbook/issues/291).

## Monthly (or whenever the editorial drift feels real)

```sh
npm run graph -- --stats
```

Look at:
- **Top inbound targets** — any producer ref appearing in > 30% of dishes is likely over-claimed; sweep with the producer's authoring lens.
- **By-kind distribution** — grow stage should grow over time; static = under-tracing.
- **Top outbound dishes** — dishes with 7+ refs are fully traced; dishes with 2 refs are half-traced (see audit-lineage).

## When publishing a new ADR

Per [`PROCESS.md`](PROCESS.md): name the canon, publish in code (if applicable), write an audit, wire npm + CI, file deferred-table follow-up issues.

## When a CI advisory step fails

Don't ignore — `continue-on-error: true` means the step *passes* but the audit *failed*. Read the workflow log group named after the failed audit. Fix or file an issue with the finding.

## When `audit-strict.yml` (gated audits) fails

This *will* block the merge. Either fix the drift or add an `off-<dimension>:` marker if the deviation is intentional. Don't bypass.

---

See also: [`AUDITS.md`](AUDITS.md) — script reference card. [`PROCESS.md`](PROCESS.md) — the loop each audit lives in.
