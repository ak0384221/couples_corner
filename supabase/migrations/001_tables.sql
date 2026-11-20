-- =====================================================================
-- 001_tables.sql
-- WHAT IT DOES: creates every table (plan section 5.2), with keys, status
-- checks and integrity rules. It does NOT turn on Row Level Security
-- (that is 003_rls.sql). Run it FIRST, once, in the Supabase SQL Editor.
-- Needs Postgres 15 or newer (every current Supabase project has it).
--
-- Design notes
--  * "Which couple does this row belong to?" is answered by composite foreign
--    keys, not by trust. Example: dates(place_id, couple_id) points at
--    places(id, couple_id), so a date can never point at another couple's place.
--  * couple_members has user_id as PRIMARY KEY. That is what guarantees
--    "one couple per person", in both directions, even under concurrent requests.
--  * Status columns are changed only by the SECURITY DEFINER functions in
--    004_flows.sql (column privileges in 003 block direct edits).
-- =====================================================================

-- New tables and functions in the public schema are NOT handed to the API roles
-- automatically. 003 grants only what is needed, column by column.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- shared trigger: keep updated_at honest ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- =====================================================================
-- profiles: one row per auth user. The email stays in auth.users, never here.
-- =====================================================================
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null,
  username         text not null,
  bio              text,
  birth_day        smallint,
  birth_month      smallint,
  photo_path       text,
  theme_mode       text not null default 'pink',
  theme_font       text not null default 'soft',
  theme_accent     text not null default 'rose',
  theme_font_color text not null default 'cocoa',
  email_alerts     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_username_key unique (username),
  constraint profiles_name_len check (char_length(btrim(name)) between 1 and 60),
  -- usernames are stored lowercase: letters, digits, underscore, 3 to 20 characters
  constraint profiles_username_format check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 120),
  -- birthday is day + month only (the form says "Day, month"); both or neither
  constraint profiles_birthday_pair check ((birth_day is null) = (birth_month is null)),
  constraint profiles_birth_day_range check (birth_day between 1 and 31),
  constraint profiles_birth_month_range check (birth_month between 1 and 12),
  -- an avatar must sit in the owner's own folder: avatars/<user_id>/<uuid>.jpg
  constraint profiles_photo_path_own_folder check (
    photo_path is null or photo_path ~ ('^avatars/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ),
  constraint profiles_theme_mode_check check (theme_mode in ('light', 'dark', 'pink')),
  constraint profiles_theme_font_check check (theme_font in ('soft', 'classic', 'handwritten', 'simple')),
  constraint profiles_theme_accent_check check (theme_accent in ('rose', 'lilac', 'sky', 'sage', 'butter')),
  constraint profiles_theme_font_color_check check (theme_font_color in ('cocoa', 'black', 'plum', 'navy'))
);

-- Normalise before the checks run: trimmed name, trimmed lowercase username.
create or replace function public.profiles_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name     := btrim(new.name);
  new.username := lower(btrim(new.username));
  return new;
end;
$$;
revoke all on function public.profiles_normalize() from public, anon, authenticated;

create trigger profiles_normalize_biu
  before insert or update on public.profiles
  for each row execute function public.profiles_normalize();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- pair_requests: "[NAME] wants to pair with you"
-- =====================================================================
create table public.pair_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending',
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint pair_requests_status_check check (status in ('pending', 'accepted', 'declined')),
  -- a user cannot pair with themselves
  constraint pair_requests_not_self check (sender_id <> receiver_id),
  constraint pair_requests_responded_check check ((status = 'pending') = (responded_at is null))
);

-- Only one pending request between the same two people, in either direction.
create unique index pair_requests_one_pending_per_pair
  on public.pair_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';
create index pair_requests_receiver_idx on public.pair_requests (receiver_id, status);
create index pair_requests_sender_idx on public.pair_requests (sender_id, status);

create trigger pair_requests_set_updated_at
  before update on public.pair_requests
  for each row execute function public.set_updated_at();

-- =====================================================================
-- couples: created only by respond_pair_request() when a request is accepted.
-- member_a < member_b keeps one canonical row per pair.
-- =====================================================================
create table public.couples (
  id              uuid primary key default gen_random_uuid(),
  member_a        uuid not null references public.profiles (id) on delete restrict,
  member_b        uuid not null references public.profiles (id) on delete restrict,
  pair_request_id uuid references public.pair_requests (id) on delete set null,
  together_since  date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint couples_members_ordered check (member_a < member_b),
  constraint couples_members_key unique (member_a, member_b)
);

-- couple_members: one row per person. PRIMARY KEY (user_id) = "one accepted partner
-- per person" no matter which side of the couple they are on.
create table public.couple_members (
  user_id    uuid primary key references public.profiles (id) on delete restrict,
  couple_id  uuid not null references public.couples (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- lets other tables point at "this user, inside this couple"
  constraint couple_members_user_couple_key unique (user_id, couple_id)
);
create index couple_members_couple_idx on public.couple_members (couple_id);

-- Filled automatically when a couple is created. If either person already belongs to
-- a couple, the primary key fails and the whole insert is rolled back.
create or replace function public.couples_fill_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.couple_members (user_id, couple_id)
  values (new.member_a, new.id), (new.member_b, new.id);
  return new;
end;
$$;
revoke all on function public.couples_fill_members() from public, anon, authenticated;

-- The two members of a couple can never be swapped afterwards.
create or replace function public.couples_members_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_a <> old.member_a or new.member_b <> old.member_b then
    raise exception 'couple members cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.couples_members_immutable() from public, anon, authenticated;

create trigger couples_fill_members_ai
  after insert on public.couples
  for each row execute function public.couples_fill_members();
create trigger couples_members_immutable_bu
  before update on public.couples
  for each row execute function public.couples_members_immutable();
create trigger couples_set_updated_at
  before update on public.couples
  for each row execute function public.set_updated_at();

-- =====================================================================
-- places: typed by hand. NO Google Maps API, no geocoding, no coordinates.
-- =====================================================================
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  created_by  uuid not null,
  name        text not null,
  address     text,
  maps_url    text,
  visit_count integer not null default 0,
  saved       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint places_id_couple_key unique (id, couple_id),
  -- the creator must be a member of the same couple
  constraint places_created_by_member_fk foreign key (created_by, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint places_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint places_address_len check (address is null or char_length(address) <= 300),
  constraint places_visit_count_check check (visit_count >= 0),
  -- must be https
  constraint places_maps_url_https check (maps_url is null or maps_url like 'https://%'),
  -- and the host must be a Google Maps host (same rule as the server code). Defence in depth.
  constraint places_maps_url_host check (
    maps_url is null or (
      char_length(maps_url) <= 500
      and maps_url !~ '[[:space:][:cntrl:]]'
      and maps_url ~* '^https://(www\.google\.com/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl/maps)([/?#]|$)'
    )
  )
);
create index places_couple_idx on public.places (couple_id, saved);
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- =====================================================================
-- dates
-- day and start_time are Dhaka calendar/wall-clock values (Asia/Dhaka); no zone conversion is stored.
-- creator_* = what the planner wears; partner_* = what the planner picks for the other person.
-- =====================================================================
create table public.dates (
  id                   uuid primary key default gen_random_uuid(),
  couple_id            uuid not null references public.couples (id) on delete cascade,
  created_by           uuid not null,
  name                 text,
  mood                 text,
  activity             text,
  place_id             uuid not null,
  food                 text,
  day                  date not null,
  start_time           time not null,
  time_label           text,
  creator_outfit_style text,
  creator_outfit_color text,
  partner_outfit_style text,
  partner_outfit_color text,
  status               text not null default 'pending',
  confirmed_by         uuid,
  confirmed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint dates_id_couple_key unique (id, couple_id),
  constraint dates_created_by_member_fk foreign key (created_by, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint dates_confirmed_by_member_fk foreign key (confirmed_by, couple_id)
    references public.couple_members (user_id, couple_id),
  -- the place must belong to the same couple
  constraint dates_place_same_couple_fk foreign key (place_id, couple_id)
    references public.places (id, couple_id) on delete restrict,

  constraint dates_status_check check (status in ('pending', 'confirmed', 'changed', 'cancelled')),
  -- RULE: only the person who did NOT create the request can confirm it.
  constraint dates_confirmer_is_not_creator check (confirmed_by is null or confirmed_by <> created_by),
  -- a confirmed date always records who confirmed it and when
  constraint dates_confirmed_has_confirmer check (status <> 'confirmed' or (confirmed_by is not null and confirmed_at is not null)),
  constraint dates_text_len check (
    coalesce(char_length(name), 0) <= 80
    and coalesce(char_length(mood), 0) <= 40
    and coalesce(char_length(activity), 0) <= 40
    and coalesce(char_length(food), 0) <= 40
    and coalesce(char_length(time_label), 0) <= 40
    and coalesce(char_length(creator_outfit_style), 0) <= 40
    and coalesce(char_length(creator_outfit_color), 0) <= 40
    and coalesce(char_length(partner_outfit_style), 0) <= 40
    and coalesce(char_length(partner_outfit_color), 0) <= 40
  )
);
create index dates_couple_day_idx on public.dates (couple_id, day);
create trigger dates_set_updated_at
  before update on public.dates
  for each row execute function public.set_updated_at();

-- =====================================================================
-- closet_items
-- =====================================================================
create table public.closet_items (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  owner_id   uuid not null,
  photo_path text not null,
  kind       text not null,
  name       text not null,
  main_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint closet_items_id_couple_key unique (id, couple_id),
  constraint closet_items_owner_member_fk foreign key (owner_id, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint closet_items_kind_len check (char_length(kind) between 1 and 30),
  constraint closet_items_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint closet_items_color_len check (main_color is null or char_length(main_color) <= 20),
  -- path must be <couple_id>/closet/<uuid>.jpg
  constraint closet_items_photo_path_format check (
    photo_path ~ ('^' || couple_id::text || '/closet/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  )
);
create index closet_items_couple_idx on public.closet_items (couple_id, kind);
create trigger closet_items_set_updated_at
  before update on public.closet_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- closet_preferences: its own request and its own status.
-- It points at a date but NEVER changes the date's status (004 functions never touch dates).
-- =====================================================================
create table public.closet_preferences (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples (id) on delete cascade,
  date_id      uuid not null,
  created_by   uuid not null,
  status       text not null default 'pending',
  responded_by uuid,
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint closet_preferences_id_couple_key unique (id, couple_id),
  constraint closet_preferences_date_fk foreign key (date_id, couple_id)
    references public.dates (id, couple_id) on delete cascade,
  constraint closet_preferences_created_by_member_fk foreign key (created_by, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint closet_preferences_responded_by_member_fk foreign key (responded_by, couple_id)
    references public.couple_members (user_id, couple_id),

  constraint closet_preferences_status_check check (status in ('pending', 'accepted', 'changed')),
  -- RULE: only the person who did NOT create the preference can answer it.
  constraint closet_preferences_responder_is_not_creator check (responded_by is null or responded_by <> created_by),
  -- pending = nobody answered yet; accepted/changed = both responder and time are recorded
  constraint closet_preferences_answer_consistent check (
    (status = 'pending' and responded_by is null and responded_at is null)
    or (status <> 'pending' and responded_by is not null and responded_at is not null)
  )
);
-- One open (pending) preference per date.
create unique index closet_preferences_one_pending_per_date
  on public.closet_preferences (date_id) where status = 'pending';
create index closet_preferences_couple_idx on public.closet_preferences (couple_id);
create trigger closet_preferences_set_updated_at
  before update on public.closet_preferences
  for each row execute function public.set_updated_at();

-- The pieces inside a preference. side = whose look: the creator's own pieces, or the
-- match picked for the partner. (A child table is used instead of an array so that
-- every item gets a real foreign key to the same couple.)
create table public.closet_preference_items (
  preference_id uuid not null,
  couple_id     uuid not null,
  item_id       uuid not null,
  side          text not null,

  primary key (preference_id, item_id),
  constraint cpi_preference_fk foreign key (preference_id, couple_id)
    references public.closet_preferences (id, couple_id) on delete cascade,
  constraint cpi_item_fk foreign key (item_id, couple_id)
    references public.closet_items (id, couple_id) on delete cascade,
  constraint cpi_side_check check (side in ('creator', 'partner'))
);
create index cpi_preference_idx on public.closet_preference_items (preference_id);

-- =====================================================================
-- albums and photos
-- =====================================================================
create table public.albums (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references public.couples (id) on delete cascade,
  created_by     uuid not null,
  title          text not null,
  album_date     date not null default current_date,
  cover_photo_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint albums_id_couple_key unique (id, couple_id),
  constraint albums_created_by_member_fk foreign key (created_by, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint albums_title_len check (char_length(btrim(title)) between 1 and 80)
);
create index albums_couple_idx on public.albums (couple_id, album_date desc);
create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples (id) on delete cascade,
  album_id     uuid not null,
  uploaded_by  uuid not null,
  storage_path text not null,
  caption      text,
  size_bytes   integer not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint photos_id_couple_key unique (id, couple_id),
  constraint photos_album_fk foreign key (album_id, couple_id)
    references public.albums (id, couple_id) on delete cascade,
  constraint photos_uploaded_by_member_fk foreign key (uploaded_by, couple_id)
    references public.couple_members (user_id, couple_id),
  constraint photos_caption_len check (caption is null or char_length(caption) <= 200),
  -- the 1 MB rule, enforced in the database as well as in the browser and server
  constraint photos_size_check check (size_bytes between 1 and 1048576),
  -- path must be <couple_id>/albums/<uuid>.jpg
  constraint photos_storage_path_format check (
    storage_path ~ ('^' || couple_id::text || '/albums/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ),
  constraint photos_storage_path_key unique (storage_path)
);
create index photos_album_idx on public.photos (album_id, created_at);
create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

-- album cover: a photo of the same couple. If the cover photo is deleted, only
-- cover_photo_id is cleared (column list form needs Postgres 15+).
alter table public.albums
  add constraint albums_cover_photo_fk foreign key (cover_photo_id, couple_id)
  references public.photos (id, couple_id) on delete set null (cover_photo_id);

-- =====================================================================
-- notifications: written only by the functions/triggers in 004. Read and "mark read"
-- by the recipient. ref_type + ref_id point at the linked item.
-- =====================================================================
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  event_type   text not null,
  ref_type     text,
  ref_id       uuid,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint notifications_event_check check (event_type in (
    'pair_request_received', 'paired',
    'date_requested', 'date_confirmed', 'date_changed', 'date_cancelled',
    'closet_preference_sent', 'closet_preference_accepted', 'closet_preference_changed',
    'photos_added'
  )),
  constraint notifications_ref_type_check check (
    ref_type is null or ref_type in ('pair_request', 'couple', 'date', 'closet_preference', 'album')
  )
);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);
