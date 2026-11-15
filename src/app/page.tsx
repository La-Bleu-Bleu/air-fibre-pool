import Link from "next/link";
import { Bell, HandHeart, Plus, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/badge";
import { MemberAvatar } from "@/components/member-avatar";
import { PoolRing } from "@/components/pool-ring";
import { getHousehold, isDemo } from "@/lib/data";
import { daysLeft, formatGb, formatLkr } from "@/lib/format";
import { formatMsisdn } from "@/lib/pricing";
import { resetDemo } from "./actions";
import { SimulateUsageButton } from "./simulate-usage-button";

export default async function HomePage() {
  const household = await getHousehold();
  const demo = await isDemo();
  const { pool, members, viewer } = household;
  const me = members.find((m) => m.id === viewer.memberId)!;
  const usedGb = members.reduce((sum, m) => sum + m.usedGb, 0);
  const remainingGb = Math.max(0, pool.sizeGb - usedGb);
  const unallocatedGb = pool.sizeGb - members.reduce((sum, m) => sum + m.allocatedGb, 0);
  const pendingRequests = household.requests.filter((r) => r.status === "pending").length;

  const actions = viewer.isOwner
    ? [
        { href: "/build?edit=1", label: "Top up", icon: Zap },
        { href: "/allocate", label: "Allocate", icon: SlidersHorizontal },
        { href: "/build?edit=1", label: "Add line", icon: Plus },
      ]
    : me.status === "active"
      ? [{ href: "/household", label: "Ask for more data", icon: HandHeart }]
      : [];

  return (
    <>
      {/* Hero: brand gradient with the pool ring */}
      <section className="bg-brand-gradient relative overflow-hidden rounded-b-[2rem] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-7 text-white">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/75">Good morning</p>
            <p className="text-xl font-bold">{viewer.name}</p>
          </div>
          <Link
            href="/household"
            aria-label={pendingRequests && viewer.isOwner ? `${pendingRequests} pending requests` : "Household"}
            className="relative grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            <Bell size={18} />
            {viewer.isOwner && pendingRequests > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-accent-500 text-[11px] font-bold ring-2 ring-brand-600">
                {pendingRequests}
              </span>
            )}
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div className="relative shrink-0">
            <PoolRing members={members} sizeGb={pool.sizeGb} />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[32px] font-extrabold leading-none">{Math.round(remainingGb)}</p>
                <p className="mt-1 text-xs text-white/75">of {pool.sizeGb} GB left</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Household pool</p>
            <p className="text-lg font-bold leading-snug">{household.name}</p>
            <p className="text-sm text-white/80">
              Renews in {daysLeft(pool.cycleEnd)} days
              {viewer.isOwner && (
                <>
                  <br />
                  {formatLkr(pool.priceLkr)}/month
                </>
              )}
            </p>
          </div>
        </div>

        {actions.length > 0 && (
          <div className={`mt-6 grid gap-2 ${actions.length === 3 ? "grid-cols-3" : "grid-cols-1"}`}>
            {actions.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center justify-center gap-1.5 rounded-2xl bg-white/15 py-3 text-xs font-semibold backdrop-blur transition hover:bg-white/25 ${
                  actions.length === 3 ? "flex-col" : "text-sm"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </section>

      {me.status === "invited" && (
        <Link
          href="/household"
          className="mx-4 mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-accent-500/30 bg-surface p-4"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-accent-500/15 text-accent-500">
            <Sparkles size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">You&apos;ve been invited</span>
            <span className="text-sm text-muted">Join {household.name} to start sharing data</span>
          </span>
        </Link>
      )}

      {/* Members */}
      <section className="px-4 pt-6">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-bold">Who&apos;s using what</h2>
          <span className="text-sm text-muted">{members.length} connections</span>
        </div>

        <ul className="space-y-2.5">
          {members.map((m) => {
            const pct = m.allocatedGb > 0 ? Math.min(100, (m.usedGb / m.allocatedGb) * 100) : 0;
            const invited = m.status === "invited";
            const low = !invited && m.allocatedGb > 0 && pct >= 80;
            const isMe = m.id === viewer.memberId;
            // Members only see their own number; the owner sees everyone's.
            const subtitle =
              m.kind === "home" ? "Air Fibre router" : (viewer.isOwner || isMe) && m.msisdn ? formatMsisdn(m.msisdn) : "Mobile line";
            return (
              <li
                key={m.id}
                className={`rounded-[var(--radius-card)] border bg-surface p-4 ${isMe && !viewer.isOwner ? "border-brand-500" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <MemberAvatar kind={m.kind} color={m.color} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
                      <span>{m.displayLabel}</span>
                      {m.role === "owner" && <Badge>Owner</Badge>}
                      {invited && <Badge tone="accent">Invited</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{subtitle}</p>
                  </div>
                  <p className="text-right text-sm">
                    <span className="font-bold">{formatGb(m.usedGb)}</span>
                    <span className="text-muted"> / {formatGb(m.allocatedGb)}</span>
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: low ? "var(--danger)" : m.color }}
                  />
                </div>
                {low && (
                  <p className="mt-2 flex items-center justify-between text-xs font-semibold text-danger">
                    {m.usedGb >= m.allocatedGb ? "Allocation used up" : `Running low: ${formatGb(m.allocatedGb - m.usedGb)} left`}
                    {isMe && !viewer.isOwner && (
                      <Link href="/household" className="text-brand-ink">
                        Ask for more →
                      </Link>
                    )}
                  </p>
                )}
                {!invited && m.allocatedGb === 0 && (
                  <p className="mt-2 text-xs font-semibold text-muted">No data allocated yet</p>
                )}
                {invited && <p className="mt-2 text-xs font-semibold text-muted">Waiting for them to accept the invite</p>}
              </li>
            );
          })}
        </ul>

        {viewer.isOwner && unallocatedGb > 0 && (
          <p className="mt-3 px-1 text-sm text-muted">
            <span className="font-bold text-foreground">{formatGb(unallocatedGb)}</span> unallocated.{" "}
            <Link href="/allocate" className="font-semibold text-brand-ink">
              Allocate it
            </Link>
          </p>
        )}

        {/* Prototype-only controls */}
        {demo ? (
          <form action={resetDemo} className="mt-8 flex justify-center">
            <button className="text-xs font-semibold text-muted underline-offset-2 hover:underline">Reset demo data</button>
          </form>
        ) : (
          viewer.isOwner && <SimulateUsageButton />
        )}
      </section>
    </>
  );
}
