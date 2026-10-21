-- Anyone can read a public profile; it never carries private details, and
-- disabled, admin and unknown accounts have none. Other users can no longer
-- read a provider's tax ID, rating or verification.

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

-- Acts as a signed-out visitor.
create function tests.act_as_anon()
returns void
language plpgsql
as $function$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end;
$function$;

grant execute on function tests.act_as(uuid) to authenticated, anon;
grant execute on function tests.act_as_anon() to authenticated, anon;

-- Every key in a profile, nested sections included.
create function tests.profile_keys(profile jsonb)
returns setof text
language sql
as $function$
  select jsonb_object_keys(profile)
  union all
  select jsonb_object_keys(profile -> section)
  from unnest(array['provider', 'client', 'stats']) section
  where jsonb_typeof(profile -> section) = 'object';
$function$;

grant execute on function tests.profile_keys(jsonb) to authenticated, anon;

select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'client@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'inactive@example.test'),
  ('00000000-0000-0000-0000-00000000c003', 'suspended@example.test'),
  ('00000000-0000-0000-0000-00000000c004', 'banned@example.test'),
  ('00000000-0000-0000-0000-00000000c005', 'returned@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'provider@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'bare-provider@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test');

insert into public.profiles (id, role, full_name, email, phone, country, city, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'client', 'Client One', 'client@example.test', '+381 60 111', 'Serbia', 'Belgrade', true),
  ('00000000-0000-0000-0000-00000000c002', 'client', 'Inactive', 'inactive@example.test', null, null, null, false),
  ('00000000-0000-0000-0000-00000000c003', 'client', 'Suspended', 'suspended@example.test', null, null, null, true),
  ('00000000-0000-0000-0000-00000000c004', 'client', 'Banned', 'banned@example.test', null, null, null, true),
  ('00000000-0000-0000-0000-00000000c005', 'client', 'Returned', 'returned@example.test', null, null, null, true),
  ('00000000-0000-0000-0000-00000000b001', 'provider', 'Provider One', 'provider@example.test', '+351 91 333', 'Portugal', 'Lisbon', true),
  ('00000000-0000-0000-0000-00000000b002', 'provider', 'Bare Provider', 'bare-provider@example.test', null, null, null, true),
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', 'admin@example.test', null, null, null, true);

insert into public.client_profiles (user_id, business_name, business_tax_id, project_idea, preferred_language, website_url) values
  ('00000000-0000-0000-0000-00000000c001', 'Client One Ltd', '100000001', 'A secret shop idea', 'sr', 'https://client-one.example');

insert into public.provider_profiles (
  user_id, provider_type, service_categories, service_category_other_text, headline,
  availability, hourly_rate_min, hourly_rate_max, tax_id, is_verified, average_rating,
  total_reviews, portfolio_url, social_link
) values (
  '00000000-0000-0000-0000-00000000b001', 'freelancer', '{other}', 'Brand sites', 'Web builder',
  'busy', 20, 40, '87654321', true, 4.5, 12, 'https://portfolio.example', 'https://social.example'
);

-- Client One: one draft, three posted (published, assigned, cancelled), two
-- hidden by moderation. Provider One won the assigned one.
insert into public.projects (id, client_id, title, slug, description, status, is_hidden) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001', 'Draft', 'pp-draft', 'A draft', 'draft', false),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c001', 'Open', 'pp-open', 'An open brief', 'published', false),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000c001', 'Hired', 'pp-hired', 'A hired brief', 'assigned', false),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000c001', 'Hidden', 'pp-hidden', 'A hidden brief', 'published', true),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000c001', 'Hidden hire', 'pp-hidden-hire', 'A hidden hire', 'assigned', true),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000c001', 'Cancelled', 'pp-cancelled', 'A cancelled brief', 'cancelled', false);

insert into public.applications (project_id, provider_id, cover_message, status) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000b001', 'Hire me', 'accepted'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000b001', 'Me too', 'pending');

insert into public.provider_service_listings (id, provider_id, title, description, service_type_text, category_text, status, published_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', 'Landing page', 'A sufficiently long description of a landing page service.', 'Web', 'Web', 'published', now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000b001', 'Logo design', 'A sufficiently long description of a logo design service.', 'Design', 'Design', 'published', now());

insert into public.provider_service_requests (id, service_id, client_id, provider_id, status, message) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'accepted', 'Please build my landing page'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'pending', 'Please design my logo too');

insert into public.service_workrooms (service_request_id, service_id, client_id, provider_id, status, completed_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'completed', now());

insert into public.account_moderation (user_id, status, suspended_until, reason) values
  ('00000000-0000-0000-0000-00000000c003', 'suspended', now() + interval '1 day', 'Suspended for testing'),
  ('00000000-0000-0000-0000-00000000c004', 'banned', null, 'Banned for testing'),
  ('00000000-0000-0000-0000-00000000c005', 'suspended', now() - interval '1 minute', 'Suspension already over');

-- Signed out: both kinds of profile, with stats.
select tests.act_as_anon();

select results_eq(
  $$select p ->> 'role', p ->> 'full_name', p ->> 'city', p ->> 'country',
      p -> 'provider' ->> 'headline', p -> 'provider' ->> 'availability',
      (p -> 'provider' ->> 'hourly_rate_max')::numeric, p -> 'client'
    from public.get_public_profile('00000000-0000-0000-0000-00000000b001') p$$,
  $$values ('provider', 'Provider One', 'Lisbon', 'Portugal', 'Web builder', 'busy', 40::numeric, 'null'::jsonb)$$,
  'a signed-out visitor can read a provider''s public profile'
);

select is(
  public.get_public_profile('00000000-0000-0000-0000-00000000b001') -> 'stats',
  '{"jobs_won": 2, "collaborations_completed": 1}'::jsonb,
  'provider stats count accepted applications and requests, and completed workrooms'
);

select results_eq(
  $$select p ->> 'role', p ->> 'full_name', p -> 'client' ->> 'business_name', p -> 'provider'
    from public.get_public_profile('00000000-0000-0000-0000-00000000c001') p$$,
  $$values ('client', 'Client One', 'Client One Ltd', 'null'::jsonb)$$,
  'a signed-out visitor can read a client''s public profile'
);

select is(
  public.get_public_profile('00000000-0000-0000-0000-00000000c001') -> 'stats',
  '{"projects_posted": 3, "hires": 2}'::jsonb,
  'client stats skip drafts and hidden briefs, and count accepted requests as hires'
);

select is(
  (public.get_public_profile('00000000-0000-0000-0000-00000000b001') ->> 'member_since') is not null,
  true,
  'a public profile says when the member joined'
);

-- Nothing private, by key or by value.
select is_empty(
  $$select k from tests.profile_keys(public.get_public_profile('00000000-0000-0000-0000-00000000b001')) k
    where k in ('email', 'phone', 'tax_id', 'is_verified', 'average_rating', 'total_reviews',
                'portfolio_url', 'social_link', 'is_active', 'user_id')$$,
  'a provider profile has no private keys'
);

select is_empty(
  $$select k from tests.profile_keys(public.get_public_profile('00000000-0000-0000-0000-00000000c001')) k
    where k in ('email', 'phone', 'business_tax_id', 'project_idea', 'preferred_language',
                'website_url', 'is_active', 'user_id')$$,
  'a client profile has no private keys'
);

select unalike(
  public.get_public_profile('00000000-0000-0000-0000-00000000b001')::text,
  '%(provider@example.test|+351 91 333|87654321|4.5|portfolio.example|social.example)%',
  'a provider profile carries no private values'
);

select unalike(
  public.get_public_profile('00000000-0000-0000-0000-00000000c001')::text,
  '%(client@example.test|+381 60 111|100000001|secret shop idea|client-one.example)%',
  'a client profile carries no private values'
);

select is(
  public.get_public_profile('00000000-0000-0000-0000-00000000b002') - 'member_since',
  jsonb_build_object(
    'id', '00000000-0000-0000-0000-00000000b002', 'role', 'provider',
    'full_name', 'Bare Provider', 'avatar_url', null, 'city', null, 'country', null,
    'provider', null, 'client', null,
    'stats', jsonb_build_object('jobs_won', 0, 'collaborations_completed', 0)
  ),
  'a provider who never filled in the provider profile still has a public profile'
);

-- Accounts with no public profile.
select is(public.get_public_profile('00000000-0000-0000-0000-00000000c002'), null, 'a deactivated account has no public profile');
select is(public.get_public_profile('00000000-0000-0000-0000-00000000c003'), null, 'a suspended account has no public profile');
select is(public.get_public_profile('00000000-0000-0000-0000-00000000c004'), null, 'a banned account has no public profile');
select is(public.get_public_profile('00000000-0000-0000-0000-0000000000a1'), null, 'an admin has no public profile');
select is(public.get_public_profile('00000000-0000-0000-0000-000000000000'), null, 'an unknown id has no public profile');

select isnt(
  public.get_public_profile('00000000-0000-0000-0000-00000000c005'),
  null,
  'an account whose suspension is over has a public profile again'
);

-- Signed in, the profile is the same, including the owner's own.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select is(
  public.get_public_profile('00000000-0000-0000-0000-00000000b001') -> 'provider' ->> 'headline',
  'Web builder',
  'a signed-in user can read a provider''s public profile'
);

select tests.act_as('00000000-0000-0000-0000-00000000b001');

select is_empty(
  $$select k from tests.profile_keys(public.get_public_profile('00000000-0000-0000-0000-00000000b001')) k
    where k in ('email', 'phone', 'tax_id', 'is_verified', 'average_rating', 'total_reviews')$$,
  'a provider''s own public profile has no private keys either'
);

-- Suspended viewers get the same answer as everyone else.
select tests.act_as('00000000-0000-0000-0000-00000000c003');

select is(
  public.get_public_profile('00000000-0000-0000-0000-00000000c003'),
  null,
  'a suspended user cannot see their own public profile'
);

-- Other users can no longer read a provider's tax ID, rating or verification.
select tests.act_as('00000000-0000-0000-0000-00000000c001');

select results_eq(
  $$select headline from public.provider_profiles
    where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  $$values ('Web builder')$$,
  'a user can still read a provider''s headline'
);

select throws_ok(
  $$select tax_id from public.provider_profiles where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501', null, 'a user cannot read a provider''s tax ID'
);

select throws_ok(
  $$select average_rating, total_reviews from public.provider_profiles
    where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501', null, 'a user cannot read a provider''s rating'
);

select throws_ok(
  $$select is_verified from public.provider_profiles where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501', null, 'a user cannot read whether a provider is verified'
);

select throws_ok(
  $$select * from public.provider_profiles where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501', null, 'a user cannot read a provider''s whole row'
);

select is(
  public.get_own_provider_tax_id(),
  null,
  'a client has no provider tax ID of their own'
);

select tests.act_as_anon();

select throws_ok(
  $$select tax_id from public.provider_profiles$$,
  '42501', null, 'a signed-out visitor cannot read provider tax IDs'
);

select throws_ok(
  $$select public.get_own_provider_tax_id()$$,
  '42501', null, 'a signed-out visitor cannot call get_own_provider_tax_id'
);

-- The provider reads and writes their own tax ID.
select tests.act_as('00000000-0000-0000-0000-00000000b001');

select throws_ok(
  $$select tax_id from public.provider_profiles where user_id = '00000000-0000-0000-0000-00000000b001'$$,
  '42501', null, 'a provider cannot read their own tax ID from the table'
);

select is(
  public.get_own_provider_tax_id(),
  '87654321',
  'a provider reads their own tax ID through get_own_provider_tax_id'
);

-- Rewriting tax_id on conflict reads it back, so the app inserts without
-- overwriting and updates in place instead of upserting.
select throws_ok(
  $$insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text, tax_id)
    values ('00000000-0000-0000-0000-00000000b001', 'freelancer', '{other}', 'Brand sites', '11223344')
    on conflict (user_id) do update set tax_id = excluded.tax_id$$,
  '42501', null, 'an upsert that rewrites the tax ID is refused'
);

select lives_ok(
  $$insert into public.provider_profiles (user_id, provider_type, service_categories, service_category_other_text, tax_id)
    values ('00000000-0000-0000-0000-00000000b001', 'freelancer', '{other}', 'Brand sites', '11223344')
    on conflict (user_id) do nothing$$,
  'a provider can insert their profile without overwriting an existing one'
);

select results_eq(
  $$update public.provider_profiles set tax_id = '55667788', about = 'Updated'
    where user_id = '00000000-0000-0000-0000-00000000b001'
    returning about$$,
  $$values ('Updated')$$,
  'a provider can update their own profile, tax ID included'
);

select is(
  public.get_own_provider_tax_id(),
  '55667788',
  'the updated tax ID is saved'
);

select * from finish();

rollback;
