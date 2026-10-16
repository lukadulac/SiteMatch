-- Narrow what participants can change on messages, conversations and applications.
--
-- The update policies let either participant rewrite any column of a message
-- (text, sender), of a conversation (who is in it, what it links to), and let a
-- client edit any column of an application on their brief (cover message,
-- price, provider). The app only ever needs to:
--
--   * mark a message it received as read              (messages.is_read)
--   * bump a conversation after a new message         (conversations.updated_at)
--   * mark an application viewed or shortlisted       (applications.status)
--
-- so UPDATE is limited to those columns with column grants, and the policies
-- say who may do it. Accepting, rejecting and withdrawing an application go
-- through their RPCs, which run as the function owner.
--
-- The same holes exist on INSERT, so those are closed too: a provider could
-- insert an application that is already `accepted` (which blocks the brief from
-- ever hiring anyone), and a sender could insert a message pre-marked as read
-- with a forged created_at (which hides the unread badge and pins the inbox
-- preview). Inserts are limited to the columns the app sets, and an application
-- can only be created as `pending`.
--
-- The admin branch the old update policies had is dropped: nothing in the app
-- updates these tables as an admin, and the service role still can. A column
-- added to these tables later is not writable by users until a migration grants
-- it.
--
-- accept_project_application used to run as the caller and relied on the
-- client being allowed to write any status. It is now security definer with a
-- fixed search_path (its own checks decide who may accept), which is what
-- lets a plain update stop being able to set `accepted`.

begin;

-- Messages: the recipient marks a message as read.
revoke update on public.messages from authenticated, anon;
grant update (is_read) on public.messages to authenticated;

drop policy if exists "Messages are updatable by sender participant or admin" on public.messages;
drop policy if exists messages_update_participants_only on public.messages;
drop policy if exists messages_update_recipient_is_read on public.messages;

create policy messages_update_recipient_is_read
  on public.messages
  for update
  to authenticated
  using (public.is_conversation_participant(conversation_id) and sender_id <> auth.uid())
  with check (public.is_conversation_participant(conversation_id) and sender_id <> auth.uid());

-- Conversations: a participant bumps updated_at.
revoke update on public.conversations from authenticated, anon;
grant update (updated_at) on public.conversations to authenticated;

drop policy if exists "Conversations are updatable by participants or admin" on public.conversations;
drop policy if exists conversations_update_participants_only on public.conversations;
drop policy if exists conversations_update_participants on public.conversations;

create policy conversations_update_participants
  on public.conversations
  for update
  to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- Applications: the client marks an open application viewed or shortlisted.
-- (The provider's own "withdraw" policy stays; it only allows status = withdrawn.)
revoke update on public.applications from authenticated, anon;
grant update (status) on public.applications to authenticated;

drop policy if exists applications_update_client_owner_or_admin on public.applications;
drop policy if exists applications_update_client_review on public.applications;

create policy applications_update_client_review
  on public.applications
  for update
  to authenticated
  using (
    public.owns_project(project_id)
    and status in ('pending', 'viewed', 'shortlisted')
  )
  with check (
    public.owns_project(project_id)
    and status in ('viewed', 'shortlisted')
  );

-- Inserts: only the columns the app sets.
revoke insert on public.messages from authenticated, anon;
grant insert (conversation_id, sender_id, message_text) on public.messages to authenticated;

revoke insert on public.conversations from authenticated, anon;
grant insert (project_id, client_id, provider_id, application_id, service_request_id)
  on public.conversations to authenticated;

-- An application starts as `pending`; only accept_project_application accepts one.
drop policy if exists applications_insert_provider_open_project on public.applications;

create policy applications_insert_provider_open_project
  on public.applications
  for insert
  to authenticated
  with check (
    (
      provider_id = auth.uid()
      and status = 'pending'
      and exists (
        select 1 from public.profiles pr
        where pr.id = auth.uid() and pr.role = 'provider'
      )
      and exists (
        select 1 from public.projects p
        where p.id = applications.project_id
          and p.status in ('published', 'in_discussion')
          and p.client_id <> auth.uid()
      )
    )
    or public.is_admin()
  );

-- Accept: same behaviour, now running as the function owner. Because it no
-- longer runs under the caller's row level security it authorizes first (before
-- locking any row) and only links a conversation that really belongs to the
-- application's client, provider and brief.
create or replace function public.accept_project_application(target_application_id uuid)
returns table (
  application_id uuid,
  application_status public.application_status,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  already_accepted_application_id uuid;
  existing_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  if not exists (
    select 1
    from public.applications a
    join public.projects p on p.id = a.project_id
    where a.id = target_application_id
      and p.client_id = current_user_id
  ) then
    raise exception 'Application not found.';
  end if;

  select
    a.id,
    a.project_id,
    a.provider_id,
    a.status
  into selected_application
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  select
    p.id,
    p.client_id,
    p.status
  into selected_project
  from public.projects p
  where p.id = selected_application.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  if selected_project.client_id is distinct from current_user_id then
    raise exception 'Application not found.';
  end if;

  if selected_project.status not in ('published', 'in_discussion') then
    raise exception 'This project is no longer accepting providers.';
  end if;

  if selected_application.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'This application can no longer be updated.';
  end if;

  select a.id
  into already_accepted_application_id
  from public.applications a
  where a.project_id = selected_application.project_id
    and a.status = 'accepted'
    and a.id <> selected_application.id
  limit 1
  for update;

  if already_accepted_application_id is not null then
    raise exception 'A provider has already been accepted for this project.';
  end if;

  select c.id
  into existing_conversation_id
  from public.conversations c
  where c.application_id = selected_application.id
    and c.client_id = selected_project.client_id
    and c.provider_id = selected_application.provider_id
    and c.project_id = selected_application.project_id
  limit 1;

  if existing_conversation_id is null then
    begin
      insert into public.conversations (
        application_id,
        project_id,
        client_id,
        provider_id
      )
      values (
        selected_application.id,
        selected_application.project_id,
        selected_project.client_id,
        selected_application.provider_id
      )
      returning id into existing_conversation_id;
    exception
      when unique_violation then
        select c.id
        into existing_conversation_id
        from public.conversations c
        where c.application_id = selected_application.id
          and c.client_id = selected_project.client_id
          and c.provider_id = selected_application.provider_id
          and c.project_id = selected_application.project_id
        limit 1;
    end;

    if existing_conversation_id is null then
      raise exception 'A conversation could not be opened for this application.';
    end if;
  end if;

  update public.applications
  set status = 'accepted'
  where id = selected_application.id;

  update public.applications
  set status = 'rejected'
  where project_id = selected_application.project_id
    and id <> selected_application.id
    and status in ('pending', 'viewed', 'shortlisted');

  update public.projects
  set status = 'assigned'
  where id = selected_project.id;

  return query
  select
    selected_application.id,
    'accepted'::public.application_status,
    existing_conversation_id;
end;
$function$;

revoke all on function public.accept_project_application(uuid) from public, anon;
grant execute on function public.accept_project_application(uuid) to authenticated;

commit;
