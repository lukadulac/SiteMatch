-- Access matrix: what each kind of caller can read and write on the main tables.
--
-- Run it before and after a change to policies, grants or guard triggers and diff the output:
--
--   docker exec -i supabase_db_SiteMatch psql -U postgres -d postgres -q < scripts/access-matrix.sql > before.txt
--   (change the schema)
--   docker exec -i supabase_db_SiteMatch psql -U postgres -d postgres -q < scripts/access-matrix.sql > after.txt
--   diff before.txt after.txt
--
-- Every difference is a change in who can do what; a refactor that should not change access
-- (like merging duplicate policies) must produce none. It runs against the LOCAL database in one
-- transaction that is rolled back. Callers: anon, owner client A, other client B, applicant provider
-- P1, provider P2 without an application, admin, and a signed-in user without a profile. When a
-- task adds a table or a statement that matters, add a row to the lists below.

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'a@m.test'),   -- client A (owner)
  ('00000000-0000-0000-0000-00000000a002', 'b@m.test'),   -- client B
  ('00000000-0000-0000-0000-00000000b001', 'p1@m.test'),  -- provider with an application
  ('00000000-0000-0000-0000-00000000b002', 'p2@m.test'),  -- provider without
  ('00000000-0000-0000-0000-0000000000ad', 'ad@m.test'),  -- admin
  ('00000000-0000-0000-0000-00000000e005', 'u5@m.test'),  -- new user, no profile
  ('00000000-0000-0000-0000-00000000e006', 'u6@m.test');  -- another new user, no profile

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000a001', 'client', 'A', 'a@m.test'),
  ('00000000-0000-0000-0000-00000000a002', 'client', 'B', 'b@m.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'P1', 'p1@m.test'),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'P2', 'p2@m.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin', 'Admin', 'ad@m.test');

insert into public.client_profiles (user_id, business_name) values
  ('00000000-0000-0000-0000-00000000a001', 'A Ltd'),
  ('00000000-0000-0000-0000-00000000a002', 'B Ltd');

insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text) values
  ('00000000-0000-0000-0000-00000000b001', 'freelancer', '{other}', 'x'),
  ('00000000-0000-0000-0000-00000000b002', 'freelancer', '{other}', 'x');

insert into public.project_categories (id, name, slug) values
  ('00000000-0000-0000-0000-0000000000c0', 'Cat', 'cat');

insert into public.projects (id, client_id, title, slug, description, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a001', 'A published', 'a-pub', 'd', 'published'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000a001', 'A draft', 'a-draft', 'd', 'draft'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000a001', 'A assigned', 'a-assigned', 'd', 'assigned'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000a001', 'A discussion', 'a-disc', 'd', 'in_discussion'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000a002', 'B published', 'b-pub', 'd', 'published'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000a002', 'B draft', 'b-draft', 'd', 'draft');

insert into public.applications (id, project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b001', 'hi', 'pending'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000b001', 'hi', 'accepted'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b001', 'hi', 'pending');

insert into public.conversations (id, project_id, client_id, provider_id, application_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000f1');

insert into public.messages (id, conversation_id, sender_id, message_text) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000b001', 'hello');

create function pg_temp.become(who text) returns void language plpgsql as $f$
begin
  reset role;
  if who = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $f$;

-- Reads a scalar and reports it, or the SQLSTATE.
create function pg_temp.read(who text, stmt text) returns text language plpgsql as $f$
declare result text;
begin
  perform pg_temp.become(who);
  execute stmt into result;
  reset role;
  return coalesce(result, '(none)');
exception when others then
  reset role;
  return 'err:' || sqlstate;
end $f$;

-- Runs a write, reports rows affected or the SQLSTATE, and undoes it.
create function pg_temp.attempt(who text, stmt text) returns text language plpgsql as $f$
declare affected bigint; outcome text;
begin
  begin
    perform pg_temp.become(who);
    execute stmt;
    get diagnostics affected = row_count;
    outcome := 'ok:' || affected;
    raise exception 'undo' using errcode = 'RB001';
  exception
    when sqlstate 'RB001' then null;
    when others then outcome := 'err:' || sqlstate;
  end;
  reset role;
  return outcome;
end $f$;


\echo == READS (rows visible per caller)
select w.who || ' | ' || t.name || ' | ' || pg_temp.read(w.who,
  format('select coalesce(string_agg(%s::text, '','' order by %s::text), ''(none)'') from public.%s', t.col, t.col, t.name))
from (values ('anon'), ('00000000-0000-0000-0000-00000000a001'), ('00000000-0000-0000-0000-00000000a002'),
             ('00000000-0000-0000-0000-00000000b001'), ('00000000-0000-0000-0000-00000000b002'),
             ('00000000-0000-0000-0000-0000000000ad')) as w(who)
cross join (values ('projects','id'), ('applications','id'), ('conversations','id'), ('messages','id'),
                   ('profiles','id'), ('client_profiles','user_id'), ('provider_profiles','user_id'),
                   ('project_categories','id')) as t(name, col)
order by 1;

\echo == WRITES (rows affected or error per caller)
select w.who || ' | ' || a.label || ' | ' || pg_temp.attempt(w.who, a.stmt)
from (values ('anon'), ('00000000-0000-0000-0000-00000000a001'), ('00000000-0000-0000-0000-00000000a002'),
             ('00000000-0000-0000-0000-00000000b001'), ('00000000-0000-0000-0000-00000000b002'),
             ('00000000-0000-0000-0000-0000000000ad'), ('00000000-0000-0000-0000-00000000e005')) as w(who)
cross join (values
  ('profiles insert own (e005)',      $$insert into public.profiles (id, role, full_name, email) values ('00000000-0000-0000-0000-00000000e005','client','N','u5@m.test')$$),
  ('profiles insert other (e006)',    $$insert into public.profiles (id, role, full_name, email) values ('00000000-0000-0000-0000-00000000e006','client','N','u6@m.test')$$),
  ('profiles update A',               $$update public.profiles set city = 'x' where id = '00000000-0000-0000-0000-00000000a001'$$),
  ('client_profiles insert e005',     $$insert into public.client_profiles (user_id, business_name) values ('00000000-0000-0000-0000-00000000e005','N')$$),
  ('client_profiles insert e006',     $$insert into public.client_profiles (user_id, business_name) values ('00000000-0000-0000-0000-00000000e006','N')$$),
  ('client_profiles update A',        $$update public.client_profiles set business_name = 'x' where user_id = '00000000-0000-0000-0000-00000000a001'$$),
  ('provider_profiles insert e005',   $$insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text) values ('00000000-0000-0000-0000-00000000e005','freelancer','{other}','x')$$),
  ('provider_profiles insert e006',   $$insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text) values ('00000000-0000-0000-0000-00000000e006','freelancer','{other}','x')$$),
  ('provider_profiles update P1',     $$update public.provider_profiles set about = 'x' where user_id = '00000000-0000-0000-0000-00000000b001'$$),
  ('project_categories insert',       $$insert into public.project_categories (name, slug) values ('N','n')$$),
  ('project_categories update',       $$update public.project_categories set name = 'x'$$),
  ('projects insert for A',           $$insert into public.projects (client_id, title, slug, description) values ('00000000-0000-0000-0000-00000000a001','t','t1','d')$$),
  ('projects insert for B',           $$insert into public.projects (client_id, title, slug, description) values ('00000000-0000-0000-0000-00000000a002','t','t2','d')$$),
  ('projects update A published',     $$update public.projects set title = 'x' where id = '00000000-0000-0000-0000-0000000000a1'$$),
  ('projects set in_discussion',      $$update public.projects set status = 'in_discussion' where id = '00000000-0000-0000-0000-0000000000a1'$$),
  ('projects delete A draft',         $$delete from public.projects where id = '00000000-0000-0000-0000-0000000000a2'$$),
  ('conversations insert valid app',  $$insert into public.conversations (project_id, client_id, provider_id, application_id) values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000f3')$$),
  ('conversations insert LOOPHOLE',   $$insert into public.conversations (project_id, client_id, provider_id, application_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-0000000000f2')$$),
  ('messages insert in d1',           $$insert into public.messages (conversation_id, sender_id, message_text) values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'x')$$)
) as a(label, stmt)
order by 1;

rollback;
