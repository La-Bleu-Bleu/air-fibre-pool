/** Skeleton shown while per-user data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="bg-brand-gradient h-[380px] rounded-b-[2rem] opacity-80" />
      <div className="space-y-2.5 px-4 pt-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[84px] rounded-[var(--radius-card)] bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
