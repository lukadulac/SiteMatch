# SiteMatch Roadmap: Tasks

Spec: `SPEC.md` (shared rules and capability map) and `spec/<module-id>.md`. Plan and risks: `tasks/plan.md`. Shared doc: https://claude.ai/code/artifact/50b6acec-3076-48e1-999b-dfb79f508577

**Definition of done (every task):** `npm run lint`, `npx tsc --noEmit` (`npm run typecheck` after Task 2), `npm test`, `npx supabase test db` (after S1) and `npm run build` pass; new `lib/` and action logic has Vitest tests on `tests/helpers/supabase-stub.ts`; schema changes are a new migration plus regenerated `types/supabase.ts` plus pgTAP tests for new policies and RPCs, including denied cases; everything stays on this machine (no push, no remote Supabase, no outside services; the app runs on `.env.local`); acceptance criteria checked in the browser as client and provider. Next.js 16: read the matching guide in `node_modules/next/dist/docs/` first (AGENTS.md).

---

## Phase 1: Foundation

## Task 1: Baseline the live Supabase schema into migrations

**Module:** `schema-baseline` ([spec](../spec/schema-baseline.md))

**Description:** The code calls six functions no migration defines (`accept/reject/withdraw_project_application` at `lib/projects/service.ts:946`; `auth_rate_limit_check/record_attempt/reset` in `lib/auth/rate-limit.ts`), and the base tables and RLS are missing too (the hiring migration was deleted in `fd67ae2`). Set up the Supabase CLI (`supabase init`, `supabase link`), dump the live schema into a baseline migration dated before `20260902114500`, and mark it applied remotely with `supabase migration repair`.

**Status:** Done on `feat/daddy-is-here`. After merge to `main`: run the `migration repair` command in `supabase/README.md` against production (nothing touches production before merge).

**Acceptance criteria:**
- [x] `supabase db reset` on a fresh local stack applies every migration without errors
- [x] Every `.rpc("…")` name used in `lib/` is defined in `supabase/migrations/` (guarded by `tests/unit/migrations-define-rpcs.test.ts`)
- [x] `types/supabase.ts` regenerated with `supabase gen types`; diff reviewed

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [ ] Manual check: locally register, confirm, log in, post a brief, apply, accept (an API smoke test passed post/apply/accept, both service flows and all 11 RPCs locally; the browser register → confirm path is still to do)

**Dependencies:** None

**Files likely touched:** `supabase/config.toml` (new), `supabase/migrations/<date>_baseline.sql` (new), `types/supabase.ts`, `supabase/README.md`

**Estimated scope:** Medium

## Task S1: Lock profile roles, with a pgTAP test harness

**Module:** `security-hardening` ([spec](../spec/security-hardening.md))

**Description:** Set up `supabase/tests/database/` with pgTAP tests run by `npx supabase test db`, impersonating users with `set local role authenticated` plus `request.jwt.claims`. Add a migration with a `before insert or update` trigger on `profiles`: callers who aren't admins (or the service role) can't insert `role = 'admin'` or `is_active = false`, and can't change `role` or `is_active`. An upsert that repeats the same role still works.

**Status:** Done on `feat/daddy-is-here`. Also added `scripts/smoke-local.mjs` (`npm run smoke`), the local smoke test later tasks extend. Fresh-context review folded in; carried forward: any later task that narrows the rows the `profiles` select policy returns must first make `is_admin()` `security definer` with `set search_path = ''` (otherwise its own read of `profiles` recurses; S1's guard already calls it only when a privileged column changes), and Task 21 makes `is_admin()` require `is_active` and stops admins changing their own role or status.

**Acceptance criteria:**
- [x] A user cannot insert their own profile as admin or change their own `role` / `is_active` (pgTAP, denied cases)
- [x] An admin can change both on any profile; provisioning and profile-form updates still succeed
- [x] The local smoke test reports that a client can no longer make themselves admin

**Verification:**
- [x] Tests pass: `npx supabase test db` and `npm test`
- [x] Build succeeds: `npm run build`

**Dependencies:** Task 1

**Files likely touched:** `supabase/migrations/<date>_lock_profile_roles.sql` (new), `supabase/tests/database/profiles.test.sql` (new), `supabase/README.md`, `scripts/smoke-local.mjs` (new), `package.json`

**Estimated scope:** Small

## Task S2: Hide other users' contact and tax details

**Module:** `security-hardening` ([spec](../spec/security-hardening.md))

**Description:** Replace the `using (true)` select policies on `profiles` and `client_profiles` so a signed-in user can read other users' names, city and country but not `email`, `phone` or `business_tax_id`. Use column-level grants; the own-profile pages that read `phone` (client and provider dashboard and profile pages) switch to a way of reading their own contact details that the grants allow. Messaging, workrooms, applications and Find Talent keep working.

**Status:** Done on `feat/daddy-is-here`. Column grants on `profiles`, `get_own_contact_details()` for a user's own email and phone, `client_profiles` readable by owner and admins only. Behaviour changes to know about: the client's applicant list on `/oglasi/[id]` no longer shows the provider's email and phone (they message through the conversation), and `select *` or `email`/`phone` on `profiles` now fails for every signed-in user. The provisioning upsert is now `ON CONFLICT DO NOTHING` (`ignoreDuplicates`): `DO UPDATE SET email = excluded.email` would have to read the column. Fresh-context review folded in: `profiles.email` now always follows the login's email (trigger `sync_profile_email`), because a writable email plus its unique index let any user test whether an address is registered (carried forward: Task 22 must refresh `profiles.email` after a confirmed email change); `anon` gets the same column grants as `authenticated`. Production order: deploy the app first, then `db push` (see `supabase/README.md`). Noticed, not changed: `provider_profiles.tax_id` (a public business registry number) is still readable by every signed-in user, and the baseline grants every table `ALL` (including `TRUNCATE` and `TRIGGER`) to `anon` and `authenticated`, which RLS does not cover; worth a grants-hygiene follow-up.

**Acceptance criteria:**
- [x] Another user's `email`, `phone` and `business_tax_id` are not readable (pgTAP)
- [x] A user still reads and edits their own contact details
- [x] Every page that shows another user's name still renders (Vitest plus the smoke test; browser check left to a person, see the final summary)

**Verification:**
- [x] Tests pass: `npx supabase test db` and `npm test`
- [ ] Manual check: dashboards, profile pages, a conversation and a workroom as client and provider (not done: no browser here; the smoke test covers the same reads through the API)

**Dependencies:** Task S1

**Files likely touched:** `supabase/migrations/<date>_hide_contact_and_tax_details.sql` (new), `supabase/tests/database/profile-privacy.test.sql` (new), the two own-profile pages and two dashboard pages under `app/dashboard/`, `lib/auth/own-contact.ts` (new), `lib/auth/provision.ts`, `app/oglasi/[id]/page.tsx`, the four services that embedded `profiles`, `tests/unit/own-contact.test.ts` and `tests/unit/profile-columns.test.ts` (new), `tests/helpers/supabase-stub.ts`, `scripts/smoke-local.mjs`, `types/supabase.ts`

**Estimated scope:** Medium

## Task S3: Narrow message, conversation and application updates

**Module:** `security-hardening` ([spec](../spec/security-hardening.md))

**Description:** Participants may set `messages.is_read` on messages they received and bump `conversations.updated_at`, nothing else. A client may set an application's `status` to `viewed` or `shortlisted` only; accept, reject and withdraw stay in their RPCs. Column-level grants plus policy or trigger checks.

**Status:** Done on `feat/daddy-is-here`. Column grants limit UPDATE to `messages.is_read`, `conversations.updated_at` and `applications.status`; the update policies were replaced (the old admin branches are gone). `accept_project_application` became `security definer` here instead of in S4: it ran as the caller and needed the client's old unrestricted update right, so S3's acceptance criterion (accept still works) forced it forward. It now authorizes before locking and only links a conversation that belongs to the application. Fresh-context review folded in: INSERT had the same holes (a provider could insert an application already `accepted`; a sender could insert a pre-read message with a forged `created_at`), so applications must be created `pending` and `messages`/`conversations` inserts are column-limited. Carried forward to S4: the insert policy "Conversations are insertable for valid service requests" lets a user pre-empt an application's conversation (`service_request_id is null` with any `application_id`); drop it when the duplicate insert policies are consolidated.

**Acceptance criteria:**
- [x] Nobody can change a message's text or sender, or a conversation's participants or links (pgTAP)
- [x] A client cannot change an application's content or provider, or set statuses other than `viewed` / `shortlisted` directly (pgTAP)
- [x] Reading messages, sending, marking read, shortlisting, accept, reject and withdraw still work

**Verification:**
- [x] Tests pass: `npx supabase test db` and `npm test`
- [ ] Manual check: a conversation and an application round trip (not done: no browser here; the smoke test runs the same round trip through the API)

**Dependencies:** Task S1

**Files likely touched:** `supabase/migrations/<date>_narrow_message_conversation_application_updates.sql` (new), `supabase/tests/database/messaging.test.sql` (new), `supabase/tests/database/applications.test.sql` (new), `scripts/smoke-local.mjs`

**Estimated scope:** Medium

## Task S4: Secure the accept RPC, guard brief status, drop duplicate policies

**Module:** `security-hardening` ([spec](../spec/security-hardening.md))

**Description:** Recreate `accept_project_application` as `security definer` with `set search_path = ''` (behaviour unchanged). A trigger stops callers acting as `authenticated` from setting a brief's status to `assigned` or `completed` directly (RPCs run as the function owner and still can). Drop the overlapping duplicate policy sets so each table has one coherent set with the same intended access.

**Note:** `accept_project_application` was already made `security definer` with `set search_path = ''` in Task S3 (see there), with its pgTAP and smoke coverage; this task keeps that criterion as a regression check.

**Acceptance criteria:**
- [ ] Accept still assigns the brief, rejects the rest and opens the conversation (pgTAP and smoke test)
- [ ] A client cannot set `assigned` or `completed` directly; `published` ↔ `in_discussion` still works
- [ ] Each table has one policy set; the full Vitest suite, pgTAP suite and smoke test pass

**Verification:**
- [ ] Tests pass: `npx supabase test db` and `npm test`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Tasks S2, S3

**Files likely touched:** migration (new), `supabase/tests/database/projects.test.sql` (new), `types/supabase.ts`

**Estimated scope:** Medium

## Checkpoint: Security hardening
- [ ] Every finding in `spec/security-hardening.md` has a passing pgTAP test
- [ ] A person can push `feat/daddy-is-here` and merge it here so production gets the fix early, then run the schema-baseline and security-hardening production steps; work continues on the same branch either way

## Task 2: CI workflow on pull requests

**Module:** `ci` ([spec](../spec/ci.md))

**Description:** GitHub Actions workflow "CI" on PRs and pushes to `main` with two jobs. **checks:** `npm ci`, lint, typecheck, `vitest run`, `next build` with placeholder public Supabase env vars. **database:** Supabase CLI on the runner's Docker starts a database from the migrations and runs `npx supabase test db`. Add a `typecheck` script. No repository secrets.

**Acceptance criteria:**
- [ ] Every PR shows the "CI" workflow with both jobs
- [ ] A deliberately failing test turns `checks` red; a deliberately broken migration turns `database` red
- [ ] Branch protection on `main` requires both jobs (repository admin)

**Verification:**
- [ ] Local check: run both jobs' steps in order; they pass, and fail on a broken test or migration (a person checks the first GitHub run after pushing)

**Dependencies:** None

**Files likely touched:** `.github/workflows/ci.yml` (new), `package.json`

**Estimated scope:** Small

## Task 3: Forgot-password request page

**Module:** `password-reset` ([spec](../spec/password-reset.md))

**Description:** "Forgot password?" link on the login form and a `/forgot-password` page whose action validates the email, checks the rate limit and calls `supabase.auth.resetPasswordForEmail` with a `redirectTo` from `getAuthSiteOrigin()` pointing at `/auth/recovery`.

**Acceptance criteria:**
- [ ] Known, unknown and throttled emails get the same "check your inbox" response
- [ ] Repeat requests throttled server-side, sharing the `register_ip` budget like resend (no DB change)
- [ ] `/forgot-password` sends `Cache-Control: no-store`

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/password-reset-actions.test.ts`
- [ ] Manual check: request a reset for a controlled test address

**Dependencies:** None

**Files likely touched:** `components/auth/login-form.tsx`, `app/forgot-password/page.tsx` (new), `components/auth/forgot-password-form.tsx` (new), `app/(auth)/password-reset-actions.ts` (new), `lib/auth/site-url.ts`, `next.config.ts`

**Estimated scope:** Medium

## Task 4: Password recovery callback

**Module:** `password-reset` ([spec](../spec/password-reset.md))

**Description:** `app/auth/recovery/route.ts` accepts only `type=recovery` with a `token_hash`, calls `verifyOtp({ type: "recovery" })`, keeps the session, sets a short-lived httpOnly marker cookie and redirects to `/reset-password`. Mirror the hardening in `app/auth/confirm/route.ts`. Add `supabase/templates/recovery.html` (appends `&token_hash={{ .TokenHash }}&type=recovery` to `{{ .RedirectTo }}`) and document it.

**Acceptance criteria:**
- [ ] Valid link lands on `/reset-password` with a recovery session and marker cookie
- [ ] Expired, used or malformed link goes to `/forgot-password?error=link` with nothing forwarded
- [ ] `/auth/confirm` unchanged and still rejects recovery tokens

**Verification:**
- [ ] Tests pass: `npx vitest run tests/routes/auth-recovery.test.ts` (modelled on `tests/routes/auth-confirm.test.ts`)

**Dependencies:** Task 3

**Files likely touched:** `app/auth/recovery/route.ts` (new), `supabase/templates/recovery.html` (new), `supabase/config.toml` (local recovery template), `supabase/README.md`

**Estimated scope:** Small

## Task 5: Reset-password page

**Module:** `password-reset` ([spec](../spec/password-reset.md))

**Description:** `/reset-password` shows new/confirm password fields only with the recovery marker cookie, else redirects to `/forgot-password`. Action calls `supabase.auth.updateUser({ password })`, signs out every session, redirects to `/login?reset=1`. Move the inline 8-character rule from `app/(auth)/actions.ts` into `lib/auth/password.ts`.

**Acceptance criteria:**
- [ ] After a reset the new password signs in and the old one fails
- [ ] Other devices are signed out (`signOut({ scope: "global" })`)
- [ ] Mismatched or short passwords show field errors and change nothing

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/password-reset-actions.test.ts tests/unit/auth-actions.test.ts`
- [ ] Manual check: full flow from the email

**Dependencies:** Task 4

**Files likely touched:** `app/reset-password/page.tsx` (new), `components/auth/reset-password-form.tsx` (new), `app/(auth)/password-reset-actions.ts`, `lib/auth/password.ts` (new), `app/(auth)/actions.ts`

**Estimated scope:** Medium

## Checkpoint: Foundation
- [ ] CI green on `main` and required for merges
- [ ] Fresh local DB from migrations runs register → confirm → login → post brief → apply → accept
- [ ] Password reset works end to end on staging with the new template
- [ ] Review with the team before proceeding

---

## Phase 2: Close the hiring loop

## Task 6: Client can cancel a project brief

**Module:** `hiring-loop` ([spec](../spec/hiring-loop.md))

**Description:** `cancel_project(target_project_id)` RPC moves `draft` / `published` / `in_discussion` to `cancelled` and rejects pending applications in one transaction. "Cancel brief" button with confirm on `/oglasi/[id]`.

**Acceptance criteria:**
- [ ] Cancelled briefs leave `/jobs` and show as cancelled in the client's list
- [ ] Providers with pending applications see them rejected
- [ ] `assigned` / `completed` briefs cannot be cancelled (RPC raises; button hidden)

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/projects-service.test.ts tests/unit/listing-actions.test.ts`

**Dependencies:** Task 1

**Files likely touched:** `supabase/migrations/<date>_cancel_project.sql` (new), `lib/projects/service.ts`, `app/oglasi/actions.ts`, `app/oglasi/[id]/page.tsx`

**Estimated scope:** Medium

## Task 7: Workrooms for accepted project applications

**Module:** `hiring-loop` ([spec](../spec/hiring-loop.md))

**Description:** Extend `service_workrooms`: `service_request_id` / `service_id` nullable, add `application_id` / `project_id`, check exactly one source, unique index on `application_id`. `accept_project_application` creates the workroom; backfill for projects already `assigned`.

**Acceptance criteria:**
- [ ] Accepting an application creates exactly one active workroom linked to it
- [ ] Service-request workrooms unchanged; existing workroom tests pass unchanged
- [ ] Already-assigned projects get a workroom from the backfill

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/service-workrooms.test.ts tests/unit/projects-service.test.ts`
- [ ] Manual check: `supabase db reset` locally

**Dependencies:** Task 1

**Files likely touched:** `supabase/migrations/<date>_project_workrooms.sql` (new), `lib/service-workrooms/service.ts`, `lib/service-workrooms/schemas.ts`, `types/supabase.ts`

**Estimated scope:** Medium

## Task 8: Completing a project workroom completes the project

**Module:** `hiring-loop` ([spec](../spec/hiring-loop.md))

**Description:** Project workrooms in the existing lists and detail page (project title and brief link). `complete_service_workroom` also sets `projects.status = 'completed'` when `project_id` is set. Link to the workroom from the assigned brief and the provider's applications page.

**Acceptance criteria:**
- [ ] Both parties see and open the project workroom under `/dashboard/*/workrooms`
- [ ] Provider marks complete → workroom and project both `completed`
- [ ] Assigned brief and accepted application link to the workroom

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/service-workrooms.test.ts tests/unit/workroom-actions.test.ts`
- [ ] Manual check: as client and provider

**Dependencies:** Task 7

**Files likely touched:** migration (new), `components/workrooms/workroom-ui.tsx`, `app/dashboard/workrooms/[id]/page.tsx`, `app/oglasi/[id]/page.tsx`, `app/dashboard/provider/applications/page.tsx`

**Estimated scope:** Medium

## Task 26: Test coverage for provider services

**Module:** `reviews` ([spec](../spec/reviews.md))

**Description:** `lib/provider-services/service.ts` is at 6.7% statements; `app/dashboard/provider/services/actions.ts` and `app/find-talent/[id]/actions.ts` have no tests. Cover them before Task 10 changes them.

**Acceptance criteria:**
- [ ] `lib/provider-services/` reaches ≥ 70% statement coverage
- [ ] Both action files tested for success, validation error and unauthorised paths

**Verification:**
- [ ] Tests pass: `npm run test:coverage`

**Dependencies:** None

**Files likely touched:** `tests/unit/provider-services-service.test.ts` (new), `tests/unit/provider-services-actions.test.ts` (new)

**Estimated scope:** Small

## Task 9: Client reviews a completed workroom

**Module:** `reviews` ([spec](../spec/reviews.md))

**Description:** `reviews` table (one per workroom; `client_id`, `provider_id`, `reviewer_first_name`, `rating` 1–5, `comment` ≤ 1,000 chars), publicly readable like published listings. `submit_workroom_review` security-definer RPC checks caller is the workroom's client and it is completed, copies the client's first name onto the review, inserts, recomputes `average_rating` / `total_reviews`. Review form on the completed workroom page.

**Acceptance criteria:**
- [ ] Only the workroom's client can review, once, after completion
- [ ] Provider's `average_rating` and `total_reviews` update on submit
- [ ] Reviews publicly readable; inserts only through the RPC

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/reviews.test.ts tests/unit/workroom-actions.test.ts`

**Dependencies:** Task 8

**Files likely touched:** `supabase/migrations/<date>_reviews.sql` (new), `lib/reviews/schemas.ts` (new), `lib/reviews/service.ts` (new), `app/dashboard/workroom-actions.ts`, `components/workrooms/workroom-ui.tsx`

**Estimated scope:** Medium

## Task 10: Ratings on Find Talent

**Module:** `reviews` ([spec](../spec/reviews.md))

**Description:** Star rating and count on `/find-talent` cards and `/find-talent/[id]` (with three latest reviews). "Top rated" sort in `find-talent-query.ts`. Works signed out.

**Acceptance criteria:**
- [ ] Cards and detail show rating and count; no reviews shows "New"
- [ ] `?sort=top_rated` orders by average rating, then count
- [ ] Changed functions in `lib/provider-services/service.ts` have tests

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/find-talent-query.test.ts tests/unit/provider-service-detail.test.ts`

**Dependencies:** Tasks 9, 26

**Files likely touched:** `lib/provider-services/service.ts`, `lib/provider-services/find-talent-query.ts`, `app/find-talent/page.tsx`, `app/find-talent/[id]/page.tsx`

**Estimated scope:** Medium

## Checkpoint: Hiring loop
- [ ] Both flows: hire → workroom → complete → review → rating visible on Find Talent
- [ ] Cancelled briefs leave `/jobs` with no pending applications behind
- [ ] Review with the team before proceeding

---

## Phase 3: Matching signals and notifications

## Task 11: Provider profile captures service types, business domains and languages

**Module:** `provider-taxonomy` ([spec](../spec/provider-taxonomy.md))

**Description:** Multi-selects for service types and business domains, plus languages with one primary, on the provider profile form, using the queries behind `getProjectFormMeta`. One `set_provider_taxonomy` RPC replaces rows in `provider_service_types`, `provider_business_domains`, `provider_languages` atomically.

**Acceptance criteria:**
- [ ] Selections persist and re-render on reload
- [ ] Unknown or inactive ids rejected with a field error
- [ ] Profile completion requires at least one service type

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/provider-profile.test.ts tests/unit/dashboard-actions.test.ts tests/unit/profile-completion.test.ts`

**Dependencies:** Task 1 (confirm RLS on these tables)

**Files likely touched:** `supabase/migrations/<date>_provider_taxonomy.sql` (new), `components/dashboard/provider-profile-form.tsx`, `app/dashboard/actions.ts`, `lib/auth/provider-profile.ts`, `app/dashboard/provider/profile/page.tsx`

**Estimated scope:** Medium

## Task 12: Provider profile captures goal focuses and capability strengths

**Module:** `provider-taxonomy` ([spec](../spec/provider-taxonomy.md))

**Description:** Extend the form and RPC with `provider_goal_focuses` and `provider_feature_capabilities` (basic / strong / expert), mirroring what clients pick on briefs.

**Acceptance criteria:**
- [ ] Features with a strength, and goals, persist
- [ ] Provider dashboard nudges providers with no taxonomy
- [ ] Existing profile fields keep working; current tests pass

**Verification:**
- [ ] Tests pass: same as Task 11

**Dependencies:** Task 11

**Files likely touched:** same as Task 11, plus `app/dashboard/provider/page.tsx`

**Estimated scope:** Medium

## Task 13: Notification outbox with header badges

**Module:** `notifications` ([spec](../spec/notifications.md))

**Description:** `notifications` table (`user_id`, `type`, `entity_type`, `entity_id`, `title`, `read_at`, `emailed_at`, `created_at`; owner-only). Rows written inside `request_provider_service` and by a trigger on `applications` insert. Header bell with unread count plus unread messages.

**Acceptance criteria:**
- [ ] Requesting a service or applying creates exactly one notification for the other party
- [ ] Header shows unread notifications and unread messages
- [ ] Users read only their own notifications

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/notifications.test.ts`
- [ ] Manual check: two browsers

**Dependencies:** Task 1

**Files likely touched:** `supabase/migrations/<date>_notifications.sql` (new), `lib/notifications/service.ts` (new), `app/layout.tsx`, `components/header/Header.tsx`

**Estimated scope:** Medium

## Task 14: Notification inbox with the remaining events

**Module:** `notifications` ([spec](../spec/notifications.md))

**Description:** `/dashboard/notifications` (list, mark one/all read, link to item). Events: application accepted/rejected, service request accepted/rejected, workroom completed, review received.

**Acceptance criteria:**
- [ ] Each event creates one notification for the right person
- [ ] Opening marks it read and goes to its brief, request, workroom or review
- [ ] "Mark all read" clears the header badge

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/notifications.test.ts`

**Dependencies:** Task 13 (workroom and review events need Tasks 8 and 9)

**Files likely touched:** migration (new), `app/dashboard/notifications/page.tsx` (new), `app/dashboard/notification-actions.ts` (new), `lib/notifications/service.ts`, `components/dashboard/DashboardShell.tsx`

**Estimated scope:** Medium

## Task 15: Email delivery for notifications

**Module:** `notifications` ([spec](../spec/notifications.md))

**Description:** Email each notification not yet emailed through Resend (`resend` package, pre-approved) and set `emailed_at`. A server-only dispatcher using a service-role client (`lib/supabase/admin.ts`, `import "server-only"`) runs right after the action that created the notification; a Vercel Cron route protected by `CRON_SECRET` sweeps anything left unsent. Without `RESEND_API_KEY` it logs instead of sending. Per-user opt-out via `profiles.email_notifications`. Resend becomes Supabase Auth SMTP in production (post-merge step). New env vars: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EMAIL_FROM`.

**Acceptance criteria:**
- [ ] One email within a minute; retries never duplicate
- [ ] Opted-out users get in-app only
- [ ] No secrets or one-time links in logs

**Verification:**
- [ ] Tests pass: dispatcher unit test
- [ ] Manual check: controlled inbox

**Dependencies:** Task 14

**Files likely touched:** `lib/notifications/email.ts` (new), `lib/supabase/admin.ts` (new), `app/api/cron/notifications/route.ts` (new), `vercel.json`, opt-out migration, profile forms, `supabase/README.md`

**Estimated scope:** Medium

## Checkpoint: Signals and notifications
- [ ] 10+ provider profiles with taxonomy (real or seeded)
- [ ] Every Task 14 event notifies in-app (and by email if Task 15 is done)
- [ ] Review with the team before proceeding

---

## Phase 4: Matching

## Task 16: Match scoring function

**Module:** `matching` ([spec](../spec/matching.md))

**Description:** Pure `scoreMatch(brief, provider)` in `lib/matching/score.ts` → 0–100 plus per-signal breakdown (service type, features × strength, goals, domain, language, budget fit, provider type, scope). Weights in one commented constant.

**Acceptance criteria:**
- [ ] Deterministic, no I/O
- [ ] Fixtures: strong match, no overlap, missing provider data, budget out of range
- [ ] Breakdown yields top two reasons in plain words

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/matching-score.test.ts`

**Dependencies:** None to start (real data needs Task 12)

**Files likely touched:** `lib/matching/score.ts` (new), `lib/matching/weights.ts` (new)

**Estimated scope:** Small

## Task 17: Recommended briefs for providers

**Module:** `matching` ([spec](../spec/matching.md))

**Description:** Provider dashboard scores open briefs and shows the top five with reasons. `/jobs/[id]` "How you match this brief" shows the signed-in provider's real breakdown.

**Acceptance criteria:**
- [ ] Dashboard lists up to five briefs by score, with reasons
- [ ] `/jobs/[id]` shows provider score and fit; anonymous visitors see the current section
- [ ] Providers with no taxonomy see a prompt instead

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/matching-service.test.ts tests/unit/public-projects.test.ts`

**Dependencies:** Tasks 12, 16

**Files likely touched:** `lib/matching/service.ts` (new), `app/dashboard/provider/page.tsx`, `app/jobs/[id]/page.tsx`

**Estimated scope:** Medium

## Task 18: Suggested providers for clients

**Module:** `matching` ([spec](../spec/matching.md))

**Description:** On `/oglasi/[id]`, top five available providers sharing at least one service type, scored with `scoreMatch`, linking to Find Talent.

**Acceptance criteria:**
- [ ] Up to five providers with score and reasons
- [ ] Unavailable providers never appear
- [ ] Candidates filtered in SQL by service type before scoring

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/matching-service.test.ts`

**Dependencies:** Tasks 16, 17

**Files likely touched:** `lib/matching/service.ts`, `app/oglasi/[id]/page.tsx`

**Estimated scope:** Medium

## Checkpoint: Matching
- [ ] Spot-check 10 brief/provider pairs with a teammate
- [ ] Tune weights; decide whether to persist to `matches`

---

## Phase 5: Admin, account and polish

## Task 20: Admin can verify providers

**Module:** `admin` ([spec](../spec/admin.md))

**Description:** Admin page lists providers (unverified first) with a toggle for `provider_profiles.is_verified`; verified badge on Find Talent.

**Acceptance criteria:**
- [ ] Only admins can change `is_verified` (RLS via `is_admin()` plus `proxy.ts` guard)
- [ ] Badge shows on the next page load
- [ ] Admin actions tested like other dashboard actions

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/admin-actions.test.ts`

**Dependencies:** Tasks S1–S4

**Files likely touched:** `app/dashboard/admin/page.tsx`, `app/dashboard/admin/actions.ts` (new), `lib/admin/service.ts` (new), `app/find-talent/page.tsx`, `app/find-talent/[id]/page.tsx`

**Estimated scope:** Medium

## Task 21: Admin can deactivate users

**Module:** `admin` ([spec](../spec/admin.md))

**Description:** Toggle `profiles.is_active` from an admin user list. Nothing reads it today: login and `proxy.ts` must refuse inactive users; their listings leave public pages.

**Acceptance criteria:**
- [ ] Deactivated user cannot log in and is sent out of the dashboard on next request
- [ ] Their services and briefs leave Find Talent and `/jobs`
- [ ] Reactivating restores access and listings

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/proxy.test.ts tests/unit/auth-actions.test.ts tests/unit/admin-actions.test.ts`

**Dependencies:** Task 20

**Files likely touched:** `app/dashboard/admin/*`, `proxy.ts`, `app/(auth)/actions.ts`, `lib/projects/service.ts`, `lib/provider-services/service.ts`

**Estimated scope:** Medium

## Task 22: Account settings for password and email

**Module:** `account` ([spec](../spec/account.md))

**Description:** Account section on both profile pages: change password (requires current; reuses `lib/auth/password.ts`), change email (confirmation to new address).

**Acceptance criteria:**
- [ ] Password change needs the current password and signs out other sessions
- [ ] Email change applies only after the new address is confirmed
- [ ] Both rate limited

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/account-settings-actions.test.ts`

**Dependencies:** Task 5

**Files likely touched:** `app/dashboard/account-actions.ts` (new), `components/dashboard/account-settings-form.tsx` (new), `app/dashboard/client/profile/page.tsx`, `app/dashboard/provider/profile/page.tsx`

**Estimated scope:** Medium

## Task 23: Account deletion

**Module:** `account` ([spec](../spec/account.md))

**Description:** Delete from settings after retyping the email and a recent sign-in. A security-definer RPC anonymises the profile ("Deleted user", unique placeholder email, phone and city cleared), unpublishes services, cancels open briefs (`cancel_project`) and withdraws pending applications; messages and reviews stay as "Deleted user". The server action then deletes the auth user with the service-role client from Task 15 and signs out. The migration drops the `profiles.id` → `auth.users` foreign key (`on delete cascade`) so the anonymised profile, and everything that cascades from it, outlives the login.

**Acceptance criteria:**
- [ ] User cannot log in afterwards, the email can register again, and no personal data shows on any public page
- [ ] Counterparties' workrooms, conversations and reviews still open, anonymised (pgTAP proves deletion leaves other users' rows intact)
- [ ] Requires retyping the email; nobody can delete another user (pgTAP)

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/account-deletion.test.ts` and `npx supabase test db`

**Dependencies:** Tasks 6, 15, 22

**Files likely touched:** migration (new), `supabase/tests/database/account-deletion.test.sql` (new), `app/dashboard/account-actions.ts`, `components/dashboard/account-settings-form.tsx`

**Estimated scope:** Medium

## Task 19: Landing page with working nav links

**Module:** `polish` ([spec](../spec/polish.md))

**Description:** Replace "Home Page" in `app/page.tsx` with headline, two CTAs, three-step "How it works", recent services. Header "How It Works" → `/#how-it-works`; "Enterprise" removed. No Figma: follow the existing UI style.

**Acceptance criteria:**
- [ ] No header link (desktop or mobile) points at `/` except the logo
- [ ] CTAs fit the role (client / provider / guest)
- [ ] Works at 375 px and desktop

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: both widths

**Dependencies:** None

**Files likely touched:** `app/page.tsx`, `components/home/*` (new), `components/header/Header.tsx`

**Estimated scope:** Medium

## Task 24: Route boundaries and page metadata

**Module:** `polish` ([spec](../spec/polish.md))

**Description:** Add `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, a dashboard `loading.tsx`, and `generateMetadata` on `/find-talent/[id]` and `/jobs/[id]`. Check Next.js 16 docs for each convention.

**Acceptance criteria:**
- [ ] Unknown URLs render a branded 404; thrown errors render an error page with retry
- [ ] Public detail pages have unique titles and descriptions
- [ ] Dashboard navigation shows a loading state

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: bad URL; view source on a detail page

**Dependencies:** None

**Files likely touched:** the four new files, `app/find-talent/[id]/page.tsx`, `app/jobs/[id]/page.tsx`

**Estimated scope:** Medium

## Task 25: Paginate /jobs

**Module:** `polish` ([spec](../spec/polish.md))

**Description:** `getPublicPublishedProjects` has no limit. Add page parsing and `.range()` like `lib/provider-services/find-talent-query.ts`.

**Acceptance criteria:**
- [ ] 12 briefs per page; next/previous keep filters
- [ ] Out-of-range page falls back to the last page

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/public-projects.test.ts`

**Dependencies:** None

**Files likely touched:** `lib/projects/service.ts`, `app/jobs/page.tsx`

**Estimated scope:** Small

## Checkpoint: Complete
- [ ] All acceptance criteria met; CI green
- [ ] Pre-launch review (`/agent-skills:ship`) before opening registration widely
