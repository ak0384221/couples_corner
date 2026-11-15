-- Limit new photos and thumbnails to 400 KB while keeping existing larger photos readable.
alter table public.photos
  add column if not exists thumb_path text;

alter table public.photos
  drop constraint if exists photos_size_check;
alter table public.photos
  add constraint photos_size_check check (size_bytes between 1 and 409600) not valid;

alter table public.photos
  drop constraint if exists photos_thumb_path_format;
alter table public.photos
  add constraint photos_thumb_path_format check (
    thumb_path is null
    or thumb_path ~ ('^' || couple_id::text || '/albums/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ) not valid;

grant insert (thumb_path) on public.photos to authenticated;

update storage.buckets
   set file_size_limit = 409600
 where id = 'photos';

-- A multi-row photo insert creates one notification per partner and album.
create or replace function private.photos_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cover record;
  v_photo record;
  v_partner uuid;
begin
  for v_cover in
    select distinct on (album_id) album_id, id
      from inserted_photos
     order by album_id, created_at, id
  loop
    update public.albums
       set cover_photo_id = v_cover.id
     where id = v_cover.album_id
       and cover_photo_id is null;
  end loop;

  for v_photo in
    select distinct couple_id, uploaded_by, album_id from inserted_photos
  loop
    select cm.user_id into v_partner
      from public.couple_members cm
     where cm.couple_id = v_photo.couple_id
       and cm.user_id <> v_photo.uploaded_by;

    if v_partner is not null then
      perform private.notify(v_partner, v_photo.uploaded_by, 'photos_added', 'album', v_photo.album_id);
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.photos_after_insert() from public, anon, authenticated;

drop trigger if exists photos_notify_after_insert on public.photos;
create trigger photos_notify_after_insert
  after insert on public.photos
  referencing new table as inserted_photos
  for each statement execute function private.photos_after_insert();
