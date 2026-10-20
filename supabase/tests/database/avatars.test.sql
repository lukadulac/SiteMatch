-- Profile pictures: users upload only into their own avatars folder and
-- profiles.avatar_url only points at a file in that folder.

begin;

create extension if not exists pgtap with schema extensions;

create schema tests;
grant usage on schema tests to authenticated, anon;

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

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'owner@avatars.test'),
  ('00000000-0000-4000-8000-00000000a002', 'other@avatars.test'),
  ('00000000-0000-4000-8000-00000000a003', 'admin@avatars.test'),
  ('00000000-0000-4000-8000-00000000a004', 'suspended@avatars.test');

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-4000-8000-00000000a001', 'client', 'Owner', 'owner@avatars.test'),
  ('00000000-0000-4000-8000-00000000a002', 'provider', 'Other', 'other@avatars.test'),
  ('00000000-0000-4000-8000-00000000a003', 'admin', 'Admin', 'admin@avatars.test'),
  ('00000000-0000-4000-8000-00000000a004', 'client', 'Suspended', 'suspended@avatars.test');

insert into public.account_moderation (user_id, status, suspended_until, reason) values
  ('00000000-0000-4000-8000-00000000a004', 'suspended', now() + interval '1 day', 'Suspended for the avatar test.');

-- Bucket -------------------------------------------------------------------

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'$$,
  $$values (true, 2097152::bigint, array['image/png', 'image/jpeg', 'image/webp'])$$,
  'avatars bucket is public, limited to 2 MB and png/jpeg/webp'
);

-- Uploads ------------------------------------------------------------------

select tests.act_as('00000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-4000-8000-00000000a001/11111111-1111-4111-8111-111111111111.webp', auth.uid()::text)$$,
  'owner uploads into their own folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-4000-8000-00000000a002/22222222-2222-4222-8222-222222222222.webp', auth.uid()::text)$$,
  '42501',
  null,
  'owner cannot upload into another user''s folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-4000-8000-00000000a001/nested/33333333-3333-4333-8333-333333333333.webp', auth.uid()::text)$$,
  '42501',
  null,
  'owner cannot upload into a nested folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '44444444-4444-4444-8444-444444444444.webp', auth.uid()::text)$$,
  '42501',
  null,
  'owner cannot upload into the bucket root'
);

select tests.act_as('00000000-0000-4000-8000-00000000a004');

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-4000-8000-00000000a004/55555555-5555-4555-8555-555555555555.webp', auth.uid()::text)$$,
  '42501',
  null,
  'suspended account cannot upload'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-4000-8000-00000000a001/66666666-6666-4666-8666-666666666666.webp')$$,
  '42501',
  null,
  'signed-out caller cannot upload'
);

-- Listing (needed to remove files through the Storage API) --------------------

select tests.act_as('00000000-0000-4000-8000-00000000a002');

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  0::bigint,
  'other user cannot list the owner''s folder'
);

select tests.act_as('00000000-0000-4000-8000-00000000a001');

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  'owner lists their own folder'
);

select tests.act_as('00000000-0000-4000-8000-00000000a003');

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  'admin lists every folder'
);

-- profiles.avatar_url ---------------------------------------------------------

select tests.act_as('00000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$update public.profiles
    set avatar_url = '00000000-0000-4000-8000-00000000a001/11111111-1111-4111-8111-111111111111.webp'
    where id = auth.uid()$$,
  'owner points avatar_url at a file in their own folder'
);

select lives_ok(
  $$update public.profiles set avatar_url = null where id = auth.uid()$$,
  'owner clears avatar_url'
);

select throws_ok(
  $$update public.profiles
    set avatar_url = '00000000-0000-4000-8000-00000000a002/22222222-2222-4222-8222-222222222222.webp'
    where id = auth.uid()$$,
  '23514',
  null,
  'avatar_url cannot point into another user''s folder'
);

select throws_ok(
  $$update public.profiles set avatar_url = 'https://tracker.example/pixel.png' where id = auth.uid()$$,
  '23514',
  null,
  'avatar_url cannot be an external URL'
);

select throws_ok(
  $$update public.profiles
    set avatar_url = '00000000-0000-4000-8000-00000000a001/../00000000-0000-4000-8000-00000000a002/22222222-2222-4222-8222-222222222222.webp'
    where id = auth.uid()$$,
  '23514',
  null,
  'avatar_url cannot traverse out of the folder'
);

select throws_ok(
  $$update public.profiles
    set avatar_url = '00000000-0000-4000-8000-00000000a001/11111111-1111-4111-8111-111111111111.gif'
    where id = auth.uid()$$,
  '23514',
  null,
  'avatar_url must use an allowed extension'
);

select tests.act_as('00000000-0000-4000-8000-00000000a002');

select is(
  (select count(*) from public.profiles
    where id = '00000000-0000-4000-8000-00000000a001' and avatar_url is null),
  1::bigint,
  'other users read avatar_url through the profile column grant'
);

select * from finish();

rollback;
