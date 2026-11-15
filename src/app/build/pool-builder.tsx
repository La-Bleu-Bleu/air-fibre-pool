"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Router, Smartphone, X } from "lucide-react";
import { savePlan, type PlanLineInput } from "@/app/actions";
import { Badge } from "@/components/badge";
import { StickyFooter } from "@/components/sticky-footer";
import { formatLkr } from "@/lib/format";
import { formatMsisdn, monthlyPrice, normaliseMsisdn } from "@/lib/pricing";
import type { Catalogue } from "@/lib/types";

interface DraftLine extends PlanLineInput {
  key: string;
  isOwner: boolean;
  invited: boolean;
}

interface Props {
  catalogue: Catalogue;
  initialPoolGb: number;
  initialLines: { id: string; label: string; msisdn: string; isOwner: boolean; invited: boolean }[];
}

export function PoolBuilder({ catalogue, initialPoolGb, initialLines }: Props) {
  const { tiers, packages, extraLinePriceLkr, maxLines } = catalogue;
  const [tierIndex, setTierIndex] = useState(() => Math.max(0, tiers.findIndex((t) => t.poolGb === initialPoolGb)));
  const [lines, setLines] = useState<DraftLine[]>(() => initialLines.map((l) => ({ ...l, key: l.id })));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const poolGb = tiers[tierIndex].poolGb;
  const price = monthlyPrice(catalogue, poolGb, lines.length);
  const fill = `${(tierIndex / (tiers.length - 1)) * 100}%`;

  function applyPackage(pkgPoolGb: number, pkgLines: number) {
    setTierIndex(tiers.findIndex((t) => t.poolGb === pkgPoolGb));
    // Keep the owner plus as many others as the package allows; never invent numbers.
    if (lines.length > pkgLines) {
      const owner = lines.filter((l) => l.isOwner);
      const others = lines.filter((l) => !l.isOwner).slice(0, pkgLines - owner.length);
      setLines([...owner, ...others]);
    }
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await savePlan(
        poolGb,
        lines.map(({ id, label, msisdn }) => ({ id, label, msisdn })),
      );
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6 px-4">
      {/* Packages */}
      <section>
        <h2 className="mb-3 px-1 text-sm font-bold text-muted">Start from a package</h2>
        <div className="grid grid-cols-3 gap-2">
          {packages.map((pkg) => {
            const selected = pkg.poolGb === poolGb && pkg.lines === lines.length;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => applyPackage(pkg.poolGb, pkg.lines)}
                aria-pressed={selected}
                className={`relative rounded-2xl border p-3 text-left transition ${
                  selected ? "border-brand-600 bg-brand-100" : "border-border bg-surface hover:border-brand-500"
                }`}
              >
                {selected && (
                  <Check size={14} className="absolute top-2.5 right-2.5 text-brand-ink" strokeWidth={3} aria-hidden />
                )}
                <p className="text-sm font-bold">{pkg.name}</p>
                <p className="mt-1 text-lg font-extrabold leading-none">{pkg.poolGb} GB</p>
                <p className="mt-1.5 text-[11px] leading-tight text-muted">
                  {pkg.lines} {pkg.lines === 1 ? "line" : "lines"} + home
                </p>
                <p className="mt-2 text-[11px] font-semibold text-brand-ink">
                  {formatLkr(monthlyPrice(catalogue, pkg.poolGb, pkg.lines))}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pool size */}
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">Monthly data pool</p>
            <p className="mt-1 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
              {poolGb}
              <span className="ml-1 text-xl font-bold text-muted">GB</span>
            </p>
          </div>
          <p className="pb-1 text-right text-xs text-muted">
            Shared by home
            <br />+ {lines.length} {lines.length === 1 ? "line" : "lines"}
          </p>
        </div>

        <input
          type="range"
          className="range mt-6"
          min={0}
          max={tiers.length - 1}
          step={1}
          value={tierIndex}
          onChange={(e) => setTierIndex(Number(e.target.value))}
          style={{ "--fill": fill } as React.CSSProperties}
          aria-label="Pool size"
          aria-valuetext={`${poolGb} GB`}
        />
        <div className="mt-1 flex justify-between px-0.5">
          {tiers.map((t, i) => (
            <button
              key={t.poolGb}
              type="button"
              onClick={() => setTierIndex(i)}
              className={`w-9 text-center text-xs tabular-nums transition ${
                i === tierIndex ? "font-bold text-brand-ink" : "text-muted"
              }`}
            >
              {t.poolGb}
            </button>
          ))}
        </div>
      </section>

      {/* Lines */}
      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-bold text-muted">Who&apos;s in the pool</h2>
          <span className="text-xs text-muted">
            {lines.length}/{maxLines} lines
          </span>
        </div>

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

          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-surface-muted text-muted">
                <Smartphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{line.label}</span>
                  {line.isOwner && <Badge>Owner</Badge>}
                  {!line.id && <Badge tone="accent">New</Badge>}
                  {line.id && line.invited && <Badge tone="accent">Invited</Badge>}
                </p>
                <p className="text-xs text-muted">{line.msisdn ? formatMsisdn(line.msisdn) : ""}</p>
              </div>
              {!line.isOwner && (
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                  aria-label={`Remove ${line.label}`}
                  className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-danger"
                >
                  <X size={18} />
                </button>
              )}
            </li>
          ))}

          <li>
            {adding ? (
              <AddLineForm
                existing={lines.map((l) => l.msisdn)}
                onCancel={() => setAdding(false)}
                onAdd={(label, msisdn) => {
                  setLines([...lines, { key: crypto.randomUUID(), label, msisdn, isOwner: false, invited: true }]);
                  setAdding(false);
                }}
              />
            ) : (
              <button
                type="button"
                disabled={lines.length >= maxLines}
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 p-4 font-semibold text-brand-ink transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
              >
                <span className="grid size-10 place-items-center rounded-2xl border-2 border-dashed border-current">
                  <Plus size={18} />
                </span>
                {lines.length >= maxLines ? `Maximum ${maxLines} lines` : "Add a line"}
                <span className="ml-auto text-xs font-medium text-muted">+{formatLkr(extraLinePriceLkr)}/mo</span>
              </button>
            )}
          </li>
        </ul>
        <p className="mt-2 px-1 text-xs text-muted">New lines get an invite to join. They start with 0 GB until you allocate.</p>
      </section>

      <StickyFooter>
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted">
              {poolGb} GB · home + {lines.length} {lines.length === 1 ? "line" : "lines"}
            </p>
            <p className="text-xl font-extrabold tabular-nums" aria-live="polite">
              {formatLkr(price)}
              <span className="text-sm font-semibold text-muted">/mo</span>
            </p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="bg-brand-gradient flex h-12 items-center gap-2 rounded-2xl px-5 font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-70"
          >
            {pending && <Loader2 size={18} className="animate-spin" />}
            Continue
          </button>
        </div>
      </StickyFooter>
    </div>
  );
}

function AddLineForm({
  existing,
  onAdd,
  onCancel,
}: {
  existing: string[];
  onAdd: (label: string, msisdn: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string>();

  function add(e: React.FormEvent) {
    e.preventDefault();
    const msisdn = normaliseMsisdn(number);
    if (!label.trim()) return setError("Give this line a name, like “Amma” or “Kid 4”.");
    if (!msisdn) return setError("Enter a Dialog mobile number like 077 123 4567.");
    if (existing.includes(msisdn)) return setError("That number is already in the pool.");
    onAdd(label.trim(), msisdn);
  }

  const field =
    "h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] outline-none transition placeholder:text-muted/70 focus:border-brand-500";

  return (
    <form onSubmit={add} className="space-y-3 bg-brand-100/50 p-4">
      <p className="text-sm font-bold">Add a line</p>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={20}
        placeholder="Name, e.g. Amma"
        aria-label="Name"
        className={field}
      />
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        inputMode="tel"
        placeholder="077 123 4567"
        aria-label="Dialog mobile number"
        className={field}
      />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-border bg-surface font-semibold">
          Cancel
        </button>
        <button type="submit" className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white">
          Add line
        </button>
      </div>
    </form>
  );
}
