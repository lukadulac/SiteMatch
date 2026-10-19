# Module: provider-taxonomy

Depends on: schema-baseline. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Clients describe briefs with structured taxonomy (service type, business domain, goals, features), but providers only have free text, so nothing can be matched. The provider tables for these signals exist and are empty. This module lets providers fill them in on their profile.

## Scope

Tasks 11 and 12 in `tasks/todo.md`.

## Decisions

- Options come from the same taxonomy tables and queries as the brief form (`getProjectFormMeta`), so client and provider pick from identical lists.
- One `set_provider_taxonomy` security-definer RPC replaces the caller's rows in `provider_service_types`, `provider_business_domains`, `provider_languages`, `provider_goal_focuses` and `provider_feature_capabilities` atomically. Task 11 covers the first three; Task 12 extends the same RPC.
- Languages: at least one, exactly one primary.
- Feature capabilities carry a strength: basic, strong or expert.
- Provider profile completion requires at least one service type, so the dashboard nudges providers to fill it in.

## Success Criteria

- [ ] A provider can pick service types, business domains, languages (one primary), goal focuses and feature capabilities with strength, save, and see them on reload.
- [ ] Saving replaces the previous selection completely; a failed save changes nothing.
- [ ] Unknown taxonomy ids, a missing primary language, or a caller who isn't the profile's owner are refused (zod at the action, pgTAP for the RPC).
- [ ] Profile completion reports missing service types.

## Production Steps After Merge

`npx supabase db push`.

## Out of Scope

Showing the taxonomy on Find Talent filters (possible follow-up), admin editing of taxonomy lists.
