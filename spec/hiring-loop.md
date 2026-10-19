# Module: hiring-loop

Depends on: schema-baseline. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Both hiring flows stop at "accepted". A client can't cancel a brief, a project hire has no workroom, and nothing ever completes a project. This module carries a project hire through to completion, using the same workroom the service flow already has.

## Scope

Tasks 6–8 in `tasks/todo.md`.

## Decisions

- **Project hires reuse `service_workrooms`.** `service_request_id` and `service_id` become nullable; add `application_id` and `project_id`; a check constraint requires exactly one source (service request or application); unique index on `application_id`. One list page, one detail page, one completion RPC.
- `accept_project_application` creates the workroom in the same transaction. The migration backfills workrooms for projects already `assigned` (adds rows only).
- **The provider completes the hire.** `complete_service_workroom` also sets the project to `completed` when the workroom has a `project_id`. No client confirmation in v1.
- `cancel_project(target_project_id)` moves `draft`, `published` or `in_discussion` to `cancelled` and rejects pending applications in one transaction. Assigned briefs can't be cancelled.
- Existing RPC signatures for the service flow stay the same.

## Success Criteria

- [ ] A client can cancel a brief that isn't assigned; its pending applications become rejected and it leaves `/jobs`.
- [ ] Accepting an application opens a workroom both sides see in their workroom lists, with the brief's title and a link to it.
- [ ] When the provider completes a project workroom, the project shows `completed` to both sides.
- [ ] Projects that were `assigned` before the migration have a workroom.
- [ ] Service-flow workrooms behave exactly as before (existing tests pass unchanged).
- [ ] pgTAP: only the client can cancel their brief; only the workroom's provider can complete it; a workroom can't have both or neither source.

## Production Steps After Merge

`npx supabase db push` (includes the backfill).

## Out of Scope

Client-confirmed completion, disputes, payments, reopening a completed project.
