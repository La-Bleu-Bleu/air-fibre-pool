import { daysLeft, formatGb, timeAgo } from "./format";
import type { HouseholdSummary } from "./types";

export type NotificationTone = "action" | "warning" | "info" | "success";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  body?: string;
  href?: string; // where tapping it goes
  cta?: string;
  when?: string;
}

/**
 * Notifications are derived from the current household state (there's no notifications table yet),
 * so they always reflect what's true right now. "action" and "warning" items count towards the bell badge.
 */
export function notificationsFor(h: HouseholdSummary, now = new Date()): AppNotification[] {
  const out: AppNotification[] = [];
  const me = h.members.find((m) => m.id === h.viewer.memberId)!;
  const byId = new Map(h.members.map((m) => [m.id, m]));
  const lowThreshold = 0.8;

  if (h.viewer.isOwner) {
    for (const r of h.requests.filter((r) => r.status === "pending")) {
      const m = byId.get(r.memberId);
      if (!m) continue;
      out.push({
        id: `req-${r.id}`,
        tone: "action",
        title: `${m.displayLabel} asked for ${formatGb(r.gb)}`,
        body: r.note || undefined,
        href: "/household",
        cta: "Review",
        when: timeAgo(r.createdAt, now),
      });
    }
    for (const m of h.members) {
      if (m.status !== "active" || m.allocatedGb === 0) continue;
      const used = m.usedGb / m.allocatedGb;
      if (used >= 1)
        out.push({ id: `out-${m.id}`, tone: "warning", title: `${m.displayLabel} has used all their data`, href: "/allocate", cta: "Allocate" });
      else if (used >= lowThreshold)
        out.push({
          id: `low-${m.id}`,
          tone: "warning",
          title: `${m.displayLabel} is running low`,
          body: `${formatGb(m.allocatedGb - m.usedGb)} left of ${formatGb(m.allocatedGb)}`,
          href: "/allocate",
          cta: "Allocate",
        });
    }
    const unallocated = h.pool.sizeGb - h.members.reduce((s, m) => s + m.allocatedGb, 0);
    if (unallocated > 0)
      out.push({
        id: "unallocated",
        tone: "info",
        title: `${formatGb(unallocated)} isn't allocated yet`,
        body: "Share it out so nobody runs short.",
        href: "/allocate",
        cta: "Allocate",
      });
    for (const m of h.members.filter((m) => m.status === "invited"))
      out.push({ id: `inv-${m.id}`, tone: "info", title: `${m.displayLabel} hasn't joined yet`, body: "They'll see your invite when they sign in." });
  } else {
    if (me.status === "invited")
      out.push({ id: "my-invite", tone: "action", title: `${h.ownerName} invited you to ${h.name}`, href: "/household", cta: "View invite" });

    for (const r of h.requests.filter((r) => r.memberId === me.id).slice(0, 5)) {
      if (r.status === "approved")
        out.push({ id: `req-${r.id}`, tone: "success", title: `${h.ownerName} gave you ${formatGb(r.gb)}`, when: timeAgo(r.createdAt, now) });
      else if (r.status === "declined")
        out.push({ id: `req-${r.id}`, tone: "info", title: `${h.ownerName} declined your request for ${formatGb(r.gb)}`, when: timeAgo(r.createdAt, now) });
      else out.push({ id: `req-${r.id}`, tone: "info", title: `Waiting for ${h.ownerName} to approve ${formatGb(r.gb)}`, when: timeAgo(r.createdAt, now) });
    }
    if (me.status === "active" && me.allocatedGb > 0 && me.usedGb / me.allocatedGb >= lowThreshold)
      out.push({
        id: "my-low",
        tone: "warning",
        title: me.usedGb >= me.allocatedGb ? "You've used all your data" : "You're running low on data",
        body: `${formatGb(Math.max(0, me.allocatedGb - me.usedGb))} left of ${formatGb(me.allocatedGb)}`,
        href: "/household",
        cta: "Ask for more",
      });
  }

  const renewIn = daysLeft(h.pool.cycleEnd, now);
  if (renewIn <= 5)
    out.push({ id: "renewal", tone: "info", title: `Your pool renews in ${renewIn} ${renewIn === 1 ? "day" : "days"}` });

  const order: Record<NotificationTone, number> = { action: 0, warning: 1, success: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

export const badgeCount = (items: AppNotification[]) => items.filter((n) => n.tone === "action" || n.tone === "warning").length;
