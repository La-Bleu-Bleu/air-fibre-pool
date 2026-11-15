import "server-only";
import { connection } from "next/server";
import { demoHousehold, demoPackages, demoPriceTiers } from "./demo-data";
import type { HouseholdSummary, PackagePreset, PriceTier } from "./types";

/*
 * Data access layer. Pages call these functions and never talk to Supabase directly,
 * so swapping demo data for real queries happens in one place.
 * TODO: when isSupabaseConfigured and a user is signed in, read from
 *       households / member_balances / price_tiers / packages instead.
 */

export async function getHousehold(): Promise<HouseholdSummary> {
  await connection(); // per-user, per-request data: never prerender
  return demoHousehold;
}

export async function getPriceTiers(): Promise<PriceTier[]> {
  return demoPriceTiers;
}

export async function getPackages(): Promise<PackagePreset[]> {
  return demoPackages;
}
