begin;
create extension if not exists pgtap with schema extensions;
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.act_as(user_id uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant execute on function tests.act_as(uuid) to authenticated, anon;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','admin@deletion.test'),
 ('00000000-0000-4000-8000-000000000002','client@deletion.test'),
 ('00000000-0000-4000-8000-000000000003','provider@deletion.test'),
 ('00000000-0000-4000-8000-000000000004','other@deletion.test');
insert into public.profiles(id,role,full_name,email,phone,city,country) values
 ('00000000-0000-4000-8000-000000000001','admin','Admin','admin@deletion.test',null,null,null),
 ('00000000-0000-4000-8000-000000000002','client','Clara Client','client@deletion.test','+381 60 000 0000','Belgrade','Serbia'),
 ('00000000-0000-4000-8000-000000000003','provider','Petar Provider','provider@deletion.test',null,'Novi Sad','Serbia'),
 ('00000000-0000-4000-8000-000000000004','client','Olga Other','other@deletion.test',null,null,null);
insert into public.client_profiles(user_id,business_name) values ('00000000-0000-4000-8000-000000000002','Clara Bakery');
insert into public.provider_service_listings(id,provider_id,title,description,service_type_text,category_text,status,published_at)
 values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000003',
 'Logo design','A sufficiently long description of a logo design service for testing.','Design','Creative','published',now());
insert into public.projects(id,client_id,title,slug,description,status) values
 ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000002','Clara brief','clara-brief','Description','published'),
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000004','Olga brief','olga-brief','Description','published');
insert into public.applications(id,project_id,provider_id,cover_message,status) values
 ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000003','I can help with this brief.','pending'),
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000003','I can help with this brief too.','pending');

-- Clara asks for Petar's service; Petar answers in the conversation.
select tests.act_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$select public.request_provider_service('00000000-0000-4000-8000-000000000010','Please design our bakery logo.')$$, 'client requests a service');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select lives_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 select id,auth.uid(),'Happy to help with the logo.' from public.conversations$$, 'provider replies');

-- Who may delete.
reset role;
set local role anon;
select throws_ok($$select public.delete_own_account('client@deletion.test')$$, '42501', null, 'anonymous callers cannot delete anything');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$select public.delete_own_account('admin@deletion.test')$$, '42501', 'Admin accounts cannot be deleted here.', 'admins cannot delete themselves here');
select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.delete_own_account('provider@deletion.test')$$, '22023', 'The email does not match this account.', 'another user''s email deletes nothing');
select throws_ok($$select public.delete_own_account(null)$$, '22023', 'The email does not match this account.', 'a missing email deletes nothing');
select is((select full_name from public.profiles where id = auth.uid()), 'Clara Client', 'a refused attempt changes nothing');

-- Clara deletes her account; the retyped email ignores case and spaces.
select lives_ok($$select public.delete_own_account('  Client@Deletion.test ')$$, 'client deletes own account');
select is((public.delete_own_account('client@deletion.test')->>'alreadyDeleted')::boolean, true, 'a retry is harmless');

reset role;
select is((select full_name || '|' || email || '|' || coalesce(phone,'-') || '|' || coalesce(city,'-') || '|' || is_active::text
  from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'Deleted user|00000000-0000-4000-8000-000000000002@deleted.invalid|-|-|false', 'profile is anonymised');
select is((select count(*) from public.client_profiles where user_id = '00000000-0000-4000-8000-000000000002'), 0::bigint, 'business profile is removed');
select is((select count(*) from public.projects where id = '00000000-0000-4000-8000-000000000020'), 0::bigint, 'open brief is removed');
select is((select status::text from public.provider_service_requests limit 1), 'cancelled', 'pending service request is cancelled');
select is(public.is_account_enabled('00000000-0000-4000-8000-000000000002'), false, 'the account gate blocks the deleted account');
select is((select count(*) from private.blocked_emails where user_id = '00000000-0000-4000-8000-000000000002'), 0::bigint, 'the email is not blocked, so it can register again');

-- The other side keeps its history.
select tests.act_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.messages), 2::bigint, 'provider still reads the conversation');
select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'Deleted user', 'provider sees the client as Deleted user');
select is((select count(*) from public.provider_service_listings where id = '00000000-0000-4000-8000-000000000010'), 1::bigint, 'provider''s own listing is untouched');

-- Petar deletes his account: his pending application on Olga's brief is withdrawn.
select lives_ok($$select public.delete_own_account('provider@deletion.test')$$, 'provider deletes own account');
reset role;
select is((select status::text from public.applications where id = '00000000-0000-4000-8000-000000000031'), 'withdrawn', 'pending application is withdrawn');
select is((select count(*) from public.provider_service_listings where provider_id = '00000000-0000-4000-8000-000000000003'), 0::bigint, 'listings without active work are removed');
select is((select count(*) from public.projects where id = '00000000-0000-4000-8000-000000000021'), 1::bigint, 'another client''s brief is untouched');
select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000004'), 'Olga Other', 'another user''s profile is untouched');

select * from finish();
rollback;
