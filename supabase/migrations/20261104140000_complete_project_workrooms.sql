-- Completing a project workroom completes its brief.
--
-- complete_service_workroom keeps its signature and its rule (only the workroom's
-- provider, only while it is active). When the workroom came from a project
-- application, the same transaction also moves the brief from assigned to
-- completed, which the status guard allows because this function runs as its owner.

begin;

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
  returning w.id, w.status, w.project_id
  into updated_workroom;

  if not found then
    raise exception 'Workroom could not be completed.';
  end if;

  if updated_workroom.project_id is not null then
    update public.projects p
    set status = 'completed'
    where p.id = updated_workroom.project_id
      and p.status = 'assigned';
  end if;

  return query
  select updated_workroom.id, updated_workroom.status;
end;
$function$;

revoke all on function public.complete_service_workroom(uuid) from public, anon;
grant execute on function public.complete_service_workroom(uuid) to authenticated;

commit;
