# Module: password-reset

Depends on: nothing. Shared rules: [SPEC.md](../SPEC.md).

## Objective

A user who forgets their password has no way back in. This module adds the full reset flow without loosening the hardened email-confirmation callback.

## Scope

Tasks 3–5 in `tasks/todo.md`.

## Decisions

- Recovery gets its own callback, `app/auth/recovery/route.ts`. `app/auth/confirm/route.ts` keeps rejecting every token type except signup.
- The recovery email uses a custom template (`supabase/templates/recovery.html`) that appends `&token_hash={{ .TokenHash }}&type=recovery` to `{{ .RedirectTo }}`, so the link works on any device.
- The callback sets a short-lived httpOnly marker cookie; `/reset-password` renders only with it.
- Reset requests share the existing `register_ip` rate-limit budget; no database change.
- After a reset, every session is signed out (`signOut({ scope: "global" })`) and the user signs in again.
- The 8-character password rule moves to `lib/auth/password.ts` and is shared by register, reset and (later) account settings.
- Local config: `[auth.email.template.recovery]` in `supabase/config.toml`, so the flow is testable with Mailpit.

## Success Criteria

- [ ] Known, unknown and throttled emails all get the same "check your inbox" response; no account enumeration.
- [ ] A valid link lands on `/reset-password` with a recovery session; an expired, used or malformed link lands on `/forgot-password?error=link` with nothing forwarded.
- [ ] `/auth/confirm` still rejects recovery tokens.
- [ ] After a reset the new password works, the old one fails, and other devices are signed out.
- [ ] Mismatched or short passwords show field errors and change nothing.
- [ ] `/forgot-password`, `/reset-password` and the callback send `Cache-Control: no-store`.

## Production Steps After Merge

In the Supabase dashboard: paste `supabase/templates/recovery.html` into Authentication → Emails → Reset password, and check the redirect allow-list covers `/auth/recovery` on the production host.

## Out of Scope

Magic-link login, changing password while signed in (`account`).
