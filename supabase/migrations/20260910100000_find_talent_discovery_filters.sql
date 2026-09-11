-- Adds structured discovery fields for the Find Talent marketplace.

begin;

do $$
begin
  create type public.provider_service_delivery_bucket as enum (
    'urgent_24h',
    'up_to_3_days',
    'up_to_1_week',
    'up_to_2_weeks',
    'up_to_1_month',
    'flexible'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.service_types
  add column if not exists category_id uuid
  references public.project_categories(id)
  on delete set null;

alter table public.provider_service_listings
  add column if not exists delivery_bucket public.provider_service_delivery_bucket
  not null
  default 'flexible';

create index if not exists service_types_category_id_idx
  on public.service_types(category_id);

create index if not exists provider_service_listings_status_published_at_idx
  on public.provider_service_listings(status, published_at desc);

create index if not exists provider_service_listings_starting_price_idx
  on public.provider_service_listings(starting_price)
  where status = 'published'
    and starting_price is not null;

create index if not exists provider_service_listings_delivery_bucket_idx
  on public.provider_service_listings(delivery_bucket)
  where status = 'published';

commit;
