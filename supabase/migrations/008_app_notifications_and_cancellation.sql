-- Additional app flows that were not present in the initial schema rollout.

create or replace function public.cancel_date(p_date_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_date public.dates%rowtype;
  v_partner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_date
    from public.dates
   where id = p_date_id
   for update;

  if not found or not exists (
    select 1
      from public.couple_members cm
     where cm.user_id = v_uid
       and cm.couple_id = v_date.couple_id
  ) then
    raise exception 'date_not_found' using errcode = 'P0002';
  end if;
  if v_date.created_by <> v_uid then
    raise exception 'only_creator_can_cancel' using errcode = '42501';
  end if;
  if v_date.status <> 'pending' then
    raise exception 'date_not_pending' using errcode = '55000';
  end if;

  update public.dates
     set status = 'cancelled'
   where id = v_date.id;

  select cm.user_id into v_partner
    from public.couple_members cm
   where cm.couple_id = v_date.couple_id
     and cm.user_id <> v_uid;
  if v_partner is not null then
    perform private.notify(v_partner, v_uid, 'date_cancelled', 'date', v_date.id);
  end if;
end;
$$;

revoke all on function public.cancel_date(uuid) from public, anon, authenticated;
grant execute on function public.cancel_date(uuid) to authenticated;

create or replace function private.photos_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
begin
  select cm.user_id into v_partner
    from public.couple_members cm
   where cm.couple_id = new.couple_id
     and cm.user_id <> new.uploaded_by;

  if v_partner is not null then
    perform private.notify(v_partner, new.uploaded_by, 'photos_added', 'album', new.album_id);
  end if;
  return new;
end;
$$;
revoke all on function private.photos_after_insert() from public, anon, authenticated;

drop trigger if exists photos_notify_after_insert on public.photos;
create trigger photos_notify_after_insert
  after insert on public.photos
  for each row execute function private.photos_after_insert();
