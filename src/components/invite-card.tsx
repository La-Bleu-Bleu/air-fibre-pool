"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { respondToInvite } from "@/app/actions";

/** "X invited you to Y" with Join / Decline. Used on the Household tab (demo) and on Welcome (signed-in invitees). */
export function InviteCard({
  memberId,
  ownerName,
  householdName,
}: {
  memberId: string;
  ownerName: string;
  householdName: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<boolean>();

  function respond(accept: boolean) {
    setError(undefined);
    setChoice(accept);
    startTransition(async () => {
      const result = await respondToInvite(memberId, accept);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="px-4">
      <div className="bg-brand-gradient overflow-hidden rounded-[var(--radius-card)] p-6 text-white shadow-lg shadow-brand-600/20">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/20">
          <Sparkles size={22} />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold leading-tight">
          {ownerName} invited you to {householdName}
        </h2>
        <p className="mt-2 text-white/85">
          Share one 5G data pool with the home Air Fibre and the rest of the family. {ownerName} pays and decides
          how much each person gets. You can ask for more any time.
        </p>
        {error && <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => respond(false)}
            disabled={pending}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/15 font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
          >
            {pending && choice === false && <Loader2 size={16} className="animate-spin" />}
            Decline
          </button>
          <button
            type="button"
            onClick={() => respond(true)}
            disabled={pending}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-brand-700 transition hover:bg-white/90 disabled:opacity-60"
          >
            {pending && choice === true && <Loader2 size={16} className="animate-spin" />}
            Join household
          </button>
        </div>
      </div>
    </section>
  );
}
