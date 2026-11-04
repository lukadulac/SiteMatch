-- Let a client cancel a brief nobody was hired on.
--
-- cancel_project moves a draft, published or in-discussion brief to cancelled and
-- rejects its open applications (pending, viewed, shortlisted) in the same
-- transaction, so no provider is left waiting on a brief that is gone. Assigned and
-- completed briefs cannot be cancelled. Cancelling twice returns the brief as it is.
--
-- The status guard now treats cancelled like assigned and completed: only trusted
-- backend roles (this security definer RPC among them) can set it, and a cancelled
-- brief cannot be moved back to draft or published with a plain update.

begin;

create function public.cancel_project(target_project_id uuid)
returns table (project_id uuid, project_status public.project_status, rejected_applications integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
  selected_project record;
  rejected_count integer := 0;
begin
  if caller is null then
    raise exception 'Sign in to cancel a brief.' using errcode = '42501';
  end if;

  select p.id, p.client_id, p.status
  into selected_project
  from public.projects p
  where p.id = target_project_id
  for update;

  -- Someone else's brief looks the same as a missing one.
  if not found or selected_project.client_id <> caller then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;

  if selected_project.status = 'cancelled' then
    return query select selected_project.id, selected_project.status, 0;
    return;
  end if;

  if selected_project.status not in ('draft', 'published', 'in_discussion') then
    raise exception 'A brief that was assigned or completed cannot be cancelled.'
      using errcode = '42501';
  end if;

  update public.applications a
  set status = 'rejected', updated_at = now()
  where a.project_id = selected_project.id
    and a.status in ('pending', 'viewed', 'shortlisted');
  get diagnostics rejected_count = row_count;

  update public.projects p
  set status = 'cancelled'
  where p.id = selected_project.id;

  return query select selected_project.id, 'cancelled'::public.project_status, rejected_count;
end;
$function$;

revoke all on function public.cancel_project(uuid) from public, anon;
grant execute on function public.cancel_project(uuid) to authenticated;

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

  if new.status = 'cancelled'
    and (tg_op = 'INSERT' or new.status is distinct from old.status)
  then
    raise exception 'Cancel a brief with cancel_project.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and old.status in ('assigned', 'completed')
    and new.status is distinct from old.status
  then
    raise exception 'Only the hiring flow can change the status of an assigned or completed brief.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'cancelled'
    and new.status is distinct from old.status
  then
    raise exception 'A cancelled brief cannot be reopened.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

commit;
