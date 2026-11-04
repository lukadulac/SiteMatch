-- Accepting a project application opens a workroom; a workroom has exactly one source.

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

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider-two@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Other Client', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Provider Two', 'provider-two@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Brief one', 'pw-brief-one', 'd', 'in_discussion');

insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b001', 'Hire me', 'shortlisted'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b002', 'Or me', 'pending');

-- A service request workroom, the shape that existed before.
insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Brand identity',
   'A complete brand identity package for small businesses, delivered in two weeks.', 'Branding', 'Design', 'draft');

insert into public.provider_service_requests (id, service_id, client_id, provider_id, message, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'Logo please', 'accepted');

-- Accepting opens the workroom ----------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select application_status::text, conversation_id is not null, workroom_id is not null
    from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  $$values ('accepted', true, true)$$,
  'accepting returns the conversation and the new workroom'
);

reset role;

select results_eq(
  $$select project_id::text, client_id::text, provider_id::text, status::text,
           service_request_id is null, service_id is null
    from public.service_workrooms
    where application_id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001',
            '00000000-0000-0000-0000-00000000b001', 'active', true, true)$$,
  'exactly one active workroom links the application, its brief, the client and the provider'
);

select is(
  (select count(*)::integer from public.service_workrooms where project_id = '00000000-0000-0000-0000-0000000000f1'),
  1,
  'the brief has one workroom'
);

-- Who sees it --------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select is(
  (select count(*)::integer from public.service_workrooms where application_id = '00000000-0000-0000-0000-0000000000a1'),
  1,
  'the client sees the workroom'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select is(
  (select count(*)::integer from public.service_workrooms where application_id = '00000000-0000-0000-0000-0000000000a1'),
  1,
  'the hired provider sees the workroom'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select is(
  (select count(*)::integer from public.service_workrooms where application_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'the rejected applicant does not see it'
);

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  (select count(*)::integer from public.service_workrooms where application_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'another client does not see it'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select throws_ok(
  $$insert into public.service_workrooms (application_id, project_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$,
  '42501',
  null,
  'a client cannot open a workroom directly'
);

-- One source, one workroom per hire ----------------------------------------------

reset role;

select throws_ok(
  $$insert into public.service_workrooms (application_id, project_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001')$$,
  '23505',
  null,
  'an application cannot have a second workroom'
);

select throws_ok(
  $$insert into public.service_workrooms (service_request_id, service_id, application_id, project_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
            '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$,
  '23514',
  null,
  'a workroom cannot have both sources'
);

select throws_ok(
  $$insert into public.service_workrooms (client_id, provider_id)
    values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$,
  '23514',
  null,
  'a workroom cannot have neither source'
);

select throws_ok(
  $$insert into public.service_workrooms (application_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000a2',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$,
  '23514',
  null,
  'a project workroom needs both the application and the brief'
);

select lives_ok(
  $$insert into public.service_workrooms (service_request_id, service_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001')$$,
  'a service request workroom is created as before'
);

select results_eq(
  $$select prosecdef, 'search_path=""' = any(proconfig) from pg_proc
    where oid = 'public.accept_project_application(uuid)'::regprocedure$$,
  $$values (true, true)$$,
  'accept_project_application is still security definer with an empty search_path'
);

select * from finish();

rollback;
