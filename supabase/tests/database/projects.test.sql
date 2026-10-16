-- Brief status is guarded, and every table has one coherent policy set.

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

select plan(45);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider-two@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Other Client', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider-one@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Provider Two', 'provider-two@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin', 'Admin', 'admin@example.test');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Published', 'published', 'd', 'published'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000c001', 'Draft', 'draft', 'd', 'draft'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c001', 'Assigned', 'assigned', 'd', 'assigned'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000c001', 'Discussion', 'discussion', 'd', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000c002', 'Other published', 'other-published', 'd', 'published'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000c002', 'Other draft', 'other-draft', 'd', 'draft');

-- Provider one was hired on the assigned brief.
insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000b001', 'Hired', 'accepted');

insert into public.client_profiles (user_id, business_name) values
  ('00000000-0000-0000-0000-00000000c001', 'Client Ltd'),
  ('00000000-0000-0000-0000-00000000c002', 'Other Client Ltd');

insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text) values
  ('00000000-0000-0000-0000-00000000b001', 'freelancer', '{other}', 'x');

insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Brand identity',
   'A complete brand identity package for small businesses, delivered in two weeks.', 'Branding', 'Design', 'draft');

insert into public.provider_service_requests (id, service_id, client_id, provider_id, message) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'We would like this service please.');

-- Who can read which briefs (the fixture is still pristine here).
reset role;
set local role anon;

select is(
  (select count(*) from public.projects),
  3::bigint,
  'a signed-out visitor sees only the published and in-discussion briefs'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select is(
  (select count(*) from public.projects),
  5::bigint,
  'a client sees their own four briefs plus the other client''s published one'
);

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  (select count(*) from public.projects),
  4::bigint,
  'the other client sees their own two briefs plus the two visible ones, not the first client''s draft or assigned brief'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select is(
  (select count(*) from public.projects),
  3::bigint,
  'a provider without an application sees only the visible briefs'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select is(
  (select count(*) from public.projects),
  4::bigint,
  'a provider also sees the brief they were hired on, once it is assigned'
);

select tests.act_as('00000000-0000-0000-0000-0000000000ad');

select is(
  (select count(*) from public.projects),
  6::bigint,
  'an admin sees every brief'
);

-- Brief status: published and in_discussion are the client''s to flip; assigned and completed are not.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.projects set status = 'in_discussion' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a client can move a published brief to in_discussion'
);

select lives_ok(
  $$update public.projects set status = 'published' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a client can move it back to published'
);

select throws_ok(
  $$update public.projects set status = 'assigned' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  'Only the hiring flow can set a brief to assigned or completed.',
  'a client cannot assign their own brief with a plain update'
);

select throws_ok(
  $$update public.projects set status = 'completed' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501',
  'Only the hiring flow can set a brief to assigned or completed.',
  'a client cannot complete a brief with a plain update'
);

select throws_ok(
  $$insert into public.projects (client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-00000000c001', 'Sneaky', 'sneaky-assigned', 'd', 'assigned')$$,
  '42501',
  'Only the hiring flow can set a brief to assigned or completed.',
  'a brief cannot be created already assigned'
);

select throws_ok(
  $$insert into public.projects (client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-00000000c001', 'Sneaky', 'sneaky-completed', 'd', 'completed')$$,
  '42501',
  'Only the hiring flow can set a brief to assigned or completed.',
  'a brief cannot be created already completed'
);

select lives_ok(
  $$insert into public.projects (client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-00000000c001', 'New draft', 'new-draft', 'd', 'draft')$$,
  'a client can still create a draft brief'
);

select lives_ok(
  $$insert into public.projects (client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-00000000c001', 'New published', 'new-published', 'd', 'published')$$,
  'a client can still publish a brief'
);

select lives_ok(
  $$update public.projects set title = 'Assigned (renamed)' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  'editing an assigned brief without touching its status is fine'
);

select throws_ok(
  $$update public.projects set status = 'published' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501',
  'Only the hiring flow can change the status of an assigned or completed brief.',
  'a client cannot undo a hire by moving an assigned brief back to published'
);

select throws_ok(
  $$update public.projects set status = 'draft' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501',
  'Only the hiring flow can change the status of an assigned or completed brief.',
  'a client cannot move an assigned brief back to draft'
);

select throws_ok(
  $$delete from public.projects where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501',
  'A brief that was assigned or completed cannot be deleted.',
  'a client cannot delete an assigned brief (the hire would cascade away)'
);

select throws_ok(
  $$insert into public.projects (id, client_id, title, slug, description, status)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Published', 'published', 'd', 'published')
    on conflict (id) do update set status = 'assigned'$$,
  '42501',
  null,
  'an upsert cannot assign a brief either'
);

select tests.act_as('00000000-0000-0000-0000-0000000000ad');

select throws_ok(
  $$update public.projects set status = 'assigned' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501',
  'Only the hiring flow can set a brief to assigned or completed.',
  'an admin session cannot assign a brief with a plain update either (the service role is for overrides)'
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select lives_ok(
  $$update public.projects set status = 'completed' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  'the service role can set any status'
);

reset role;

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select throws_ok(
  $$update public.projects set status = 'draft' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501',
  'Only the hiring flow can change the status of an assigned or completed brief.',
  'a completed brief cannot be reopened with a plain update'
);

reset role;

-- Who can write briefs.
select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  tests.rows_affected($$update public.projects set title = 'Hijacked' where id = '00000000-0000-0000-0000-0000000000a1'$$),
  0::bigint,
  'another client cannot edit a brief'
);

select is(
  tests.rows_affected($$delete from public.projects where id = '00000000-0000-0000-0000-0000000000a2'$$),
  0::bigint,
  'another client cannot delete a brief'
);

select throws_ok(
  $$insert into public.projects (client_id, title, slug, description)
    values ('00000000-0000-0000-0000-00000000c001', 'Forged', 'forged', 'd')$$,
  '42501',
  null,
  'a client cannot create a brief in someone else''s name'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select is(
  tests.rows_affected($$delete from public.projects where id = '00000000-0000-0000-0000-0000000000a2'$$),
  1::bigint,
  'a client can delete their own brief'
);

-- Conversations only exist for a real application or a real service request.
select tests.act_as('00000000-0000-0000-0000-00000000b002');

select throws_ok(
  $$insert into public.conversations (project_id, client_id, provider_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$,
  '42501',
  null,
  'a stranger cannot start a conversation about someone''s brief'
);

select throws_ok(
  $$insert into public.conversations (project_id, client_id, provider_id, application_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c001',
            '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'a stranger cannot take over the conversation of someone else''s application'
);

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select throws_ok(
  $$insert into public.conversations (project_id, client_id, provider_id, application_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c001',
            '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'a client cannot link the application to a provider who did not apply'
);

select lives_ok(
  $$insert into public.conversations (project_id, client_id, provider_id, application_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c001',
            '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000f1')$$,
  'a client can open the conversation of a real application'
);

select lives_ok(
  $$insert into public.conversations (client_id, provider_id, service_request_id)
    values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001',
            '00000000-0000-0000-0000-0000000000d1')$$,
  'a client can open the conversation of their own service request'
);

select tests.act_as('00000000-0000-0000-0000-00000000b002');

select throws_ok(
  $$insert into public.conversations (client_id, provider_id, service_request_id)
    values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001',
            '00000000-0000-0000-0000-0000000000d1')$$,
  '42501',
  null,
  'someone else cannot open a conversation on a service request'
);

-- The surviving policies still say what the dropped duplicates said.
select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  tests.rows_affected($$update public.profiles set city = 'Hijacked' where id = '00000000-0000-0000-0000-00000000c001'$$),
  0::bigint,
  'a user cannot edit someone else''s profile'
);

select is(
  tests.rows_affected($$update public.client_profiles set business_name = 'Hijacked' where user_id = '00000000-0000-0000-0000-00000000c001'$$),
  0::bigint,
  'a client cannot edit someone else''s client profile'
);

select is(
  tests.rows_affected($$update public.provider_profiles set about = 'Hijacked' where user_id = '00000000-0000-0000-0000-00000000b001'$$),
  0::bigint,
  'a user cannot edit someone else''s provider profile'
);

select throws_ok(
  $$insert into public.project_categories (name, slug) values ('Mine', 'mine')$$,
  '42501',
  null,
  'a client cannot add a project category'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select is(
  tests.rows_affected($$update public.provider_profiles set about = 'Mine' where user_id = '00000000-0000-0000-0000-00000000b001'$$),
  1::bigint,
  'a provider can edit their own provider profile'
);

select is(
  (select count(*) from public.provider_profiles),
  1::bigint,
  'provider profiles are readable by every signed-in user'
);

select tests.act_as('00000000-0000-0000-0000-0000000000ad');

select is(
  tests.rows_affected($$update public.profiles set city = 'Admin edit' where id = '00000000-0000-0000-0000-00000000c001'$$)
    + tests.rows_affected($$update public.client_profiles set business_name = 'Admin edit' where user_id = '00000000-0000-0000-0000-00000000c001'$$)
    + tests.rows_affected($$update public.provider_profiles set about = 'Admin edit' where user_id = '00000000-0000-0000-0000-00000000b001'$$),
  3::bigint,
  'an admin can edit profiles, client profiles and provider profiles'
);

select lives_ok(
  $$insert into public.project_categories (name, slug) values ('Admin category', 'admin-category')$$,
  'an admin can add a project category'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.client_profiles$$,
  '42501',
  null,
  'anon has no access to client profiles'
);

select is(
  tests.rows_affected($$update public.projects set title = 'x'$$),
  0::bigint,
  'anon cannot update briefs (row level security filters every row)'
);

select is(
  tests.rows_affected($$delete from public.projects$$),
  0::bigint,
  'anon cannot delete briefs (row level security filters every row)'
);

reset role;

-- One coherent policy set: policies for the same command and role OR together, so overlap means the
-- loosest wins. Only these audiences are split on purpose (public listing + owner view; client
-- review + provider withdrawal). ALL policies are write management (admin or owner) whose SELECT part
-- is already covered by the table's SELECT policy, so they are not counted; `public` means anon too.
reset role;

select results_eq(
  $$select tablename::text collate "default", cmd::text collate "default"
    from (
      select p.tablename, p.cmd, r.role
      from pg_policies p
      cross join lateral unnest(
        case when p.roles = '{public}'::name[] then array['anon', 'authenticated']::name[] else p.roles end
      ) as r(role)
      where p.schemaname = 'public' and p.cmd <> 'ALL'
      group by p.tablename, p.cmd, r.role
      having count(*) > 1
    ) split_policies
    group by tablename, cmd
    order by tablename, cmd$$,
  $$values ('applications', 'UPDATE'), ('projects', 'SELECT'), ('provider_service_listings', 'SELECT')$$,
  'only the intentional audience splits have more than one policy per command'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and policyname in (
    'profiles_insert_own', 'profiles_update_own', 'client_profiles_insert_own', 'client_profiles_update_own',
    'provider_profiles_insert_own', 'provider_profiles_update_own', 'provider_profiles_select_all_authenticated',
    'projects_delete_own', 'projects_insert_client_own', 'projects_update_own', 'projects_select_visible_or_own',
    'applications_select_related_users', 'conversations_select_participants', 'messages_select_conversation_participants',
    'project_categories_select_all_authenticated'
  )),
  0::bigint,
  'the narrower duplicate policies are gone'
);

select * from finish();

rollback;
