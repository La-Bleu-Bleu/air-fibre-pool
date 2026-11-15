"use client";

import { useState, useTransition } from "react";
import { Loader2, Router } from "lucide-react";
import { createHousehold } from "@/app/actions";

export function CreateHouseholdForm() {
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createHousehold(name, displayName);
      if (result?.error) setError(result.error);
    });
  }

  const field =
    "h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] outline-none transition placeholder:text-muted/70 focus:border-brand-500";

  return (
    <form onSubmit={submit} className="mx-4 space-y-5 rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-ink">
          <Router size={20} />
        </span>
        <p className="text-sm text-muted">
          You&apos;ll be the owner: you pay for one shared pool and decide how much your home and each family member gets.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your name</span>
        <input
          autoFocus
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="e.g. Nadeesha"
          className={field}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Household name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Perera home"
          className={field}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg shadow-brand-600/30 disabled:opacity-70"
      >
        {pending && <Loader2 size={18} className="animate-spin" />}
        Continue to build your pool
      </button>
    </form>
  );
}
