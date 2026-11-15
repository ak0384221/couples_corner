-- =====================================================================
-- 002_helpers.sql
-- WHAT IT DOES: creates the small functions that answer "who am I, and which couple
-- am I in?" from the login (auth.uid()), and sets the column defaults that use them.
-- Run SECOND. Safe to run again.
--
-- Why SECURITY DEFINER: the functions must read couple_members even though the
-- caller has no direct right to see other people's rows. search_path is fixed to ''
-- (empty) so nothing can be hijacked by a look-alike object; every name inside is
-- schema-qualified. Execute is revoked from everyone and granted to logged-in users only.
-- =====================================================================

-- "private" holds internal functions and tables that the API must never expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The couple of the logged-in user, or NULL if not paired yet.
create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cm.couple_id
  from public.couple_members cm
  where cm.user_id = (select auth.uid());
$$;

-- True if the logged-in user belongs to the given couple.
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.user_id = (select auth.uid())
      and cm.couple_id = p_couple_id
  );
$$;

-- The other person in the logged-in user's couple, or NULL.
create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select other.user_id
  from public.couple_members me
  join public.couple_members other
    on other.couple_id = me.couple_id and other.user_id <> me.user_id
  where me.user_id = (select auth.uid());
$$;

revoke all on function public.current_couple_id() from public, anon, authenticated;
revoke all on function public.is_couple_member(uuid) from public, anon, authenticated;
revoke all on function public.current_partner_id() from public, anon, authenticated;
grant execute on function public.current_couple_id() to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.current_partner_id() to authenticated;

-- ---------------------------------------------------------------------
-- Column defaults: the browser never sends couple_id or the creator.
-- Both are filled from the login. (003 also stops the browser from sending them,
-- and the RLS policies re-check them.)
-- ---------------------------------------------------------------------
alter table public.places       alter column couple_id   set default public.current_couple_id();
alter table public.places       alter column created_by  set default auth.uid();
alter table public.dates        alter column couple_id   set default public.current_couple_id();
alter table public.dates        alter column created_by  set default auth.uid();
alter table public.closet_items alter column couple_id   set default public.current_couple_id();
alter table public.closet_items alter column owner_id    set default auth.uid();
alter table public.albums       alter column couple_id   set default public.current_couple_id();
alter table public.albums       alter column created_by  set default auth.uid();
alter table public.photos       alter column couple_id   set default public.current_couple_id();
alter table public.photos       alter column uploaded_by set default auth.uid();
