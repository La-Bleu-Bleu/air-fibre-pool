# Air Fibre Household

Concept app for **Dialog Air Fibre household data pools**: one shared monthly 5G data pool for the Air Fibre home router and the family's Dialog mobile lines. The account owner builds the pool and decides how much each connection gets.

It's a mobile app at heart, built as a mobile-first web app for now.

- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, lucide icons, Plus Jakarta Sans
- **Backend:** Supabase (Postgres, Auth, row-level security)
- **Hosting:** Vercel

## Running locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Two modes, one deployment

| | Demo mode | Real mode |
| --- | --- | --- |
| How | **Explore the demo** on the sign-in screen | Sign in with a mobile number |
| Sign-in | None. A "view as" switch on the Household tab lets you play any role | Any Sri Lankan (077 123 4567) or Malaysian (012-345 6789) number, code **123456** |
| Data | The deck's family-of-five household, kept in a cookie on that device | Your Supabase project |
| Extras | "Reset demo data" on Home; "Exit demo" on Household | Owner can "Simulate a few days of usage" on Home |

Demo mode is also forced when Supabase isn't configured, or with `NEXT_PUBLIC_DEMO_MODE=true` (e.g. a demo-only deployment).

> **⚠️ Prototype sign-in is not secure.** No SMS is sent and the code is always 123456, so anyone can sign in as any number.
> Each number becomes an ordinary Supabase email/password account behind the scenes (`signInWithPhone` in `src/app/actions.ts`).
> Before real users, replace it with Supabase phone OTP and an SMS provider, or Dialog's own SMS gateway via Supabase's Send SMS hook.

## Project layout

```
src/
  app/                 Routes: / (home), /build, /allocate, /household, /login, /welcome
  components/          UI pieces (bottom nav, pool ring, headers)
  lib/
    data.ts            Data access layer: picks the demo or Supabase repo
    repo/              demo.ts (cookie) and supabase.ts behind one interface
    demo-data.ts       Demo household, price tiers, packages
    supabase/          Browser + server Supabase clients
  proxy.ts             Refreshes the Supabase session; sends signed-out people to /login
supabase/
  migrations/          Database schema + security rules
  seed.sql             Price tiers and packages (PLACEHOLDER prices)
```

## Data model

| Table | What it holds |
| --- | --- |
| `profiles` | One per signed-up user (created automatically) |
| `households` | A home, owned by one profile |
| `household_members` | The router (`kind = home`) and each mobile line (`kind = line`), with role owner/member |
| `pools` | The data pool bought for a billing cycle (one active per household) |
| `allocations` | GB per member per pool. **The database rejects totals above the pool size** |
| `usage_events` | Simulated usage (there is no live network feed in this prototype) |
| `price_tiers`, `packages`, `settings` | Catalogue: slider stops, presets, extra-line price |
| `member_balances` (view) | Allocated vs used per member for the active pool |

Security rules: members can read their own household; only the owner can change members, pools and allocations. Everyone can read the catalogue.

## Connecting Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Link it and push the schema (the Supabase CLI is installed as a dev dependency):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --remote --include-seed
   ```
   No CLI? Paste `supabase/migrations/*.sql` and then `supabase/seed.sql` into the dashboard's SQL editor instead.
3. Copy `.env.example` to `.env.local` and fill in the URL and publishable key from **Project Settings → API**.
4. For prototype sign-in: **Authentication → Sign In / Providers → Email**: keep it enabled and switch **off "Confirm email"**.
   (Accounts use made-up addresses, so confirmation emails would bounce.) Phone and SMS providers are not needed.
5. **Authentication → URL Configuration:** Site URL = your Vercel URL; redirect URLs `http://localhost:3000/**` and `https://*.vercel.app/**`.

New migrations: `npx supabase db push --remote` (dry run first with `--dry-run`).

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo (framework is detected automatically).
3. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables, then deploy.

Every push to `main` then deploys automatically.

## Status

- [x] Scaffold, brand theme, app shell, home screen on demo data
- [x] Database schema and security rules
- [x] Build your pool: packages, slider with stops, live price, add/remove lines
- [x] Allocate: slider + stepper per connection, stacked bar, can't exceed the pool
- [x] Household (owner): approve/decline data requests, remove lines, cancel invites
- [x] Household (member): own allowance, request more data, accept/decline invite; owner-only screens are locked
- [x] Schema: `data_requests`, `respond_to_data_request()` and `respond_to_invite()` (tested on local Postgres)
- [x] Prototype phone sign-in (fixed code, LK + MY numbers), "Explore the demo", onboarding (create a household or accept an invite), sign-out
- [x] All screens read and write Supabase; demo mode kept for presenting
- [x] Schema: `create_household()`, `save_plan()`, `save_allocations()`, `my_invites()`, `simulate_usage()`
- [ ] Real phone OTP (SMS provider or Dialog SMS gateway) instead of the fixed 123456 code
- [ ] Real usage feed from the network (currently simulated)
- [ ] Sinhala and Tamil

In demo mode, "Reset demo data" at the bottom of the home screen restores the deck's family-of-five example.

### Open questions (placeholders used for now)

- Pricing: pool tiers and the LKR 290 per-line add-on are made up.
- Can unallocated GB be used by anyone, or is it held back?
- Does a smaller pool apply mid-cycle or from the next cycle? (The demo applies it immediately.)
- What happens when a connection uses up its allocation: pause, borrow from the pool, or ask the owner?
- Approving a request only uses unallocated GB. Should the owner be able to take it from someone else (e.g. Home) in one step?
- Should members see each other's usage, or only their own? (Currently: everyone's usage, but only their own number.)
