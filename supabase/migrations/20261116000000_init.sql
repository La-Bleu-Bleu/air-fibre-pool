-- Air Fibre household data pool: initial schema.
-- One household = one owner + members (the Air Fibre router counts as a member of kind 'home').
-- Each billing cycle the owner buys a pool and splits it into allocations that never exceed the pool.

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.member_kind   as enum ('home', 'line');      -- router vs mobile SIM
create type public.member_role   as enum ('owner', 'member');
create type public.member_status as enum ('active', 'invited');
create type public.pool_status   as enum ('active', 'expired');

-- ─── Profiles (1:1 with auth.users) ─────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  msisdn       text unique,                                    -- mobile number, e.g. 0771234567
  created_at   timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, msisdn)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new.phone);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Catalogue (public, read-only to clients) ───────────────────────────────
-- The discrete stops on the "Build your pool" slider. Prices are PLACEHOLDERS.
create table public.price_tiers (
  pool_gb   int primary key check (pool_gb > 0),
  price_lkr int not null check (price_lkr >= 0)
);

create table public.packages (
  id          text primary key,                                -- 'solo' | 'couple' | 'family'
  name        text not null,
  pool_gb     int  not null references public.price_tiers (pool_gb),
  lines       int  not null check (lines >= 1),               -- mobile lines, excluding the home router
  sort_order  int  not null default 0
);

-- Monthly add-on per extra mobile line. PLACEHOLDER price.
create table public.settings (
  key   text primary key,
  value jsonb not null
);

-- ─── Households ─────────────────────────────────────────────────────────────
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id   uuid references public.profiles (id) on delete set null,  -- null for router / pending invite
  kind         public.member_kind   not null default 'line',
  role         public.member_role   not null default 'member',
  status       public.member_status not null default 'invited',
  label        text not null,                                   -- "Home", "Me", "Partner", "Kid 1"
  msisdn       text,                                            -- line number, or router number
  created_at   timestamptz not null default now(),
  unique (household_id, profile_id)
);

create index on public.household_members (profile_id);
-- One router and one owner per household.
create unique index one_home_per_household  on public.household_members (household_id) where kind = 'home';
create unique index one_owner_per_household on public.household_members (household_id) where role = 'owner';

-- ─── Pools, allocations, usage ──────────────────────────────────────────────
create table public.pools (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  size_gb      int  not null check (size_gb > 0),
  price_lkr    int  not null check (price_lkr >= 0),
  cycle_start  date not null,
  cycle_end    date not null,
  status       public.pool_status not null default 'active',
  created_at   timestamptz not null default now(),
  check (cycle_end > cycle_start)
);

create unique index one_active_pool_per_household on public.pools (household_id) where status = 'active';

create table public.allocations (
  pool_id    uuid not null references public.pools (id) on delete cascade,
  member_id  uuid not null references public.household_members (id) on delete cascade,
  gb         numeric(7, 2) not null check (gb >= 0),
  updated_at timestamptz not null default now(),
  primary key (pool_id, member_id)
);

-- Usage is simulated in this prototype (there is no live network feed).
create table public.usage_events (
  id          bigint generated always as identity primary key,
  pool_id     uuid not null references public.pools (id) on delete cascade,
  member_id   uuid not null references public.household_members (id) on delete cascade,
  mb          int  not null check (mb > 0),
  recorded_at timestamptz not null default now()
);

create index on public.usage_events (pool_id, member_id);

-- Allocations may never add up to more than the pool.
create function public.check_allocation_total() returns trigger
language plpgsql set search_path = '' as $$
declare
  total numeric;
  cap   int;
begin
  select size_gb into cap from public.pools where id = new.pool_id;
  select coalesce(sum(gb), 0) into total from public.allocations where pool_id = new.pool_id;
  if total > cap then
    raise exception 'Allocations (% GB) exceed the pool (% GB)', total, cap
      using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger allocations_within_pool
  after insert or update on public.allocations
  deferrable initially deferred
  for each row execute function public.check_allocation_total();

-- ─── Convenience view: per-member allocation vs usage for the active pool ───
create view public.member_balances with (security_invoker = true) as
select
  p.household_id,
  p.id                                        as pool_id,
  m.id                                        as member_id,
  m.label,
  m.kind,
  m.role,
  coalesce(a.gb, 0)                           as allocated_gb,
  coalesce(sum(u.mb), 0) / 1024.0             as used_gb
from public.pools p
join public.household_members m on m.household_id = p.household_id
left join public.allocations  a on a.pool_id = p.id and a.member_id = m.id
left join public.usage_events u on u.pool_id = p.id and u.member_id = m.id
where p.status = 'active'
group by p.household_id, p.id, m.id, m.label, m.kind, m.role, a.gb;

-- ─── Row-level security ─────────────────────────────────────────────────────
-- Helpers run as definer so policies on household_members don't recurse.
create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and profile_id = (select auth.uid()) and status = 'active'
  );
$$;

create function public.is_household_owner(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.households where id = hid and owner_id = (select auth.uid())
  );
$$;

alter table public.profiles          enable row level security;
alter table public.price_tiers       enable row level security;
alter table public.packages          enable row level security;
alter table public.settings          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.pools             enable row level security;
alter table public.allocations       enable row level security;
alter table public.usage_events      enable row level security;

-- Catalogue: anyone may read.
create policy "catalogue readable" on public.price_tiers for select using (true);
create policy "catalogue readable" on public.packages    for select using (true);
create policy "catalogue readable" on public.settings    for select using (true);

-- Profiles: read yourself and people in your households; edit only yourself.
create policy "read own and housemates" on public.profiles for select using (
  id = (select auth.uid())
  or exists (
    select 1 from public.household_members hm
    where hm.profile_id = profiles.id and public.is_household_member(hm.household_id)
  )
);
create policy "update self" on public.profiles for update using (id = (select auth.uid()));

-- Households: members read; anyone signed in may create one they own; owner edits.
create policy "members read"  on public.households for select using (public.is_household_member(id) or owner_id = (select auth.uid()));
create policy "create own"    on public.households for insert with check (owner_id = (select auth.uid()));
create policy "owner updates" on public.households for update using (public.is_household_owner(id));
create policy "owner deletes" on public.households for delete using (public.is_household_owner(id));

-- Members: housemates read; owner manages.
create policy "members read"  on public.household_members for select using (public.is_household_member(household_id) or public.is_household_owner(household_id));
create policy "owner manages" on public.household_members for all
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

-- Pools: housemates read; owner buys / changes.
create policy "members read"  on public.pools for select using (public.is_household_member(household_id));
create policy "owner manages" on public.pools for all
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

-- Allocations: housemates read; owner allocates.
create policy "members read" on public.allocations for select using (
  exists (select 1 from public.pools p where p.id = pool_id and public.is_household_member(p.household_id))
);
create policy "owner manages" on public.allocations for all
  using      (exists (select 1 from public.pools p where p.id = pool_id and public.is_household_owner(p.household_id)))
  with check (exists (select 1 from public.pools p where p.id = pool_id and public.is_household_owner(p.household_id)));

-- Usage: housemates read. Writes come from the server (service role) or the demo simulator.
create policy "members read" on public.usage_events for select using (
  exists (select 1 from public.pools p where p.id = pool_id and public.is_household_member(p.household_id))
);
