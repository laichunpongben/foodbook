# Audits — quick reference

Each `audit:*` script polices one dimension named by an ADR. All advisory by default; `--strict` flips to exit-1 on findings (suitable for CI gates, see [audit-strict.yml](../.github/workflows/audit-strict.yml)).

## The family

| Script | What it checks | ADR | Output shape |
|---|---|---|---|
| `audit:lineage` | Dishes with under 2/4 lifecycle stages covered. | [0009](adr/0009-north-star.md) | `[S··E] Adobo  …` |
| `audit:tags` | Entries without tags · dishes/recipes missing meal-type or cuisine. | (operational) | Per-rule lists |
| `audit:coords` | Out-of-range / Null Island / low-precision / duplicate lat·lng. | (operational) | Per-rule lists |
| `audit:tokens` | Spacing + type literals not on the ADR-0010 scale. | [0010](adr/0010-design-tokens.md) | `file:line  font-size: 1.05rem  (between 1rem → 1.15rem)` |
| `audit:radii` | `border-radius` literals not on the ADR-0010 canon. | [0010](adr/0010-design-tokens.md) | `file:line  10px` |
| `audit:motion` | `transition` durations not on the ADR-0011 canon. | [0011](adr/0011-motion-tokens.md) | `file:line  0.3s  (nearest 200ms)` |
| `audit:prose` | AI-tic phrase banlist + adverb stacks from ADR-0012. | [0012](adr/0012-editorial-voice.md) | `file:line  [banlist]  "delve into"` |
| `audit:a11y` | `<img>` without alt, `outline: none` without `:focus-visible`. | [0013](adr/0013-accessibility-commitments.md) | `file:line  [ADR-0013 §5]  …` |
| `audit:photos` | Hero photo health (existence, dimensions). | (operational) | Per-photo report |
| `audit:api` | Built `/api/*.json` endpoint envelope conformance. | (operational) | Pass/fail per endpoint |

Plus the viewer:

| Script | What it shows |
|---|---|
| `npm run graph` | Every cross-collection ref grouped by source dish. `--stats` adds top-N targets. |

## Run everything

```sh
npm run audit:all
```

Sequential: tags → coords → lineage → tokens → radii → motion → prose → a11y. Exit-0 on success of *every* script; non-zero only if a script crashes (not on advisory hits).

## When to skip the marker

Each off-scale value can carry a `/* off-scale: */`, `/* off-radius: */`, `/* off-motion: */` comment naming the nearest token. The audits skip pre-flagged lines. Use markers when:

- The value is genuinely off-canon by design (e.g. WCAG 2px focus indicator, geometric 50% circles).
- Rounding to the nearest canon value would shift visuals.

Don't use markers to suppress sprawl. The marker is an *explanation*, not a *silencer*.

## Conventions for new scripts

When you write the next audit:

1. Name it `scripts/audit-<dimension>.mjs`.
2. Default `process.exit(0)` (advisory); `--strict` flag for the gating mode.
3. Print `Audited N files. Findings: M` summary as first line.
4. Each finding: `  <file>:<line>  <token-or-rule>  <detail>`.
5. Recognise an `off-<dimension>:` comment marker on the same line — pre-audited, skip.
6. Add to `npm run audit:all`.
7. Wire into the advisory CI step in `ci.yml`.
8. Document here.

See [`docs/PROCESS.md`](PROCESS.md) for the broader ADR → audit → CI loop.
