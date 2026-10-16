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
migrations. Then check that nobody already holds an unexpected admin role:

```sql
select id, email, role, updated_at from public.profiles where role = 'admin';
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
