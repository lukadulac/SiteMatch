-- Each hiring event notifies exactly the right person once.

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

select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider-two@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Ana Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Marko Provider', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Iva Provider', 'provider-two@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Salon booking site', 'ne-salon', 'd', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c001', 'Bakery menu', 'ne-bakery', 'd', 'published');

insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status, published_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Brand identity',
   'A complete brand identity package for small businesses, delivered in two weeks.', 'Branding', 'Design', 'published', now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000b002', 'Logo refresh',
   'A quick refresh of an existing logo with three directions to choose from.', 'Branding', 'Design', 'published', now());

-- Seeded directly, so the "received" notifications they trigger are cleared below.
insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b001', 'Hire me', 'shortlisted'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b002', 'Or me', 'pending'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000b002', 'Bakery', 'pending');

insert into public.provider_service_requests (id, service_id, client_id, provider_id, message, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'Logo for the salon please', 'pending'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002', 'Refresh our bakery logo', 'pending');

delete from public.notifications;

-- Hiring on a brief ----------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');
select lives_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  'the client hires provider one'
);

reset role;

select results_eq(
  $$select n.user_id::text, n.type, n.entity_type, n.entity_id = w.id, n.title
    from public.notifications n
    join public.service_workrooms w on w.application_id = '00000000-0000-0000-0000-0000000000a1'
    where n.type = 'application_accepted'$$,
  $$values ('00000000-0000-0000-0000-00000000b001', 'application_accepted', 'workroom', true,
            'Ana Client hired you for Salon booking site')$$,
  'the hired provider is notified once, pointing at the workroom'
);

select results_eq(
  $$select user_id::text, entity_type, entity_id::text, title
    from public.notifications where type = 'application_rejected'$$,
  $$values ('00000000-0000-0000-0000-00000000b002', 'application', '00000000-0000-0000-0000-0000000000a2',
            'Your application to Salon booking site was not selected')$$,
  'the provider who was not hired is told once'
);

-- Cancelling a brief tells its applicants ------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000c001');
select lives_ok(
  $$select * from public.cancel_project('00000000-0000-0000-0000-0000000000f2')$$,
  'the client cancels the bakery brief'
);

reset role;

select is(
  (select count(*)::integer from public.notifications
    where type = 'application_rejected' and entity_id = '00000000-0000-0000-0000-0000000000a3'
      and user_id = '00000000-0000-0000-0000-00000000b002'),
  1,
  'the applicant of the cancelled brief is told once'
);

-- Service requests -------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000b001');
select lives_ok(
  $$select * from public.accept_provider_service_request('00000000-0000-0000-0000-0000000000d1')$$,
  'provider one accepts the logo request'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');
select lives_ok(
  $$select * from public.reject_provider_service_request('00000000-0000-0000-0000-0000000000d2')$$,
  'provider two declines the bakery request'
);

reset role;

select results_eq(
  $$select n.user_id::text, n.entity_type, n.entity_id = w.id, n.title
    from public.notifications n
    join public.service_workrooms w on w.service_request_id = '00000000-0000-0000-0000-0000000000d1'
    where n.type = 'service_request_accepted'$$,
  $$values ('00000000-0000-0000-0000-00000000c001', 'workroom', true,
            'Marko Provider accepted your request for Brand identity')$$,
  'the client is told once that the request was accepted, pointing at the workroom'
);

select results_eq(
  $$select user_id::text, entity_type, entity_id::text, title
    from public.notifications where type = 'service_request_rejected'$$,
  $$values ('00000000-0000-0000-0000-00000000c001', 'service_request', '00000000-0000-0000-0000-0000000000d2',
            'Iva Provider declined your request for Logo refresh')$$,
  'the client is told once that the request was declined'
);

-- Completing work --------------------------------------------------------------------

select tests.act_as('00000000-0000-0000-0000-00000000b001');
select lives_ok(
  $$select * from public.complete_service_workroom(
      (select id from public.service_workrooms where application_id = '00000000-0000-0000-0000-0000000000a1'))$$,
  'provider one completes the project workroom'
);

reset role;

select results_eq(
  $$select user_id::text, entity_type, title
    from public.notifications where type = 'workroom_completed'$$,
  $$values ('00000000-0000-0000-0000-00000000c001', 'workroom', 'Marko Provider marked Salon booking site completed')$$,
  'the client is told once that the work is completed'
);

select results_eq(
  $$select type, count(*)::integer from public.notifications group by type order by type$$,
  $$values ('application_accepted', 1), ('application_rejected', 2), ('service_request_accepted', 1),
           ('service_request_rejected', 1), ('workroom_completed', 1)$$,
  'every event wrote exactly one notification and nothing else was written'
);

select * from finish();

rollback;
