alter table public.profiles
  add column birth_year smallint,
  add constraint profiles_birth_year_range
    check (birth_year is null or birth_year between 1900 and 2100);

grant insert (birth_year) on public.profiles to authenticated;
grant update (birth_year) on public.profiles to authenticated;
