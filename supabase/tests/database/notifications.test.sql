-- Applying and requesting a service each notify the other party; users only see and mark their own.

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

-- Rows an update touched, for asserting that row level security filtered it out.
create function tests.rows_affected(statement text)
returns bigint
language plpgsql
as $function$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$function$;

grant execute on function tests.rows_affected(text) to authenticated, anon;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Ana Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Other Client', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Marko Provider', 'provider@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Salon booking site', 'nt-salon', 'd', 'published');

insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status, published_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Brand identity',
   'A complete brand identity package for small businesses, delivered in two weeks.', 'Branding', 'Design', 'published', now());

-- A provider applies -------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select lives_ok(
  $$insert into public.applications (id, project_id, provider_id, cover_message)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-00000000b001', 'I would love to build this.')$$,
  'the provider applies to the brief'
);

reset role;

select results_eq(
  $$select user_id::text, type, entity_type, entity_id::text, title, read_at is null, emailed_at is null
    from public.notifications where type = 'application_received'$$,
  $$values ('00000000-0000-0000-0000-00000000c001', 'application_received', 'project',
            '00000000-0000-0000-0000-0000000000f1', 'Marko Provider applied to Salon booking site', true, true)$$,
  'the client gets exactly one unread notification about the application'
);

-- A client requests a service --------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$select public.request_provider_service('00000000-0000-0000-0000-0000000000e1', 'Please design our salon logo.')$$,
  'the client requests the service'
);

reset role;

select results_eq(
  $$select n.user_id::text, n.entity_type, n.entity_id = r.id, n.title
    from public.notifications n
    join public.provider_service_requests r on r.service_id = '00000000-0000-0000-0000-0000000000e1'
    where n.type = 'service_request_received'$$,
  $$values ('00000000-0000-0000-0000-00000000b001', 'service_request', true, 'Ana Client requested Brand identity')$$,
  'the provider gets exactly one notification pointing at the request'
);

select is(
  (select count(*)::integer from public.notifications),
  2,
  'nothing else was notified'
);

-- Who reads what --------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select type from public.notifications$$,
  $$values ('application_received')$$,
  'the client reads only their own notification'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select results_eq(
  $$select type from public.notifications$$,
  $$values ('service_request_received')$$,
  'the provider reads only their own notification'
);

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  (select count(*)::integer from public.notifications),
  0,
  'another client reads none'
);

select is(
  tests.rows_affected($$update public.notifications set read_at = now()$$),
  0::bigint,
  'another client cannot mark someone else''s notification read'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.notifications$$,
  '42501',
  null,
  'anon cannot read notifications'
);

-- Marking read, and nothing else ------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select is(
  tests.rows_affected($$update public.notifications set read_at = now()$$),
  1::bigint,
  'the client marks their notification read'
);

select throws_ok(
  $$update public.notifications set title = 'Changed'$$,
  '42501',
  null,
  'the client cannot change the title'
);

select throws_ok(
  $$update public.notifications set emailed_at = now()$$,
  '42501',
  null,
  'the client cannot mark it emailed'
);

select throws_ok(
  $$insert into public.notifications (user_id, type, entity_type, entity_id, title)
    values ('00000000-0000-0000-0000-00000000b001', 'application_received', 'project',
            '00000000-0000-0000-0000-0000000000f1', 'Fake')$$,
  '42501',
  null,
  'a user cannot write a notification for someone else'
);

select throws_ok(
  $$delete from public.notifications$$,
  '42501',
  null,
  'a user cannot delete notifications'
);

reset role;

select is(
  (select count(*)::integer from public.notifications where read_at is not null),
  1,
  'only the client''s notification is read'
);

select * from finish();

rollback;
