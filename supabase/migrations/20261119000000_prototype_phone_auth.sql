-- Prototype sign-in without SMS (see signInWithPhone in src/app/actions.ts), and Malaysian numbers.
--
-- Accounts are ordinary email/password users; the phone number arrives in user metadata ("msisdn").
-- Supported numbers: Sri Lanka 947XXXXXXXX, Malaysia 601XXXXXXXX(X). Keep in sync with src/lib/pricing.ts.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  phone text := coalesce(nullif(new.phone, ''), new.raw_user_meta_data ->> 'msisdn');
begin
  insert into public.profiles (id, display_name, msisdn)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when phone ~ '^(947[0-9]{8}|601[0-9]{8,9})$' then phone end
  );
  return new;
end $$;

-- Same as before, but new lines may also be Malaysian numbers.
create or replace function public.save_plan(p_household uuid, p_pool_gb int, p_lines jsonb) returns void
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
      if (line ->> 'msisdn') !~ '^(947[0-9]{8}|601[0-9]{8,9})$' then
        raise exception '%: enter a mobile number like 077 123 4567 or 012-345 6789', line ->> 'label';
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
