export const formatGb = (gb: number) =>
  `${gb >= 100 || Number.isInteger(gb) ? Math.round(gb) : gb.toFixed(1)} GB`;

export const formatLkr = (lkr: number) => `LKR ${lkr.toLocaleString("en-LK")}`;

export function daysLeft(cycleEnd: string, now = new Date()) {
  const ms = new Date(cycleEnd).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
