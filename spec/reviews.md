# Module: reviews

Depends on: hiring-loop. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Clients choosing a provider have no signal of past work. `provider_profiles.average_rating` and `total_reviews` exist but nothing writes them. After a completed workroom, the client can review the provider, and ratings show on Find Talent.

## Scope

Task 26 first (tests for `lib/provider-services/service.ts`, at 6.7% coverage, which Task 10 changes), then Tasks 9 and 10 in `tasks/todo.md`.

## Decisions

- `reviews` table keyed on the workroom: one review per completed workroom, written by its client about its provider. `rating` 1–5, `comment` up to 1,000 characters. No editing or deleting in v1.
- `submit_workroom_review` security-definer RPC checks the caller is the workroom's client and the workroom is completed, inserts the review, and recomputes the provider's `average_rating` and `total_reviews`.
- Reviews are public, like published listings. The reviewer appears by first name, copied onto the review when it's submitted, so public pages never need to read `profiles`.
- "Top rated" sort orders by `average_rating`, then `total_reviews`; providers with no reviews sort last.

## Success Criteria

- [ ] `lib/provider-services/service.ts`, `app/dashboard/provider/services/actions.ts` and `app/find-talent/[id]/actions.ts` have tests for every exported function before they change.
- [ ] The client of a completed workroom can leave one review; a second attempt, the provider, or anyone else is refused (pgTAP and Vitest).
- [ ] The provider's average and count update with each review.
- [ ] `/find-talent` cards show stars and count; `/find-talent/[id]` shows them plus the three latest reviews; both work signed out.
- [ ] "Top rated" sort works with pagination and other filters.

## Production Steps After Merge

`npx supabase db push`.

## Out of Scope

Provider replies, review moderation, reviews of clients by providers.
