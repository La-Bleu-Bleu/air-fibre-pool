"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2, Send } from "lucide-react";
import { requestData } from "@/app/actions";
import { Badge } from "@/components/badge";
import { InviteCard } from "@/components/invite-card";
import { MemberAvatar } from "@/components/member-avatar";
import { formatGb } from "@/lib/format";
import type { MemberBalance } from "@/lib/types";
import { SectionTitle, type RequestRow } from "./owner-view";

const amounts = [5, 10, 20, 50];

export function MemberView({
  me,
  members,
  requests,
  ownerName,
  householdName,
}: {
  me: MemberBalance;
  members: MemberBalance[];
  requests: RequestRow[];
  ownerName: string;
  householdName: string;
}) {
  if (me.status === "invited") return <InviteCard memberId={me.id} ownerName={ownerName} householdName={householdName} />;

  const pending = requests.find((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <div className="space-y-7 px-4">
      <MyAllowance me={me} />

      <section>
        <SectionTitle title="Need more data?" />
        {pending ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-500/15 text-accent-500">
              <Clock size={18} />
            </span>
            <div>
              <p className="font-semibold">
                Asked {ownerName} for {formatGb(pending.gb)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Sent {pending.when}. You&apos;ll get it as soon as they approve.
              </p>
            </div>
          </div>
        ) : (
          <RequestForm ownerName={ownerName} />
        )}
      </section>

      {history.length > 0 && (
        <section>
          <SectionTitle title="Your requests" />
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{formatGb(r.gb)}</span>
                  <span className="block text-xs text-muted">{r.when}</span>
                </span>
                <Badge tone={r.status === "approved" ? "success" : "muted"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle title="In this household" />
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <MemberAvatar kind={m.kind} color={m.color} size="sm" />
              <span className="flex-1 truncate text-sm font-semibold">{m.displayLabel}</span>
              {m.role === "owner" && <Badge>Owner</Badge>}
              {m.status === "invited" && <Badge tone="accent">Invited</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-xs text-muted">Only {ownerName} can add people or change allocations.</p>
      </section>
    </div>
  );
}

function MyAllowance({ me }: { me: MemberBalance }) {
  const left = Math.max(0, me.allocatedGb - me.usedGb);
  const pct = me.allocatedGb > 0 ? Math.min(100, (me.usedGb / me.allocatedGb) * 100) : 0;
  const none = me.allocatedGb === 0;
  const low = !none && pct >= 80;

  return (
    <section className="bg-brand-gradient rounded-[var(--radius-card)] p-5 text-white shadow-lg shadow-brand-600/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Your data this month</p>
      <p className="mt-2 text-[40px] font-extrabold leading-none tabular-nums">
        {formatGb(left).replace(" GB", "")}
        <span className="ml-1 text-lg font-bold text-white/75">GB left</span>
      </p>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-white/80">
        {none ? (
          "Nothing allocated to you yet. Ask below to get started."
        ) : (
          <>
            {formatGb(me.usedGb)} used of {formatGb(me.allocatedGb)}
            {low && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Running low</span>}
          </>
        )}
      </p>
    </section>
  );
}

function RequestForm({ ownerName }: { ownerName: string }) {
  const [gb, setGb] = useState(10);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await requestData(gb, note);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={send} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-sm text-muted">Ask {ownerName} for more from the household pool.</p>
      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Amount">
        {amounts.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={gb === a}
            onClick={() => setGb(a)}
            className={`h-12 rounded-xl text-sm font-bold tabular-nums transition ${
              gb === a ? "bg-brand-600 text-white" : "bg-surface-muted hover:bg-brand-100"
            }`}
          >
            {a} GB
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={120}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] outline-none transition placeholder:text-muted/70 focus:border-brand-500"
      />
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-gradient mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-70"
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        Ask for {gb} GB
      </button>
    </form>
  );
}
