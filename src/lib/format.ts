export const formatGb = (gb: number) =>
  `${gb >= 100 || Number.isInteger(gb) ? Math.round(gb) : gb.toFixed(1)} GB`;

export const formatLkr = (lkr: number) => `LKR ${lkr.toLocaleString("en-LK")}`;

export function daysLeft(cycleEnd: string, now = new Date()) {
  const ms = new Date(cycleEnd).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 days ago". Call on the server to avoid hydration drift. */
export function timeAgo(iso: string, now = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}
