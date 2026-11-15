-- Household tab: data requests from members, and invite acceptance.

-- ─── Data requests ──────────────────────────────────────────────────────────
create type public.request_status as enum ('pending', 'approved', 'declined');

create table public.data_requests (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id    uuid not null references public.household_members (id) on delete cascade,
  gb           int  not null check (gb between 1 and 1000),
  note         text not null default '' check (char_length(note) <= 120),
  status       public.request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles (id) on delete set null
);

create index on public.data_requests (household_id, created_at desc);
-- One open request per member at a time.
create unique index one_pending_request_per_member on public.data_requests (member_id) where status = 'pending';

alter table public.data_requests enable row level security;

-- Owner sees every request in the household; members see their own.
create policy "owner or requester reads" on public.data_requests for select using (
  public.is_household_owner(household_id)
  or exists (
    select 1 from public.household_members hm
    where hm.id = member_id and hm.profile_id = (select auth.uid())
  )
);

-- An active, non-owner member may open a pending request for themselves.
create policy "member requests for self" on public.data_requests for insert with check (
  status = 'pending'
  and decided_at is null
  and exists (
    select 1 from public.household_members hm
    where hm.id = member_id
      and hm.household_id = data_requests.household_id
      and hm.profile_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role = 'member'
  )
);
-- No direct updates/deletes: decisions go through respond_to_data_request().

-- Approve (adds GB to the member's allocation in the active pool) or decline, atomically.
-- The allocations_within_pool trigger rejects approvals that would overfill the pool.
create function public.respond_to_data_request(request_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  req  public.data_requests;
  active_pool_id uuid;
begin
  select * into req from public.data_requests where id = request_id for update;
  if req is null or not public.is_household_owner(req.household_id) then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;
  if req.status <> 'pending' then
    raise exception 'Request already handled' using errcode = 'check_violation';
  end if;

  if approve then
    select id into active_pool_id from public.pools where household_id = req.household_id and status = 'active';
    if active_pool_id is null then
      raise exception 'Household has no active pool' using errcode = 'no_data_found';
    end if;
    insert into public.allocations (pool_id, member_id, gb)
    values (active_pool_id, req.member_id, req.gb)
    on conflict (pool_id, member_id) do update set gb = public.allocations.gb + excluded.gb, updated_at = now();
  end if;

  update public.data_requests
  set status = case when approve then 'approved'::public.request_status else 'declined'::public.request_status end,
      decided_at = now(),
      decided_by = (select auth.uid())
  where id = request_id;
end $$;

-- ─── Invites ────────────────────────────────────────────────────────────────
-- A line is invited by mobile number. Whoever signs in with that number can see and answer the invite.
create function public.my_msisdn() returns text
language sql stable security definer set search_path = '' as $$
  select msisdn from public.profiles where id = (select auth.uid());
$$;

create policy "invitee reads own invite" on public.household_members for select using (
  status = 'invited' and msisdn is not null and msisdn = public.my_msisdn()
);

create policy "invitee reads inviting household" on public.households for select using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.status = 'invited'
      and hm.msisdn = public.my_msisdn()
  )
);

create function public.respond_to_invite(member_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.household_members;
begin
  select * into m from public.household_members where id = member_id for update;
  if m is null or m.status <> 'invited' or m.msisdn is distinct from public.my_msisdn() then
    raise exception 'Invite not found' using errcode = 'no_data_found';
  end if;

  if accept then
    update public.household_members
    set status = 'active', profile_id = (select auth.uid())
    where id = member_id;
  else
    delete from public.household_members where id = member_id;
  end if;
end $$;

-- Only signed-in users may call the RPCs.
revoke execute on function public.respond_to_data_request(uuid, boolean) from public, anon;
revoke execute on function public.respond_to_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_data_request(uuid, boolean) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
