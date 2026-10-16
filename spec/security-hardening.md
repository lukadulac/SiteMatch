# Module: security-hardening

Depends on: schema-baseline. Shared rules: [SPEC.md](../SPEC.md).

## Objective

The production schema lets signed-in users do things the app never intended. The worst is that any signed-in user can make themselves an admin, and `is_admin()` then opens every admin policy on every table. This module closes those holes without changing what the app legitimately does, and sets up pgTAP so every later policy and RPC is tested against the real database.

Ship it in the same PR as `schema-baseline`, so production gets the fix as soon as possible.

## Findings (from the production dump, 2026-10-16)

| # | Hole | Severity |
|---|---|---|
| 1 | `profiles` insert and update policies don't restrict columns: a user can insert or update their own row with `role = 'admin'` (reproduced locally), or flip `is_active` | Critical |
| 2 | `profiles_select_own_or_public` (`using (true)`) lets every signed-in user read every profile's email and phone; `client_profiles_select_all_authenticated` exposes tax IDs and project ideas | High |
| 3 | `messages_update_participants_only` lets either participant rewrite any message in the conversation, including `message_text` and `sender_id` | High |
| 4 | `conversations_update_participants_only` lets a participant change `client_id`, `provider_id`, `project_id` | High |
| 5 | `applications_update_client_owner_or_admin` lets a client edit any column of applications on their briefs (cover message, price, provider); `accept_project_application` runs as the caller and depends on it | Medium |
| 6 | `projects_update_own` lets a client set any status, including `assigned` and `completed`, outside the hiring RPCs | Medium |
| 7 | Most tables have two overlapping policy sets (`"… by owner or admin"` and `snake_case_*`); permissive policies OR together, so the loosest wins | Medium (cause of 2–6) |

Accepted, not fixed here: the `auth_rate_limit_*` RPCs are executable by `anon`. Keys are HMACs with a server secret, so nobody can target another user's counter; the remaining risk is junk rows.

## What the App Legitimately Writes

Fixes must keep these working (found in `lib/` and `app/`):

- `profiles`: provisioning upsert (same role as before), profile form updates of name, phone, country, city.
- `client_profiles` / `provider_profiles`: owner upserts and updates.
- `applications`: provider inserts; client sets `status` to `viewed` or `shortlisted`; accept/reject/withdraw through RPCs.
- `conversations`: participant inserts; `updated_at` bump on new message.
- `messages`: sender inserts; recipient sets `is_read`.
- `projects`: client inserts and edits brief fields; status `published` ↔ `in_discussion`.

Reading other users' names, city and country is legitimate (messaging, workrooms, Find Talent, applications).

## Success Criteria

Each item is a pgTAP test on the local database, including the denied case:

- [ ] A user cannot insert their own profile with `role = 'admin'`, and cannot change `role` or `is_active` on their own profile. An admin can change both on any profile.
- [ ] Provisioning and profile-form updates still succeed.
- [ ] A signed-in user cannot read another user's `email` or `phone`, or another client's `business_tax_id`; they can still read their own, and other users' names, city and country.
- [ ] A participant can mark messages they received as read, but cannot change any message's text or sender.
- [ ] A participant can bump a conversation's `updated_at`, but cannot change who is in it or what it links to.
- [ ] A client cannot change an application's content or provider; direct status changes are limited to `viewed` and `shortlisted`. Accept, reject and withdraw still work through their RPCs.
- [ ] `accept_project_application` is `security definer` with `set search_path = ''`, with behaviour unchanged.
- [ ] A client cannot set a brief's status to `assigned` or `completed` directly.
- [ ] Each affected table has one coherent policy set; the overlapping duplicates are dropped.
- [ ] Existing Vitest suite and the local hire-flow smoke test still pass.

## Decisions

- Enforce column restrictions with column-level grants where the app's queries allow it, and `before insert or update` triggers where they don't (for example, `profiles.role` must allow an upsert that repeats the same role).
- `supabase/tests/database/*.test.sql` with pgTAP, run by `npx supabase test db`; tests switch role with `set local role authenticated` and set `request.jwt.claims` to impersonate users.

## Production Steps After Merge

After the `schema-baseline` repair: `npx supabase db push`. Then check that nobody already has an unexpected `admin` role:

```sql
select id, email, role, updated_at from public.profiles where role = 'admin';
```

## Out of Scope

Admin UI (`admin`), rate-limit RPC privileges, storage policies (no storage in use).
