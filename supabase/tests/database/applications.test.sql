-- Clients review applications (viewed / shortlisted); accept, reject and withdraw go through their RPCs.

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

-- Rows an update or delete touched, for asserting that row level security filtered it out.
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

select plan(39);

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
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Brief one', 'brief-one', 'First brief', 'published'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c001', 'Brief two', 'brief-two', 'Second brief', 'published'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000c001', 'Brief three', 'brief-three', 'Third brief', 'published'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000c001', 'Brief four', 'brief-four', 'Fourth brief', 'published'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000c001', 'Brief five', 'brief-five', 'Fifth brief', 'published'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000c001', 'Brief six', 'brief-six', 'Sixth brief', 'published');

-- Brief one: A1 (provider one) and A2 (provider two) compete; brief two: A4 is rejected via the RPC;
-- brief three: A5 is withdrawn by its provider. A3 is already rejected.
insert into public.applications (id, project_id, provider_id, cover_message, proposed_price, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b001', 'Pick me', 1000, 'pending'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b002', 'Pick me instead', 900, 'pending'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000b002', 'Old offer', 500, 'rejected'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000b001', 'Offer', 700, 'pending'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000b002', 'Offer', 800, 'pending'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000b001', 'Offer', 600, 'pending'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000b001', 'Offer', 650, 'pending'),
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000b001', 'Offer', 660, 'pending');

-- A conversation that does not belong to application a8's client: someone planted it.
insert into public.conversations (id, project_id, client_id, provider_id, application_id) values
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a8');

-- The client reviews an application.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.applications set status = 'viewed' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a client can mark an application as viewed'
);

select lives_ok(
  $$update public.applications set status = 'shortlisted' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a client can shortlist an application'
);

select throws_ok(
  $$update public.applications set status = 'accepted' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot accept an application with a plain update (accept_project_application does that)'
);

select throws_ok(
  $$update public.applications set status = 'rejected' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot reject an application with a plain update'
);

select throws_ok(
  $$update public.applications set status = 'withdrawn' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot withdraw someone else''s application'
);

select throws_ok(
  $$update public.applications set status = 'pending' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  null,
  'a client cannot move an application back to pending'
);

select throws_ok(
  $$update public.applications set cover_message = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot rewrite an applicant''s cover message'
);

select throws_ok(
  $$update public.applications set proposed_price = 1 where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot change an applicant''s price'
);

select throws_ok(
  $$update public.applications set provider_id = '00000000-0000-0000-0000-00000000b001' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot swap the provider on an application'
);

select throws_ok(
  $$update public.applications set project_id = '00000000-0000-0000-0000-0000000000f2' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a client cannot move an application to another brief'
);

select throws_ok(
  $$update public.applications set status = 'viewed', cover_message = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a status change cannot carry another column along with it'
);

select is(
  tests.rows_affected($$update public.applications set status = 'shortlisted' where id = '00000000-0000-0000-0000-0000000000a3'$$),
  0::bigint,
  'a client''s update of an already rejected application touches no rows'
);

-- Other people cannot review someone else's applications.
select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  tests.rows_affected($$update public.applications set status = 'viewed' where id = '00000000-0000-0000-0000-0000000000a2'$$),
  0::bigint,
  'another client''s update of an application on a brief they do not own touches no rows'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select throws_ok(
  $$update public.applications set status = 'accepted' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a provider cannot accept their own application'
);

select throws_ok(
  $$update public.applications set cover_message = 'Edited' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  null,
  'a provider cannot edit the cover message of an application after sending it'
);

-- Providers: withdrawing their own open application is the only status they can set.
select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$update public.applications set status = 'viewed' where id = '00000000-0000-0000-0000-0000000000a6'$$,
  '42501',
  null,
  'a provider cannot mark their own application as viewed'
);

select is(
  tests.rows_affected($$update public.applications set status = 'withdrawn' where id = '00000000-0000-0000-0000-0000000000a6'$$),
  1::bigint,
  'a provider can still withdraw their own open application with a plain update'
);

-- Applications are created as pending, never as accepted.
select tests.act_as('00000000-0000-0000-0000-00000000b002');

select throws_ok(
  $$insert into public.applications (project_id, provider_id, cover_message, status)
    values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000b002', 'Already accepted', 'accepted')$$,
  '42501',
  null,
  'a provider cannot insert an application that is already accepted'
);

select lives_ok(
  $$insert into public.applications (project_id, provider_id, cover_message, proposed_price, status)
    values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000b002', 'A normal offer', 500, 'pending')$$,
  'a provider can still apply with a pending application'
);

reset role;
set local role anon;

select throws_ok(
  $$update public.applications set status = 'viewed'$$,
  '42501',
  null,
  'anon cannot update applications'
);

reset role;

select results_eq(
  $$select id::text, status::text, cover_message, proposed_price::int from public.applications
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3')
    order by id$$,
  $$values ('00000000-0000-0000-0000-0000000000a1', 'shortlisted', 'Pick me', 1000),
           ('00000000-0000-0000-0000-0000000000a2', 'pending', 'Pick me instead', 900),
           ('00000000-0000-0000-0000-0000000000a3', 'rejected', 'Old offer', 500)$$,
  'only the allowed status changes landed; content and providers are intact'
);

-- Accept: assigns the brief, rejects the rest, opens the conversation.
select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001',
  'Application not found.',
  'a provider cannot accept an application (it is not their brief)'
);

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select throws_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001',
  'Application not found.',
  'another client cannot accept an application on a brief they do not own'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  '42501',
  null,
  'a signed-out caller cannot execute accept_project_application'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select application_id::text, application_status::text, conversation_id is not null
    from public.accept_project_application('00000000-0000-0000-0000-0000000000a1')$$,
  $$values ('00000000-0000-0000-0000-0000000000a1', 'accepted', true)$$,
  'the client accepts an application and gets its conversation'
);

reset role;

select results_eq(
  $$select (select status::text from public.projects where id = '00000000-0000-0000-0000-0000000000f1'),
           (select status::text from public.applications where id = '00000000-0000-0000-0000-0000000000a1'),
           (select status::text from public.applications where id = '00000000-0000-0000-0000-0000000000a2'),
           (select count(*) from public.conversations
             where application_id = '00000000-0000-0000-0000-0000000000a1'
               and client_id = '00000000-0000-0000-0000-00000000c001'
               and provider_id = '00000000-0000-0000-0000-00000000b001')$$,
  $$values ('assigned', 'accepted', 'rejected', 1::bigint)$$,
  'accepting assigned the brief, rejected the competing application and opened one conversation'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select throws_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a2')$$,
  'P0001',
  'This project is no longer accepting providers.',
  'nothing more can be accepted once the brief is assigned'
);

-- The normal path: the conversation already exists before the client accepts.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$insert into public.conversations (project_id, client_id, provider_id, application_id)
    values ('00000000-0000-0000-0000-0000000000f5',
            '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001',
            '00000000-0000-0000-0000-0000000000a7')$$,
  'the client opens a conversation with an applicant before accepting'
);

select results_eq(
  $$select conversation_id = (select id from public.conversations
                              where application_id = '00000000-0000-0000-0000-0000000000a7')
    from public.accept_project_application('00000000-0000-0000-0000-0000000000a7')$$,
  $$values (true)$$,
  'accepting links the conversation that already exists'
);

-- A planted conversation that does not match the application is never linked.
select throws_ok(
  $$select * from public.accept_project_application('00000000-0000-0000-0000-0000000000a8')$$,
  'P0001',
  'A conversation could not be opened for this application.',
  'accepting refuses to link a conversation that belongs to someone else'
);

reset role;

select is(
  (select status::text from public.applications where id = '00000000-0000-0000-0000-0000000000a8'),
  'pending',
  'the refused accept changed nothing'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

-- Reject and withdraw keep working.
select results_eq(
  $$select application_status::text, project_status::text
    from public.reject_project_application('00000000-0000-0000-0000-0000000000a4')$$,
  $$values ('rejected', 'published')$$,
  'the client can reject an application through the RPC'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select results_eq(
  $$select application_status::text from public.withdraw_project_application('00000000-0000-0000-0000-0000000000a5')$$,
  $$values ('withdrawn')$$,
  'a provider can withdraw their application through the RPC'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$select * from public.withdraw_project_application('00000000-0000-0000-0000-0000000000a5')$$,
  'P0001',
  'Application not found.',
  'a provider cannot withdraw someone else''s application'
);

-- The accept function runs with the owner's rights and a fixed search path.
reset role;

select results_eq(
  $$select prosecdef, 'search_path=""' = any(proconfig) from pg_proc
    where oid = 'public.accept_project_application(uuid)'::regprocedure$$,
  $$values (true, true)$$,
  'accept_project_application is security definer with an empty search_path'
);

select is(
  has_function_privilege('anon', 'public.accept_project_application(uuid)', 'execute'),
  false,
  'anon has no execute privilege on accept_project_application'
);

select is(
  has_function_privilege('authenticated', 'public.accept_project_application(uuid)', 'execute'),
  true,
  'authenticated may execute accept_project_application'
);

-- The service role is not narrowed.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select lives_ok(
  $$update public.applications set cover_message = 'Moderated' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  'the service role can still edit an application'
);

reset role;

select is(
  (select cover_message from public.applications where id = '00000000-0000-0000-0000-0000000000a5'),
  'Moderated',
  'the service role edit landed'
);

select * from finish();

rollback;
