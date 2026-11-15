"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { switchViewer } from "@/app/actions";

/** Demo-only: switch which household member is "signed in". Remove once real sign-in exists. */
export function ViewAs({ people, current }: { people: { id: string; label: string }[]; current: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="mx-4 mb-5 rounded-2xl border border-dashed border-brand-500/40 bg-brand-100/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
        <Eye size={14} aria-hidden /> Demo: view the app as
      </p>
      <div className={`-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 ${pending ? "opacity-60" : ""}`}>
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            disabled={pending}
            onClick={() => startTransition(async () => void (await switchViewer(p.id)))}
            className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition ${
              p.id === current ? "bg-brand-600 text-white" : "border border-border bg-surface hover:border-brand-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
