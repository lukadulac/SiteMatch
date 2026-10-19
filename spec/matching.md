# Module: matching

Depends on: provider-taxonomy. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Providers browse every open brief and clients browse every provider; nothing suggests a good fit. The "How you match" section on `/jobs/[id]` is a placeholder. This module scores brief–provider fit and uses it in three places.

## Scope

Tasks 16–18 in `tasks/todo.md`.

## Decisions

- **Score on read.** A pure, unit-tested `scoreMatch(brief, provider)` in `lib/matching/score.ts` returns 0–100 plus a per-signal breakdown. The `matches` table stays unused until scale or status tracking needs it.
- **Signals:** service type, feature capabilities weighted by strength, goals, business domain, language, budget fit, provider type, scope. Weights live in one commented constant.
- Candidates are narrowed in SQL first (open briefs, or active and available providers sharing at least one service type), then scored in code.
- Reasons shown to users come from the breakdown, in plain words ("Builds booking flows (expert)").

## Success Criteria

- [ ] `scoreMatch` is deterministic, stays within 0–100, and has tests for each signal, missing data and a perfect match.
- [ ] The provider dashboard shows the top five open briefs with reasons; `/jobs/[id]` shows the signed-in provider's real breakdown.
- [ ] `/oglasi/[id]` shows the client the top five available providers sharing a service type, linking to Find Talent.
- [ ] Inactive and unavailable providers, and the client's own or closed briefs, never appear.
- [ ] With no taxonomy filled in, each surface shows an empty state that explains why.

## Production Steps After Merge

None (no schema change expected). Spot-check ten real pairs and tune the weights.

## Out of Scope

Persisting matches, inviting a suggested provider, machine-learned ranking.
