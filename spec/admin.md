# Module: admin

Depends on: security-hardening. Shared rules: [SPEC.md](../SPEC.md).

## Objective

`/dashboard/admin` is a placeholder. Staff need to vouch for providers and remove bad actors. `provider_profiles.is_verified` and `profiles.is_active` exist, but nothing sets them and nothing reads `is_active`.

## Scope

Tasks 20 and 21 in `tasks/todo.md`.

## Decisions

- Admin writes go through the existing `is_admin()` policies; after `security-hardening`, only admins can change `role`, `is_active` and `is_verified`.
- `is_active = false` is enforced in three places: the login action refuses the user, `proxy.ts` ends an existing session, and the user's listings and open briefs leave public pages.
- An admin cannot deactivate themselves or change their own role.
- The first admin is set by a person in production SQL after merge; there is no self-service path.

## Success Criteria

- [ ] An admin sees providers (unverified first) and can toggle verified; a verified badge shows on Find Talent.
- [ ] An admin sees users and can deactivate and reactivate them, but not themselves.
- [ ] A deactivated user can't log in, is signed out on their next request, and their listings and briefs disappear from public pages; reactivating restores them.
- [ ] Non-admins get no access to admin pages (proxy) or admin writes (pgTAP).

## Production Steps After Merge

`npx supabase db push` if the module adds migrations, then set the first admin:

```sql
update public.profiles set role = 'admin' where email = '<staff email>';
```

## Out of Scope

Audit log, admin editing of listings or briefs, impersonation.
