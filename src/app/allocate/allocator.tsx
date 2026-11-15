"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Divide, Loader2, Minus, Plus, RotateCcw, Router, Smartphone } from "lucide-react";
import { saveAllocations } from "@/app/actions";
import { StickyFooter } from "@/components/sticky-footer";
import { Toast } from "@/components/toast";
import { formatGb } from "@/lib/format";
import { allocationStep } from "@/lib/pricing";
import type { MemberBalance } from "@/lib/types";

export function Allocator({ poolGb, members, setup = false }: { poolGb: number; members: MemberBalance[]; setup?: boolean }) {
  // `initial` is re-derived from the server data on every render, so after a save (which refreshes the
  // page) it matches what was saved and the Save bar disappears.
  const initial = Object.fromEntries(members.map((m) => [m.id, m.allocatedGb]));
  const [allocs, setAllocs] = useState<Record<string, number>>(initial);
  const [error, setError] = useState<string>();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const step = allocationStep(poolGb);
  const total = members.reduce((s, m) => s + allocs[m.id], 0);
  const remaining = poolGb - total;
  const changed = members.some((m) => allocs[m.id] !== initial[m.id]);

  /** Set one member's GB, never letting the total exceed the pool. */
  function set(id: string, gb: number) {
    const others = total - allocs[id];
    const clamped = Math.max(0, Math.min(gb, poolGb - others));
    setAllocs({ ...allocs, [id]: clamped });
  }

  function splitEvenly() {
    const each = Math.floor(poolGb / members.length / step) * step;
    const next = Object.fromEntries(members.map((m) => [m.id, each]));
    // Give any rounding leftover to the home router.
    const home = members.find((m) => m.kind === "home");
    if (home) next[home.id] += poolGb - each * members.length;
    setAllocs(next);
  }

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await saveAllocations(allocs, "stay");
      if (result?.error) setError(result.error);
      else setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-5 px-4">
      {/* Summary: stacked bar of everyone's share */}
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">Allocated</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
              {total}
              <span className="text-lg font-bold text-muted"> / {poolGb} GB</span>
            </p>
          </div>
          <p
            aria-live="polite"
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              remaining === 0 ? "bg-success/15 text-success" : "bg-accent-500/15 text-accent-500"
            }`}
          >
            {remaining === 0 ? "Fully allocated" : `${formatGb(remaining)} left`}
          </p>
        </div>

        <div className="mt-4 flex h-4 gap-0.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          {members.map((m) =>
            allocs[m.id] > 0 ? (
              <div
                key={m.id}
                className="h-full transition-[width] duration-200 first:rounded-l-full"
                style={{ width: `${(allocs[m.id] / poolGb) * 100}%`, background: m.color }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ background: m.color }} />
              {m.label}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-2">
          <QuickButton onClick={splitEvenly} icon={<Divide size={15} />}>
            Split evenly
          </QuickButton>
          <QuickButton onClick={() => setAllocs(initial)} disabled={!changed} icon={<RotateCcw size={15} />}>
            Undo changes
          </QuickButton>
        </div>
      </section>

      {/* One row per connection */}
      <ul className="space-y-2.5">
        {members.map((m) => {
          const value = allocs[m.id];
          const belowUsage = value < m.usedGb;
          const Icon = m.kind === "home" ? Router : Smartphone;
          return (
            <li key={m.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl text-white" style={{ background: m.color }}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.label}</p>
                  <p className="text-xs text-muted">
                    {m.status === "invited" ? "Invite pending" : `${formatGb(m.usedGb)} used so far`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StepButton label={`Less for ${m.label}`} onClick={() => set(m.id, value - step)} disabled={value <= 0}>
                    <Minus size={16} />
                  </StepButton>
                  <p className="w-16 text-center text-lg font-extrabold tabular-nums">
                    {value}
                    <span className="text-xs font-semibold text-muted"> GB</span>
                  </p>
                  <StepButton label={`More for ${m.label}`} onClick={() => set(m.id, value + step)} disabled={remaining <= 0}>
                    <Plus size={16} />
                  </StepButton>
                </div>
              </div>
              <input
                type="range"
                className="range mt-3"
                min={0}
                max={poolGb}
                step={step}
                value={value}
                onChange={(e) => set(m.id, Number(e.target.value))}
                style={{ "--fill": `${(value / poolGb) * 100}%`, "--fill-color": m.color } as React.CSSProperties}
                aria-label={`${m.label} allocation`}
                aria-valuetext={`${value} GB`}
              />
              {belowUsage && (
                <p className="mt-1 text-xs font-medium text-danger">
                  Below the {formatGb(m.usedGb)} already used, so this connection would pause until topped up.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="px-1 text-xs text-muted">
        Need a bigger pool or another line?{" "}
        <Link href="/build" className="font-semibold text-brand-ink underline-offset-2 hover:underline">
          Change your plan
        </Link>
      </p>

      {/* Only when there's something to save */}
      {changed && (
        <StickyFooter>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-4">
            <p className="flex-1 text-sm text-muted">
              {remaining > 0 ? (
                <>
                  <span className="font-bold text-foreground">{formatGb(remaining)}</span> will stay unallocated
                </>
              ) : (
                "Every GB will be allocated"
              )}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="bg-brand-gradient flex h-12 items-center gap-2 rounded-2xl px-5 font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-70"
            >
              {pending && <Loader2 size={18} className="animate-spin" />}
              Save
            </button>
          </div>
        </StickyFooter>
      )}

      {savedAt && !changed && (
        <Toast key={savedAt} onDone={() => setSavedAt(null)}>
          {setup ? (
            <>
              You&apos;re all set.{" "}
              <Link href="/" className="font-bold underline underline-offset-2">
                Go to Home
              </Link>
            </>
          ) : (
            "Allocation saved"
          )}
        </Toast>
      )}
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-full bg-surface-muted transition hover:bg-brand-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function QuickButton({ onClick, disabled, icon, children }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition hover:border-brand-500 disabled:opacity-40 disabled:hover:border-border"
    >
      {icon}
      {children}
    </button>
  );
}
