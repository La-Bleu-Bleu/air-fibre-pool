export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">{eyebrow}</p>}
      <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
    </header>
  );
}
