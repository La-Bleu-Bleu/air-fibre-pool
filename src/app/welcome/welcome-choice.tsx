"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home, Loader2, RefreshCw, Users } from "lucide-react";
import { CreateHouseholdForm } from "./create-household-form";

/** No invite yet: are you joining your family's household, or starting one? */
export function WelcomeChoice({ phone }: { phone: string | null }) {
  const [choice, setChoice] = useState<"join" | "start" | null>(null);
  const [checking, startChecking] = useTransition();
  const router = useRouter();

  const back = (
    <button
      type="button"
      onClick={() => setChoice(null)}
      className="mx-5 mb-4 flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
    >
      <ArrowLeft size={16} /> Back
    </button>
  );

  if (choice === "start")
    return (
      <>
        {back}
        <CreateHouseholdForm />
      </>
    );

  if (choice === "join")
    return (
      <>
        {back}
        <section className="mx-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-100 text-brand-ink">
            <Users size={20} />
          </span>
          <h2 className="mt-4 text-lg font-bold">Ask the owner to add you</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              The person who manages your household opens <b className="text-foreground">Pool → Change plan → Add a line</b>.
            </li>
            <li>
              They add your number{phone && <> (<b className="text-foreground">{phone}</b>)</>}.
            </li>
            <li>Come back here and tap Check again. Your invite will be waiting.</li>
          </ol>
          <button
            type="button"
            disabled={checking}
            onClick={() => startChecking(() => router.refresh())}
            className="bg-brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-70"
          >
            {checking ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={16} />}
            Check again
          </button>
        </section>
      </>
    );

  return (
    <div className="space-y-3 px-4">
      <Option
        icon={<Users size={20} />}
        title="Join my family's household"
        body="Someone else pays and shares their pool with you."
        onClick={() => setChoice("join")}
      />
      <Option
        icon={<Home size={20} />}
        title="Start a household"
        body="You pay for one pool and decide how much your home and family get."
        onClick={() => setChoice("start")}
      />
    </div>
  );
}

function Option({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-left transition hover:border-brand-500"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-ink">{icon}</span>
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{body}</span>
      </span>
      <ChevronRight size={18} className="text-muted" />
    </button>
  );
}
