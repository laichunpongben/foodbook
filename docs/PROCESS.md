# Process — how a decision becomes enforced

The pattern that's emerged across ADRs 0009–0013. Documented here so the next ADR (whichever dimension it names) inherits the same shape instead of reinventing it.

## The five-step loop

```
   1. ADR              names the canon — what's in, what's out, with worked examples.
        ↓
   2. tokens / schema  publishes the canon in code so it can be referenced.
                       (CSS :root vars, tokens.json, schema enum, etc.)
        ↓
   3. audit script     mechanises the canon — flags sprawl, surfaces drift.
                       Heuristic; advisory by default; `--strict` mode for CI.
        ↓
   4. npm + CI wiring  one-command access locally, log surface on every PR.
        ↓
   5. follow-up issues convert findings into tracked editorial / engineering work.
```

Each step has a recognisable file:

| Step | File pattern |
|---|---|
| ADR | `docs/adr/NNNN-<slug>.md` |
| Canon | `:root` block in `src/styles/global.css`, `src/styles/tokens.json`, or `src/content.config.ts` |
| Audit | `scripts/audit-<dimension>.mjs` |
| Wiring | `package.json` `scripts:` + `.github/workflows/ci.yml` advisory step |
| Follow-ups | GitHub issues citing the ADR §number |

## Current loops

| Dimension | ADR | Canon | Audit | Issues |
|---|---|---|---|---|
| Purpose (north star) | 0009 | n/a | `audit-lineage.mjs` | — |
| Visual — palette/type/spacing | 0010 | `tokens.json` §color/text/space + `:root` | `audit-tokens.mjs` | — |
| Visual — radii | 0010 | `tokens.json` §radius | `audit-radii.mjs` | #287 (resolved) |
| Motion — durations/easings | 0011 | `tokens.json` §motion + `:root` | `audit-motion.mjs` | — |
| Editorial voice | 0012 | (prose, no code canon) | `audit-prose.mjs` | #293 |
| Accessibility | 0013 | (maintainer contract, no code canon) | `audit-a11y.mjs` | #283 / #284 / #285 / #286 |
| — operational | n/a | content schemas | `audit-tags` / `audit-coords` / `audit-photos` / `audit-api` | — |

## When you propose a new dimension

1. Write the ADR. Cite ADRs already in the same shape (0010/0011/0012/0013 all follow the same skeleton).
2. Publish the canon in code if it has a code surface; otherwise the ADR text *is* the canon.
3. Write the audit script — heuristic is fine, `--strict` flag for CI gating later.
4. Wire npm + CI advisory step.
5. File issues for the ADR's `§Deferred` table items so they're not just promises.

This file is itself an artefact of step 1 → it doesn't have an ADR yet because the process is the meta-pattern, not a load-bearing decision. If it gets contentious enough to need an ADR (e.g., someone proposes a different shape), promote it.

## Anti-patterns to avoid

- **ADR without canon** — words without code. The audit can't enforce something the codebase doesn't name.
- **Canon without audit** — silently rots. ADR-0010 had this problem for a week between #235 (publication) and #239 (audit).
- **Audit without CI step** — gets forgotten. Always wire to npm + CI advisory, even if `continue-on-error: true`.
- **Strict gate too early** — fails CI on legitimate borderline cases. Stay advisory until the false-positive rate is < 5%.
- **Issue list that grows without closing** — file follow-ups, but also resolve them. Track the close rate.

---

*Documenting this loop is itself adoption of the loop. Each future ADR cites this file; each adjustment to the loop edits this file.*
