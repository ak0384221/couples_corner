create or replace function private.dates_after_pending_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
begin
  if old.status = 'pending'
     and new.status = 'pending'
     and (
       old.name is distinct from new.name
       or old.mood is distinct from new.mood
       or old.activity is distinct from new.activity
       or old.place_id is distinct from new.place_id
       or old.food is distinct from new.food
       or old.day is distinct from new.day
       or old.start_time is distinct from new.start_time
       or old.time_label is distinct from new.time_label
       or old.creator_outfit_style is distinct from new.creator_outfit_style
       or old.creator_outfit_color is distinct from new.creator_outfit_color
       or old.partner_outfit_style is distinct from new.partner_outfit_style
       or old.partner_outfit_color is distinct from new.partner_outfit_color
     ) then
    select cm.user_id into v_partner
      from public.couple_members cm
     where cm.couple_id = new.couple_id
       and cm.user_id <> new.created_by;
    if v_partner is not null then
      perform private.notify(v_partner, new.created_by, 'date_changed', 'date', new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.dates_after_pending_edit() from public, anon, authenticated;

drop trigger if exists dates_notify_after_pending_edit on public.dates;
create trigger dates_notify_after_pending_edit
  after update on public.dates
  for each row execute function private.dates_after_pending_edit();
