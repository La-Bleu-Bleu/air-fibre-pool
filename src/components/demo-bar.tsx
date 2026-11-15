"use client";

import { useTransition } from "react";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import { switchViewer } from "@/app/actions";

/** Demo-only: a slim bar at the top of every screen to switch who you're viewing the app as. */
export function DemoBar({ people, current }: { people: { id: string; label: string }[]; current: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-brand-500/20 bg-brand-100/95 px-4 py-2 pt-[max(env(safe-area-inset-top),8px)] text-xs backdrop-blur">
      <span className="flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-wide text-brand-ink">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} aria-hidden />}
        Demo
      </span>
      <label className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-muted">
        Viewing as
        <span className="relative">
          <select
            value={current}
            disabled={pending}
            onChange={(e) => {
              const id = e.target.value;
              startTransition(async () => void (await switchViewer(id)));
            }}
            className="h-8 max-w-[11rem] appearance-none truncate rounded-full border border-brand-500/30 bg-surface py-0 pr-7 pl-3 text-xs font-semibold text-foreground outline-none focus:border-brand-500"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" aria-hidden />
        </span>
      </label>
    </div>
  );
}
