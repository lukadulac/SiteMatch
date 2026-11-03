-- Lists public briefs and services that look like test data, so they can be removed
-- before launch. Read-only: run it in the Supabase SQL editor of production, review
-- every row, then delete the ones that really are tests through /dashboard/admin
-- (Projects or Service listings -> Delete), which keeps the audit log and protects
-- conversations. Never delete these rows with plain SQL.
--
-- The patterns are guesses from what the live site showed on 2026-11-03 ("WB RPC
-- Recalc 1787134853857", a service whose description is keyboard mashing). Adjust them.

with candidates as (
  select 'project' as kind, p.id, p.title, left(p.description, 80) as description,
    p.status::text as status, p.created_at, pr.full_name as owner
  from public.projects p
  left join public.profiles pr on pr.id = p.client_id
  where not p.is_hidden
  union all
  select 'service', s.id, s.title, left(s.description, 80), s.status::text, s.created_at, pr.full_name
  from public.provider_service_listings s
  left join public.profiles pr on pr.id = s.provider_id
  where not s.is_hidden
)
select *,
  case
    when title ~* '(^|\W)(test|testing|regression|smoke|recalc|dummy|lorem|asdf|qwerty)(\W|$)' then 'test word in title'
    when title ~ '\d{10,}' then 'long number in title (timestamp?)'
    when description ~* '(test|regression|lorem ipsum)' then 'test word in description'
    when description ~* '[bcdfghjklmnpqrstvwxz]{6,}' then 'looks like keyboard mashing'
    when owner ~* '(test|wb test|demo)' then 'owner name looks like a test account'
  end as reason
from candidates
where title ~* '(^|\W)(test|testing|regression|smoke|recalc|dummy|lorem|asdf|qwerty)(\W|$)'
  or title ~ '\d{10,}'
  or description ~* '(test|regression|lorem ipsum)'
  or description ~* '[bcdfghjklmnpqrstvwxz]{6,}'
  or owner ~* '(test|wb test|demo)'
order by kind, created_at;
