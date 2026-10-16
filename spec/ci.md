# Module: ci

Depends on: nothing. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Nothing checks a PR today. Because production database changes happen only after merge, CI must prove before merge that the code builds, the tests pass and every migration applies to a fresh database.

## Scope

Task 2 in `tasks/todo.md`, extended with a database job.

## Decisions

- GitHub Actions workflow `.github/workflows/ci.yml` on pull requests and pushes to `main`, one workflow named "CI" with two jobs:
  - **checks:** `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` with placeholder public Supabase env vars (no secrets in CI).
  - **database:** Supabase CLI on the runner's Docker: start a local database from the migrations, then `npx supabase test db`.
- Add a `typecheck` script (`tsc --noEmit`) to `package.json`.
- Cache npm; no deploy steps.

## Success Criteria

- [ ] Every PR shows the CI workflow with both jobs.
- [ ] A deliberately failing test turns `checks` red; a deliberately broken migration turns `database` red.
- [ ] CI needs no repository secrets.
- [ ] Branch protection on `main` requires both jobs (a GitHub setting; a repository admin turns it on).

## Production Steps After Merge

A repository admin enables branch protection on `main` requiring the CI jobs.

## Out of Scope

Preview deployments, coverage gates, end-to-end tests.
