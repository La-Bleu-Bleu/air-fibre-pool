-- Everything a screen needs about the caller's household, in one round trip.
-- security invoker: runs with the caller's rights, so the usual row-level security still applies.
-- Returns null when the caller isn't an active member of any household.

create function public.my_household() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with me as (
    select id, household_id
    from public.household_members
    where profile_id = (select auth.uid()) and status = 'active'
    limit 1
  )
  select case when me.id is null then null else jsonb_build_object(
    'viewer_member_id', me.id,
    'household', (
      select jsonb_build_object('id', h.id, 'name', h.name, 'owner_name', coalesce(nullif(p.display_name, ''), 'Owner'))
      from public.households h join public.profiles p on p.id = h.owner_id
      where h.id = me.household_id
    ),
    'pool', (
      select jsonb_build_object('size_gb', size_gb, 'cycle_start', cycle_start, 'cycle_end', cycle_end)
      from public.pools where household_id = me.household_id and status = 'active'
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'label', m.label, 'kind', m.kind, 'role', m.role, 'status', m.status, 'msisdn', m.msisdn,
        'allocated_gb', coalesce(b.allocated_gb, 0), 'used_gb', round(coalesce(b.used_gb, 0), 1)
      ) order by m.created_at), '[]'::jsonb)
      from public.household_members m
      left join public.member_balances b on b.member_id = m.id
      where m.household_id = me.household_id
    ),
    'requests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'member_id', r.member_id, 'gb', r.gb, 'note', r.note, 'status', r.status, 'created_at', r.created_at
      ) order by r.created_at desc), '[]'::jsonb)
      from (
        select * from public.data_requests where household_id = me.household_id
        order by created_at desc limit 20
      ) r
    )
  ) end
  from (select 1) one left join me on true;
$$;

revoke execute on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;
