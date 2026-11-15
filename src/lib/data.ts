import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
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

/**
 * The viewer's household, or null if they don't have one. Cached per request, so the layout
 * (tabs, demo bar) and the page share a single load.
 */
export const findHousehold = cache(async (): Promise<HouseholdSummary | null> => {
  await connection(); // per-user, per-request data: never prerender
  return (await getRepo()).getHousehold();
});

/** The viewer's household. Sends people without one to onboarding. */
export async function getHousehold(): Promise<HouseholdSummary> {
  const household = await findHousehold();
  if (!household) redirect("/welcome");
  return household;
}

/** Same as getHousehold, but sends members (non-owners) home: for owner-only screens. */
export async function getHouseholdAsOwner(): Promise<HouseholdSummary> {
  const household = await getHousehold();
  if (!household.viewer.isOwner) redirect("/");
  return household;
}

export async function getCatalogue() {
  return (await getRepo()).getCatalogue();
}
