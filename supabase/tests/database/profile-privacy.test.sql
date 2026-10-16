-- Signed-in users can read each other's names and locations, but not contact or tax details.

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

grant execute on function tests.act_as(uuid) to authenticated;

select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'other-client@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider@example.test'),
  ('00000000-0000-0000-0000-00000000c007', 'new-client@example.test'),
  ('00000000-0000-0000-0000-00000000c008', 'late-client@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test');

insert into public.profiles (id, role, full_name, email, phone, country, city) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client One', 'client@example.test', '+381 60 111', 'Serbia', 'Belgrade'),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Client Two', 'other-client@example.test', '+381 60 222', 'Serbia', 'Nis'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider@example.test', '+351 91 333', 'Portugal', 'Lisbon'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', 'admin@example.test', null, null, null);

insert into public.client_profiles (user_id, business_name, business_tax_id, project_idea) values
  ('00000000-0000-0000-0000-00000000c001', 'Client One Ltd', '100000001', 'A shop'),
  ('00000000-0000-0000-0000-00000000c002', 'Client Two Ltd', '100000002', 'A blog');

-- Other people: names and locations yes, contact details no.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select full_name, country, city from public.profiles
    where id = '00000000-0000-0000-0000-00000000b001'$$,
  $$values ('Provider One', 'Portugal', 'Lisbon')$$,
  'a user can read another user''s name, country and city'
);

select throws_ok(
  $$select email from public.profiles where id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501',
  null,
  'a user cannot read another user''s email'
);

select throws_ok(
  $$select phone from public.profiles where id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501',
  null,
  'a user cannot read another user''s phone'
);

select throws_ok(
  $$select * from public.profiles where id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501',
  null,
  'a user cannot read another user''s whole profile row'
);

select throws_ok(
  $$select count(*) from public.profiles where email = 'provider@example.test'$$,
  '42501',
  null,
  'a user cannot probe for another user''s email by filtering on it'
);

-- Own contact details come through the RPC, and only for the caller.
select results_eq(
  $$select email, phone from public.get_own_contact_details()$$,
  $$values ('client@example.test', '+381 60 111')$$,
  'a user reads their own email and phone through get_own_contact_details()'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select results_eq(
  $$select email, phone from public.get_own_contact_details()$$,
  $$values ('provider@example.test', '+351 91 333')$$,
  'get_own_contact_details() returns the caller''s details, not anyone else''s'
);

-- Editing own contact details still works, and the RPC shows the new value.
select lives_ok(
  $$update public.profiles set phone = '+351 91 444', city = 'Porto'
    where id = '00000000-0000-0000-0000-00000000b001'$$,
  'a user can edit their own phone and city'
);

select results_eq(
  $$select phone from public.get_own_contact_details()$$,
  $$values ('+351 91 444')$$,
  'the edited phone is what the RPC returns'
);

-- Provisioning writes email and phone for a new user, and must not need to read them back:
-- the app upserts with ON CONFLICT DO NOTHING (ignoreDuplicates).
select tests.act_as('00000000-0000-0000-0000-00000000c007');

select lives_ok(
  $$insert into public.profiles (id, role, full_name, email, phone, country, city)
    values ('00000000-0000-0000-0000-00000000c007', 'client', 'New Client', 'new-client@example.test', '+381 60 777', 'Serbia', 'Subotica')
    on conflict (id) do nothing$$,
  'the provisioning upsert (which writes email and phone) works for a new user'
);

select lives_ok(
  $$insert into public.profiles (id, role, full_name, email, phone, country, city)
    values ('00000000-0000-0000-0000-00000000c007', 'client', 'Overwritten', 'new-client@example.test', '+000', 'Serbia', 'Elsewhere')
    on conflict (id) do nothing$$,
  'repeating the provisioning upsert is harmless'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c007', 'client', 'New Client', 'new-client@example.test')
    on conflict (id) do update set email = excluded.email$$,
  '42501',
  null,
  'an upsert that rewrites email would have to read it, so it is not available (provisioning uses DO NOTHING)'
);

-- profiles.email follows the login, so it cannot be used to probe for registered addresses
-- (a unique violation on someone else's email) or to point mail at another address.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$update public.profiles set email = 'provider@example.test'
    where id = '00000000-0000-0000-0000-00000000c001'$$,
  'setting your profile email to a registered address does not reveal that it is registered'
);

select tests.act_as('00000000-0000-0000-0000-00000000c008');

select lives_ok(
  $$insert into public.profiles (id, role, full_name, email)
    values ('00000000-0000-0000-0000-00000000c008', 'client', 'Late Client', 'provider@example.test')
    on conflict (id) do nothing$$,
  'provisioning with a registered address does not reveal that it is registered'
);

reset role;

select results_eq(
  $$select id::text, email from public.profiles
    where id in ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c008')
    order by id$$,
  $$values ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
           ('00000000-0000-0000-0000-00000000c008', 'late-client@example.test')$$,
  'both profiles kept the email of their own login'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

-- The RPC is for signed-in users only.
select tests.act_as('00000000-0000-0000-0000-00000000b001');
set local role anon;

select throws_ok(
  $$select * from public.get_own_contact_details()$$,
  '42501',
  null,
  'anonymous callers cannot execute get_own_contact_details()'
);

-- Tax IDs and project ideas on client profiles are private to their owner (and admins).
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select business_name, business_tax_id from public.client_profiles$$,
  $$values ('Client One Ltd', '100000001')$$,
  'a client sees only their own client profile, tax ID included'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select is(
  (select count(*) from public.client_profiles),
  0::bigint,
  'a provider cannot read any client profile'
);

select tests.act_as('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*) from public.client_profiles),
  2::bigint,
  'an admin can read client profiles'
);

-- Reading names still works from every angle the app uses.
select tests.act_as('00000000-0000-0000-0000-00000000c002');

select is(
  (select count(*) from public.profiles where role = 'provider'),
  1::bigint,
  'filtering by role (a granted column) still works'
);

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000c001'),
  'Client One',
  'a client can read another client''s name'
);

-- Writes are not narrowed by the read grants.
reset role;

select results_eq(
  $$select phone, city from public.profiles where id = '00000000-0000-0000-0000-00000000b001'$$,
  $$values ('+351 91 444', 'Porto')$$,
  'the provider''s edits were saved'
);

select results_eq(
  $$select full_name, email, phone, city from public.profiles
    where id = '00000000-0000-0000-0000-00000000c007'$$,
  $$values ('New Client', 'new-client@example.test', '+381 60 777', 'Subotica')$$,
  'the provisioned profile kept its email and phone, and the repeat did not overwrite it'
);

select tests.act_as('00000000-0000-0000-0000-00000000c002');

select throws_ok(
  $$update public.profiles set phone = '+000' where id = '00000000-0000-0000-0000-00000000c001' returning phone$$,
  '42501',
  null,
  'an update cannot read back a column the user may not select'
);

-- Signed-out callers get the same columns and no rows.
reset role;
set local role anon;

select is(
  (select count(*) from public.profiles),
  0::bigint,
  'anon reads no profile rows (but the granted columns can be embedded without error)'
);

select throws_ok(
  $$select email from public.profiles$$,
  '42501',
  null,
  'anon cannot read profiles.email'
);

select throws_ok(
  $$select business_tax_id from public.client_profiles$$,
  '42501',
  null,
  'anon cannot read client_profiles'
);

reset role;

-- The grants are exactly the readable columns; a column added later is unreadable until granted.
select results_eq(
  $$select column_name::text collate "default" from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'SELECT'
    order by column_name$$,
  $$values ('avatar_url'), ('city'), ('country'), ('created_at'), ('full_name'),
           ('id'), ('is_active'), ('role'), ('updated_at')$$,
  'authenticated may select exactly the non-contact profile columns'
);

select results_eq(
  $$select column_name::text collate "default" from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'anon' and privilege_type = 'SELECT'
    order by column_name$$,
  $$values ('avatar_url'), ('city'), ('country'), ('created_at'), ('full_name'),
           ('id'), ('is_active'), ('role'), ('updated_at')$$,
  'anon may select exactly the same columns'
);

select * from finish();

rollback;
