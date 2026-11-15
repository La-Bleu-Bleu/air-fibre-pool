import "server-only";
import { connection } from "next/server";
import { demoCatalogue, demoHouseholdMeta, demoUsageGb } from "./demo-data";
import { readPlan, readViewerId } from "./demo-store";
import { monthlyPrice } from "./pricing";
import type { Catalogue, HouseholdSummary } from "./types";

/*
 * Data access layer. Pages call these functions and never talk to storage directly,
 * so swapping the demo store for Supabase happens in one place.
 * TODO: when isSupabaseConfigured and a user is signed in, read from
 *       households / member_balances / data_requests / price_tiers / packages instead,
 *       and take the viewer from the Supabase session.
 */

const lineColors = ["var(--member-1)", "var(--member-2)", "var(--member-3)", "var(--member-4)", "var(--member-5)"];

export async function getHousehold(): Promise<HouseholdSummary> {
  await connection(); // per-user, per-request data: never prerender
  const plan = await readPlan();
  const viewerId = await readViewerId(plan);
  const catalogue = await getCatalogue();
  const { ownerName } = demoHouseholdMeta;

  const viewerMember = plan.members.find((m) => m.id === viewerId)!;
  const viewerIsOwner = viewerMember.role === "owner";

  let lineIndex = 0;
  const members = plan.members.map((m) => ({
    ...m,
    usedGb: m.status === "active" ? (demoUsageGb[m.id] ?? 0) : 0,
    color: m.kind === "home" ? "var(--member-home)" : lineColors[lineIndex++ % lineColors.length],
    // Labels are the owner's names for each connection; members see the owner by name and themselves as "You".
    displayLabel: viewerIsOwner
      ? m.label
      : m.role === "owner"
        ? ownerName
        : m.id === viewerId
          ? `${m.label} (you)`
          : m.label,
  }));

  return {
    id: demoHouseholdMeta.id,
    name: demoHouseholdMeta.name,
    ownerName,
    pool: {
      sizeGb: plan.poolGb,
      priceLkr: monthlyPrice(catalogue, plan.poolGb, members.filter((m) => m.kind === "line").length),
      cycleStart: demoHouseholdMeta.cycleStart,
      cycleEnd: demoHouseholdMeta.cycleEnd,
    },
    members,
    requests: [...plan.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    viewer: {
      memberId: viewerId,
      isOwner: viewerIsOwner,
      name: viewerIsOwner ? ownerName : viewerMember.label,
    },
  };
}

export async function getCatalogue(): Promise<Catalogue> {
  return demoCatalogue;
}
