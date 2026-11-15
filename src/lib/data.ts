import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DEMO_COOKIE, demoForced } from "./mode";
import { demoRepo } from "./repo/demo";
import { supabaseRepo } from "./repo/supabase";
import type { Repo } from "./repo/types";
import type { HouseholdSummary } from "./types";

/*
 * Data access layer. Pages and actions use these; they never talk to storage directly.
 * Demo mode keeps everything in a cookie; otherwise Supabase is the source of truth.
 */

/** Whether this visitor is in demo mode (see lib/mode.ts). */
export async function isDemo(): Promise<boolean> {
  if (demoForced) return true;
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
}

export async function getRepo(): Promise<Repo> {
  return (await isDemo()) ? demoRepo : supabaseRepo;
}

/** The signed-in person's household. Sends people without one to onboarding. */
export async function getHousehold(): Promise<HouseholdSummary> {
  await connection(); // per-user, per-request data: never prerender
  const household = await (await getRepo()).getHousehold();
  if (!household) redirect("/welcome");
  return household;
}

export async function getCatalogue() {
  await connection(); // reads the database at request time
  return (await getRepo()).getCatalogue();
}
