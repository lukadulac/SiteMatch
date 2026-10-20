# Database and migrations

`supabase/migrations/` is the source of truth for the schema. Change it only by
adding a migration (`npx supabase migration new <name>`); don't edit production
through the SQL editor, or the migrations stop matching it.

Develop and test schema changes against the local database only. Nothing runs
against the production database until the change is merged into `main`.

`20260901000000_baseline_schema.sql` recreates the schema production had before
migrations were tracked, so it only ever runs on fresh databases. After it
merges, production is marked as already having it, together with the five
migrations that were applied there through the SQL editor. The repo stays
unlinked during development, so link it first:

```
npx supabase link --project-ref fnbpwevsubtcdnrfjjak
npx supabase migration repair --status applied 20260901000000 20260902114500 20260910100000 20260915120000 20260925100000 20260930110000
```

## Local database

Requires Docker. The CLI is a dev dependency, so use `npx supabase`.

1. `npx supabase start` builds a local database from every migration plus
   `seed.sql` (taxonomy reference data) and prints its URL and keys.
2. Point the app at it in `.env.local` (it overrides `.env`):
   `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from npx supabase status>`,
   `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. Confirmation emails land in Mailpit at http://127.0.0.1:54324.
4. `npx supabase db reset` rebuilds from scratch; run it after pulling new
   migrations.

After changing the schema, regenerate types with
`npx supabase gen types typescript --local > types/supabase.ts`.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`, with no
secrets. Job `checks`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` (with placeholder public Supabase variables). Job `database`:
`npx supabase start` builds a database from `supabase/migrations` and `seed.sql` on the
runner's Docker, then `npx supabase test db`. To reproduce the database job locally on a
fresh stack: `npx supabase stop --no-backup`, then the same two commands. Branch protection
that requires both jobs is a GitHub setting a repository admin turns on after the first run.

## Reading profiles

Signed-in users can read other users' `profiles` rows, but only these columns:
`id, role, full_name, avatar_url, country, city, is_active, created_at,
updated_at`. `email` and `phone` are not readable by anyone signed in, their own
rows included, so a query that selects them (or `*`) fails with a permission
error. A user's own email and phone come from `get_own_contact_details()`
(`lib/auth/own-contact.ts`). A column added to `profiles` stays unreadable until
the grant in a migration includes it. `tests/unit/profile-columns.test.ts` fails
if app code selects an unreadable column. Writes are not narrowed: a user still
inserts and updates their own email and phone, but provisioning uses
`ON CONFLICT DO NOTHING`, because `DO UPDATE SET email = excluded.email` would
have to read the column.

`client_profiles` (tax ID, project idea) is readable by its owner and admins only.

## Profile pictures

Pictures live in the public `avatars` Storage bucket (PNG, JPEG or WebP, 2 MB at
most). A user uploads only into the folder named after their profile id, and never
overwrites a file: each upload gets a new `<uuid>.<ext>` name. `profiles.avatar_url`
holds that object path, not a URL, and a check constraint only accepts a path in
the profile's own folder. Build the URL with `getAvatarUrl()` from
`lib/profiles/avatar.ts`; uploads and removals go through `/api/profile/avatar`.

A picture picked on the registration form (48 KB at most, because Server Action
bodies are capped at 64 KB) is uploaded by `registerAction` with the service-role
client, since the account has no session or profile yet. It is only stored for an
account that sign-up just created. On the first sign-in `ensureUserProfile` links
the newest file in the user's folder to the new profile row.

## Writing policies, guards and RPCs

- **One policy per command and role.** Permissive policies OR together, so a second,
  looser policy silently wins. `supabase/tests/database/projects.test.sql` fails if a table
  has two policies for the same command and role, apart from the audience splits listed
  there (public listing + owner view; client review + provider withdrawal). `scripts/access-matrix.sql`
  prints who can read and write what for each kind of caller; run it before and after a change
  and diff the output (see the header of the file).
- **Guard triggers** (`trg_profiles_zz_guard_privileged_columns`, `trg_projects_zz_guard_status`)
  let `postgres`, `service_role` and `supabase_admin` through, and nobody else, admins
  included. So every `security definer` RPC that must change a guarded column (role,
  is_active, a brief's status) has to be owned by `postgres`, which is what `supabase db`
  migrations do, and must never copy such a value from its caller. The `zz` in the trigger
  name keeps the guard firing last, because BEFORE triggers run in name order; a new BEFORE
  trigger on those tables must sort before it.
- **Writes are limited by column grants** on `messages`, `conversations`, `applications` and
  `profiles` (see the migrations). A column added to one of those tables is not writable by
  users until a migration grants it.

## Database tests

`supabase/tests/database/*.test.sql` are [pgTAP](https://pgtap.org) tests for RLS
policies, triggers and RPCs. `npx supabase test db` runs them against the local
database (it pulls the `pg_prove` image the first time). Each file runs in a
transaction that rolls back, creates its own users in `auth.users`, and
impersonates them with the `tests.act_as(user_id)` helper it defines (a role
switch to `authenticated` plus `request.jwt.claims`, like a PostgREST request).
Test the denied cases as well as the allowed ones.

`npm run smoke` drives the same rules through the real Auth and REST API of the
local stack, as a client would. It creates throwaway users, deletes them again
and refuses to run against anything but a local stack.

## Production steps: security hardening

After the baseline repair, `npx supabase db push` applies the security
migrations. Order matters for one of them: the contact-details migration
(`hide_contact_and_tax_details`) revokes `profiles.email` and `phone`, which the
previous app version selects, so **deploy the app first, then run `db push`**
(the new app only needs the migration for the two profile pages, which show an
error until it lands). `profiles.email` now always follows the login's email
(`sync_profile_email`), so a profile write cannot probe for registered
addresses or redirect mail.

Then check that nobody already holds an unexpected admin role:

```sql
select id, email, role, updated_at from public.profiles where role = 'admin';
```

Conversations could be planted through an insert policy that is now closed (the
`project_status_guard_and_policy_cleanup` migration stops new ones and makes messaging
require a conversation that matches its application). Look for any that already exist,
before and after `db push`; they are not deleted by a migration, so a person decides:

```sql
select c.* from public.conversations c
where c.service_request_id is null
  and not exists (
    select 1 from public.applications a join public.projects p on p.id = a.project_id
    where a.id = c.application_id and a.project_id = c.project_id
      and a.provider_id = c.provider_id and p.client_id = c.client_id
  );
```

And that the GraphQL API (if enabled on the project) honours the column grants.
Signed in as a normal user, this must fail or omit the contact columns:

```graphql
{ profilesCollection { edges { node { fullName email phone } } } }
```

# Email verification setup

The application requires Supabase **Confirm email** to remain enabled. Supabase
Auth enforces confirmation before password sign-in; the login action also rejects
a session whose user lacks `email_confirmed_at`. Disabling Confirm email causes
Supabase to mark new users confirmed automatically, so an application timestamp
check cannot replace this project setting.

## Local and staging configuration

1. Set `NEXT_PUBLIC_SITE_URL` to the origin of this environment, for example
   `http://localhost:3000` or your fixed `https://<project>.vercel.app` staging URL.
   This is an origin only: no path, query, credentials or fragment. Without it,
   Vercel's `VERCEL_URL` is used; other production hosts fail closed.
2. Set `AUTH_RATE_LIMIT_SECRET` on the deployment (existing auth requirement).
3. In Supabase Authentication > Sign In / Providers, keep **Confirm email** on.
4. In URL Configuration, set Site URL to the environment's origin and allow its
   callback redirects. An entry `https://<exact-staging-host>/**` allows paths and
   queries only on that host; add `http://localhost:3000/**` for development if
   using this project locally. Avoid a wildcard that trusts every Vercel host.
5. Keep using controlled test addresses while the built-in mailer is enabled.
   Its authorized-recipient restrictions and project-wide email limits still
   apply. Application resend controls do not increase those limits.

No remote setting is changed by this repository. Review these settings manually
before testing the deployed flow. Do not replay SQL migrations to configure Auth.

## Confirmation template

`templates/confirmation.html` is the proposed hosted Confirm sign up template.
Subject: `Confirm your WorkBridge email`.

Apply it under Authentication > Emails > Confirm sign up when template editing is
available. Newer Free projects using the built-in mailer may require custom SMTP
first. Committing this HTML alone does not change Supabase's hosted template.

The app always passes an `emailRedirectTo` ending in `/auth/confirm?next=...`
for both signup and resend. The template appends `&token_hash=...&type=signup` to
`.RedirectTo`, so it must be paired with these app actions. It supports opening
the link on another browser/device. The callback consumes the token, ends only
that local session, and redirects to password sign-in with a sanitized `next`.

The unchanged built-in template (`.ConfirmationURL`) is also supported through
the callback's PKCE code exchange. That exchange requires the browser/device
where signup began. If it fails on another device, try password sign-in (the
email may already be confirmed), or request a fresh confirmation email. The
built-in resend link may use the older implicit flow and verify upstream before
returning to the recovery page; password sign-in can then succeed. Apply the
provided token-hash template before the full signup/resend browser test.

Invalid, expired and used links redirect to `/verify-email` without forwarding
tokens or provider error details. Callback responses are private/no-store.
Confirmation links are one-time secrets: don't copy live links into logs, issues
or test fixtures. Email scanners that follow links can consume a one-time link;
resend is the recovery path in this version.

## Resend behavior

Resend shares the existing `register_ip` server-side rate-limit budget with signup
(5 attempts/hour/IP); it needs no new RPC or migration. Supabase additionally
enforces its own recipient and email limits. The UI applies a cooldown, while the
server remains authoritative. Known, unknown, already-confirmed and throttled
addresses receive the same response, without disclosing account existence.

## Manual verification

- Signup as client and provider: check-inbox screen replaces the signup form.
- An unconfirmed account cannot sign in or reach its role dashboard.
- Signup and resend use this environment's callback, including a safe `next`.
- Confirm, sign in, and check that the role/profile is provisioned correctly.
- Confirm on another browser using the custom template.
- Expired/used/malformed links show the recovery page, never a raw auth error.
- Resend validates email, prevents rapid repetition and preserves `next`.
- No callback or `next` value can redirect to an external host or another auth
  callback. Existing role-home fallback and marketplace login return still work.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[SSR email confirmation](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs),
[PKCE limitations](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[resend API](https://supabase.com/docs/reference/javascript/auth-resend).

## Admin moderation backend

Migration: `20261019100000_admin_moderation.sql`. Apply the migration before
deploying the dependent application code. The baseline repair instructions above
still apply to a hosted project that predates this migration history. Do not
blindly replay baseline migrations. This feature does not create an admin user.

The backend exposes `GET /api/admin/overview`, and paginated
`GET /api/admin/{users,projects,services,audit}?page=1&filter=all` (20 rows).
User filters: all/active/suspended/banned/deleted; listing filters:
all/hidden/visible. Reads are authenticated, admin-only, and private/no-store.

`POST /api/admin/moderation` requires a same-origin JSON request:

```json
{
  "targetType": "service",
  "targetId": "<uuid>",
  "decision": "hide",
  "reason": "The listing contains misleading information."
}
```

Listing decisions: hide/restore/delete, for project or service. User decisions:
suspend/ban/reactivate/delete. Suspend requires `suspendedUntil` (future ISO
timestamp). Reasons are trimmed, 10-2000 characters, and visible to the affected
owner through `moderation_events` RLS. Admins cannot moderate themselves or other
admins. The SQL RPCs recheck authorization independently of HTTP handlers.

Suspensions expire through the DB access predicate, without cron. Ban/deletion
blocks access immediately, including existing JWTs at RLS and write triggers.
Login and dashboard proxy also check this predicate. Keep Auth email confirmation
enabled: confirmation proves control of a mailbox; no SMTP probing is used.

Deleted listings detach conversations and retain their original title. Chat
history survives and is read-only after deletion. Hidden listings do not prevent
existing conversations from continuing. Project-only conversations remain
read-only. Active service workrooms and assigned projects block listing deletion;
hide the listing instead. Account deletion retains these active references for
the remaining participant. A later admin deletion may remove the listing once
the engagement is resolved. This backend does not introduce a force-complete action.

Account deletion requires server-only `SUPABASE_SERVICE_ROLE_KEY`. The app uses it
only for `auth.admin.deleteUser(id, true)` after the actor's session-authorized RPC
has blocked the account and anonymized its profile. Auth deletion is a separate
operation: on failure the response is 503 and `auth_deleted_at` stays null. Retry
the same command; it neither repeats the audit event nor deletes Auth twice.
`GET /api/admin/overview` reports pending Auth deletions. No background retry is
installed. Never prefix this key with `NEXT_PUBLIC_`.

A private, randomly generated HMAC key and normalized email fingerprints prevent
re-registration of banned/deleted email addresses, including direct Auth calls
and email-change attempts. Back up `private.moderation_secret` along with the
blocklist: replacing the key invalidates existing fingerprints. Email aliases
are distinct addresses; this is not a claim to identify the same person across
different mailboxes. Fingerprints are retained until unban, or indefinitely for
deleted accounts under the confirmed anti-re-registration rule. Messages and
their original text are retained; personal data inside messages is not scrubbed.

Optional hosted Auth Hook: Before User Created -> Postgres function
`public.before_user_created_moderation`. It gives a controlled registration error.
The `auth.users` trigger independently enforces the invariant even when that
hook is not configured. Configure it manually on the intended project; deployment
does not change remote Auth settings. See [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
and [Auth soft deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

Local checks: `npx supabase start`, `npx supabase test db`, `npm run test`,
`npx tsc --noEmit`, `npm run lint`, `npx next build --webpack`.
Browser acceptance after the admin UI is connected: hide/restore both listing
types, delete a listing with chat, block deletion with active work, suspend/expire,
ban/unban, delete/retry Auth deletion, attempt registration with a blocked email,
verify owner reason visibility and outsider denial. Frontend UI for moderation
and archived conversation labels is intentionally a separate feature.
