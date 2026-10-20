-- Profile pictures.
--
-- Images live in a public `avatars` bucket so a profile picture renders on
-- signed-out pages too. Each user owns the folder named after their profile
-- id: `avatars/<user id>/<random uuid>.<png|jpg|webp>`. Storage itself
-- enforces the size limit and the allowed types.
--
--   * Only the owner (with an enabled account) uploads into their folder.
--     Files are never overwritten; a new picture gets a new name, so a cached
--     old URL never shows the new image and there is no UPDATE policy.
--   * The owner and admins can list and delete files in a folder (removing
--     through the Storage API needs both SELECT and DELETE). Reading an image
--     goes through the public URL, which needs no policy.
--   * profiles.avatar_url stores the object path inside the bucket, not a URL,
--     and only a path inside the profile's own folder. Nobody can point their
--     avatar at an external URL (a tracking pixel) or at someone else's file.
--     The app builds the public URL from the path.
--
-- No app code wrote avatar_url before this migration, so existing rows are
-- expected to be null. The constraint is NOT VALID so an unexpected legacy
-- value cannot fail the rollout; it is still enforced on every write.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_select_own_or_admin on storage.objects;
drop policy if exists avatars_delete_own_or_admin on storage.objects;

create policy avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and public.is_account_enabled(auth.uid())
  );

create policy avatars_select_own_or_admin
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy avatars_delete_own_or_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

alter table public.profiles drop constraint if exists profiles_avatar_url_own_path;

alter table public.profiles add constraint profiles_avatar_url_own_path check (
  avatar_url is null
  or avatar_url ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$')
) not valid;

comment on column public.profiles.avatar_url is
  'Object path in the public avatars bucket (<profile id>/<uuid>.<ext>), not a URL. Null shows initials.';

commit;
