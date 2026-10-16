# SiteMatch Roadmap: Tasks

Plan and decisions: `tasks/plan.md`. Shared doc: https://claude.ai/code/artifact/50b6acec-3076-48e1-999b-dfb79f508577

**Definition of done (every task):** `npm run lint`, `npx tsc --noEmit` (`npm run typecheck` after Task 2), `npm test` and `npm run build` pass; new `lib/` and action logic has Vitest tests on `tests/helpers/supabase-stub.ts`; schema changes are a new migration plus regenerated `types/supabase.ts`; acceptance criteria checked in the browser as client and provider. Next.js 16: read the matching guide in `node_modules/next/dist/docs/` first (AGENTS.md).

---

## Phase 1: Foundation

## Task 1: Baseline the live Supabase schema into migrations

**Description:** The code calls six functions no migration defines (`accept/reject/withdraw_project_application` at `lib/projects/service.ts:946`; `auth_rate_limit_check/record_attempt/reset` in `lib/auth/rate-limit.ts`), and the base tables and RLS are missing too (the hiring migration was deleted in `fd67ae2`). Set up the Supabase CLI (`supabase init`, `supabase link`), dump the live schema into a baseline migration dated before `20260902114500`, and mark it applied remotely with `supabase migration repair`.

**Acceptance criteria:**
- [ ] `supabase db reset` on a fresh local stack applies every migration without errors
- [ ] Every `.rpc("…")` name used in `lib/` is defined in `supabase/migrations/`
- [ ] `types/supabase.ts` regenerated with `supabase gen types`; diff reviewed

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: locally register, confirm, log in, post a brief, apply, accept

**Dependencies:** None

**Files likely touched:** `supabase/config.toml` (new), `supabase/migrations/<date>_baseline.sql` (new), `types/supabase.ts`, `supabase/README.md`

**Estimated scope:** Medium

## Task 2: CI workflow on pull requests

**Description:** GitHub Actions on PRs and pushes to `main`: `npm ci`, lint, typecheck, `vitest run`, `next build` with placeholder public Supabase env vars. Add a `typecheck` script.

**Acceptance criteria:**
- [ ] Every PR shows one "CI" check running all four steps
- [ ] A deliberately failing test turns the check red
- [ ] Branch protection on `main` requires the check

**Verification:**
- [ ] Manual check: open a draft PR and see it pass

**Dependencies:** None

**Files likely touched:** `.github/workflows/ci.yml` (new), `package.json`

**Estimated scope:** Small

## Task 3: Forgot-password request page

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

**Description:** `app/auth/recovery/route.ts` accepts only `type=recovery` with a `token_hash`, calls `verifyOtp({ type: "recovery" })`, keeps the session, sets a short-lived httpOnly marker cookie and redirects to `/reset-password`. Mirror the hardening in `app/auth/confirm/route.ts`. Add `supabase/templates/recovery.html` (appends `&token_hash={{ .TokenHash }}&type=recovery` to `{{ .RedirectTo }}`) and document it.

**Acceptance criteria:**
- [ ] Valid link lands on `/reset-password` with a recovery session and marker cookie
- [ ] Expired, used or malformed link goes to `/forgot-password?error=link` with nothing forwarded
- [ ] `/auth/confirm` unchanged and still rejects recovery tokens

**Verification:**
- [ ] Tests pass: `npx vitest run tests/routes/auth-recovery.test.ts` (modelled on `tests/routes/auth-confirm.test.ts`)

**Dependencies:** Task 3

**Files likely touched:** `app/auth/recovery/route.ts` (new), `supabase/templates/recovery.html` (new), `supabase/README.md`

**Estimated scope:** Small

## Task 5: Reset-password page

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

## Task 9: Client reviews a completed workroom

**Description:** `reviews` table (one per workroom; `client_id`, `provider_id`, `rating` 1–5, `comment` ≤ 1,000 chars). `submit_workroom_review` security-definer RPC checks caller is the workroom's client and it is completed, inserts, recomputes `average_rating` / `total_reviews`. Review form on the completed workroom page.

**Acceptance criteria:**
- [ ] Only the workroom's client can review, once, after completion
- [ ] Provider's `average_rating` and `total_reviews` update on submit
- [ ] Reviews publicly readable; inserts only through the RPC

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/reviews.test.ts tests/unit/workroom-actions.test.ts`

**Dependencies:** Task 1 (project workrooms join after Task 8)

**Files likely touched:** `supabase/migrations/<date>_reviews.sql` (new), `lib/reviews/schemas.ts` (new), `lib/reviews/service.ts` (new), `app/dashboard/workroom-actions.ts`, `components/workrooms/workroom-ui.tsx`

**Estimated scope:** Medium

## Task 10: Ratings on Find Talent

**Description:** Star rating and count on `/find-talent` cards and `/find-talent/[id]` (with three latest reviews). "Top rated" sort in `find-talent-query.ts`. Add tests for every touched function in `lib/provider-services/service.ts` (6.7% coverage today).

**Acceptance criteria:**
- [ ] Cards and detail show rating and count; no reviews shows "New"
- [ ] `?sort=top_rated` orders by average rating, then count
- [ ] Changed functions in `lib/provider-services/service.ts` have tests

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/find-talent-query.test.ts tests/unit/provider-service-detail.test.ts`

**Dependencies:** Task 9

**Files likely touched:** `lib/provider-services/service.ts`, `lib/provider-services/find-talent-query.ts`, `app/find-talent/page.tsx`, `app/find-talent/[id]/page.tsx`

**Estimated scope:** Medium

## Checkpoint: Hiring loop
- [ ] Both flows: hire → workroom → complete → review → rating visible on Find Talent
- [ ] Cancelled briefs leave `/jobs` with no pending applications behind
- [ ] Review with the team before proceeding

---

## Phase 3: Matching signals and notifications

## Task 11: Provider profile captures service types, business domains and languages

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

**Description:** Email each notification not yet emailed, set `emailed_at`. Database Webhook → Edge Function, or cron → protected route. Per-user opt-out. Same provider becomes Auth SMTP.

**Acceptance criteria:**
- [ ] One email within a minute; retries never duplicate
- [ ] Opted-out users get in-app only
- [ ] No secrets or one-time links in logs

**Verification:**
- [ ] Tests pass: dispatcher unit test
- [ ] Manual check: controlled inbox

**Dependencies:** Task 13; email provider decision

**Files likely touched:** `supabase/functions/notify-email/index.ts` (new) or `app/api/notifications/dispatch/route.ts` (new), opt-out migration, profile forms, `supabase/README.md`

**Estimated scope:** Medium

## Checkpoint: Signals and notifications
- [ ] 10+ provider profiles with taxonomy (real or seeded)
- [ ] Every Task 14 event notifies in-app (and by email if Task 15 is done)
- [ ] Review with the team before proceeding

---

## Phase 4: Matching

## Task 16: Match scoring function

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

## Phase 5: Polish (parallel, any time)

## Task 19: Landing page with working nav links

**Description:** Replace "Home Page" in `app/page.tsx` with headline, two CTAs, three-step "How it works", recent services. Header "How It Works" → `/#how-it-works`; "Enterprise" removed or linked to contact.

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

## Task 20: Admin can verify providers

**Description:** Admin page lists providers (unverified first) with a toggle for `provider_profiles.is_verified`; verified badge on Find Talent.

**Acceptance criteria:**
- [ ] Only admins can change `is_verified` (RLS via `is_admin()` plus `proxy.ts` guard)
- [ ] Badge shows on the next page load
- [ ] Admin actions tested like other dashboard actions

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/admin-actions.test.ts`

**Dependencies:** Task 1

**Files likely touched:** `app/dashboard/admin/page.tsx`, `app/dashboard/admin/actions.ts` (new), `lib/admin/service.ts` (new), `app/find-talent/page.tsx`, `app/find-talent/[id]/page.tsx`

**Estimated scope:** Medium

## Task 21: Admin can deactivate users

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

**Description:** Delete from settings after retyping the email. Security-definer RPC anonymises the profile, unpublishes services, cancels open briefs; messages and reviews stay as "Deleted user". Removing the `auth.users` row needs a service-role key (open question).

**Acceptance criteria:**
- [ ] User cannot log in afterwards; no personal data on any public page
- [ ] Counterparties' workrooms and conversations still open, anonymised
- [ ] Requires retyping the email

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/account-deletion.test.ts`

**Dependencies:** Tasks 1, 22

**Files likely touched:** migration (new), `app/dashboard/account-actions.ts`, `components/dashboard/account-settings-form.tsx`

**Estimated scope:** Medium

## Task 24: Route boundaries and page metadata

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

**Description:** `getPublicPublishedProjects` has no limit. Add page parsing and `.range()` like `lib/provider-services/find-talent-query.ts`.

**Acceptance criteria:**
- [ ] 12 briefs per page; next/previous keep filters
- [ ] Out-of-range page falls back to the last page

**Verification:**
- [ ] Tests pass: `npx vitest run tests/unit/public-projects.test.ts`

**Dependencies:** None

**Files likely touched:** `lib/projects/service.ts`, `app/jobs/page.tsx`

**Estimated scope:** Small

## Task 26: Test coverage for provider services

**Description:** `lib/provider-services/service.ts` is at 6.7% statements; `app/dashboard/provider/services/actions.ts` and `app/find-talent/[id]/actions.ts` have no tests. Ideally before Task 10.

**Acceptance criteria:**
- [ ] `lib/provider-services/` reaches ≥ 70% statement coverage
- [ ] Both action files tested for success, validation error and unauthorised paths

**Verification:**
- [ ] Tests pass: `npm run test:coverage`

**Dependencies:** None

**Files likely touched:** `tests/unit/provider-services-service.test.ts` (new), `tests/unit/provider-services-actions.test.ts` (new)

**Estimated scope:** Small

## Checkpoint: Complete
- [ ] All acceptance criteria met; CI green
- [ ] Pre-launch review (`/agent-skills:ship`) before opening registration widely
