-- Adds client-to-provider service requests for published provider services.

begin;

do $$
begin
  create type public.provider_service_request_status as enum (
    'pending',
    'accepted',
    'rejected',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.provider_service_requests (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.provider_service_listings(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  status public.provider_service_request_status not null default 'pending',
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_service_requests_message_length_check
    check (char_length(trim(message)) between 10 and 2000),

  constraint provider_service_requests_client_provider_check
    check (client_id <> provider_id)
);

create unique index if not exists provider_service_requests_one_active_per_client_service_idx
  on public.provider_service_requests(service_id, client_id)
  where status in (
    'pending'::public.provider_service_request_status,
    'accepted'::public.provider_service_request_status
  );

create index if not exists provider_service_requests_client_created_at_idx
  on public.provider_service_requests(client_id, created_at desc);

create index if not exists provider_service_requests_provider_created_at_idx
  on public.provider_service_requests(provider_id, created_at desc);

create index if not exists provider_service_requests_service_id_idx
  on public.provider_service_requests(service_id);

create index if not exists provider_service_requests_status_idx
  on public.provider_service_requests(status);

alter table public.provider_service_requests enable row level security;

drop policy if exists "Service requests are readable by participants"
  on public.provider_service_requests;
drop policy if exists "Clients can request published provider services"
  on public.provider_service_requests;
drop policy if exists "Service requests are updatable by participants"
  on public.provider_service_requests;
drop policy if exists "Service requests are deletable by participants"
  on public.provider_service_requests;

create policy "Service requests are readable by participants"
on public.provider_service_requests
for select
to authenticated
using (
  client_id = auth.uid()
  or provider_id = auth.uid()
  or public.is_admin()
);

create policy "Clients can request published provider services"
on public.provider_service_requests
for insert
to authenticated
with check (
  (
    client_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'client'
    )
    and exists (
      select 1
      from public.provider_service_listings s
      where s.id = provider_service_requests.service_id
        and s.status = 'published'
        and s.provider_id = provider_service_requests.provider_id
        and s.provider_id <> auth.uid()
    )
  )
  or public.is_admin()
);

create or replace function public.set_provider_service_request_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists provider_service_requests_set_updated_at
  on public.provider_service_requests;

create trigger provider_service_requests_set_updated_at
before update on public.provider_service_requests
for each row
execute function public.set_provider_service_request_updated_at();

commit;
