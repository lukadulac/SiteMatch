-- Participants can mark received messages as read and bump a conversation, nothing else.

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

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider@example.test'),
  ('00000000-0000-0000-0000-00000000d001', 'outsider@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider', 'provider@example.test'),
  ('00000000-0000-0000-0000-00000000d001', 'client', 'Outsider', 'outsider@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Brief', 'brief', 'A brief', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000d001', 'Other brief', 'other-brief', 'Another brief', 'published');

insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000b001', 'Hello', 'shortlisted');

insert into public.conversations (id, project_id, client_id, provider_id, application_id, updated_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a1', '2020-01-01 00:00:00+00');

insert into public.messages (id, conversation_id, sender_id, message_text) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000b001', 'From the provider'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c001', 'From the client');

-- Messages: the recipient marks a message as read.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.messages set is_read = true where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'the recipient can mark a message as read'
);

select is(
  tests.rows_affected($$update public.messages set is_read = true where id = '00000000-0000-0000-0000-0000000000e2'$$),
  0::bigint,
  'marking your own sent message as read touches no rows'
);

select throws_ok(
  $$update public.messages set message_text = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501',
  null,
  'the recipient cannot rewrite a message'
);

select throws_ok(
  $$update public.messages set message_text = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000e2'$$,
  '42501',
  null,
  'the sender cannot rewrite their own message'
);

select throws_ok(
  $$update public.messages set sender_id = '00000000-0000-0000-0000-00000000c001' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501',
  null,
  'nobody can change who sent a message'
);

select throws_ok(
  $$update public.messages set is_read = true, message_text = 'Rewritten' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501',
  null,
  'is_read cannot carry another column along with it'
);

select throws_ok(
  $$update public.messages set conversation_id = '00000000-0000-0000-0000-0000000000c2' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501',
  null,
  'nobody can move a message to another conversation'
);

-- Sending and reading are unchanged.
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, message_text)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c001', 'A new message')$$,
  'a participant can still send a message'
);

select is(
  (select count(*) from public.messages),
  3::bigint,
  'a participant still reads every message in their conversation'
);

-- Inserts only set the columns the app sets: no pre-read messages, no forged timestamps.
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, message_text, is_read)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c001', 'Spoofed', true)$$,
  '42501',
  null,
  'a message cannot be inserted already marked as read'
);

select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, message_text, created_at)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c001', 'Spoofed', '2099-01-01')$$,
  '42501',
  null,
  'a message cannot be inserted with a forged created_at'
);

select throws_ok(
  $$insert into public.conversations (project_id, client_id, provider_id, application_id, updated_at)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001',
            '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a1', '2099-01-01')$$,
  '42501',
  null,
  'a conversation cannot be inserted with a forged updated_at'
);

-- An outsider reaches nothing.
select tests.act_as('00000000-0000-0000-0000-00000000d001');

select is(
  tests.rows_affected($$update public.messages set is_read = true where id = '00000000-0000-0000-0000-0000000000e2'$$),
  0::bigint,
  'an outsider''s update of someone else''s message touches no rows'
);

reset role;

select results_eq(
  $$select id::text, is_read, message_text from public.messages
    where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')
    order by id$$,
  $$values ('00000000-0000-0000-0000-0000000000e1', true, 'From the provider'),
           ('00000000-0000-0000-0000-0000000000e2', false, 'From the client')$$,
  'only the recipient''s read mark landed, and no text or sender changed'
);

-- Conversations: a participant bumps updated_at and nothing else.
select tests.act_as('00000000-0000-0000-0000-00000000b001');

select lives_ok(
  $$update public.conversations set updated_at = now() where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'a participant can bump a conversation''s updated_at'
);

select throws_ok(
  $$update public.conversations set client_id = '00000000-0000-0000-0000-00000000b001' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501',
  null,
  'a participant cannot change who the client is'
);

select throws_ok(
  $$update public.conversations set provider_id = '00000000-0000-0000-0000-00000000d001' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501',
  null,
  'a participant cannot swap the provider for someone else'
);

select throws_ok(
  $$update public.conversations set project_id = '00000000-0000-0000-0000-0000000000f2' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501',
  null,
  'a participant cannot relink the conversation to another brief'
);

select throws_ok(
  $$update public.conversations set application_id = null where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501',
  null,
  'a participant cannot detach the conversation from its application'
);

select tests.act_as('00000000-0000-0000-0000-00000000d001');

select is(
  tests.rows_affected($$update public.conversations set updated_at = now() where id = '00000000-0000-0000-0000-0000000000c1'$$),
  0::bigint,
  'an outsider''s update of someone else''s conversation touches no rows'
);

reset role;

select results_eq(
  $$select client_id::text, provider_id::text, project_id::text, updated_at > '2020-01-02 00:00:00+00'
    from public.conversations where id = '00000000-0000-0000-0000-0000000000c1'$$,
  $$values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001',
            '00000000-0000-0000-0000-0000000000f1', true)$$,
  'the participants and links are intact and the bump landed'
);

-- Signed-out callers cannot update either table.
reset role;
set local role anon;

select throws_ok(
  $$update public.messages set is_read = true$$,
  '42501',
  null,
  'anon cannot update messages'
);

select throws_ok(
  $$update public.conversations set updated_at = now()$$,
  '42501',
  null,
  'anon cannot update conversations'
);

reset role;

-- The service role (the backend) is not narrowed.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select lives_ok(
  $$update public.messages set message_text = 'Moderated' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'the service role can still edit a message (moderation)'
);

reset role;

select is(
  (select message_text from public.messages where id = '00000000-0000-0000-0000-0000000000e1'),
  'Moderated',
  'the service role edit landed'
);

select * from finish();

rollback;
