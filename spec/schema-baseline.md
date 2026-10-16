# Module: schema-baseline

Status: done on `feat/daddy-is-here` (commit `31d8099`). Shared rules: [SPEC.md](../SPEC.md).

## Objective

Production was built through the SQL editor, so no migration created the base tables, their RLS, or six RPCs the app calls (`accept/reject/withdraw_project_application`, `auth_rate_limit_check/record_attempt/reset`). A fresh database could not be built from the repository. This module makes `supabase/migrations/` reproduce production.

## Scope

Task 1 in `tasks/todo.md`.

## Decisions

- The baseline (`20260901000000_baseline_schema.sql`) is a `supabase db dump` of production minus every object the five later migrations create, so those migrations run unchanged after it.
- `pg_dump` omits revokes of Supabase's default grants, so the baseline revokes `auth_rate_limits` from `anon` and `authenticated` explicitly.
- `seed.sql` holds the taxonomy reference data only (service types, domains, goals, feature tags, categories). No user data.
- Local auth config mirrors production: confirm email on, the custom confirmation template, `http://localhost:3000` redirects.

## Success Criteria

- [x] `npx supabase db reset` applies every migration and the seed without errors.
- [x] A schema dump of the rebuilt local database matches the production dump, except column order in `provider_service_listings`, two constraints validated locally instead of `NOT VALID`, whitespace, and the local-only `pg_graphql` extension.
- [x] Every `rpc()` the app calls is defined in a migration (`tests/unit/migrations-define-rpcs.test.ts`).
- [x] `types/supabase.ts` regenerated from the local database; structural diff reviewed.
- [ ] Browser check on the local stack: register → confirm → log in → post brief → apply → accept.

## Production Steps After Merge

Mark the baseline and the five SQL-editor migrations as applied, so `db push` never replays them:

```
npx supabase migration repair --status applied 20260901000000 20260902114500 20260910100000 20260915120000 20260925100000 20260930110000
```

## Out of Scope

Fixing the security issues the dump exposed; that is `security-hardening`.
