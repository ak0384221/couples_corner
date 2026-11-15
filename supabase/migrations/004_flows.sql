-- =====================================================================
-- 004_flows.sql
-- WHAT IT DOES: the only code paths that may change who is paired, a date's status,
-- or a closet preference's status. Each function:
--   * takes the caller from auth.uid() (never from a parameter),
--   * checks the caller's right to do this and the current status,
--   * changes the row and writes the notification for the other person
--     in the SAME transaction (if one step fails, nothing is saved).
-- Run FOURTH. Safe to run again. Needs 006 (rate limiter) before it is first USED;
-- creating the functions does not need it.
--
-- All functions are SECURITY DEFINER with search_path = '' (every name is schema-qualified)
-- and are executable by logged-in users only.
-- Error codes: 28000 not logged in, 42501 not allowed, 55000 wrong status,
-- 22023 bad input, P0002 not found (also used when the row belongs to someone else,
-- so IDs cannot be probed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal: write one notification row. Not callable from the API (private schema).
-- ---------------------------------------------------------------------
create or replace function private.notify(
  p_recipient uuid, p_actor uuid, p_event text, p_ref_type text, p_ref_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, event_type, ref_type, ref_id)
  values (p_recipient, p_actor, p_event, p_ref_type, p_ref_id);
$$;
revoke all on function private.notify(uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- =====================================================================
-- 1. send_pair_request(receiver)
-- RULES: caller and receiver both have a profile, are different people, and are
-- not already in a couple. Only one pending request per pair (also a unique index).
-- Rate-limited: 5 sends per hour.
-- =====================================================================
create or replace function public.send_pair_request(p_receiver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform private.check_rate_limit('pair_request_send', 5, interval '1 hour');

  if p_receiver_id is null or p_receiver_id = v_uid then
    raise exception 'invalid_receiver' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_required' using errcode = '55000';
  end if;
  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'receiver_not_found' using errcode = 'P0002';
  end if;

  -- RULE: one accepted partner per person
  if exists (select 1 from public.couple_members where user_id in (v_uid, p_receiver_id)) then
    raise exception 'already_paired' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.pair_requests pr
    where pr.status = 'pending'
      and ((pr.sender_id = v_uid and pr.receiver_id = p_receiver_id)
        or (pr.sender_id = p_receiver_id and pr.receiver_id = v_uid))
  ) then
    raise exception 'request_already_pending' using errcode = '55000';
  end if;

  insert into public.pair_requests (sender_id, receiver_id)
  values (v_uid, p_receiver_id)
  returning id into v_id;

  perform private.notify(p_receiver_id, v_uid, 'pair_request_received', 'pair_request', v_id);
  return v_id;
end;
$$;

-- =====================================================================
-- 2. respond_pair_request(request, accept)
-- RULE: ONLY THE RECEIVER can answer. The sender gets 'only_receiver_can_answer'.
-- On accept: creates the couple (members are filled by a trigger from 001, whose primary
-- key stops anyone ending up in two couples), marks the request accepted, and notifies
-- both people. On decline: marks it declined. A decline is not announced to the sender.
-- Returns the new couple id, or NULL on decline.
-- =====================================================================
create or replace function public.respond_pair_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_req    public.pair_requests%rowtype;
  v_couple uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_accept is null then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;

  -- lock the row so two answers cannot race
  select * into v_req from public.pair_requests where id = p_request_id for update;

  -- not found, or not involved: same message either way
  if not found or v_uid not in (v_req.sender_id, v_req.receiver_id) then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if v_req.receiver_id <> v_uid then
    raise exception 'only_receiver_can_answer' using errcode = '42501';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = '55000';
  end if;

  if not p_accept then
    update public.pair_requests
       set status = 'declined', responded_at = now()
     where id = v_req.id;
    return null;
  end if;

  -- RULE: one accepted partner per person
  if exists (
    select 1 from public.couple_members
    where user_id in (v_req.sender_id, v_req.receiver_id)
  ) then
    raise exception 'already_paired' using errcode = '55000';
  end if;

  insert into public.couples (member_a, member_b, pair_request_id)
  values (least(v_req.sender_id, v_req.receiver_id),
          greatest(v_req.sender_id, v_req.receiver_id),
          v_req.id)
  returning id into v_couple;

  update public.pair_requests
     set status = 'accepted', responded_at = now()
   where id = v_req.id;

  perform private.notify(v_req.sender_id,   v_uid, 'paired', 'couple', v_couple);
  perform private.notify(v_req.receiver_id, v_uid, 'paired', 'couple', v_couple);
  return v_couple;
end;
$$;

-- =====================================================================
-- get_my_pair_requests(): my pending requests with ONLY the other person's card
-- (name, username, bio, photo). This is how the "wants to pair with you" screen
-- shows the sender without opening up the profiles table.
-- direction = 'incoming' (I can answer) or 'outgoing' (I am waiting).
-- =====================================================================
create or replace function public.get_my_pair_requests()
returns table (
  request_id uuid, direction text, status text, created_at timestamptz,
  other_id uuid, other_name text, other_username text, other_bio text, other_photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id,
         case when pr.receiver_id = (select auth.uid()) then 'incoming' else 'outgoing' end,
         pr.status,
         pr.created_at,
         o.id, o.name, o.username, o.bio, o.photo_path
  from public.pair_requests pr
  join public.profiles o
    on o.id = case when pr.receiver_id = (select auth.uid()) then pr.sender_id else pr.receiver_id end
  where pr.status = 'pending'
    and (select auth.uid()) in (pr.sender_id, pr.receiver_id)
  order by pr.created_at desc;
$$;

-- =====================================================================
-- 3a. New date request: a trigger writes the notification for the partner when a pending
-- date is inserted (plan 5.3). The email is sent later by the server; if it fails the
-- date and this notification still stand.
-- =====================================================================
create or replace function private.dates_after_insert()
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
  where cm.couple_id = new.couple_id and cm.user_id <> new.created_by;

  if v_partner is not null then
    perform private.notify(v_partner, new.created_by, 'date_requested', 'date', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.dates_after_insert() from public, anon, authenticated;

drop trigger if exists dates_notify_after_insert on public.dates;
create trigger dates_notify_after_insert
  after insert on public.dates
  for each row execute function private.dates_after_insert();

-- =====================================================================
-- 3b. confirm_date(date)
-- RULE: only the person who did NOT create the date can confirm it. Also backed by the
-- CHECK constraint dates_confirmer_is_not_creator, so even a bug here cannot break it.
-- Only a 'pending' date can be confirmed. Notifies the creator.
-- =====================================================================
create or replace function public.confirm_date(p_date_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_date public.dates%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_date from public.dates where id = p_date_id for update;

  -- not found, or not in my couple: same message either way
  if not found or not exists (
    select 1 from public.couple_members cm
    where cm.user_id = v_uid and cm.couple_id = v_date.couple_id
  ) then
    raise exception 'date_not_found' using errcode = 'P0002';
  end if;

  if v_date.created_by = v_uid then
    raise exception 'creator_cannot_confirm' using errcode = '42501';
  end if;

  if v_date.status <> 'pending' then
    raise exception 'date_not_pending' using errcode = '55000';
  end if;

  update public.dates
     set status = 'confirmed', confirmed_by = v_uid, confirmed_at = now()
   where id = v_date.id;

  perform private.notify(v_date.created_by, v_uid, 'date_confirmed', 'date', v_date.id);
end;
$$;

-- =====================================================================
-- 4. Closet preferences.
-- RULE: closet preference status NEVER changes the date's status. None of the three
-- functions below reads-for-update or writes the dates table.
-- RULE: only the person who did NOT create the preference can accept it or suggest a change
-- (also backed by CHECK closet_preferences_responder_is_not_creator).
-- Each piece must belong to the couple, and sit on the right side:
--   'creator' pieces are owned by the sender, 'partner' pieces by the other person.
-- =====================================================================

-- 4a. send_closet_preference(date, creator pieces, partner pieces)
create or replace function public.send_closet_preference(
  p_date_id uuid, p_creator_item_ids uuid[], p_partner_item_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_couple  uuid;
  v_partner uuid;
  v_date_status text;
  v_c_ids   uuid[];
  v_p_ids   uuid[];
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select cm.couple_id into v_couple from public.couple_members cm where cm.user_id = v_uid;
  if v_couple is null then
    raise exception 'not_paired' using errcode = '42501';
  end if;
  select cm.user_id into v_partner
    from public.couple_members cm where cm.couple_id = v_couple and cm.user_id <> v_uid;

  -- the date must be in my couple and not cancelled (a pending date is allowed)
  select d.status into v_date_status
    from public.dates d where d.id = p_date_id and d.couple_id = v_couple;
  if not found then
    raise exception 'date_not_found' using errcode = 'P0002';
  end if;
  if v_date_status = 'cancelled' then
    raise exception 'date_not_open' using errcode = '55000';
  end if;

  -- distinct ids, at most 8 per side, at least one piece in total
  select coalesce(array_agg(distinct x), '{}') into v_c_ids from unnest(coalesce(p_creator_item_ids, '{}')) x;
  select coalesce(array_agg(distinct x), '{}') into v_p_ids from unnest(coalesce(p_partner_item_ids, '{}')) x;
  if cardinality(v_c_ids) > 8 or cardinality(v_p_ids) > 8
     or cardinality(v_c_ids) + cardinality(v_p_ids) = 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- every piece exists, is in my couple, and is owned by the right person
  if (select count(*) from public.closet_items ci
       where ci.id = any (v_c_ids) and ci.couple_id = v_couple and ci.owner_id = v_uid) <> cardinality(v_c_ids)
     or (select count(*) from public.closet_items ci
          where ci.id = any (v_p_ids) and ci.couple_id = v_couple and ci.owner_id = v_partner) <> cardinality(v_p_ids) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.closet_preferences cp
    where cp.date_id = p_date_id and cp.status = 'pending'
  ) then
    raise exception 'preference_already_pending' using errcode = '55000';
  end if;

  insert into public.closet_preferences (couple_id, date_id, created_by)
  values (v_couple, p_date_id, v_uid)
  returning id into v_id;

  insert into public.closet_preference_items (preference_id, couple_id, item_id, side)
  select v_id, v_couple, x, 'creator' from unnest(v_c_ids) x
  union all
  select v_id, v_couple, x, 'partner' from unnest(v_p_ids) x;

  perform private.notify(v_partner, v_uid, 'closet_preference_sent', 'closet_preference', v_id);
  return v_id;
end;
$$;

-- 4b. accept_closet_preference(preference)
create or replace function public.accept_closet_preference(p_preference_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_pref public.closet_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_pref from public.closet_preferences where id = p_preference_id for update;
  if not found or not exists (
    select 1 from public.couple_members cm
    where cm.user_id = v_uid and cm.couple_id = v_pref.couple_id
  ) then
    raise exception 'preference_not_found' using errcode = 'P0002';
  end if;

  if v_pref.created_by = v_uid then
    raise exception 'creator_cannot_answer' using errcode = '42501';
  end if;
  if v_pref.status <> 'pending' then
    raise exception 'preference_not_pending' using errcode = '55000';
  end if;

  update public.closet_preferences
     set status = 'accepted', responded_by = v_uid, responded_at = now()
   where id = v_pref.id;
  -- note: the date row is deliberately not touched

  perform private.notify(v_pref.created_by, v_uid, 'closet_preference_accepted', 'closet_preference', v_pref.id);
end;
$$;

-- 4c. change_closet_preference(preference, my new pieces)
-- "Suggest a change": the other person swaps THEIR OWN pieces (the 'partner' side) and
-- sends it back. The status becomes 'changed' and the creator is notified.
create or replace function public.change_closet_preference(
  p_preference_id uuid, p_partner_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_pref public.closet_preferences%rowtype;
  v_ids  uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_pref from public.closet_preferences where id = p_preference_id for update;
  if not found or not exists (
    select 1 from public.couple_members cm
    where cm.user_id = v_uid and cm.couple_id = v_pref.couple_id
  ) then
    raise exception 'preference_not_found' using errcode = 'P0002';
  end if;

  if v_pref.created_by = v_uid then
    raise exception 'creator_cannot_answer' using errcode = '42501';
  end if;
  if v_pref.status <> 'pending' then
    raise exception 'preference_not_pending' using errcode = '55000';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_partner_item_ids, '{}')) x;
  if cardinality(v_ids) < 1 or cardinality(v_ids) > 8 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  -- all new pieces must be mine and in my couple
  if (select count(*) from public.closet_items ci
       where ci.id = any (v_ids) and ci.couple_id = v_pref.couple_id and ci.owner_id = v_uid) <> cardinality(v_ids) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  delete from public.closet_preference_items
   where preference_id = v_pref.id and side = 'partner';
  insert into public.closet_preference_items (preference_id, couple_id, item_id, side)
  select v_pref.id, v_pref.couple_id, x, 'partner' from unnest(v_ids) x;

  update public.closet_preferences
     set status = 'changed', responded_by = v_uid, responded_at = now()
   where id = v_pref.id;
  -- note: the date row is deliberately not touched

  perform private.notify(v_pref.created_by, v_uid, 'closet_preference_changed', 'closet_preference', v_pref.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Who may call what: logged-in users only. Nobody (not even anon) gets the rest.
-- ---------------------------------------------------------------------
revoke all on function public.send_pair_request(uuid)                     from public, anon, authenticated;
revoke all on function public.respond_pair_request(uuid, boolean)         from public, anon, authenticated;
revoke all on function public.get_my_pair_requests()                      from public, anon, authenticated;
revoke all on function public.confirm_date(uuid)                          from public, anon, authenticated;
revoke all on function public.send_closet_preference(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.accept_closet_preference(uuid)              from public, anon, authenticated;
revoke all on function public.change_closet_preference(uuid, uuid[])      from public, anon, authenticated;

grant execute on function public.send_pair_request(uuid)                     to authenticated;
grant execute on function public.respond_pair_request(uuid, boolean)         to authenticated;
grant execute on function public.get_my_pair_requests()                      to authenticated;
grant execute on function public.confirm_date(uuid)                          to authenticated;
grant execute on function public.send_closet_preference(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.accept_closet_preference(uuid)              to authenticated;
grant execute on function public.change_closet_preference(uuid, uuid[])      to authenticated;
