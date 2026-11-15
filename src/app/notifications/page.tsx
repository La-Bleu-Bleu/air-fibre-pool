import Link from "next/link";
import { AlertTriangle, BellOff, CheckCircle2, ChevronRight, Info, Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/lib/data";
import { notificationsFor, type NotificationTone } from "@/lib/notifications";

const toneStyle: Record<NotificationTone, { icon: React.ReactNode; className: string }> = {
  action: { icon: <Inbox size={18} />, className: "bg-brand-100 text-brand-ink" },
  warning: { icon: <AlertTriangle size={18} />, className: "bg-danger/10 text-danger" },
  success: { icon: <CheckCircle2 size={18} />, className: "bg-success/15 text-success" },
  info: { icon: <Info size={18} />, className: "bg-surface-muted text-muted" },
};

export default async function NotificationsPage() {
  const household = await getHousehold();
  const items = notificationsFor(household);

  return (
    <div className="pb-8">
      <PageHeader eyebrow="Notifications" title="What's new" />
      {items.length === 0 ? (
        <section className="mx-4 rounded-[var(--radius-card)] border border-border bg-surface p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-muted text-muted">
            <BellOff size={20} />
          </span>
          <p className="mt-4 font-bold">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-muted">We&apos;ll let you know when something needs your attention.</p>
        </section>
      ) : (
        <ul className="mx-4 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {items.map((n) => {
            const { icon, className } = toneStyle[n.tone];
            const content = (
              <>
                <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${className}`}>{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                  {n.when && <span className="mt-0.5 block text-xs text-muted">{n.when}</span>}
                </span>
                {n.href && (
                  <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-ink">
                    {n.cta} <ChevronRight size={16} />
                  </span>
                )}
              </>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className="flex items-center gap-3 p-4 transition hover:bg-brand-100/40">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-4">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
