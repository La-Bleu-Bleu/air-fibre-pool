import Link from "next/link";
import { Bell, Plus, Router, SlidersHorizontal, Smartphone, Zap } from "lucide-react";
import { PoolRing } from "@/components/pool-ring";
import { getHousehold } from "@/lib/data";
import { daysLeft, formatGb, formatLkr } from "@/lib/format";
import { formatMsisdn } from "@/lib/pricing";
import { resetDemo } from "./actions";

export default async function HomePage() {
  const household = await getHousehold();
  const { pool, members } = household;
  const usedGb = members.reduce((sum, m) => sum + m.usedGb, 0);
  const remainingGb = Math.max(0, pool.sizeGb - usedGb);
  const unallocatedGb = pool.sizeGb - members.reduce((sum, m) => sum + m.allocatedGb, 0);

  return (
    <>
      {/* Hero: brand gradient with the pool ring */}
      <section className="bg-brand-gradient relative overflow-hidden rounded-b-[2rem] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-7 text-white">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/75">Good morning</p>
            <p className="text-xl font-bold">{household.ownerName}</p>
          </div>
          <button aria-label="Notifications" className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur">
            <Bell size={18} />
          </button>
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
              <br />
              {formatLkr(pool.priceLkr)}/month
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { href: "/build", label: "Top up", icon: Zap },
            { href: "/allocate", label: "Allocate", icon: SlidersHorizontal },
            { href: "/build", label: "Add line", icon: Plus },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/15 py-3 text-xs font-semibold backdrop-blur transition hover:bg-white/25"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      </section>

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
            const Icon = m.kind === "home" ? Router : Smartphone;
            return (
              <li key={m.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-2xl text-white"
                    style={{ background: m.color }}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {m.label}
                      {m.role === "owner" && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                          Owner
                        </span>
                      )}
                      {invited && (
                        <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-500">
                          Invited
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {m.kind === "home" ? "Air Fibre router" : m.msisdn ? formatMsisdn(m.msisdn) : ""}
                    </p>
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
                  <p className="mt-2 text-xs font-semibold text-danger">
                    {m.usedGb >= m.allocatedGb ? "Allocation used up" : `Running low: ${formatGb(m.allocatedGb - m.usedGb)} left`}
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

        {unallocatedGb > 0 && (
          <p className="mt-3 px-1 text-sm text-muted">
            <span className="font-bold text-foreground">{formatGb(unallocatedGb)}</span> unallocated.{" "}
            <Link href="/allocate" className="font-semibold text-brand-ink">
              Allocate it
            </Link>
          </p>
        )}

        {/* Demo-only control; remove once real data is connected */}
        <form action={resetDemo} className="mt-8 flex justify-center">
          <button className="text-xs font-semibold text-muted underline-offset-2 hover:underline">Reset demo data</button>
        </form>
      </section>
    </>
  );
}
