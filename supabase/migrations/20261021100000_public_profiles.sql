-- Public profiles and private provider details.
--
-- A public profile page (/profiles/[id]) shows a client or provider to anyone,
-- signed out included, so the other side can judge who they are about to
-- contact. Everything it shows comes from get_public_profile(), which picks the
-- fields one by one:
--
--   * shared: id, role, full_name, avatar_url, city, country, member_since
--   * provider: what they offer, availability and price ranges
--   * client: who the business is
--   * stats: counts the database can vouch for, so text cannot fake them.
--     Provider: jobs_won (accepted applications and service requests) and
--     collaborations_completed (completed service workrooms). Client:
--     projects_posted (past draft, not hidden) and hires (assigned projects and
--     accepted service requests; projects never reach 'completed' in the app).
--
-- Never returned: email, phone, tax IDs, project_idea, preferred_language,
-- ratings, is_verified and link fields. The function returns null for an
-- unknown id, an admin, and an account that is deactivated, suspended, banned
-- or deleted, and the page answers 404.
--
-- provider_profiles was readable column for column by every signed-in user
-- (tax_id, average_rating, total_reviews and is_verified included). It gets the
-- same treatment profiles got in 20261016142029: the table grant is replaced by
-- a column grant without those four. There are no reviews or verification yet,
-- so nothing reads the other three; a provider reads their own tax ID through
-- get_own_provider_tax_id(). Writes are unchanged.
--
-- Rollout: the app must be deployed before this runs. The previous app selects
-- tax_id, average_rating, total_reviews and is_verified on the provider
-- dashboard, which fails once the columns are revoked.

begin;

revoke select on public.provider_profiles from authenticated, anon;

grant select (
  id, user_id, provider_type, headline, bio, years_of_experience, portfolio_url,
  hourly_rate_min, hourly_rate_max, fixed_price_min, fixed_price_max, availability,
  created_at, updated_at, display_name, company_name, team_size,
  project_budget_min, project_budget_max, preferred_scope, services_text,
  industries_text, ideal_client_text, tech_capabilities_text,
  business_domain_other_text, social_link, service_categories,
  service_category_other_text, about
) on public.provider_profiles to authenticated, anon;

create or replace function public.get_own_provider_tax_id()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  own_tax_id text;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select pp.tax_id into own_tax_id
  from public.provider_profiles pp
  where pp.user_id = current_user_id;

  return own_tax_id;
end;
$function$;

revoke all on function public.get_own_provider_tax_id() from public, anon;
grant execute on function public.get_own_provider_tax_id() to authenticated;

create or replace function public.get_public_profile(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  person public.profiles%rowtype;
  provider public.provider_profiles%rowtype;
  client public.client_profiles%rowtype;
  result jsonb;
begin
  select p.* into person
  from public.profiles p
  where p.id = target_user_id
    and p.role in ('client', 'provider');

  if not found or not public.is_account_enabled(person.id) then
    return null;
  end if;

  result := jsonb_build_object(
    'id', person.id,
    'role', person.role,
    'full_name', person.full_name,
    'avatar_url', person.avatar_url,
    'city', person.city,
    'country', person.country,
    'member_since', person.created_at
  );

  if person.role = 'provider' then
    select pp.* into provider
    from public.provider_profiles pp
    where pp.user_id = person.id;

    return result || jsonb_build_object(
      'provider', case when provider.id is null then null else jsonb_build_object(
        'display_name', provider.display_name,
        'company_name', provider.company_name,
        'provider_type', provider.provider_type,
        'headline', provider.headline,
        'bio', provider.bio,
        'about', provider.about,
        'service_categories', to_jsonb(provider.service_categories),
        'service_category_other_text', provider.service_category_other_text,
        'years_of_experience', provider.years_of_experience,
        'team_size', provider.team_size,
        'industries_text', provider.industries_text,
        'tech_capabilities_text', provider.tech_capabilities_text,
        'availability', provider.availability,
        'hourly_rate_min', provider.hourly_rate_min,
        'hourly_rate_max', provider.hourly_rate_max,
        'fixed_price_min', provider.fixed_price_min,
        'fixed_price_max', provider.fixed_price_max,
        'project_budget_min', provider.project_budget_min,
        'project_budget_max', provider.project_budget_max
      ) end,
      'client', null,
      'stats', jsonb_build_object(
        'jobs_won',
          (select count(*) from public.applications a
            where a.provider_id = person.id and a.status = 'accepted')
          + (select count(*) from public.provider_service_requests r
            where r.provider_id = person.id and r.status = 'accepted'),
        'collaborations_completed',
          (select count(*) from public.service_workrooms w
            where w.provider_id = person.id and w.status = 'completed')
      )
    );
  end if;

  select cp.* into client
  from public.client_profiles cp
  where cp.user_id = person.id;

  return result || jsonb_build_object(
    'provider', null,
    'client', case when client.id is null then null else jsonb_build_object(
      'business_name', client.business_name,
      'business_type', client.business_type,
      'business_type_text', client.business_type_text,
      'business_description', client.business_description,
      'company_size', client.company_size,
      'target_market_text', client.target_market_text
    ) end,
    'stats', jsonb_build_object(
      'projects_posted',
        (select count(*) from public.projects pr
          where pr.client_id = person.id and pr.status <> 'draft' and not pr.is_hidden),
      'hires',
        (select count(*) from public.projects pr
          where pr.client_id = person.id and pr.status in ('assigned', 'completed')
            and not pr.is_hidden)
        + (select count(*) from public.provider_service_requests r
          where r.client_id = person.id and r.status = 'accepted')
    )
  );
end;
$function$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

commit;
