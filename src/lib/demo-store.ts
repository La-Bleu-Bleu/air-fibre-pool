import "server-only";
import { cookies } from "next/headers";
import { demoMembers, demoPoolGb } from "./demo-data";
import type { Member } from "./types";

/**
 * Demo persistence: the household plan lives in a cookie so the whole flow
 * (build → allocate → home) works before Supabase is connected.
 * Replace with Supabase reads/writes once it is.
 */
const COOKIE = "afp-demo-plan";

export interface DemoPlan {
  poolGb: number;
  members: Member[];
}

const defaultPlan: DemoPlan = { poolGb: demoPoolGb, members: demoMembers };

export async function readPlan(): Promise<DemoPlan> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return defaultPlan;
  try {
    const plan = JSON.parse(raw) as DemoPlan;
    return Array.isArray(plan.members) && typeof plan.poolGb === "number" ? plan : defaultPlan;
  } catch {
    return defaultPlan;
  }
}

export async function writePlan(plan: DemoPlan) {
  (await cookies()).set(COOKIE, JSON.stringify(plan), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function resetPlan() {
  (await cookies()).delete(COOKIE);
}
