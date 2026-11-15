"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Router, Smartphone } from "lucide-react";
import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { formatGb, formatLkr } from "@/lib/format";
import { formatMsisdn } from "@/lib/pricing";
import type { Catalogue } from "@/lib/types";
import { PoolBuilder } from "./pool-builder";

type Line = { id: string; label: string; msisdn: string; isOwner: boolean; invited: boolean };

/** The owner's current plan at a glance, with "Change plan" opening the builder in place. */
export function PlanView({
  catalogue,
  poolGb,
  priceLkr,
  cycleEnd,
  unallocatedGb,
  lines,
  startEditing = false,
}: {
  startEditing?: boolean;
  catalogue: Catalogue;
  poolGb: number;
  priceLkr: number;
  cycleEnd: string;
  unallocatedGb: number;
  lines: Line[];
}) {
  const [editing, setEditing] = useState(startEditing);

  if (editing) {
    return (
      <div className="pb-64">
        <PageHeader eyebrow="Pool" title="Change your plan">
          Changes apply straight away. Your renewal date stays the same.
        </PageHeader>
        <PoolBuilder
          mode="change"
          catalogue={catalogue}
          initialPoolGb={poolGb}
          initialLines={lines}
          onDone={() => {
            setEditing(false);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const renews = new Date(cycleEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Pool" title="Your plan" />

      <div className="space-y-5 px-4">
        <section className="bg-brand-gradient relative overflow-hidden rounded-[var(--radius-card)] p-5 text-white shadow-lg shadow-brand-600/20">
          <div className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-white/10 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Monthly data pool</p>
          <p className="mt-1 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
            {poolGb}
            <span className="ml-1 text-xl font-bold text-white/75">GB</span>
          </p>
          <p className="mt-2 text-sm text-white/85">
            Home + {lines.length} {lines.length === 1 ? "mobile line" : "mobile lines"}
          </p>
          <div className="mt-5 flex items-end justify-between">
            <p className="text-sm text-white/85">
              <span className="block text-2xl font-extrabold text-white tabular-nums">{formatLkr(priceLkr)}</span>
              per month · renews {renews}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-brand-700 transition hover:bg-white/90"
            >
              <Pencil size={15} /> Change plan
            </button>
          </div>
        </section>

        {unallocatedGb > 0 && (
          <Link
            href="/allocate"
            className="flex items-center gap-3 rounded-2xl border border-accent-500/30 bg-surface p-4 text-sm transition hover:border-accent-500"
          >
            <span className="flex-1">
              <span className="font-bold">{formatGb(unallocatedGb)}</span> isn&apos;t allocated to anyone yet
            </span>
            <span className="flex items-center gap-1 font-semibold text-brand-ink">
              Allocate <ArrowRight size={15} />
            </span>
          </Link>
        )}

        <section>
          <h2 className="mb-3 px-1 text-lg font-bold">In this plan</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            <li className="flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-ink">
                <Router size={18} />
              </span>
              <div className="flex-1">
                <p className="font-semibold">Home</p>
                <p className="text-xs text-muted">Air Fibre router · always included</p>
              </div>
            </li>
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-surface-muted text-muted">
                  <Smartphone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{l.label}</span>
                    {l.isOwner && <Badge>Owner</Badge>}
                    {l.invited && <Badge tone="accent">Invited</Badge>}
                  </p>
                  <p className="text-xs text-muted">{l.msisdn ? formatMsisdn(l.msisdn) : ""}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-muted">
            To add or remove a line, or resize the pool, tap <b>Change plan</b>.
          </p>
        </section>
      </div>
    </div>
  );
}
