# Module: polish

Depends on: nothing; can run any time. Shared rules: [SPEC.md](../SPEC.md).

## Objective

Rough edges a launch can't have: the home page says "Home Page", two header links go nowhere, unknown routes and errors fall back to defaults, detail pages share one generic title, and `/jobs` loads every open brief at once.

## Scope

Tasks 19, 24 and 25 in `tasks/todo.md`.

## Decisions

- Landing page in the existing UI style (no Figma): headline, client and provider calls to action, a three-step "How it works" (`#how-it-works`), recent published services.
- The "Enterprise" header item is removed; "How It Works" links to `/#how-it-works`.
- Route boundaries per the Next.js 16 docs in `node_modules/next/dist/docs/`: `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, a dashboard `loading.tsx`.
- `generateMetadata` on `/find-talent/[id]` and `/jobs/[id]`.
- `/jobs` paginates with the same page parsing and `.range()` approach as `lib/provider-services/find-talent-query.ts`.

## Success Criteria

- [ ] `/` shows the landing page signed in and out; every header link resolves.
- [ ] Unknown URLs render the custom not-found page with a 404; a thrown error renders the error page with a retry.
- [ ] Detail pages have their own titles and descriptions.
- [ ] `/jobs` shows a fixed page size with next and previous links; invalid page numbers fall back to page 1.

## Production Steps After Merge

None.

## Out of Scope

Full redesign, SEO beyond page metadata, analytics.
