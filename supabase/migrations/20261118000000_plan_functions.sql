-- Atomic write functions used by the app, plus a usage simulator for demos.
-- Phone numbers are stored like Supabase Auth stores them: country code, no "+", e.g. 94771234567.

insert into public.settings (key, value) values ('max_lines', '6'::jsonb)
on conflict (key) do nothing;

-- Monthly price for a pool size and number of mobile lines (mirrors src/lib/pricing.ts).
create function public.plan_price(p_pool_gb int, p_lines int) returns int
language sql stable set search_path = '' as $$
  select t.price_lkr + p_lines * coalesce((select (value)::int from public.settings where key = 'extra_line_price_lkr'), 0)
  from public.price_tiers t where t.pool_gb = p_pool_gb;
$$;

-- ─── Onboarding: create a household owned by the caller ─────────────────────
create function public.create_household(p_name text, p_display_name text, p_pool_gb int default 100)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := (select auth.uid());
  phone text;
  hid   uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = 'insufficient_privilege'; end if;
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'Household name must be 1-40 characters'; end if;
  if char_length(trim(p_display_name)) not between 1 and 40 then raise exception 'Your name must be 1-40 characters'; end if;
  if public.plan_price(p_pool_gb, 1) is null then raise exception 'Unknown pool size'; end if;
  if exists (select 1 from public.household_members where profile_id = uid and status = 'active') then
    raise exception 'You are already in a household' using errcode = 'unique_violation';
  end if;

  update public.profiles set display_name = trim(p_display_name) where id = uid returning msisdn into phone;

  insert into public.households (name, owner_id) values (trim(p_name), uid) returning id into hid;
  insert into public.household_members (household_id, profile_id, kind, role, status, label, msisdn) values
    (hid, null, 'home', 'member', 'active', 'Home', null),
    (hid, uid,  'line', 'owner',  'active', 'Me',   phone);
  insert into public.pools (household_id, size_gb, price_lkr, cycle_start, cycle_end)
  values (hid, p_pool_gb, public.plan_price(p_pool_gb, 1), current_date, (current_date + interval '1 month')::date);

  return hid;
end $$;

-- ─── Step 1: pool size and lines ────────────────────────────────────────────
-- p_lines: [{ "id": "<member uuid>" | null, "label": "...", "msisdn": "947XXXXXXXX" }]
-- Keeps listed lines (renaming them), adds new ones as invited, removes unlisted non-owner lines,
-- shrinks allocations proportionally if they no longer fit, and updates the pool size and price.
create function public.save_plan(p_household uuid, p_pool_gb int, p_lines jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  max_lines int := coalesce((select (value)::int from public.settings where key = 'max_lines'), 6);
  pool      public.pools;
  owner_id  uuid;
  new_id    uuid;
  line      jsonb;
  kept      uuid[] := '{}';
  total     numeric;
  n         int := jsonb_array_length(p_lines);
begin
  if not public.is_household_owner(p_household) then
    raise exception 'Only the household owner can change the plan' using errcode = 'insufficient_privilege';
  end if;
  if public.plan_price(p_pool_gb, 1) is null then raise exception 'Unknown pool size'; end if;
  if n < 1 or n > max_lines then raise exception 'A household can have 1 to % mobile lines', max_lines; end if;

  select id into owner_id from public.household_members where household_id = p_household and role = 'owner';
  if not exists (select 1 from jsonb_array_elements(p_lines) l where l ->> 'id' = owner_id::text) then
    raise exception 'The owner''s line can''t be removed';
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    if char_length(trim(line ->> 'label')) not between 1 and 20 then
      raise exception 'Each line needs a name of up to 20 characters';
    end if;
    if line ->> 'id' is not null then
      update public.household_members set label = trim(line ->> 'label')
      where id = (line ->> 'id')::uuid and household_id = p_household and kind = 'line';
      if not found then raise exception 'That line no longer exists'; end if;
      kept := kept || (line ->> 'id')::uuid;
    else
      if (line ->> 'msisdn') !~ '^947[0-9]{8}$' then
        raise exception '%: enter a Dialog mobile number like 077 123 4567', line ->> 'label';
      end if;
      if exists (select 1 from public.household_members where household_id = p_household and msisdn = line ->> 'msisdn') then
        raise exception '%: that number is already in the household', line ->> 'label';
      end if;
      insert into public.household_members (household_id, kind, role, status, label, msisdn)
      values (p_household, 'line', 'member', 'invited', trim(line ->> 'label'), line ->> 'msisdn')
      returning id into new_id;
      kept := kept || new_id;
    end if;
  end loop;

  delete from public.household_members
  where household_id = p_household and kind = 'line' and role <> 'owner' and not (id = any (kept));

  select * into pool from public.pools where household_id = p_household and status = 'active' for update;
  select coalesce(sum(gb), 0) into total from public.allocations where pool_id = pool.id;
  if total > p_pool_gb then
    update public.allocations set gb = floor(gb * p_pool_gb / total), updated_at = now() where pool_id = pool.id;
  end if;

  update public.pools set size_gb = p_pool_gb, price_lkr = public.plan_price(p_pool_gb, n) where id = pool.id;
end $$;

-- ─── Step 2: allocations ────────────────────────────────────────────────────
-- p_allocations: { "<member uuid>": <gb>, ... }. The allocations_within_pool trigger enforces the cap.
create function public.save_allocations(p_household uuid, p_allocations jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pool_uuid uuid;
  item      record;
begin
  if not public.is_household_owner(p_household) then
    raise exception 'Only the household owner can change allocations' using errcode = 'insufficient_privilege';
  end if;
  select id into pool_uuid from public.pools where household_id = p_household and status = 'active';

  for item in select key, value from jsonb_each(p_allocations) loop
    if not exists (select 1 from public.household_members where id = item.key::uuid and household_id = p_household) then
      raise exception 'Someone was removed from the household';
    end if;
    if (item.value)::numeric < 0 then raise exception 'Allocations must be zero or more'; end if;
    insert into public.allocations (pool_id, member_id, gb) values (pool_uuid, item.key::uuid, (item.value)::numeric)
    on conflict (pool_id, member_id) do update set gb = excluded.gb, updated_at = now();
  end loop;
end $$;

-- ─── Demo helper: simulate a few days of usage ──────────────────────────────
-- There is no live network feed, so the owner can add random usage to show the app moving.
create function public.simulate_usage(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pool_uuid uuid;
begin
  if not public.is_household_owner(p_household) then
    raise exception 'Only the household owner can do that' using errcode = 'insufficient_privilege';
  end if;
  select id into pool_uuid from public.pools where household_id = p_household and status = 'active';

  insert into public.usage_events (pool_id, member_id, mb)
  select pool_uuid, m.id, greatest(1, floor(random() * least(a.gb * 1024 * 0.25, 8 * 1024)))::int
  from public.household_members m
  join public.allocations a on a.pool_id = pool_uuid and a.member_id = m.id
  where m.household_id = p_household and m.status = 'active' and a.gb > 0;
end $$;

-- ─── Invites waiting for the caller (matched by their signed-in phone number) ─
-- Invitees can't read the owner's profile directly, so this returns just what the invite card needs.
create function public.my_invites()
returns table (member_id uuid, label text, household_name text, owner_name text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.label, h.name, coalesce(nullif(p.display_name, ''), 'The owner')
  from public.household_members m
  join public.households h on h.id = m.household_id
  join public.profiles p on p.id = h.owner_id
  where m.status = 'invited' and m.msisdn is not null and m.msisdn = public.my_msisdn()
  order by m.created_at;
$$;

revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

revoke execute on function public.create_household(text, text, int) from public, anon;
revoke execute on function public.save_plan(uuid, int, jsonb) from public, anon;
revoke execute on function public.save_allocations(uuid, jsonb) from public, anon;
revoke execute on function public.simulate_usage(uuid) from public, anon;
grant execute on function public.create_household(text, text, int) to authenticated;
grant execute on function public.save_plan(uuid, int, jsonb) to authenticated;
grant execute on function public.save_allocations(uuid, jsonb) to authenticated;
grant execute on function public.simulate_usage(uuid) to authenticated;
