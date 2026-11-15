import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDemoMode } from "./mode";
import { demoRepo } from "./repo/demo";
import { supabaseRepo } from "./repo/supabase";
import type { Repo } from "./repo/types";
import type { HouseholdSummary } from "./types";

/*
 * Data access layer. Pages and actions use these; they never talk to storage directly.
 * Demo mode keeps everything in a cookie; otherwise Supabase is the source of truth.
 */

export const repo: Repo = isDemoMode ? demoRepo : supabaseRepo;

/** The signed-in person's household. Sends people without one to onboarding. */
export async function getHousehold(): Promise<HouseholdSummary> {
  await connection(); // per-user, per-request data: never prerender
  const household = await repo.getHousehold();
  if (!household) redirect("/welcome");
  return household;
}

export async function getCatalogue() {
  return repo.getCatalogue();
}
