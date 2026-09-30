-- Adds Workroom Lite for accepted provider service requests.

begin;

do $$
begin
  create type public.service_workroom_status as enum (
    'active',
    'completed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.service_workrooms (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.provider_service_requests(id) on delete restrict,
  service_id uuid not null references public.provider_service_listings(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  status public.service_workroom_status not null default 'active',
  accepted_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_workrooms_client_provider_check
    check (client_id <> provider_id),

  constraint service_workrooms_completion_check
    check (
      (status = 'completed'::public.service_workroom_status and completed_at is not null)
      or
      (status = 'active'::public.service_workroom_status and completed_at is null)
    )
);

create unique index if not exists service_workrooms_service_request_id_key
  on public.service_workrooms(service_request_id);

create index if not exists service_workrooms_client_status_accepted_at_idx
  on public.service_workrooms(client_id, status, accepted_at desc);

create index if not exists service_workrooms_provider_status_accepted_at_idx
  on public.service_workrooms(provider_id, status, accepted_at desc);

create index if not exists service_workrooms_service_id_idx
  on public.service_workrooms(service_id);

alter table public.service_workrooms enable row level security;

drop policy if exists "Service workrooms are readable by participants"
  on public.service_workrooms;
drop policy if exists "Service workrooms are insertable by admin"
  on public.service_workrooms;
drop policy if exists "Service workrooms are updatable by admin"
  on public.service_workrooms;
drop policy if exists "Service workrooms are deletable by admin"
  on public.service_workrooms;

create policy "Service workrooms are readable by participants"
on public.service_workrooms
for select
to authenticated
using (
  client_id = auth.uid()
  or provider_id = auth.uid()
  or public.is_admin()
);

create policy "Service workrooms are insertable by admin"
on public.service_workrooms
for insert
to authenticated
with check (public.is_admin());

create policy "Service workrooms are updatable by admin"
on public.service_workrooms
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.set_service_workroom_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists service_workrooms_set_updated_at
  on public.service_workrooms;

create trigger service_workrooms_set_updated_at
before update on public.service_workrooms
for each row
execute function public.set_service_workroom_updated_at();

with accepted_requests as (
  select
    r.id as service_request_id,
    r.service_id,
    r.client_id,
    r.provider_id,
    r.updated_at as accepted_at,
    r.updated_at as created_at,
    r.updated_at as updated_at
  from public.provider_service_requests r
  where r.status = 'accepted'::public.provider_service_request_status
    and not exists (
      select 1
      from public.service_workrooms w
      where w.service_request_id = r.id
    )
)
insert into public.service_workrooms (
  service_request_id,
  service_id,
  client_id,
  provider_id,
  status,
  accepted_at,
  created_at,
  updated_at
)
select
  service_request_id,
  service_id,
  client_id,
  provider_id,
  'active'::public.service_workroom_status,
  accepted_at,
  created_at,
  updated_at
from accepted_requests;

drop function if exists public.accept_provider_service_request(uuid);

create or replace function public.accept_provider_service_request(
  target_request_id uuid
)
returns table (
  request_id uuid,
  request_status public.provider_service_request_status,
  conversation_id uuid,
  workroom_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  updated_request record;
  linked_conversation_id uuid;
  linked_workroom_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  update public.provider_service_requests r
  set status = 'accepted'::public.provider_service_request_status
  where r.id = target_request_id
    and r.provider_id = current_user_id
    and r.status = 'pending'::public.provider_service_request_status
  returning r.id, r.service_id, r.client_id, r.provider_id, r.status
  into updated_request;

  if not found then
    raise exception 'Service request could not be accepted.';
  end if;

  select c.id
  into linked_conversation_id
  from public.conversations c
  where c.service_request_id = updated_request.id;

  insert into public.service_workrooms (
    service_request_id,
    service_id,
    client_id,
    provider_id,
    status
  )
  values (
    updated_request.id,
    updated_request.service_id,
    updated_request.client_id,
    updated_request.provider_id,
    'active'::public.service_workroom_status
  )
  on conflict (service_request_id)
  do update set updated_at = public.service_workrooms.updated_at
  returning id into linked_workroom_id;

  return query
  select
    updated_request.id,
    updated_request.status,
    linked_conversation_id,
    linked_workroom_id;
end;
$function$;

create or replace function public.complete_service_workroom(
  target_workroom_id uuid
)
returns table (
  workroom_id uuid,
  workroom_status public.service_workroom_status
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  updated_workroom record;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  update public.service_workrooms w
  set
    status = 'completed'::public.service_workroom_status,
    completed_at = now()
  where w.id = target_workroom_id
    and w.provider_id = current_user_id
    and w.status = 'active'::public.service_workroom_status
  returning w.id, w.status
  into updated_workroom;

  if not found then
    raise exception 'Workroom could not be completed.';
  end if;

  return query
  select updated_workroom.id, updated_workroom.status;
end;
$function$;

revoke all on function public.accept_provider_service_request(uuid) from public;
revoke all on function public.complete_service_workroom(uuid) from public;

grant execute on function public.accept_provider_service_request(uuid) to authenticated;
grant execute on function public.complete_service_workroom(uuid) to authenticated;

commit;
