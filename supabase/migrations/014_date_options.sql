-- Couple-managed choices used by the date planner.
create table public.date_options (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  category text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint date_options_category_check check (category in (
    'mood', 'activity', 'food', 'time_label',
    'creator_outfit_style', 'creator_outfit_color',
    'partner_outfit_style', 'partner_outfit_color'
  )),
  constraint date_options_label_check check (char_length(btrim(label)) between 1 and 40),
  constraint date_options_couple_category_label_key unique (couple_id, category, label)
);

create index date_options_couple_category_order_idx
  on public.date_options (couple_id, category, sort_order, created_at);

alter table public.date_options enable row level security;

grant select, delete on public.date_options to authenticated;
grant insert (couple_id, category, label, sort_order) on public.date_options to authenticated;
grant update (label, sort_order) on public.date_options to authenticated;

create policy date_options_select_couple on public.date_options
  for select to authenticated
  using (couple_id = (select public.current_couple_id()));

create policy date_options_insert_couple on public.date_options
  for insert to authenticated
  with check (couple_id = (select public.current_couple_id()));

create policy date_options_update_couple on public.date_options
  for update to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));

create policy date_options_delete_couple on public.date_options
  for delete to authenticated
  using (couple_id = (select public.current_couple_id()));

insert into public.date_options (couple_id, category, label, sort_order)
select couples.id, options.category, options.label, options.sort_order
  from public.couples
 cross join (
  values
    ('mood', 'Cozy', 0), ('mood', 'Romantic', 1), ('mood', 'Adventurous', 2), ('mood', 'Silly', 3),
    ('activity', 'Walk', 0), ('activity', 'Cafe', 1), ('activity', 'Movie', 2), ('activity', 'Picnic', 3), ('activity', 'Boat ride', 4),
    ('food', 'Biryani', 0), ('food', 'Fuchka', 1), ('food', 'Pasta', 2), ('food', 'Dessert', 3), ('food', 'Coffee', 4),
    ('time_label', 'Golden hour', 0), ('time_label', 'Sunset', 1), ('time_label', 'Evening', 2), ('time_label', 'Late night', 3),
    ('creator_outfit_style', 'Three-piece', 0), ('creator_outfit_style', 'Top and jeans', 1), ('creator_outfit_style', 'Saree', 2), ('creator_outfit_style', 'Kurti', 3),
    ('creator_outfit_color', 'Rose', 0), ('creator_outfit_color', 'Sky', 1), ('creator_outfit_color', 'Sage', 2), ('creator_outfit_color', 'Lilac', 3), ('creator_outfit_color', 'Butter', 4),
    ('partner_outfit_style', 'Panjabi', 0), ('partner_outfit_style', 'T-shirt', 1), ('partner_outfit_style', 'Shirt', 2), ('partner_outfit_style', 'Polo', 3),
    ('partner_outfit_color', 'Navy', 0), ('partner_outfit_color', 'Cream', 1), ('partner_outfit_color', 'Black', 2), ('partner_outfit_color', 'Maroon', 3), ('partner_outfit_color', 'Olive', 4)
 ) as options(category, label, sort_order)
on conflict (couple_id, category, label) do nothing;
