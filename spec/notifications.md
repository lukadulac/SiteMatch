# Module: notifications

Depends on: hiring-loop, reviews. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Nobody learns that something happened unless they open the right page: a new application, an accepted request, a completed workroom. This module records every event in an outbox, shows it in the app (header bell and inbox), and emails it through Resend.

## Scope

Tasks 13–15 in `tasks/todo.md`.

## Decisions

- **Outbox in the database.** A `notifications` table (`user_id`, `type`, `entity_type`, `entity_id`, `title`, `read_at`, `emailed_at`, `created_at`) readable and markable-read by its owner only. Rows are written in the same transaction as the event: inside the RPCs, and by a trigger on `applications` insert.
- **Events:** new application (to the client), service request received (to the provider), application accepted or rejected, service request accepted or rejected, workroom completed (to the client), review received (to the provider).
- **Email through Resend** (`resend` npm package, pre-approved). The dispatcher is server-only code using a service-role Supabase client (`lib/supabase/admin.ts`, `import "server-only"`), because it reads other users' notifications. It runs right after the action that created the notification, and a scheduled sweep (Vercel Cron calling a route protected by `CRON_SECRET`) sends anything left unsent, as often as the Vercel plan allows.
- Each email sets `emailed_at`; a failed send leaves it null for the sweep to retry.
- **Opt-out:** `profiles.email_notifications` (default on), editable on the profile page. The in-app notifications always appear.
- Without `RESEND_API_KEY` (local development), the dispatcher logs the email instead of sending it.
- Resend also becomes Supabase Auth's SMTP in production, lifting the built-in mailer's limits for confirmation and reset emails.
- New environment variables, approved by this spec: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EMAIL_FROM`. None are `NEXT_PUBLIC_`.

## Success Criteria

- [ ] Each listed event creates exactly one notification for the right user, in the same transaction (pgTAP).
- [ ] The header shows an unread count of notifications plus unread messages; `/dashboard/notifications` lists them, marks one or all read, and links to the item.
- [ ] A user can read and mark only their own notifications (pgTAP).
- [ ] Each notification is emailed at most once; failures are retried by the sweep; opted-out users get no email.
- [ ] The sweep route rejects requests without the cron secret.
- [ ] The service-role client is imported only from server-only modules (a test fails if a client component imports it).

## Production Steps After Merge

1. In Resend: verify the sending domain, create an API key.
2. In Vercel: add `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EMAIL_FROM`; confirm the cron is registered.
3. In Supabase: set Authentication → SMTP to Resend.
4. `npx supabase db push`.

## Out of Scope

Push notifications, digests, per-event email preferences, realtime updates to the bell (a page load is enough in v1).
