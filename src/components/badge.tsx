const tones = {
  brand: "bg-brand-100 text-brand-ink",
  accent: "bg-accent-500/15 text-accent-500",
  success: "bg-success/15 text-success",
  muted: "bg-surface-muted text-muted",
} as const;

export function Badge({ children, tone = "brand" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}
