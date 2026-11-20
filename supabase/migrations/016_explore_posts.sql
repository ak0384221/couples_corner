-- Public relationship reminders for Explore.
-- Public visitors can read posts; signed-in users can create them under their own account.

create table public.explore_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('social_media', 'sunnah', 'intentional_love')),
  content text not null check (length(btrim(content)) between 1 and 500),
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index explore_posts_created_at_idx on public.explore_posts (created_at desc, id desc);
create index explore_posts_category_created_at_idx
  on public.explore_posts (category, created_at desc, id desc);

alter table public.explore_posts enable row level security;
revoke all on public.explore_posts from anon, authenticated;
grant select (id, category, content, created_at) on public.explore_posts to anon, authenticated;
grant insert (category, content, author_id) on public.explore_posts to authenticated;

create policy explore_posts_public_read on public.explore_posts
  for select to anon, authenticated
  using (true);

create policy explore_posts_authenticated_insert on public.explore_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()));

insert into public.explore_posts (category, content)
select seed.category, seed.content
from (values
  ('social_media', 'Scroll less, look closer at the person sitting next to you. Real barakah doesn’t need a highlight reel.'),
  ('social_media', 'Social media shows curated moments, not quiet sacrifices. Guard your marriage from comparison.'),
  ('social_media', 'A couple posting constantly isn’t proof of peace; a couple praying together often is.'),
  ('social_media', 'Don’t measure a real, breathing marriage against a filtered screen.'),
  ('social_media', 'Peace in a home is built in private, not performed in public.'),
  ('social_media', 'Comparison is a thief of contentment—especially inside a nikah.'),
  ('social_media', 'Mute the noise online so you can hear what your partner actually needs today.'),
  ('social_media', 'Some of the strongest marriages you’ll never see online because they’re too busy living it.'),
  ('social_media', 'Turn off the highlight reels and tend to the real garden in front of you.'),
  ('social_media', 'What looks effortless on a screen usually hides angles, edits, and unseen struggles.'),
  ('sunnah', 'Make the Sunnah your blueprint, not a viral aesthetic. Mercy, gentleness, and patience never go out of style.'),
  ('sunnah', 'Lead with softness and listen with honor—that’s the Sunnah way of holding a home.'),
  ('sunnah', 'When ego gets loud, go back to prophetic manners: a gentle word, a warm greeting, a forgiving heart.'),
  ('sunnah', 'Real romance in Islam isn’t dramatic—it’s tenderness, respect, and carrying each other through hard days.'),
  ('sunnah', 'Build your home on sakinah (tranquility), mawaddah (affection), and rahmah (mercy), not fleeting trends.'),
  ('sunnah', 'Speak to your spouse the way you wish to be spoken to when you’re tired, stressed, or wrong.'),
  ('sunnah', 'Sunnah living means choosing kindness even when you don’t feel like winning an argument.'),
  ('sunnah', 'A home anchored in the Sunnah doesn’t break when worldly trends shift.'),
  ('sunnah', 'Honor your partner in private just as much as—or more than—you do in front of others.'),
  ('sunnah', 'Mercy is strength in marriage. Be soft where the world tells you to be harsh.'),
  ('intentional_love', 'Love isn’t just a feeling you wait for; it’s a choice you renew and a dua you keep making.'),
  ('intentional_love', 'When words fail you, raise your hands—ask Allah to soften your partner’s heart and steady your own.'),
  ('intentional_love', 'The best gift you can give your spouse is a quiet dua made when they aren’t even in the room.'),
  ('intentional_love', 'Ask Allah to put barakah in your time together, healing in your apologies, and patience in your waiting.'),
  ('intentional_love', 'Love your partner for Allah’s sake, and you’ll find grace even on the days you fall short.'),
  ('intentional_love', 'Make dua for their health, their peace of mind, their akhirah, and the weight they carry silently.'),
  ('intentional_love', 'Sometimes the most romantic thing you can do is pray for your partner’s ease before asking for your own.'),
  ('intentional_love', 'Keep loving gently, keep forgiving quickly, and keep asking Allah to tie your hearts in goodness.'),
  ('intentional_love', 'Marriage grows when two imperfect people turn toward Allah instead of turning against each other.'),
  ('intentional_love', 'Ask Allah to make your home a place of rest—and make your partner someone you continually pray for.')
) as seed(category, content)
where not exists (
  select 1
  from public.explore_posts as existing
  where existing.category = seed.category
    and existing.content = seed.content
);
