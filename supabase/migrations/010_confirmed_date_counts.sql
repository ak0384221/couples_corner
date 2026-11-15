create or replace function private.dates_after_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'confirmed' and new.status = 'confirmed' then
    update public.places
       set visit_count = visit_count + 1
     where id = new.place_id
       and couple_id = new.couple_id;
  end if;
  return new;
end;
$$;
revoke all on function private.dates_after_confirm() from public, anon, authenticated;

drop trigger if exists dates_count_confirmed_visit on public.dates;
create trigger dates_count_confirmed_visit
  after update of status on public.dates
  for each row execute function private.dates_after_confirm();
