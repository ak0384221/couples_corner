-- =====================================================================
-- 007_checks.sql
-- WHAT IT DOES: READ-ONLY queries to prove the lock-down is in place. It changes nothing.
-- Run any time (after 001 to 006). Run the blocks one at a time in the SQL Editor and
-- compare with the "EXPECT" line above each.
-- =====================================================================

-- 1) EXPECT: every row has rls_enabled = true (public tables and private.rate_limits).
select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'private')
order by n.nspname, c.relname;

-- 2) EXPECT: zero rows. (Any table listed here has RLS switched off.)
select n.nspname as schema, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and not c.relrowsecurity;

-- 3) Every policy on every public table.
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 4) Tables with RLS but NO policy at all (nobody can touch them through the API).
-- EXPECT: only private.rate_limits.
select n.nspname as schema, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and c.relrowsecurity
  and not exists (
    select 1 from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname
  )
order by 1, 2;

-- 5) Table rights of the anon role (not logged in). EXPECT: zero rows.
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema in ('public', 'private');

-- 6) Whole-table rights of logged-in users. EXPECT: select everywhere they should read;
-- delete only on places, closet_items, albums, photos; no insert/update here
-- (inserts and updates are column-by-column, see query 7).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public'
order by table_name, privilege_type;

-- 7) Column-level insert/update rights of logged-in users.
-- EXPECT: dates has NO status, confirmed_by, confirmed_at, couple_id, created_by;
-- places has NO visit_count, couple_id, created_by; notifications update is_read only.
select table_name, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')
group by table_name, privilege_type
order by table_name, privilege_type;

-- 8) SECURITY DEFINER functions WITHOUT a fixed search_path. EXPECT: zero rows.
select p.oid::regprocedure as function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef and n.nspname in ('public', 'private')
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%'
  );

-- 9) Who can run each function. EXPECT: anon_can_run = false for all rows;
-- authenticated_can_run = true only for the API functions (current_couple_id, is_couple_member,
-- current_partner_id, search_profile_by_username, send_pair_request, respond_pair_request,
-- get_my_pair_requests, confirm_date, send_closet_preference, accept_closet_preference,
-- change_closet_preference, cancel_date, suggest_date_change, revise_date_request), false for
-- everything in schema private and the trigger helpers.
select n.nspname as schema,
       p.oid::regprocedure as function,
       has_function_privilege('anon', p.oid, 'execute')          as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_run
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.oid::regprocedure::text;

-- 10) Storage policies on the photos bucket. EXPECT: 6 policies (avatars read/insert/delete,
-- couple read/insert/delete) and no update policy.
select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'photos\_%'
order by policyname;

-- 11) Bucket settings. EXPECT: public = false, file_size_limit = 1048576, allowed = {image/jpeg}.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'photos';

-- 12) Pairing integrity. EXPECT: zero rows for each.
-- (a) someone in more than one couple (cannot happen: user_id is the primary key)
select user_id, count(*) from public.couple_members group by user_id having count(*) > 1;
-- (b) a couple that does not have exactly two members
select c.id, count(cm.user_id) as members
from public.couples c left join public.couple_members cm on cm.couple_id = c.id
group by c.id having count(cm.user_id) <> 2;
-- (c) a confirmed date confirmed by its own creator
select id from public.dates where confirmed_by = created_by;
