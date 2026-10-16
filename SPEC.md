# Spec: SiteMatch roadmap

Shared rules for every module. Each module has its own spec in `spec/<module-id>.md`; the capability map below is the index. Task-level acceptance criteria live in `tasks/todo.md`, the build order and risks in `tasks/plan.md`.

## Objective

SiteMatch is a marketplace that connects small businesses (**clients**) with web providers (**providers**: freelancers, agencies, studios). It has two hiring flows:

- **Project flow:** a client posts a brief (`/oglasi`), providers find it (`/jobs`) and apply, the client accepts one application.
- **Service flow:** a provider lists services, clients find them (`/find-talent`) and request one, the provider accepts and a workroom opens.

Both flows stop at "accepted" today, and the database has known security holes. This initiative makes the platform safe, finishes hires (workroom, completion, review), tells people what happened (notifications, email), recommends matches, and gives staff (**admins**) and users the account tools a launch needs.

Success: every module's success criteria are met, CI is green on `main`, and each merged module's database changes are applied to production after merge.

## Capability map

| Module id | Responsibility | Tasks | Depends on | Spec |
|---|---|---|---|---|
| `schema-baseline` | Migrations reproduce production | 1 ✓ | — | [spec](spec/schema-baseline.md) |
| `security-hardening` | Close the RLS holes found in the baseline | S1–S4 | schema-baseline | [spec](spec/security-hardening.md) |
| `ci` | Lint, typecheck, test, build and database checks on every PR | 2 | — | [spec](spec/ci.md) |
| `password-reset` | Forgot password → recovery link → new password | 3–5 | — | [spec](spec/password-reset.md) |
| `hiring-loop` | Cancel brief, workrooms for project hires, completion | 6–8 | schema-baseline | [spec](spec/hiring-loop.md) |
| `reviews` | Reviews and ratings on Find Talent | 26, 9, 10 | hiring-loop | [spec](spec/reviews.md) |
| `provider-taxonomy` | Provider profile captures matching signals | 11, 12 | schema-baseline | [spec](spec/provider-taxonomy.md) |
| `notifications` | Outbox, header bell, inbox, email via Resend | 13–15 | hiring-loop, reviews | [spec](spec/notifications.md) |
| `matching` | Match scores, recommended briefs, suggested providers | 16–18 | provider-taxonomy | [spec](spec/matching.md) |
| `admin` | Verify providers, deactivate users | 20, 21 | security-hardening | [spec](spec/admin.md) |
| `account` | Change password and email, delete account | 22, 23 | password-reset, hiring-loop | [spec](spec/account.md) |
| `polish` | Landing page, route boundaries, metadata, `/jobs` pagination | 19, 24, 25 | — | [spec](spec/polish.md) |

Build order: schema-baseline → security-hardening → ci → password-reset → hiring-loop → reviews → provider-taxonomy → notifications → matching → admin → account → polish

Module ids are stable; never rename one.

## Decisions

| Decision | Choice | Module |
|---|---|---|
| Who completes a hire | The provider marks the workroom complete; the project completes with it. Client confirmation is out of scope for v1. | hiring-loop |
| Email provider | Resend, for notification email and as Supabase Auth SMTP | notifications |
| Account deletion | Anonymise app data, then delete the auth user with the service-role key (server only) | account |
| "Enterprise" nav item | Removed | polish |
| Landing page design | No Figma; follows the existing UI | polish |
| Branching | Every task on one branch, `feat/daddy-is-here`, one commit per task in build order; no per-module branches. A person pushes it and opens the PR. | all |
| Where work happens | Only on this machine: code, the local Supabase stack, Docker. Nothing is pushed, deployed or sent to an outside service. Production steps are done by a person after merge to `main`. | all |
| RLS and RPC tests | pgTAP tests run by `supabase test db` (no new npm dependency) | security-hardening onward |

## Tech Stack

- Next.js 16.2.4 (App Router, `proxy.ts` instead of middleware). **Not the Next.js in training data:** read the matching guide in `node_modules/next/dist/docs/` before using any Next.js API.
- React 19.2.4, TypeScript 5, Tailwind CSS 4
- Supabase: Postgres 17 with RLS, Auth (email + password, confirm email on), Realtime for messages. `@supabase/ssr` 0.10, `@supabase/supabase-js` 2.104, CLI 2.121 as a dev dependency
- zod 4 for input validation, Vitest 4 with v8 coverage
- Hosted on Vercel; Resend for email (from `notifications`)

## Commands

```
Dev:            npm run dev                      # Next.js on http://localhost:3000
Build:          npm run build
Lint:           npm run lint
Typecheck:      npx tsc --noEmit                 # npm run typecheck once `ci` lands
Test:           npm test                         # vitest run
One test file:  npx vitest run tests/unit/<name>.test.ts
Coverage:       npm run test:coverage

Local DB start: npx supabase start               # builds from migrations + seed.sql
Local DB reset: npx supabase db reset            # rebuild after pulling or adding migrations
DB tests:       npx supabase test db             # pgTAP tests in supabase/tests/database
New migration:  npx supabase migration new <name>
Types:          npx supabase gen types typescript --local --schema public > types/supabase.ts
                # then format to the existing style (Prettier defaults, print width 100)
Local DB stop:  npx supabase stop
Local mail:     http://127.0.0.1:54324           # Mailpit, catches auth emails
```

Production only, by a person, after the branch is merged to `main`: `npx supabase link --project-ref fnbpwevsubtcdnrfjjak` (the repo stays unlinked during development), then `npx supabase migration repair …` (once, for the baseline) and `npx supabase db push`. Each module spec lists its post-merge steps; the build workflow never runs them.

Local setup that keeps work on this machine: `.env.local` points the app at the local stack (`.env` points at production), Next.js and Supabase CLI telemetry are disabled (`npx next telemetry disable`, `npx supabase telemetry disable`), and the Supabase project is unlinked (`npx supabase unlink`), so a command without `--local` fails instead of reaching production.

## Project Structure

```
app/                      Routes (App Router). Server actions in app/**/actions.ts
  (auth)/                 Login, register and their actions
  auth/confirm/           Email confirmation callback
  dashboard/{client,provider,admin}/   Role dashboards
  find-talent/, jobs/, oglasi/          Marketplace pages
components/<area>/        UI components by feature
lib/<area>/schemas.ts     zod schemas and parsers for that area
lib/<area>/service.ts     Data access: takes a SupabaseClient, returns { data } | { error }
lib/<area>/queries.ts     Read-only queries shared by pages
lib/supabase/             Supabase clients (browser, server, middleware) and env
proxy.ts                  Role guards for /dashboard/* and /oglasi/novi
types/supabase.ts         Generated database types; never edit by hand
supabase/migrations/      Schema history; the only way to change the schema
supabase/tests/database/  pgTAP tests for RLS policies and RPCs
supabase/seed.sql         Taxonomy reference data for local databases
supabase/templates/       Auth email templates
tests/unit/, tests/routes/  Vitest tests; tests/helpers/ holds the Supabase stub
spec/                     Module specs (this file is the index)
tasks/                    plan.md and todo.md
```

## Code Style

Data access lives in `lib/<area>/service.ts`, takes the client as an argument and returns a result instead of throwing:

```ts
export async function completeWorkroomForProvider(
	supabase: SupabaseClient<Database>,
	_userId: string,
	workroomId: string,
): Promise<Result<{ id: string; status: ServiceWorkroomStatus }>> {
	const { data, error } = await supabase.rpc("complete_service_workroom", {
		target_workroom_id: workroomId,
	});

	if (error) {
		return { error: error.message };
	}

	const workroom = data?.[0];

	if (!workroom) {
		return { error: "Workroom could not be completed." };
	}

	return { data: { id: workroom.workroom_id, status: workroom.workroom_status } };
}
```

State changes that touch several rows or need checks the caller can't bypass are `security definer` RPCs:

```sql
create or replace function public.complete_service_workroom(target_workroom_id uuid)
returns table (workroom_id uuid, workroom_status public.service_workroom_status)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;
  -- update ... where w.provider_id = current_user_id ... returning ...
end;
$function$;

revoke all on function public.complete_service_workroom(uuid) from public;
grant execute on function public.complete_service_workroom(uuid) to authenticated;
```

Conventions:

- Server actions (`"use server"`) parse `FormData`, validate with the area's zod schema, call a service, then `revalidatePath` / `redirect`. Form actions return `DashboardActionState` (`formError`, `fieldErrors`, `fields`).
- Redirect targets from user input go through `getSafeReturnPath` (`lib/auth/return-url.ts`).
- RPC error messages are user-facing sentences (`'Service request could not be accepted.'`); never return raw database errors from auth flows.
- Named exports; camelCase for TypeScript, snake_case for SQL and RPC arguments (`target_<thing>_id`).
- No formatter is configured. Match the indentation of the file you edit; new files use tabs.
- UI copy is English.

## Testing Strategy

| Level | Tool | Location | Covers |
|---|---|---|---|
| Unit and action | Vitest + `tests/helpers/supabase-stub.ts` | `tests/unit/` | Services, schemas, server actions. Assert on the returned result and the recorded calls (table, operation, payload), never on column strings. |
| Route | Vitest | `tests/routes/` | Route handlers and page-level behaviour (auth callbacks, redirects, headers) |
| Database | pgTAP via `npx supabase test db` | `supabase/tests/database/` | RLS policies and RPCs on the local database, including what a user must *not* be able to do |
| Migration guard | Vitest | `tests/unit/migrations-define-rpcs.test.ts` | Every `rpc()` the app calls is defined in a migration |
| Manual | Browser, local stack | — | Each module's flow as client, provider and (where relevant) admin |

- Test-driven: write the failing test first, then the code.
- Every new `lib/` function and server action gets Vitest tests; every new policy or RPC gets a pgTAP test, including denied cases.
- No browser end-to-end framework for now (Playwright would be a new dependency).
- Coverage: no global threshold; new and changed code is covered.

## Boundaries

**Always**
- Run lint, typecheck, `npm test`, `npx supabase test db` and `npm run build` before each commit; one commit per task.
- Read the relevant guide in `node_modules/next/dist/docs/` before using a Next.js API.
- Change the schema only through a new migration, then regenerate `types/supabase.ts` and add pgTAP tests.
- Validate user input with zod at the action boundary; enforce permissions in RLS or RPCs, not only in the UI.
- Write `security definer` functions with `set search_path = ''`, an `auth.uid()` check, and `revoke … from public` + `grant execute … to authenticated`.
- Work against the local Supabase stack, with the app on `.env.local`.

**Ask first**
- Adding an npm dependency (`resend` is pre-approved for `notifications`).
- Auth or permission changes: new or changed RLS policies, RPC privileges, auth flows (sign-off per task).
- Anything that needs a new environment variable or secret.
- Changing `supabase/config.toml` auth settings or the CI workflow outside the `ci` module.
- Deleting or rewriting user data in a migration (backfills that only add rows are fine).

**Never**
- Send anything off this machine: no `git push` or PRs, no deploys, no command against the remote Supabase project (`db push`, `migration repair`, SQL, dumps, `migration list` on the linked project), no real calls to outside services (email is logged locally, never sent), no publishing docs. Downloading packages and Docker images is fine.
- Edit a migration that has been merged; add a new one instead.
- Commit secrets or `.env*` files; expose the service-role key to the browser (no `NEXT_PUBLIC_` prefix, server-only modules).
- Disable RLS on a table, or grant a table to `anon` without a policy that needs it.
- Skip, delete or weaken a failing test without approval.

## Success Criteria

- Every module's success criteria in `spec/` are met and checked off in `tasks/todo.md`.
- CI is required on `main` and green.
- A fresh local database built from migrations passes `npx supabase test db` and the full hire flow for both flows.
- After merge, every merged module's production steps are done in build order and production matches the migrations.
- No known critical security issue is open.

## Open Questions

None blocking. Deferred beyond this initiative: client confirmation of completion, inviting a suggested provider, persisting matches to the `matches` table.
