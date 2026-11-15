create or replace function public.suggest_date_change(p_date_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_date public.dates%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_date
    from public.dates
   where id = p_date_id
   for update;
  if not found or not exists (
    select 1 from public.couple_members cm
     where cm.user_id = v_uid and cm.couple_id = v_date.couple_id
  ) then
    raise exception 'date_not_found' using errcode = 'P0002';
  end if;
  if v_date.created_by = v_uid then
    raise exception 'creator_cannot_suggest' using errcode = '42501';
  end if;
  if v_date.status <> 'pending' then
    raise exception 'date_not_pending' using errcode = '55000';
  end if;

  update public.dates set status = 'changed' where id = v_date.id;
  perform private.notify(v_date.created_by, v_uid, 'date_changed', 'date', v_date.id);
end;
$$;

create or replace function public.revise_date_request(
  p_date_id uuid,
  p_name text,
  p_day date,
  p_start_time time,
  p_time_label text
)
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
  if p_day is null or p_start_time is null
     or char_length(coalesce(p_name, '')) > 80
     or char_length(coalesce(p_time_label, '')) > 40 then
    raise exception 'invalid_date_details' using errcode = '22023';
  end if;

  select * into v_date
    from public.dates
   where id = p_date_id
   for update;
  if not found or not exists (
    select 1 from public.couple_members cm
     where cm.user_id = v_uid and cm.couple_id = v_date.couple_id
  ) then
    raise exception 'date_not_found' using errcode = 'P0002';
  end if;
  if v_date.created_by <> v_uid then
    raise exception 'only_creator_can_revise' using errcode = '42501';
  end if;
  if v_date.status <> 'changed' then
    raise exception 'date_not_changed' using errcode = '55000';
  end if;

  update public.dates
     set name = nullif(btrim(p_name), ''),
         day = p_day,
         start_time = p_start_time,
         time_label = nullif(btrim(p_time_label), ''),
         status = 'pending'
   where id = v_date.id;

  select cm.user_id into v_partner
    from public.couple_members cm
   where cm.couple_id = v_date.couple_id
     and cm.user_id <> v_uid;
  if v_partner is not null then
    perform private.notify(v_partner, v_uid, 'date_changed', 'date', v_date.id);
  end if;
end;
$$;

revoke all on function public.suggest_date_change(uuid) from public, anon, authenticated;
revoke all on function public.revise_date_request(uuid, text, date, time, text) from public, anon, authenticated;
grant execute on function public.suggest_date_change(uuid) to authenticated;
grant execute on function public.revise_date_request(uuid, text, date, time, text) to authenticated;
