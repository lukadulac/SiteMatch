-- Guard brief status, and leave each table one coherent set of policies.
--
-- 1. A client could set their own brief to `assigned` or `completed` with a
--    plain update, outside the hiring flow, and could also undo a hire by
--    moving the brief back to `published` or by deleting it (which cascades to
--    the accepted application, its conversation and messages). A trigger now
--    rejects all of that for anyone but trusted backend roles. The hiring RPCs
--    (accept_project_application and the ones to come) are security definer
--    functions owned by the database owner, so they keep working;
--    published <-> in_discussion is unchanged.
--
--    Two limits worth knowing: an `INSERT ... ON CONFLICT DO UPDATE` aimed at an
--    assigned or completed brief is rejected even when it keeps the status,
--    because a BEFORE INSERT trigger runs before conflict resolution (the app
--    never upserts briefs); and an admin session is not exempt, so overrides
--    go through the service role.
--
-- 2. Most tables had two overlapping policy sets, an older one named after the
--    access ("... by owner or admin") and a snake_case one. Permissive
--    policies OR together, so the loosest wins, and a later change to one set
--    silently did nothing. Where one policy already covered the other (the
--    "owner or admin" one covers the "_own" one) the narrower duplicate is
--    dropped and effective access does not change. Where the overlap was
--    several differently scoped policies (projects select, conversations
--    insert) they are merged into the same effective access, except for the
--    hole noted below.
--
--    The one deliberate change: "Conversations are insertable for valid service
--    requests" also allowed any conversation with service_request_id null, so a
--    stranger could create a conversation naming someone else's application
--    (and, because accepting links the application's conversation, squat it).
--    Conversations now need a real application (client and applicant) or a real
--    service request, which is what the two old policies were meant to say.

begin;

-- Brief status ---------------------------------------------------------------

create or replace function public.guard_project_status()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('assigned', 'completed') then
      raise exception 'A brief that was assigned or completed cannot be deleted.'
        using errcode = '42501';
    end if;

    return old;
  end if;

  if new.status in ('assigned', 'completed')
    and (tg_op = 'INSERT' or new.status is distinct from old.status)
  then
    raise exception 'Only the hiring flow can set a brief to assigned or completed.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and old.status in ('assigned', 'completed')
    and new.status is distinct from old.status
  then
    raise exception 'Only the hiring flow can change the status of an assigned or completed brief.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_project_status() from public, anon, authenticated;

drop trigger if exists trg_projects_zz_guard_status on public.projects;

-- BEFORE triggers fire in name order; the zz keeps the guard last.
create trigger trg_projects_zz_guard_status
  before insert or update or delete on public.projects
  for each row execute function public.guard_project_status();

-- Duplicate policies: the "owner or admin" policy already covers the "_own" one --

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists client_profiles_insert_own on public.client_profiles;
drop policy if exists client_profiles_update_own on public.client_profiles;

drop policy if exists provider_profiles_insert_own on public.provider_profiles;
drop policy if exists provider_profiles_update_own on public.provider_profiles;
drop policy if exists provider_profiles_select_all_authenticated on public.provider_profiles;

drop policy if exists projects_delete_own on public.projects;
drop policy if exists projects_insert_client_own on public.projects;
drop policy if exists projects_update_own on public.projects;

drop policy if exists applications_select_related_users on public.applications;
drop policy if exists conversations_select_participants on public.conversations;
drop policy if exists messages_select_conversation_participants on public.messages;
drop policy if exists project_categories_select_all_authenticated on public.project_categories;

-- Projects: published briefs are public; the rest is owner, admin or applicant -------
-- (three older policies said the same thing in different words; the union of what
-- they allowed is exactly: visible, or own, or admin, or an applicant.)

drop policy if exists "Projects are readable by owner admin or providers when visible" on public.projects;
drop policy if exists projects_select_visible_or_own on public.projects;
drop policy if exists "providers can read projects they applied to" on public.projects;
drop policy if exists projects_select_owner_admin_or_applicant on public.projects;

create policy projects_select_owner_admin_or_applicant
  on public.projects
  for select
  to authenticated
  using (
    client_id = auth.uid()
    or public.is_admin()
    or public.provider_has_application_for_project(id, auth.uid())
  );

-- ("Visible marketplace projects are readable by everyone" stays: published and
-- in_discussion briefs for anon and authenticated.)

-- Conversations: one insert policy, two valid sources -----------------------------

drop policy if exists "Conversations are insertable for valid service requests" on public.conversations;
drop policy if exists conversations_insert_valid_application_participant on public.conversations;
drop policy if exists conversations_insert_valid_source on public.conversations;

create policy conversations_insert_valid_source
  on public.conversations
  for insert
  to authenticated
  with check (
    -- an open application, between its brief's client and its applicant, opened by one of them
    exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.id = conversations.application_id
        and conversations.project_id = a.project_id
        and conversations.provider_id = a.provider_id
        and conversations.client_id = p.client_id
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
        and (
          conversations.client_id = auth.uid()
          or conversations.provider_id = auth.uid()
          or public.is_admin()
        )
    )
    -- or a service request, between its client and provider, opened by the client
    or exists (
      select 1
      from public.provider_service_requests r
      where r.id = conversations.service_request_id
        and r.client_id = conversations.client_id
        and r.provider_id = conversations.provider_id
        and (r.client_id = auth.uid() or public.is_admin())
    )
  );

-- Messages: only into a conversation that really belongs to its application ----
-- (the old policy only checked that the conversation's application was open, so a
-- conversation planted through the insert hole above kept working as a channel to
-- the applicant.)

drop policy if exists "Messages are insertable in valid conversations" on public.messages;

create policy "Messages are insertable in valid conversations"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = auth.uid() or c.provider_id = auth.uid())
        and (
          exists (
            select 1
            from public.applications a
            join public.projects p on p.id = a.project_id
            where a.id = c.application_id
              and a.project_id = c.project_id
              and a.provider_id = c.provider_id
              and p.client_id = c.client_id
              and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
          )
          or exists (
            select 1
            from public.provider_service_requests r
            where r.id = c.service_request_id
              and r.client_id = c.client_id
              and r.provider_id = c.provider_id
          )
        )
    )
  );

commit;
