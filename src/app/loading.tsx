/** Neutral skeleton shown while per-user data loads on any screen. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <div className="h-3 w-20 rounded-full bg-surface-muted" />
      <div className="mt-3 h-8 w-48 rounded-xl bg-surface-muted" />
      <div className="mt-8 h-40 rounded-[var(--radius-card)] bg-surface-muted" />
      <div className="mt-3 space-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[84px] rounded-[var(--radius-card)] bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
