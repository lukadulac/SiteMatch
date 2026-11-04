-- A client cancels their own brief through cancel_project; open applications are rejected.

begin;

create extension if not exists pgtap with schema extensions;

create schema tests;
grant usage on schema tests to authenticated, anon;

-- Acts as a signed-in user for the rest of the transaction, like a PostgREST request.
create function tests.act_as(user_id uuid)
returns void
language plpgsql
as $function$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$function$;

grant execute on function tests.act_as(uuid) to authenticated, anon;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider-two@example.test'),
  ('00000000-0000-0000-0000-00000000b003', 'provider-three@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Other Client', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Provider Two', 'provider-two@example.test'),
  ('00000000-0000-0000-0000-00000000b003', 'provider', 'Provider Three', 'provider-three@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Discussion', 'cp-discussion', 'd', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000c001', 'Draft', 'cp-draft', 'd', 'draft'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c001', 'Assigned', 'cp-assigned', 'd', 'assigned'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000c001', 'Completed', 'cp-completed', 'd', 'completed'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000c001', 'Published', 'cp-published', 'd', 'published'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000c002', 'Other published', 'cp-other', 'd', 'published');

-- Open applications of every kind on the in-discussion brief, plus one already
-- withdrawn, which must stay withdrawn.
insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b001', 'p', 'pending'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b002', 'v', 'shortlisted'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b003', 'w', 'withdrawn'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000b001', 'h', 'accepted'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000b002', 'o', 'pending');

-- Denied cases ------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select throws_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a1')$$,
  'P0002',
  'Project not found.',
  'another client cannot cancel the brief'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a1')$$,
  'P0002',
  'Project not found.',
  'an applicant cannot cancel the brief'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a1')$$,
  '42501',
  null,
  'anon cannot call cancel_project'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select throws_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a3')$$,
  '42501',
  'A brief that was assigned or completed cannot be cancelled.',
  'an assigned brief cannot be cancelled'
);

select throws_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a4')$$,
  '42501',
  'A brief that was assigned or completed cannot be cancelled.',
  'a completed brief cannot be cancelled'
);

select throws_ok(
  $$update public.projects set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  '42501',
  'Cancel a brief with cancel_project.',
  'a plain update cannot cancel a brief'
);

select throws_ok(
  $$insert into public.projects (client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-00000000c001', 'Sneaky', 'cp-sneaky', 'd', 'cancelled')$$,
  '42501',
  'Cancel a brief with cancel_project.',
  'a brief cannot be created already cancelled'
);

-- Cancelling ----------------------------------------------------------------------

select results_eq(
  $$select project_status::text, rejected_applications from public.cancel_project('00000000-0000-0000-0000-0000000000a1')$$,
  $$values ('cancelled', 2)$$,
  'the client cancels an in-discussion brief and its two open applications are rejected'
);

reset role;

select is(
  (select status::text from public.projects where id = '00000000-0000-0000-0000-0000000000a1'),
  'cancelled',
  'the brief is cancelled'
);

select results_eq(
  $$select id::text, status::text from public.applications
    where project_id = '00000000-0000-0000-0000-0000000000a1' order by id$$,
  $$values
    ('00000000-0000-0000-0000-0000000000f1', 'rejected'),
    ('00000000-0000-0000-0000-0000000000f2', 'rejected'),
    ('00000000-0000-0000-0000-0000000000f3', 'withdrawn')$$,
  'open applications are rejected and a withdrawn one stays withdrawn'
);

select is(
  (select status::text from public.applications where id = '00000000-0000-0000-0000-0000000000f5'),
  'pending',
  'applications on other briefs are untouched'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select project_status::text, rejected_applications from public.cancel_project('00000000-0000-0000-0000-0000000000a1')$$,
  $$values ('cancelled', 0)$$,
  'cancelling twice returns the brief as it is'
);

select lives_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000a2')$$,
  'a draft brief can be cancelled'
);

select throws_ok(
  $$update public.projects set status = 'published' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  'A cancelled brief cannot be reopened.',
  'a cancelled brief cannot be published again'
);

select lives_ok(
  $$update public.projects set title = 'Renamed' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'other columns of a cancelled brief can still change'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select is(
  (select count(*)::integer from public.projects where id = '00000000-0000-0000-0000-0000000000a1' and status in ('published', 'in_discussion')),
  0,
  'the cancelled brief leaves the marketplace'
);

select is(
  (select status::text from public.applications where id = '00000000-0000-0000-0000-0000000000f2'),
  'rejected',
  'the applicant sees their application as rejected'
);

select * from finish();

rollback;
