-- =====================================================================
-- 003_rls.sql
-- WHAT IT DOES: turns on Row Level Security (RLS) on every table, removes all default
-- access, then grants only what each table needs. Also creates the username search function.
-- Run THIRD (after 001 and 002). Safe to run again (policies are dropped and recreated).
--
-- Three layers, all deny-by-default:
--   1. GRANTs: the anon role gets nothing. Logged-in users get only the listed
--      operations, and on some tables only the listed COLUMNS (for example nobody can
--      write dates.status, couple_id or created_by directly).
--   2. RLS policies: a row is visible/changeable only to members of the owning couple.
--   3. Functions in 004: the only way to change statuses and create couples.
--
-- In every policy we write (select auth.uid()) and (select public.current_couple_id())
-- so Postgres evaluates them once per query instead of once per row.
-- =====================================================================

-- Start from zero access for the API roles.
revoke all on all tables in schema public from anon, authenticated;

alter table public.profiles                enable row level security;
alter table public.pair_requests           enable row level security;
alter table public.couples                 enable row level security;
alter table public.couple_members          enable row level security;
alter table public.places                  enable row level security;
alter table public.dates                   enable row level security;
alter table public.closet_items            enable row level security;
alter table public.closet_preferences      enable row level security;
alter table public.closet_preference_items enable row level security;
alter table public.albums                  enable row level security;
alter table public.photos                  enable row level security;
alter table public.notifications           enable row level security;

-- drop old versions so this file can be run again
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- =====================================================================
-- profiles
-- A user reads and edits their own profile. A partner (same couple) can read it.
-- Nobody else can read profiles. Pair search goes through search_profile_by_username()
-- below, and received requests through get_my_pair_requests() in 004, which return
-- only safe columns. There is no delete: a profile disappears with its auth user.
-- =====================================================================
grant select on public.profiles to authenticated;
grant insert (id, name, username, bio, birth_day, birth_month, photo_path)
  on public.profiles to authenticated;
grant update (name, username, bio, birth_day, birth_month, photo_path,
              theme_mode, theme_font, theme_accent, theme_font_color, email_alerts)
  on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_partner on public.profiles
  for select to authenticated
  using (id = (select public.current_partner_id()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =====================================================================
-- pair_requests: read-only for the two people involved.
-- Sending and answering happen only in send_pair_request / respond_pair_request.
-- =====================================================================
grant select on public.pair_requests to authenticated;

create policy pair_requests_select_involved on public.pair_requests
  for select to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

-- =====================================================================
-- couples and couple_members: read-only for members. Created only by respond_pair_request.
-- (No update or delete policy: unpairing is not part of Phase 1.)
-- =====================================================================
grant select on public.couples to authenticated;
grant select on public.couple_members to authenticated;

create policy couples_select_member on public.couples
  for select to authenticated
  using (id = (select public.current_couple_id()));

create policy couple_members_select_member on public.couple_members
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

-- =====================================================================
-- places: couple members read and manage them.
-- couple_id and created_by are NOT in the insert grant: the browser cannot send them,
-- they come from the defaults set in 002. The policy re-checks them anyway.
-- visit_count is not writable by the browser.
-- =====================================================================
grant select, delete on public.places to authenticated;
grant insert (name, address, maps_url, saved) on public.places to authenticated;
grant update (name, address, maps_url, saved) on public.places to authenticated;

create policy places_select_couple on public.places
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy places_insert_couple on public.places
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id())
              and created_by = (select auth.uid()));

create policy places_update_couple on public.places
  for update to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));

create policy places_delete_couple on public.places
  for delete to authenticated
  using (couple_id = (select public.current_couple_id()));

-- =====================================================================
-- dates
-- RULE: status, confirmed_by, confirmed_at, couple_id and created_by are NOT writable
-- by the browser. A date starts as 'pending' (column default). Only the creator can edit it,
-- and only while it is pending. Confirming/cancelling/changing happens in 004 functions.
-- There is no delete: a cancelled date stays as history.
-- =====================================================================
grant select on public.dates to authenticated;
grant insert (name, mood, activity, place_id, food, day, start_time, time_label,
              creator_outfit_style, creator_outfit_color,
              partner_outfit_style, partner_outfit_color)
  on public.dates to authenticated;
grant update (name, mood, activity, place_id, food, day, start_time, time_label,
              creator_outfit_style, creator_outfit_color,
              partner_outfit_style, partner_outfit_color)
  on public.dates to authenticated;

create policy dates_select_couple on public.dates
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy dates_insert_creator on public.dates
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id())
              and created_by = (select auth.uid())
              and status = 'pending');

create policy dates_update_creator_while_pending on public.dates
  for update to authenticated
  using (couple_id = (select public.current_couple_id())
         and created_by = (select auth.uid())
         and status = 'pending')
  with check (couple_id = (select public.current_couple_id())
              and created_by = (select auth.uid())
              and status = 'pending');

-- =====================================================================
-- closet_items: both partners see everything in the closet; you manage only your own items.
-- =====================================================================
grant select, delete on public.closet_items to authenticated;
grant insert (photo_path, kind, name, main_color) on public.closet_items to authenticated;
grant update (kind, name, main_color) on public.closet_items to authenticated;

create policy closet_items_select_couple on public.closet_items
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy closet_items_insert_own on public.closet_items
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id())
              and owner_id = (select auth.uid()));

create policy closet_items_update_own on public.closet_items
  for update to authenticated
  using (couple_id = (select public.current_couple_id()) and owner_id = (select auth.uid()))
  with check (couple_id = (select public.current_couple_id()) and owner_id = (select auth.uid()));

create policy closet_items_delete_own on public.closet_items
  for delete to authenticated
  using (couple_id = (select public.current_couple_id()) and owner_id = (select auth.uid()));

-- =====================================================================
-- closet_preferences and their items: read-only. Created and answered only in 004 functions,
-- so the "other person answers" rule and the pairing of pieces cannot be bypassed.
-- =====================================================================
grant select on public.closet_preferences to authenticated;
grant select on public.closet_preference_items to authenticated;

create policy closet_preferences_select_couple on public.closet_preferences
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy closet_preference_items_select_couple on public.closet_preference_items
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

-- =====================================================================
-- albums and photos: any member of the couple.
-- =====================================================================
grant select, delete on public.albums to authenticated;
grant insert (title, album_date) on public.albums to authenticated;
grant update (title, album_date, cover_photo_id) on public.albums to authenticated;

create policy albums_select_couple on public.albums
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy albums_insert_couple on public.albums
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id())
              and created_by = (select auth.uid()));

create policy albums_update_couple on public.albums
  for update to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));

create policy albums_delete_couple on public.albums
  for delete to authenticated
  using (couple_id = (select public.current_couple_id()));

grant select, delete on public.photos to authenticated;
grant insert (album_id, storage_path, caption, size_bytes) on public.photos to authenticated;
grant update (caption) on public.photos to authenticated;

create policy photos_select_couple on public.photos
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy photos_insert_couple on public.photos
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id())
              and uploaded_by = (select auth.uid()));

create policy photos_update_couple on public.photos
  for update to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));

create policy photos_delete_couple on public.photos
  for delete to authenticated
  using (couple_id = (select public.current_couple_id()));

-- =====================================================================
-- notifications: you see only your own, and you may only flip is_read.
-- Rows are created by the functions/triggers in 004, never by the browser.
-- =====================================================================
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- =====================================================================
-- Pair search: EXACT lowercase username only.
-- Returns at most ONE row with id, name, username, bio, photo_path. Never the email,
-- never the birthday. Hides yourself and people who are already paired (they look the same
-- as "not found"). Rate-limited (see 006). There is no broad SELECT on profiles, so this
-- is the only way to find someone you are not paired with.
-- =====================================================================
create or replace function public.search_profile_by_username(p_username text)
returns table (id uuid, name text, username text, bio text, photo_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform private.check_rate_limit('username_search', 20, interval '10 minutes');

  -- a person who is already paired cannot send requests
  if exists (select 1 from public.couple_members cm where cm.user_id = v_uid) then
    return;
  end if;

  -- accept "@name" or "name", any case, but only the exact, valid username format
  v_name := regexp_replace(lower(btrim(coalesce(p_username, ''))), '^@', '');
  if v_name !~ '^[a-z0-9_]{3,20}$' then
    return;
  end if;

  return query
    select p.id, p.name, p.username, p.bio, p.photo_path
    from public.profiles p
    where p.username = v_name
      and p.id <> v_uid
      and not exists (select 1 from public.couple_members cm where cm.user_id = p.id);
end;
$$;

revoke all on function public.search_profile_by_username(text) from public, anon, authenticated;
grant execute on function public.search_profile_by_username(text) to authenticated;
