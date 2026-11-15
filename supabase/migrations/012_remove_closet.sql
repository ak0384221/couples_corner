-- Remove the closet feature from databases that have already applied migrations 001-011.
-- Closet records and their notification history are intentionally deleted.

drop function if exists public.send_closet_preference(uuid, uuid[], uuid[]);
drop function if exists public.accept_closet_preference(uuid);
drop function if exists public.change_closet_preference(uuid, uuid[]);

delete from public.notifications
where event_type in (
  'closet_preference_sent',
  'closet_preference_accepted',
  'closet_preference_changed'
);

alter table public.notifications
  drop constraint if exists notifications_event_check;
alter table public.notifications
  drop constraint if exists notifications_ref_type_check;

alter table public.notifications
  add constraint notifications_event_check check (event_type in (
    'pair_request_received', 'paired',
    'date_requested', 'date_confirmed', 'date_changed', 'date_cancelled',
    'photos_added'
  ));
alter table public.notifications
  add constraint notifications_ref_type_check check (
    ref_type is null or ref_type in ('pair_request', 'couple', 'date', 'album')
  );

drop table if exists public.closet_preference_items;
drop table if exists public.closet_preferences;
drop table if exists public.closet_items;

drop policy if exists photos_couple_read on storage.objects;
drop policy if exists photos_couple_insert on storage.objects;
drop policy if exists photos_couple_delete on storage.objects;

create policy photos_couple_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = 'albums'
  );

create policy photos_couple_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and name ~ ('^' || (select public.current_couple_id())::text || '/albums/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );

create policy photos_couple_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = 'albums'
  );
