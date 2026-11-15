import "server-only";
import { cookies } from "next/headers";
import { demoMembers, demoPoolGb, demoRequests } from "./demo-data";
import type { DataRequest, Member } from "./types";

/**
 * Demo persistence: the household plan lives in a cookie so the whole flow
 * works before Supabase is connected. Replace with Supabase reads/writes once it is.
 *
 * The "viewer" cookie stands in for sign-in: it says which member is using the app.
 */
const PLAN_COOKIE = "afp-demo-plan";
const VIEWER_COOKIE = "afp-demo-viewer";
const MAX_REQUESTS = 20; // keep the cookie small

export interface DemoPlan {
  poolGb: number;
  members: Member[];
  requests: DataRequest[];
}

const defaultPlan: DemoPlan = { poolGb: demoPoolGb, members: demoMembers, requests: demoRequests };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function readPlan(): Promise<DemoPlan> {
  const raw = (await cookies()).get(PLAN_COOKIE)?.value;
  if (!raw) return defaultPlan;
  try {
    const plan = JSON.parse(raw) as Partial<DemoPlan>;
    if (!Array.isArray(plan.members) || typeof plan.poolGb !== "number") return defaultPlan;
    return {
      poolGb: plan.poolGb,
      members: plan.members,
      // Cookies saved before requests existed get the demo request.
      requests: Array.isArray(plan.requests) ? plan.requests : demoRequests,
    };
  } catch {
    return defaultPlan;
  }
}

export async function writePlan(plan: DemoPlan) {
  const trimmed = { ...plan, requests: plan.requests.slice(0, MAX_REQUESTS) };
  (await cookies()).set(PLAN_COOKIE, JSON.stringify(trimmed), cookieOptions);
}

/** The member id of whoever is "signed in". Falls back to the owner. */
export async function readViewerId(plan: DemoPlan): Promise<string> {
  const id = (await cookies()).get(VIEWER_COOKIE)?.value;
  const member = plan.members.find((m) => m.id === id && m.kind === "line");
  return member?.id ?? plan.members.find((m) => m.role === "owner")!.id;
}

export async function writeViewerId(memberId: string) {
  (await cookies()).set(VIEWER_COOKIE, memberId, cookieOptions);
}

export async function resetDemoStore() {
  const store = await cookies();
  store.delete(PLAN_COOKIE);
  store.delete(VIEWER_COOKIE);
}
