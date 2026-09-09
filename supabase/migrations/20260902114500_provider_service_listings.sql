-- Adds provider-owned service listings for the Find Talent marketplace.

begin;

do $$
begin
  create type public.provider_service_listing_status as enum (
    'draft',
    'published',
    'paused'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_service_price_type as enum (
    'fixed',
    'hourly',
    'starting_at',
    'negotiable'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.provider_service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  service_type_id uuid references public.service_types(id) on delete set null,
  service_type_text text,
  category_id uuid references public.project_categories(id) on delete set null,
  category_text text,
  price_type public.provider_service_price_type not null default 'starting_at',
  starting_price numeric(12, 2),
  delivery_estimate text,
  status public.provider_service_listing_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_service_listings_title_length_check
    check (char_length(trim(title)) between 5 and 120),

  constraint provider_service_listings_description_length_check
    check (char_length(trim(description)) between 40 and 4000),

  constraint provider_service_listings_starting_price_check
    check (starting_price is null or starting_price >= 0),

  constraint provider_service_listings_service_type_check
    check (
      service_type_id is not null
      or char_length(trim(coalesce(service_type_text, ''))) between 2 and 80
    ),

  constraint provider_service_listings_category_check
    check (
      category_id is not null
      or char_length(trim(coalesce(category_text, ''))) between 2 and 80
    ),

  constraint provider_service_listings_published_at_check
    check (
      (status = 'published' and published_at is not null)
      or
      (status <> 'published')
    )
);

alter table public.provider_service_listings
  add column if not exists service_type_text text,
  add column if not exists category_text text;

do $$
begin
  alter table public.provider_service_listings
    add constraint provider_service_listings_service_type_check
    check (
      service_type_id is not null
      or char_length(trim(coalesce(service_type_text, ''))) between 2 and 80
    ) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.provider_service_listings
    add constraint provider_service_listings_category_check
    check (
      category_id is not null
      or char_length(trim(coalesce(category_text, ''))) between 2 and 80
    ) not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists provider_service_listings_provider_id_idx
  on public.provider_service_listings(provider_id);

create index if not exists provider_service_listings_status_idx
  on public.provider_service_listings(status);

create index if not exists provider_service_listings_service_type_id_idx
  on public.provider_service_listings(service_type_id);

create index if not exists provider_service_listings_category_id_idx
  on public.provider_service_listings(category_id);

create index if not exists provider_service_listings_created_at_idx
  on public.provider_service_listings(created_at desc);

create index if not exists provider_service_listings_published_at_idx
  on public.provider_service_listings(published_at desc)
  where status = 'published';

alter table public.provider_service_listings enable row level security;

drop policy if exists "Published provider service listings are readable by everyone"
  on public.provider_service_listings;
drop policy if exists "Providers can read own service listings"
  on public.provider_service_listings;
drop policy if exists "Providers can create own service listings"
  on public.provider_service_listings;
drop policy if exists "Providers can update own service listings"
  on public.provider_service_listings;
drop policy if exists "Providers can delete own draft service listings"
  on public.provider_service_listings;
drop policy if exists "Providers can delete own service listings"
  on public.provider_service_listings;

create policy "Published provider service listings are readable by everyone"
on public.provider_service_listings
for select
to anon, authenticated
using (status = 'published');

create policy "Providers can read own service listings"
on public.provider_service_listings
for select
to authenticated
using (
  provider_id = auth.uid()
  or public.is_admin()
);

create policy "Providers can create own service listings"
on public.provider_service_listings
for insert
to authenticated
with check (
  (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  )
  or public.is_admin()
);

create policy "Providers can update own service listings"
on public.provider_service_listings
for update
to authenticated
using (
  provider_id = auth.uid()
  or public.is_admin()
)
with check (
  (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  )
  or public.is_admin()
);

create policy "Providers can delete own service listings"
on public.provider_service_listings
for delete
to authenticated
using (
  (
    provider_id = auth.uid()
    and status in (
      'draft'::public.provider_service_listing_status,
      'published'::public.provider_service_listing_status,
      'paused'::public.provider_service_listing_status
    )
  )
  or public.is_admin()
);

create or replace function public.set_provider_service_listing_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();

  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at = now();
  end if;

  if new.status <> 'published' then
    new.published_at = null;
  end if;

  return new;
end;
$function$;

drop trigger if exists provider_service_listings_set_updated_at
  on public.provider_service_listings;

create trigger provider_service_listings_set_updated_at
before update on public.provider_service_listings
for each row
execute function public.set_provider_service_listing_updated_at();

commit;
