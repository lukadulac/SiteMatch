-- Only the workroom's provider completes it; completing a project workroom completes the brief.

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

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider-two@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Provider Two', 'provider-two@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Brief one', 'pwc-brief-one', 'd', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c001', 'Brief two', 'pwc-brief-two', 'd', 'published');

insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b001', 'Hire me', 'shortlisted');

insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Brand identity',
   'A complete brand identity package for small businesses, delivered in two weeks.', 'Branding', 'Design', 'draft');

insert into public.provider_service_requests (id, service_id, client_id, provider_id, message, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'Logo please', 'accepted');

insert into public.service_workrooms (id, service_request_id, service_id, client_id, provider_id) values
  ('00000000-0000-0000-0000-000000000ee1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001');

-- The client hires provider one, which opens the project workroom.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

create temp table hired on commit drop as
  select workroom_id from public.accept_project_application('00000000-0000-0000-0000-0000000000a1');
grant select on hired to authenticated;

-- Denied cases ------------------------------------------------------------------

select throws_ok(
  $$select * from public.complete_service_workroom((select workroom_id from hired))$$,
  'P0001',
  'Workroom could not be completed.',
  'the client cannot complete the workroom'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select throws_ok(
  $$select * from public.complete_service_workroom((select workroom_id from hired))$$,
  'P0001',
  'Workroom could not be completed.',
  'another provider cannot complete the workroom'
);

reset role;

select is(
  (select status::text from public.projects where id = '00000000-0000-0000-0000-0000000000f1'),
  'assigned',
  'the refused completions left the brief assigned'
);

select is(
  has_function_privilege('anon', 'public.complete_service_workroom(uuid)', 'execute'),
  false,
  'anon has no execute privilege on complete_service_workroom'
);

-- Completing --------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select results_eq(
  $$select workroom_status::text from public.complete_service_workroom((select workroom_id from hired))$$,
  $$values ('completed')$$,
  'the hired provider completes the project workroom'
);

reset role;

select results_eq(
  $$select w.status::text, w.completed_at is not null, p.status::text
    from public.service_workrooms w
    join public.projects p on p.id = w.project_id
    where w.id = (select workroom_id from hired)$$,
  $$values ('completed', true, 'completed')$$,
  'the workroom and its brief are both completed'
);

select is(
  (select status::text from public.projects where id = '00000000-0000-0000-0000-0000000000f2'),
  'published',
  'other briefs are untouched'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$select * from public.complete_service_workroom((select workroom_id from hired))$$,
  'P0001',
  'Workroom could not be completed.',
  'a completed workroom cannot be completed again'
);

-- Service request workrooms complete as before -------------------------------------

select results_eq(
  $$select workroom_status::text from public.complete_service_workroom('00000000-0000-0000-0000-000000000ee1')$$,
  $$values ('completed')$$,
  'the provider completes a service request workroom'
);

reset role;

select is(
  (select count(*)::integer from public.projects where status = 'completed'),
  1,
  'completing a service workroom completes no brief'
);

select * from finish();

rollback;
