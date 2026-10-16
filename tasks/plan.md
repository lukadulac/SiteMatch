# Implementation Plan: SiteMatch Roadmap

Spec: `SPEC.md` (shared rules, capability map, decisions) and `spec/<module-id>.md` per module.
Task details with acceptance criteria: `tasks/todo.md` (each task names its module).
Shared doc (the version the team reads and comments on): https://claude.ai/code/artifact/50b6acec-3076-48e1-999b-dfb79f508577. It predates the spec; `SPEC.md` wins where they differ.

## Overview

30 tasks across 12 modules take SiteMatch from two hiring flows that stop at "accepted", on a database with known security holes, to a marketplace that is safe, finishes hires, collects reviews, notifies people and matches clients with providers. Phase 1 goes first: a reproducible database (done), the security fixes, CI and password reset.

## Architecture Decisions

- **Migrations only, local first.** The schema changes only through migrations, developed and tested on the local stack. Production gets them after merge to `main` (`migration repair` once for the baseline, then `db push`).
- **Database tests in pgTAP.** RLS policies and RPCs are tested with `npx supabase test db`, including denied cases; CI runs them on a fresh database.
- **Security fixes keep app behaviour.** Column-level grants and triggers narrow what users can write to exactly what the app does today (see `spec/security-hardening.md`).
- **Project hires reuse workrooms.** Extend `service_workrooms` with nullable `application_id` / `project_id` (check: exactly one source) instead of a second table.
- **The provider completes a hire.** Completing a project workroom completes the project; no client confirmation in v1.
- **Reviews key on the workroom.** One review per completed workroom, client to provider, via a security-definer RPC that recomputes `average_rating` / `total_reviews`. Public, with the reviewer's first name copied onto the review.
- **Notifications use an outbox.** A `notifications` table written in the same transaction as each event; the in-app bell reads it; a server-only dispatcher emails through Resend right after the action, and a Vercel Cron sweep retries. Resend also becomes Auth SMTP.
- **One service-role client, server only.** `lib/supabase/admin.ts` (from Task 15) for the email dispatcher and account deletion; never `NEXT_PUBLIC_`.
- **Account deletion anonymises, then deletes the login.** The `profiles.id` → `auth.users` cascade is dropped so the anonymised profile and the other side's history survive.
- **Matching v1 scores on read.** Pure, unit-tested `scoreMatch` in `lib/matching/score.ts`; the `matches` table waits.
- **Password reset gets its own callback** (`app/auth/recovery/route.ts`); `app/auth/confirm/route.ts` keeps rejecting all but signup tokens.
- **One branch for everything.** Every task lands on `feat/daddy-is-here`, one commit per task, in build order. A person pushes it and opens the PR; after merge they run each merged module's production steps in build order.
- Out of scope: payments, avatar/portfolio uploads, inviting a suggested provider, client-confirmed completion, renaming `/oglasi` routes.

## Task List

### Phase 1: Foundation
- [x] Task 1: Baseline the live Supabase schema into migrations — `schema-baseline` (after merge: `migration repair` on production)
- [x] Task S1: Lock profile roles, with a pgTAP test harness — `security-hardening`
- [x] Task S2: Hide other users' contact and tax details — `security-hardening`
- [x] Task S3: Narrow message, conversation and application updates — `security-hardening`
- [ ] Task S4: Secure the accept RPC, guard brief status, drop duplicate policies — `security-hardening`

### Checkpoint: Security hardening
- [ ] Every finding has a passing pgTAP test. A person can push and merge the branch here so production gets the fix without waiting for later modules; work continues on the same branch either way

- [ ] Task 2: CI workflow on pull requests — `ci`
- [ ] Task 3: Forgot-password request page — `password-reset`
- [ ] Task 4: Password recovery callback — `password-reset`
- [ ] Task 5: Reset-password page — `password-reset`

### Checkpoint: Foundation
- [ ] CI green on `main` and required; fresh local DB from migrations runs the full hire flow; reset works on staging; team review

### Phase 2: Close the hiring loop
- [ ] Task 6: Client can cancel a project brief — `hiring-loop`
- [ ] Task 7: Workrooms for accepted project applications — `hiring-loop`
- [ ] Task 8: Completing a project workroom completes the project — `hiring-loop`
- [ ] Task 26: Test coverage for provider services — `reviews`
- [ ] Task 9: Client reviews a completed workroom — `reviews`
- [ ] Task 10: Ratings on Find Talent — `reviews`

### Checkpoint: Hiring loop
- [ ] Hire → workroom → complete → review → rating visible, for both flows; team review

### Phase 3: Matching signals and notifications
- [ ] Task 11: Provider profile captures service types, business domains and languages — `provider-taxonomy`
- [ ] Task 12: Provider profile captures goal focuses and capability strengths — `provider-taxonomy`
- [ ] Task 13: Notification outbox with header badges — `notifications`
- [ ] Task 14: Notification inbox with the remaining events — `notifications`
- [ ] Task 15: Email delivery for notifications — `notifications`

### Checkpoint: Signals and notifications
- [ ] 10+ provider profiles with taxonomy; every event notifies and emails; team review

### Phase 4: Matching
- [ ] Task 16: Match scoring function — `matching`
- [ ] Task 17: Recommended briefs for providers — `matching`
- [ ] Task 18: Suggested providers for clients — `matching`

### Checkpoint: Matching
- [ ] Spot-check 10 pairs; tune weights; decide on persisting to `matches`

### Phase 5: Admin, account and polish
- [ ] Task 20: Admin can verify providers — `admin`
- [ ] Task 21: Admin can deactivate users — `admin`
- [ ] Task 22: Account settings for password and email — `account`
- [ ] Task 23: Account deletion — `account`
- [ ] Task 19: Landing page with working nav links — `polish`
- [ ] Task 24: Route boundaries and page metadata — `polish`
- [ ] Task 25: Paginate /jobs — `polish`

### Checkpoint: Complete
- [ ] All acceptance criteria met, CI green, pre-launch review (`/agent-skills:ship`)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Baseline migration replays against production because `migration repair` was skipped | High | Repair runs right after merge, before any `db push`; the command is in `supabase/README.md` |
| Security fixes break a legitimate write the app makes | High | Criteria list every legitimate write; pgTAP covers allowed and denied cases; the smoke test runs both flows |
| Someone already holds `admin` in production through the escalation | High | Post-merge step checks every `admin` profile |
| Extending `service_workrooms` breaks the service-request flow | Medium | Keep columns and RPC signatures; existing workroom tests pass unchanged |
| Dropping the `profiles` → `auth.users` cascade leaves orphaned profiles | Medium | Only deletion creates them, always anonymised; pgTAP proves other users' data is intact |
| Service-role key leaks to the browser | High | Server-only module, no `NEXT_PUBLIC_`, a test fails if a client component imports it |
| Few providers fill in the taxonomy, so matches are empty | Medium | Ship 11–12 early, completion requires a service type, empty states explain why |
| Scoring on read slows as data grows | Medium | Filter candidates in SQL first; move to `matches` past a few hundred open briefs |
| Vercel plan limits cron frequency | Low | Emails go out inline; the cron only retries failures |
| Email scanners consume one-time recovery links | Low | Requesting a new link from `/forgot-password` is the recovery path |

## Open Questions

None blocking; decisions are recorded in `SPEC.md`. Deferred: client-confirmed completion, inviting a suggested provider, persisting matches.
