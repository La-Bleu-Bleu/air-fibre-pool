import type { DataRequest, HouseholdSummary, Member } from "../types";

const lineColors = ["var(--member-1)", "var(--member-2)", "var(--member-3)", "var(--member-4)", "var(--member-5)"];

/** Shared by both repos: turns stored rows into what the screens need, from the viewer's point of view. */
export function shapeHousehold(input: {
  id: string;
  name: string;
  ownerName: string;
  poolGb: number;
  priceLkr: number;
  cycleStart: string;
  cycleEnd: string;
  members: Member[];
  usedGb: Record<string, number>;
  requests: DataRequest[];
  viewerId: string;
}): HouseholdSummary {
  const viewerMember = input.members.find((m) => m.id === input.viewerId)!;
  const viewerIsOwner = viewerMember.role === "owner";

  // Home first, owner next, then everyone else in the order they joined.
  const ordered = [...input.members].sort((a, b) => rank(a) - rank(b));

  let lineIndex = 0;
  const members = ordered.map((m) => ({
    ...m,
    usedGb: m.status === "active" ? (input.usedGb[m.id] ?? 0) : 0,
    color: m.kind === "home" ? "var(--member-home)" : lineColors[lineIndex++ % lineColors.length],
    // Labels are the owner's names for each connection; members see the owner by name and themselves as "(you)".
    displayLabel: viewerIsOwner
      ? m.label
      : m.role === "owner"
        ? input.ownerName
        : m.id === input.viewerId
          ? `${m.label} (you)`
          : m.label,
  }));

  return {
    id: input.id,
    name: input.name,
    ownerName: input.ownerName,
    pool: { sizeGb: input.poolGb, priceLkr: input.priceLkr, cycleStart: input.cycleStart, cycleEnd: input.cycleEnd },
    members,
    requests: [...input.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    viewer: {
      memberId: input.viewerId,
      isOwner: viewerIsOwner,
      name: viewerIsOwner ? input.ownerName : viewerMember.label,
    },
  };
}

const rank = (m: Member) => (m.kind === "home" ? 0 : m.role === "owner" ? 1 : 2);
