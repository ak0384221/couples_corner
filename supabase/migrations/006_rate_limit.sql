-- =====================================================================
-- 006_rate_limit.sql
-- WHAT IT DOES: a simple rate limiter that lives entirely in Postgres (no outside service).
-- Used by search_profile_by_username (20 searches / 10 min) and send_pair_request
-- (5 sends / hour). Run SIXTH, before the app calls either function. Safe to run again.
--
-- How it works: one counter row per (user, action, time window). Each call adds 1 to the
-- current window with an atomic upsert and raises 'rate_limited' (HTTP 429 through the API)
-- when the count passes the limit. Old windows are deleted as we go.
-- Note: if a function later fails for another reason, its transaction is rolled back and that
-- attempt is not counted. The limiter only counts calls that completed or hit the limit.
-- The table lives in the private schema, so the API cannot see it, and RLS is on with
-- no policies (deny everything) as a second lock.
-- =====================================================================

create schema if not exists private;

create table if not exists private.rate_limits (
  user_id      uuid        not null,
  action       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (user_id, action, window_start)
);

alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create or replace function private.check_rate_limit(p_action text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_secs  double precision := extract(epoch from p_window);
  v_start timestamptz;
  v_hits  integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- start of the current fixed window
  v_start := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);

  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (v_uid, p_action, v_start, 1)
  on conflict (user_id, action, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- tidy up old windows for this user and action
  delete from private.rate_limits
   where user_id = v_uid and action = p_action
     and window_start < now() - (p_window * 4);

  if v_hits > p_max then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
end;
$$;

revoke all on function private.check_rate_limit(text, integer, interval) from public, anon, authenticated;
