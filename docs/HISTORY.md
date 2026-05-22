# History — major iterations

What shipped each iteration and why, so future-me can read backward.

## Iteration 2 — design + purpose (2026-05-22)

**Goal:** Codify the implicit voice across visual, motion, prose, and accessibility dimensions. Name a north star. Give every dimension an enforceable auditor.

**Output:** ~80 PRs across 5 voice ADRs, full token systems, 10 audit scripts, CI integration, 6 reference docs, 13 tracked follow-up issues.

**The five voice ADRs:**

| Voice | ADR | What it names |
|---|---|---|
| Purpose | 0009 | "Foodbook is a walkable food archive — readable as prose by humans, queryable as a graph by agents — where every dish's lineage runs backward to soil and forward to table in both directions." |
| Look | 0010 | 7-colour palette · 7-step minor-third type scale · 9-step musical spacing scale · 3 radius primitives |
| Move | 0011 | 4 duration tokens (120ms / 200ms / 400ms / 2400ms) · 3 easing tokens · canonical reduced-motion contract |
| Sound | 0012 | 5 prose-posture tokens (--tone-confident / --tone-specific / --tone-honest / --tone-anecdotal / --tone-minimal-jargon) · anti-pattern list · per-collection register matrix |
| Reach | 0013 | WCAG 2.2 AA baseline · 6-point maintainer's contract · deferred-table for known gaps |

**The methodology** (codified in `PROCESS.md`): each ADR earns a canon in code, an audit script that mechanises enforcement, npm + CI wiring, and tracked follow-up issues for deferred items. Documented because the pattern is reusable for future dimensions (an eventual ADR-0014 on the topic of its choice should plug into the same shape).

**Key tracking artefacts:** [#300](https://github.com/laichunpongben/foodbook/issues/300) PR catalogue · [#301](https://github.com/laichunpongben/foodbook/issues/301) graduation criteria · [#309](https://github.com/laichunpongben/foodbook/issues/309) next-session RFC · [#312](https://github.com/laichunpongben/foodbook/issues/312) issue-PR map.

---

## Iteration 1 — UX + features (2026-05-22)

**Goal:** Evolve the foodbook reader surface continuously.

**Output:** ~50 PRs across navigation, discovery, machine-readable surfaces, editorial tooling.

**Headline deliveries:**

- **Reader navigation** — A–Z jump bar on /dishes; lifecycle dots on dish hero (Source · Grow · Cook · Eat); recipes grouped by meal-type; tags grouped by kind on /tags/<tag>; weighted tag cloud on /tags; country grouping on /restaurants; A11y-aware 404 with tag chips + /recent + /tags links.
- **New routes** — /recent (cross-collection timeline), /random + /random/recipe (discovery), /credits (photo attribution), /lifecycle (concept explainer), /colophon (tech credits), /keyboard (shortcut reference), /search (OpenSearch-discoverable), /design-system (token reference), /recipes/<slug>/shopping (printable list).
- **Machine-readable surfaces** — RSS recipe pubDates; JSON Feed 1.1 (/feed.json); /llms.txt "Recent" section + /llms-full.txt verbose corpus; /sitemap.txt + /sitemap.json; OpenSearch description; the full `/api/*.json` set (index, dishes, recipes, farms, restaurants, garden, meals, tags, world, seasonal, all, stats).
- **PWA + SEO** — webmanifest shortcuts; humans.txt; robots.txt enhancements; COOP + CORP security headers; multiple `_redirects` cleanups; site-wide canonical metadata.
- **Editorial tooling** — audit-tags / audit-coords / audit-api scripts; cuisine-enum expansion (Korean, Vietnamese, Filipino, +17); Korean dish retagging batch; countTags + countTagsByKind helper with vitest cases.

**Tracking:** all PRs catalogued in the open-PR list from this iteration (not consolidated into a single issue — the work was more dispersed than iteration 2).

---

## Conventions

- Each entry leads with goal + output sizing, then headline deliveries.
- Cross-link to tracking issues where they exist; PR-by-PR enumeration lives in those issues, not here.
- Update at the end of each substantive iteration. Append, don't rewrite — this is an append-only log.
