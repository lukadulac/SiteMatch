# Implementation Plan: SiteMatch Roadmap

Shared doc (the version the team reads and comments on): https://claude.ai/code/artifact/50b6acec-3076-48e1-999b-dfb79f508577
Task details with acceptance criteria: `tasks/todo.md`. Keep both in sync with the doc.

## Overview

26 tasks in five phases take SiteMatch from two hiring flows that stop at "accepted" to a marketplace that finishes hires, collects reviews and matches clients with providers. Phase 1 (schema baseline, CI, password reset) goes first because every later task depends on a reproducible database and a safe login.

## Architecture Decisions

- **Project hires reuse workrooms.** Extend `service_workrooms` with nullable `application_id` / `project_id` (check: exactly one source) instead of a second table: one list page, one detail page, one completion RPC, one place for reviews.
- **Reviews key on the workroom.** One review per completed workroom, client to provider, via a security-definer RPC that recomputes `provider_profiles.average_rating` / `total_reviews` (columns exist, never written today). No editing in v1.
- **Notifications use an outbox.** A `notifications` table written in the database when each event happens; the in-app bell reads it; a separate dispatcher emails rows not yet emailed.
- **Matching v1 scores on read.** Pure, unit-tested `scoreMatch` in `lib/matching/score.ts`. The unused `matches` table waits until scale or status tracking needs it (writing it needs a service-role key or SQL scoring).
- **Password reset gets its own callback** (`app/auth/recovery/route.ts`) instead of loosening `app/auth/confirm/route.ts`, which deliberately rejects all but signup tokens.
- **Migrations only, after Task 1.** No more schema changes through the Supabase SQL editor.
- Out of scope: payments, avatar/portfolio uploads, inviting a suggested provider, renaming `/oglasi` routes.

## Task List

### Phase 1: Foundation
- [ ] Task 1: Baseline the live Supabase schema into migrations
- [ ] Task 2: CI workflow on pull requests
- [ ] Task 3: Forgot-password request page
- [ ] Task 4: Password recovery callback
- [ ] Task 5: Reset-password page

### Checkpoint: Foundation
- [ ] CI green on `main` and required; fresh local DB from migrations runs the full hire flow; reset works on staging; team review

### Phase 2: Close the hiring loop
- [ ] Task 6: Client can cancel a project brief
- [ ] Task 7: Workrooms for accepted project applications
- [ ] Task 8: Completing a project workroom completes the project
- [ ] Task 9: Client reviews a completed workroom
- [ ] Task 10: Ratings on Find Talent

### Checkpoint: Hiring loop
- [ ] Hire → workroom → complete → review → rating visible, for both flows; team review

### Phase 3: Matching signals and notifications
- [ ] Task 11: Provider profile captures service types, business domains and languages
- [ ] Task 12: Provider profile captures goal focuses and capability strengths
- [ ] Task 13: Notification outbox with header badges
- [ ] Task 14: Notification inbox with the remaining events
- [ ] Task 15: Email delivery for notifications

### Checkpoint: Signals and notifications
- [ ] 10+ provider profiles with taxonomy; every event notifies; team review

### Phase 4: Matching
- [ ] Task 16: Match scoring function
- [ ] Task 17: Recommended briefs for providers
- [ ] Task 18: Suggested providers for clients

### Checkpoint: Matching
- [ ] Spot-check 10 pairs; tune weights; decide on persisting to `matches`

### Phase 5: Polish (parallel, any time)
- [ ] Task 19: Landing page with working nav links
- [ ] Task 20: Admin can verify providers
- [ ] Task 21: Admin can deactivate users
- [ ] Task 22: Account settings for password and email
- [ ] Task 23: Account deletion
- [ ] Task 24: Route boundaries and page metadata
- [ ] Task 25: Paginate /jobs
- [ ] Task 26: Test coverage for provider services

### Checkpoint: Complete
- [ ] All acceptance criteria met, CI green, pre-launch review (`/agent-skills:ship`)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Baseline migration replays against production because `migration repair` was skipped | High | Dump read-only; repair remote history before any `db push`; prove on a local stack first |
| RLS on taxonomy, provider and `matches` tables unknown until the baseline exists | High | Task 1 gates Tasks 6–18; review every policy in the baseline PR |
| Extending `service_workrooms` breaks the service-request flow | Medium | Keep columns and RPC signatures; existing workroom tests pass unchanged |
| Few providers fill in the taxonomy, so matches are empty | Medium | Ship 11–12 early, dashboard nudge, require one service type for completion |
| Scoring on read slows as data grows | Medium | Filter candidates in SQL first; move to `matches` past a few hundred open briefs |
| Supabase built-in mailer limits block reset and notification emails | Medium | Pick a provider in Task 15; use it as Auth SMTP before launch |
| Email scanners consume one-time recovery links | Low | Requesting a new link from `/forgot-password` is the recovery path |

## Open Questions

- Who has Supabase project access for the baseline dump, and were the five existing migrations applied via CLI or SQL editor? (Task 1)
- Is provider-marked completion enough, or should the client confirm? (Tasks 8, 9)
- Email provider for notifications and Auth SMTP: Resend, Postmark or SES? (Task 15)
- Account deletion: hard-delete the auth user (needs service-role key) or anonymise only? (Task 23)
- "Enterprise" nav item: remove or link to a contact page? (Task 19)
- Is there a Figma design for the landing page (`redesign/implementing-figma-new-UI` branch)? (Task 19)
- Should clients be able to invite a suggested provider? Not in this plan; would follow Task 18.
