import "server-only";
import { connection } from "next/server";
import { demoCatalogue, demoHouseholdMeta, demoUsageGb } from "./demo-data";
import { readPlan } from "./demo-store";
import { monthlyPrice } from "./pricing";
import type { Catalogue, HouseholdSummary } from "./types";

/*
 * Data access layer. Pages call these functions and never talk to storage directly,
 * so swapping the demo store for Supabase happens in one place.
 * TODO: when isSupabaseConfigured and a user is signed in, read from
 *       households / member_balances / price_tiers / packages instead.
 */

const lineColors = ["var(--member-1)", "var(--member-2)", "var(--member-3)", "var(--member-4)", "var(--member-5)"];

export async function getHousehold(): Promise<HouseholdSummary> {
  await connection(); // per-user, per-request data: never prerender
  const plan = await readPlan();
  const catalogue = await getCatalogue();
  let lineIndex = 0;

  const members = plan.members.map((m) => ({
    ...m,
    usedGb: demoUsageGb[m.id] ?? 0,
    color: m.kind === "home" ? "var(--member-home)" : lineColors[lineIndex++ % lineColors.length],
  }));

  return {
    id: demoHouseholdMeta.id,
    name: demoHouseholdMeta.name,
    ownerName: demoHouseholdMeta.ownerName,
    pool: {
      sizeGb: plan.poolGb,
      priceLkr: monthlyPrice(catalogue, plan.poolGb, members.filter((m) => m.kind === "line").length),
      cycleStart: demoHouseholdMeta.cycleStart,
      cycleEnd: demoHouseholdMeta.cycleEnd,
    },
    members,
  };
}

export async function getCatalogue(): Promise<Catalogue> {
  return demoCatalogue;
}
