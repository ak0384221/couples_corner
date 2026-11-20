-- Important dates are visible to the creator and their current partner.
-- Every saved month/day repeats annually, so birthdays and anniversaries stay useful.

create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (length(btrim(event_name)) between 1 and 80),
  event_date date not null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index important_dates_created_by_idx on public.important_dates (created_by, event_date);

alter table public.important_dates enable row level security;
revoke all on public.important_dates from anon, authenticated;
grant select (id, event_name, event_date, created_at) on public.important_dates to authenticated;
grant insert (event_name, event_date) on public.important_dates to authenticated;

create policy important_dates_select_owner_or_partner on public.important_dates
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or created_by = (select public.current_partner_id())
  );

create policy important_dates_insert_owner on public.important_dates
  for insert to authenticated
  with check (created_by = (select auth.uid()));
