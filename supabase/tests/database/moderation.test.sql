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
 ('00000000-0000-4000-8000-000000000001','admin@moderation.test'),
 ('00000000-0000-4000-8000-000000000002','client@moderation.test'),
 ('00000000-0000-4000-8000-000000000003','provider@moderation.test'),
 ('00000000-0000-4000-8000-000000000004','outsider@moderation.test');
insert into public.profiles(id,role,full_name,email) values
 ('00000000-0000-4000-8000-000000000001','admin','Admin','admin@moderation.test'),
 ('00000000-0000-4000-8000-000000000002','client','Client','client@moderation.test'),
 ('00000000-0000-4000-8000-000000000003','provider','Provider','provider@moderation.test'),
 ('00000000-0000-4000-8000-000000000004','client','Outsider','outsider@moderation.test');
insert into public.provider_service_listings(id,provider_id,title,description,service_type_text,category_text,status,published_at)
 values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000003',
 'Design service','A sufficiently long description of a design service for testing.','Design','Creative','published',now());
insert into public.projects(id,client_id,title,slug,description,status)
 values ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000002','Test project','moderation-project','Description','published');

select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.admin_overview()$$, '42501', 'Admin access required.', 'client cannot access admin reads');
select throws_ok($$select public.admin_moderate_listing('service','00000000-0000-4000-8000-000000000010','hide','Misleading listing content.')$$,
 '42501','Admin access required.','client cannot hide a listing');
select lives_ok($$select public.request_provider_service('00000000-0000-4000-8000-000000000010','Please help with our new branding.')$$, 'client request creates conversation and message');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select is((public.admin_list_records('users',1,'active')->>'totalCount')::int,4,'active user listing has an exact count');
select throws_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000001','ban','Self ban must not work.')$$,
 '42501','Self moderation is not allowed.','admin cannot ban self');
select throws_ok($$select public.admin_moderate_listing('service','00000000-0000-4000-8000-000000000010','hide','')$$,
 '22023','Invalid moderation input.','reason required in DB');
select lives_ok($$select public.admin_moderate_listing('service','00000000-0000-4000-8000-000000000010','hide','Misleading listing content.')$$, 'admin hides listing');

select tests.act_as('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.provider_service_listings),0::bigint,'hidden service invisible to outsider');
select is((select count(*) from public.moderation_events),0::bigint,'audit private to owner/admin');
select throws_ok($$select public.request_provider_service('00000000-0000-4000-8000-000000000010','Please help with our new branding.')$$,
 '42501','Service is not available for requests.','definer RPC cannot bypass hidden listing gate');
select throws_ok($$select * from private.blocked_emails$$,'42501',null,'email blocklist is private');
select is((select count(*) from public.conversations),0::bigint,'outsider cannot read chat');

select tests.act_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.moderation_events),1::bigint,'owner can read reason');
select throws_ok($$update public.provider_service_listings set is_hidden=false where id='00000000-0000-4000-8000-000000000010'$$,
 '42501','Use the moderation action.','owner cannot unhide listing');
select lives_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 select id,auth.uid(),'We can still discuss the request.' from public.conversations$$,'hidden listing chat stays usable');
select throws_ok($$delete from public.provider_service_listings where id='00000000-0000-4000-8000-000000000010'$$,
 '23503','Related requests prevent deletion.','owner cannot use admin cleanup to bypass request history protection');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_listing('service','00000000-0000-4000-8000-000000000010','delete','Remove misleading listing permanently.')$$,'delete preserves chat');
select is((select count(*) from public.provider_service_requests),0::bigint,'request removed with deleted listing');
select is((select count(*) from public.messages),2::bigint,'messages preserved');
select is((select source_title from public.conversations limit 1),'Design service','conversation retains context');

select tests.act_as('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.messages),2::bigint,'client can still read history');
select throws_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 select id,auth.uid(),'Cannot write to deleted listing.' from public.conversations$$,'42501',null,'deleted source chat is read-only');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','suspend','Temporary review of account.',now()+interval '1 hour')$$,'temporary suspension');
select is(public.is_account_enabled('00000000-0000-4000-8000-000000000003'),false,'suspension blocks access');
select is((public.admin_list_records('users',1,'active')->>'totalCount')::int,3,'active filter excludes a suspended account');
select is((public.admin_list_records('users',1,'suspended')->>'totalCount')::int,1,'suspended filter selects the account');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.messages),0::bigint,'suspended JWT cannot read messages');
select throws_ok($$update public.profiles set full_name='Bypass' where id=auth.uid()$$,'42501','Account unavailable.','suspended actor cannot write');
reset role;
update public.account_moderation set suspended_until=now()-interval '1 minute' where user_id='00000000-0000-4000-8000-000000000003';
select is(public.is_account_enabled('00000000-0000-4000-8000-000000000003'),true,'suspension expires without cron');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','ban','Permanent account restriction.')$$,'ban succeeds');
reset role;
select throws_ok($$insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000099','PROVIDER@moderation.test')$$,
 '42501','Account registration is unavailable.','blocked email cannot sign up with another ID/case');
select throws_ok($$update auth.users set email='provider@moderation.test' where id='00000000-0000-4000-8000-000000000004'$$,
 '42501','Account registration is unavailable.','email change cannot claim blocked email');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','reactivate','Account review has completed.')$$,'admin can unban');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','delete','Account removal is approved.')$$,'delete account anonymizes profile');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','delete','Account removal is approved.')$$,'delete command can be retried');
select is((select full_name from public.profiles where id='00000000-0000-4000-8000-000000000003'),'Deleted user','name anonymized');
select is((select count(*) from public.messages),2::bigint,'account deletion preserves messages');
select throws_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000003','reactivate','Attempt to restore account.')$$,
 '55000','Deleted accounts cannot be restored.','delete is irreversible');
reset role;
select throws_ok($$insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000099','provider@moderation.test')$$,
 '42501','Account registration is unavailable.','deleted email remains blocked');

-- Project-only conversations remain readable, and cannot be written even before removal.
select set_config('request.jwt.claims','{}',true);
insert into public.conversations(project_id,client_id,provider_id)
 values ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004');
select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 select id,auth.uid(),'Project only cannot write.' from public.conversations where project_id is not null$$,'42501',null,'project-only stays read-only');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_listing('project','00000000-0000-4000-8000-000000000020','delete','Project removal is approved.')$$,'project deletion detaches chat');
select is((select count(*) from public.conversations),2::bigint,'project conversation preserved');

reset role;
select set_config('request.jwt.claims','{}',true);
insert into public.provider_service_listings(id,provider_id,title,description,service_type_text,category_text,status,published_at)
 values ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000004',
 'Active service','Another sufficiently long service description for testing.','Design','Creative','published',now());
update public.profiles set role='provider' where id='00000000-0000-4000-8000-000000000004';
select tests.act_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$select public.request_provider_service('00000000-0000-4000-8000-000000000030','Please start our new project.')$$,'second request created');
select tests.act_as('00000000-0000-4000-8000-000000000004');
select lives_ok($$select public.accept_provider_service_request(id) from public.provider_service_requests where service_id='00000000-0000-4000-8000-000000000030'$$,'provider accepts and creates active workroom');
reset role;
select set_config('request.jwt.claims','{}',true);
insert into public.projects(id,client_id,title,slug,description,status)
 values ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000002','Hidden project','hidden-project-test','Description','published');
insert into public.applications(id,project_id,provider_id,cover_message,status)
 values ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000004','My proposal','pending');
insert into public.conversations(id,project_id,application_id,client_id,provider_id)
 values ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_moderate_listing('project','00000000-0000-4000-8000-000000000040','hide','Hide this project for review.')$$,'hide project with existing conversation');
select tests.act_as('00000000-0000-4000-8000-000000000004');
select lives_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 values ('00000000-0000-4000-8000-000000000042',auth.uid(),'Messaging continues while the project is hidden.')$$,'provider can message hidden project despite listing RLS');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$select public.admin_moderate_listing('service','00000000-0000-4000-8000-000000000030','delete','This listing should be removed.')$$,
 '55000','Resolve active work before deleting this listing.','active workroom blocks physical deletion');
select lives_ok($$select public.admin_moderate_user('00000000-0000-4000-8000-000000000004','delete','Remove this provider account.')$$,'account deletion retains active engagement');
select set_config('test.workroom_id',(select id::text from public.service_workrooms limit 1),true);
select tests.act_as('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.service_workrooms),1::bigint,'other participant keeps active workroom');
select lives_ok($$insert into public.messages(conversation_id,sender_id,message_text)
 select id,auth.uid(),'Preserve communication on active work.' from public.conversations where service_request_id is not null$$,'active conversation remains writable for remaining participant');
select tests.act_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$select public.complete_service_workroom(current_setting('test.workroom_id')::uuid)$$,
 '42501','Account unavailable.','blocked provider cannot bypass RLS through definer workroom RPC');
select * from finish();
rollback;
