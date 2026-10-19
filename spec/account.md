# Module: account

Depends on: password-reset, hiring-loop. Shared rules: [SPEC.md](../SPEC.md).

## Objective

A signed-in user can't change their password or email, or leave the platform. This module adds an account section to both profile pages.

## Scope

Tasks 22 and 23 in `tasks/todo.md`.

## Decisions

- **Change password** requires the current password and reuses `lib/auth/password.ts`. **Change email** sends a confirmation to the new address (Supabase's email-change flow, double confirm on); `profiles.email` updates once confirmed.
- **Delete account** after retyping the email:
  1. A security-definer RPC anonymises the user's data: name becomes "Deleted user", email becomes a unique placeholder, phone and city are cleared, services are unpublished, open briefs are cancelled (`cancel_project`), pending applications are withdrawn. Messages and reviews stay, shown as "Deleted user".
  2. A server action then deletes the auth user with the service-role client (`lib/supabase/admin.ts`, introduced in `notifications`), and signs the session out.
- **Schema consequence:** `profiles.id` currently references `auth.users` with `on delete cascade`, and most tables cascade from `profiles`. Deleting the auth user would wipe the other party's conversations, messages and reviews, or fail on `restrict` keys. The migration drops that foreign key so the anonymised profile outlives the login. A pgTAP test proves deletion leaves other users' data intact.

## Success Criteria

- [ ] Password change fails with a wrong current password and succeeds otherwise, signing out other sessions; both password and email changes are rate limited.
- [ ] Email change takes effect only after the new address confirms.
- [ ] After deletion: the user can't log in, their email can register again, their profile reads "Deleted user", their public listings and open briefs are gone, and the other side of each conversation and review still sees its history.
- [ ] Deletion requires the retyped email and a recent sign-in; nobody can delete another user (pgTAP).

## Production Steps After Merge

`SUPABASE_SERVICE_ROLE_KEY` already set (from `notifications`), then `npx supabase db push`.

## Out of Scope

Data export, delayed deletion or undo, admin-initiated deletion.
