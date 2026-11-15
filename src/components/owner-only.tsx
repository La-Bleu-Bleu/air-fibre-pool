import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown to members on screens only the owner can use. */
export function OwnerOnly({ ownerName, what }: { ownerName: string; what: string }) {
  return (
    <section className="mx-4 rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-100 text-brand-ink">
        <Lock size={20} />
      </span>
      <p className="mt-4 font-bold">Only {ownerName} can {what}</p>
      <p className="mt-1 text-sm text-muted">They pay for the pool and decide who gets what.</p>
      <Link
        href="/household"
        className="bg-brand-gradient mt-5 inline-flex h-11 items-center rounded-xl px-5 font-semibold text-white"
      >
        Ask for more data
      </Link>
    </section>
  );
}
