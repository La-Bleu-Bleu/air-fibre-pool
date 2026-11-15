import type { MemberBalance } from "@/lib/types";

/** Ring split into each member's usage, on a track representing the whole pool. */
export function PoolRing({ members, sizeGb, size = 168 }: { members: MemberBalance[]; sizeGb: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 4; // px gap between segments
  // If usage ever exceeds the pool (e.g. demo usage after a downgrade), fill the ring instead of overflowing.
  const scale = Math.max(sizeGb, members.reduce((s, m) => s + m.usedGb, 0));
  const lengths = members.map((m) => (m.usedGb / scale) * c);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={stroke} />
      {members.map((m, i) => (
          <circle
            key={m.id}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={m.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(lengths[i] - gap, 0.01)} ${c}`}
            strokeDashoffset={-offsets[i]}
            style={{ filter: "drop-shadow(0 0 1px rgb(255 255 255 / 0.9))" }}
          />
      ))}
    </svg>
  );
}
