export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">{eyebrow}</p>}
      <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
    </header>
  );
}

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <section className="mx-4 rounded-[var(--radius-card)] border border-dashed border-border bg-surface p-5">
      <p className="text-sm font-bold">Planned for this screen</p>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
