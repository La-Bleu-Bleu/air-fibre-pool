"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, X } from "lucide-react";
import { removeMember, respondToRequest } from "@/app/actions";
import { Badge } from "@/components/badge";
import { MemberAvatar } from "@/components/member-avatar";
import { formatGb } from "@/lib/format";
import { formatMsisdn } from "@/lib/pricing";
import type { DataRequest, MemberBalance } from "@/lib/types";

export interface RequestRow extends DataRequest {
  memberLabel: string;
  memberColor: string;
  when: string;
}

export function OwnerView({
  members,
  requests,
  unallocatedGb,
}: {
  members: MemberBalance[];
  requests: RequestRow[];
  unallocatedGb: number;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <div className="space-y-7 px-4">
      {pending.length > 0 && (
        <section>
          <SectionTitle
            title="Requests"
            aside={<span className="text-xs text-muted">{formatGb(Math.max(0, unallocatedGb))} unallocated</span>}
          />
          <ul className="space-y-2.5">
            {pending.map((r) => (
              <PendingRequest key={r.id} request={r} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle title="People and connections" />
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
          <li>
            <Link
              href="/build?edit=1"
              className="flex items-center gap-3 p-4 font-semibold text-brand-ink transition hover:bg-brand-100"
            >
              <span className="grid size-10 place-items-center rounded-2xl border-2 border-dashed border-current">
                <Plus size={18} />
              </span>
              Add a line
            </Link>
          </li>
        </ul>
        <p className="mt-2 px-1 text-xs text-muted">
          Removing someone returns their allocation to the pool and lowers your monthly price.
        </p>
      </section>

      {history.length > 0 && (
        <section>
          <SectionTitle title="Recent requests" />
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm">
                <span className="size-2 rounded-full" style={{ background: r.memberColor }} />
                <span className="flex-1">
                  <span className="font-semibold">{r.memberLabel}</span> asked for {formatGb(r.gb)}
                  <span className="block text-xs text-muted">{r.when}</span>
                </span>
                <Badge tone={r.status === "approved" ? "success" : "muted"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingRequest({ request: r }: { request: RequestRow }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<boolean>();

  function respond(approve: boolean) {
    setError(undefined);
    setChoice(approve);
    startTransition(async () => {
      const result = await respondToRequest(r.id, approve);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <li className="rounded-[var(--radius-card)] border border-accent-500/30 bg-surface p-4 shadow-sm shadow-accent-500/10">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: r.memberColor }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {r.memberLabel} asks for <span className="text-brand-ink">{formatGb(r.gb)}</span>
          </p>
          {r.note && <p className="mt-1 text-sm text-muted">“{r.note}”</p>}
          <p className="mt-1 text-xs text-muted">{r.when}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {error}{" "}
          <Link href="/allocate" className="underline">
            Open Allocate
          </Link>
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border font-semibold transition hover:border-danger hover:text-danger disabled:opacity-50"
        >
          {pending && choice === false ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
          Decline
        </button>
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className="bg-brand-gradient flex h-11 items-center justify-center gap-1.5 rounded-xl font-semibold text-white disabled:opacity-50"
        >
          {pending && choice === true ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Give {formatGb(r.gb)}
        </button>
      </div>
    </li>
  );
}

function MemberRow({ member: m }: { member: MemberBalance }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const removable = m.kind === "line" && m.role !== "owner";
  const invited = m.status === "invited";

  function remove() {
    setError(undefined);
    startTransition(async () => {
      const result = await removeMember(m.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <li className="p-4">
      <div className="flex items-center gap-3">
        <MemberAvatar kind={m.kind} color={m.color} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{m.displayLabel}</span>
            {m.role === "owner" && <Badge>Owner</Badge>}
            {invited && <Badge tone="accent">Invited</Badge>}
          </p>
          <p className="text-xs text-muted">
            {m.kind === "home" ? "Air Fibre router" : m.msisdn ? formatMsisdn(m.msisdn) : ""} · {formatGb(m.allocatedGb)}
          </p>
        </div>
        {removable && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-9 rounded-full px-3 text-xs font-semibold text-muted transition hover:bg-danger/10 hover:text-danger"
          >
            {invited ? "Cancel invite" : "Remove"}
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-2xl bg-danger/5 p-3">
          <p className="text-sm">
            {invited ? (
              <>Cancel the invite to <b>{m.displayLabel}</b>?</>
            ) : (
              <>
                Remove <b>{m.displayLabel}</b> from the household?
                {m.allocatedGb > 0 && <> Their {formatGb(m.allocatedGb)} returns to the pool.</>}
              </>
            )}
          </p>
          {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="h-9 rounded-xl border border-border bg-surface px-3 text-sm font-semibold"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-danger px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {invited ? "Cancel invite" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function SectionTitle({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between px-1">
      <h2 className="text-lg font-bold">{title}</h2>
      {aside}
    </div>
  );
}
