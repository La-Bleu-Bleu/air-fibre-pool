"use client";

import { useState, useTransition } from "react";
import { Activity, Loader2 } from "lucide-react";
import { simulateUsage } from "./actions";

/** Prototype-only: there's no live network feed, so the owner can add random usage to see the app move. */
export function SimulateUsageButton() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await simulateUsage();
            if (result?.error) setError(result.error);
          })
        }
        className="flex items-center gap-1.5 text-xs font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
        Simulate a few days of usage
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
