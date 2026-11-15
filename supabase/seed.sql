-- Catalogue seed. ALL PRICES ARE PLACEHOLDERS until real Air Fibre pricing is confirmed.
-- Slider stops follow deck slide 7: 10 / 20 / 50 / 100 / 200 / 500 GB.
insert into public.price_tiers (pool_gb, price_lkr) values
  (10,   990),
  (20,  1690),
  (50,  3490),
  (100, 5990),
  (200, 9490),
  (500, 17990)
on conflict (pool_gb) do update set price_lkr = excluded.price_lkr;

-- Presets from slide 7 (Solo GB was left blank in the deck; 100 GB assumed).
insert into public.packages (id, name, pool_gb, lines, sort_order) values
  ('solo',   'Solo',   100, 1, 1),
  ('couple', 'Couple', 200, 2, 2),
  ('family', 'Family', 500, 5, 3)
on conflict (id) do update set name = excluded.name, pool_gb = excluded.pool_gb, lines = excluded.lines;

insert into public.settings (key, value) values
  ('extra_line_price_lkr', '290'::jsonb)
on conflict (key) do update set value = excluded.value;
