-- =====================================================================
-- 005_storage.sql
-- WHAT IT DOES: locks down the existing private bucket "photos".
-- Run FIFTH. Safe to run again. Create the bucket in the dashboard first
-- (Storage > New bucket > name: photos > keep "Public bucket" OFF).
--
-- Paths (random UUID file names only):
--   <couple_id>/albums/<uuid>.jpg      readable and writable only by that couple
--   <couple_id>/closet/<uuid>.jpg      readable and writable only by that couple
--   avatars/<user_id>/<uuid>.jpg       writable only by the owner; migration 015 narrows reads
-- Photos are shown with short-lived signed URLs created on the server. Creating a signed
-- URL needs the SELECT policy below, so only people who may read a file can get a link.
-- There is no UPDATE policy: files are never overwritten, a new random name is used.
-- =====================================================================

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'photos') then
    raise exception 'Bucket "photos" does not exist. Create it (private) in the dashboard first.';
  end if;
end $$;

-- Bucket-level limits, a second line of defence behind the browser and server checks:
-- private, max 1 MB per file, JPEG only (the browser re-encodes every photo to JPEG).
update storage.buckets
   set public = false,
       file_size_limit = 1048576,
       allowed_mime_types = array['image/jpeg']
 where id = 'photos';

drop policy if exists photos_avatars_read      on storage.objects;
drop policy if exists photos_avatars_insert    on storage.objects;
drop policy if exists photos_avatars_delete    on storage.objects;
drop policy if exists photos_couple_read       on storage.objects;
drop policy if exists photos_couple_insert     on storage.objects;
drop policy if exists photos_couple_delete     on storage.objects;

-- ---------- avatars ----------
create policy photos_avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'avatars');

create policy photos_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
    and name ~ ('^avatars/' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );

create policy photos_avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ---------- albums and closet: couple members only ----------
-- If the user is not paired, current_couple_id() is NULL and every comparison below is
-- NULL, which means "no access".
create policy photos_couple_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] in ('albums', 'closet')
  );

create policy photos_couple_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and name ~ ('^' || (select public.current_couple_id())::text || '/(albums|closet)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );

create policy photos_couple_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] in ('albums', 'closet')
  );
