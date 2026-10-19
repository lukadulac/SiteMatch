-- Profile role and active status can only be changed by admins.

begin;

create extension if not exists pgtap with schema extensions;

create schema tests;
grant usage on schema tests to authenticated;

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

-- Acts as the service role: a request with no user behind it.
create function tests.act_as_service_role()
returns void
language plpgsql
as $function$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end;
$function$;

grant execute on function tests.act_as(uuid) to authenticated;

-- Stands in for any security definer function owned by the database owner.
create function tests.definer_set_role(target_id uuid, new_role public.user_role)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.profiles set role = new_role where id = target_id;
$function$;

grant execute on function tests.definer_set_role(uuid, public.user_role) to authenticated;

select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000c003', 'new-client@example.test'),
  ('00000000-0000-0000-0000-00000000c004', 'new-admin@example.test'),
  ('00000000-0000-0000-0000-00000000c005', 'banned-client@example.test'),
  ('00000000-0000-0000-0000-00000000c006', 'provider@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test');

insert into public.profiles (id, role, full_name, email, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client One', 'client@example.test', true),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Client Two', 'other-client@example.test', true),
  ('00000000-0000-0000-0000-00000000c005', 'client', 'Banned Client', 'banned-client@example.test', false),
  ('00000000-0000-0000-0000-00000000c006', 'provider', 'Provider', 'provider@example.test', true),
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', 'admin@example.test', true);

-- Provisioning: a new user creates their own profile.
select tests.act_as('00000000-0000-0000-0000-00000000c003');

select lives_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c003', 'client', 'New Client', 'new-client@example.test')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name$$,
  'a new user can provision their own client profile'
);

select tests.act_as('00000000-0000-0000-0000-00000000c004');

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c004', 'admin', 'Sneaky', 'new-admin@example.test')$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a new user cannot provision themselves as admin'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email, is_active)
    values ('00000000-0000-0000-0000-00000000c004', 'client', 'Inactive', 'new-admin@example.test', false)$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a new user cannot provision an inactive profile'
);

-- Existing user: profile form updates and repeated provisioning still work.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.profiles
    set full_name = 'Client Renamed', phone = '+381600000', country = 'Serbia', city = 'Novi Sad'
    where id = '00000000-0000-0000-0000-00000000c001'$$,
  'a user can update their own name, phone, country and city'
);

select lives_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c001', 'client', 'Client Upserted', 'client@example.test')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name$$,
  'an upsert that repeats the same role succeeds'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a user cannot make themselves admin'
);

select throws_ok(
  $$update public.profiles set role = 'provider' where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a user cannot switch their own role'
);

select throws_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a user cannot change their own active status'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c001', 'admin', 'Client One', 'client@example.test')
    on conflict (id) do update set role = excluded.role$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'an upsert cannot smuggle in the admin role'
);

-- A deactivated user cannot reactivate themselves.
select tests.act_as('00000000-0000-0000-0000-00000000c005');

select throws_ok(
  $$update public.profiles set is_active = true where id = '00000000-0000-0000-0000-00000000c005'$$,
  '42501',
  'Account unavailable.',
  'a deactivated user cannot reactivate themselves with an update'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c005', 'client', 'Banned Client', 'banned-client@example.test')
    on conflict (id) do update set is_active = excluded.is_active$$,
  '42501',
  'Account unavailable.',
  'a deactivated user cannot reactivate themselves with an upsert'
);

-- An upsert cannot switch an existing provider to another non-admin role either.
select tests.act_as('00000000-0000-0000-0000-00000000c006');

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c006', 'client', 'Provider', 'provider@example.test')
    on conflict (id) do update set role = excluded.role$$,
  '42501',
  'Only admins can set a profile role or active status.',
  'a provider cannot become a client through an upsert'
);

-- Someone else's profile is out of reach, whatever the column.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.profiles set role = 'admin', is_active = false
    where id = '00000000-0000-0000-0000-00000000c002'$$,
  'updating another user''s profile is silently filtered out by row level security'
);

reset role;

select results_eq(
  $$select role::text, is_active, full_name, phone, country, city
    from public.profiles where id = '00000000-0000-0000-0000-00000000c001'$$,
  $$values ('client', true, 'Client Upserted', '+381600000', 'Serbia', 'Novi Sad')$$,
  'denied changes left the client profile as the allowed ones set it'
);

select results_eq(
  $$select role::text, is_active from public.profiles where id = '00000000-0000-0000-0000-00000000c002'$$,
  $$values ('client', true)$$,
  'the other client''s role and status are untouched'
);

-- Admins, the service role and owner-owned security definer functions can change both columns.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000c002'$$,
  '42501', 'Use the moderation action.', 'admin deactivation must be audited through moderation'
);
update public.profiles set role = 'provider'
where id = '00000000-0000-0000-0000-00000000c002';
select public.admin_moderate_user('00000000-0000-0000-0000-00000000c002', 'ban', 'Account violates marketplace rules.');

reset role;

select results_eq(
  $$select role::text, is_active from public.profiles where id = '00000000-0000-0000-0000-00000000c002'$$,
  $$values ('provider', true)$$,
  'an admin can change another user role; moderation controls account access separately'
);

select tests.act_as_service_role();

select lives_ok(
  $$update public.profiles set role = 'client', is_active = true
    where id = '00000000-0000-0000-0000-00000000c002'$$,
  'the service role (no user behind the request) can change role and active status'
);

reset role;

select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$select tests.definer_set_role('00000000-0000-0000-0000-00000000c001', 'provider')$$,
  'a security definer function owned by the database owner can change a role'
);

reset role;

select results_eq(
  $$select role::text, is_active from public.profiles where id = '00000000-0000-0000-0000-00000000c002'
    union all
    select role::text, is_active from public.profiles where id = '00000000-0000-0000-0000-00000000c001'$$,
  $$values ('client', true), ('provider', true)$$,
  'the service role and the definer function changes were applied'
);

select * from finish();

rollback;
