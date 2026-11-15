"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRepo, isDemo } from "@/lib/data";
import { resetDemoStore, writeViewerId } from "@/lib/demo-store";
import { DEMO_COOKIE, demoForced } from "@/lib/mode";
import { normaliseMsisdn, PHONE_EXAMPLE } from "@/lib/pricing";
import { UserError, type PlanLine } from "@/lib/repo/types";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | undefined;

/**
 * Run a write, turning UserErrors into a message for the form. Anything else is a real bug and is rethrown.
 * On success, refresh the page so it shows the new data (Supabase writes don't touch cookies, so Next.js
 * wouldn't re-render on its own).
 */
async function attempt(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh();
}

/** The caller's household, or a UserError. Permission checks here give friendly messages; storage enforces them too. */
async function household() {
  const h = await (await getRepo()).getHousehold();
  if (!h) throw new UserError("You're not in a household yet.");
  return h;
}

async function asOwner() {
  const h = await household();
  if (!h.viewer.isOwner) throw new UserError("Only the household owner can do that.");
  return h;
}

const allocatedTotal = (h: Awaited<ReturnType<typeof household>>) => h.members.reduce((s, m) => s + m.allocatedGb, 0);

// ─── Onboarding ──────────────────────────────────────────────────────────────

export async function createHousehold(name: string, displayName: string): Promise<ActionResult> {
  const result = await attempt(async () => {
    if (!displayName.trim()) throw new UserError("Tell us your name.");
    if (!name.trim()) throw new UserError("Give your household a name.");
    await (await getRepo()).createHousehold(name.trim().slice(0, 40), displayName.trim().slice(0, 40));
  });
  if (result) return result;
  redirect("/build?setup=1");
}

// ─── Owner: plan and allocations ─────────────────────────────────────────────

export interface PlanLineInput {
  id?: string;
  label: string;
  msisdn: string;
}

/**
 * Save the pool size and lines. During first-time setup ("allocate") go on to Allocate;
 * when changing an existing plan ("stay"), stay on the Pool page, which refreshes to show it.
 */
export async function savePlan(poolGb: number, lines: PlanLineInput[], then: "allocate" | "stay"): Promise<ActionResult> {
  const result = await attempt(async () => {
    const h = await asOwner();
    const catalogue = await (await getRepo()).getCatalogue();

    if (!catalogue.tiers.some((t) => t.poolGb === poolGb)) throw new UserError("Pick one of the pool sizes.");
    if (lines.length < 1 || lines.length > catalogue.maxLines)
      throw new UserError(`A household can have 1 to ${catalogue.maxLines} mobile lines.`);

    const owner = h.members.find((m) => m.role === "owner")!;
    if (!lines.some((l) => l.id === owner.id)) throw new UserError("The owner's line can't be removed.");

    const existing = new Map(h.members.map((m) => [m.id, m]));
    const seen = new Set<string>();
    const clean: PlanLine[] = [];
    for (const line of lines) {
      const label = line.label.trim();
      if (!label || label.length > 20) throw new UserError("Each line needs a name of up to 20 characters.");
      const prev = line.id ? existing.get(line.id) : undefined;
      if (line.id && (!prev || prev.kind !== "line")) throw new UserError("That line no longer exists. Reload and try again.");

      const msisdn = prev?.msisdn ?? normaliseMsisdn(line.msisdn);
      if (!msisdn) throw new UserError(`${label}: enter a mobile number like ${PHONE_EXAMPLE}.`);
      if (seen.has(msisdn)) throw new UserError(`${label}: that number is already in the household.`);
      seen.add(msisdn);
      clean.push({ id: line.id, label, msisdn });
    }

    await (await getRepo()).savePlan(poolGb, clean);
  });
  if (result || then === "stay") return result;
  redirect("/allocate?setup=1");
}

/** Save GB per member. The total may not exceed the pool. "home" goes back to Home; "stay" (e.g. from Dia) doesn't navigate. */
export async function saveAllocations(allocations: Record<string, number>, then: "home" | "stay" = "home"): Promise<ActionResult> {
  const result = await attempt(async () => {
    const h = await asOwner();
    if (Object.keys(allocations).some((id) => !h.members.some((m) => m.id === id)))
      throw new UserError("Someone was removed from the household. Reload and try again.");
    if (Object.values(allocations).some((gb) => !Number.isFinite(gb) || gb < 0))
      throw new UserError("Allocations must be zero or more.");
    const total = h.members.reduce((s, m) => s + (allocations[m.id] ?? m.allocatedGb), 0);
    if (total > h.pool.sizeGb) throw new UserError(`That's ${total} GB, but the pool is ${h.pool.sizeGb} GB.`);
    await (await getRepo()).saveAllocations(allocations);
  });
  if (result || then === "stay") return result;
  redirect("/");
}

// ─── Owner: household management ─────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<ActionResult> {
  return attempt(async () => {
    const h = await asOwner();
    const member = h.members.find((m) => m.id === memberId);
    if (!member) throw new UserError("That person is no longer in the household.");
    if (member.kind === "home" || member.role === "owner")
      throw new UserError("The home router and the owner can't be removed.");
    await (await getRepo()).removeMember(memberId);
  });
}

/** Approve (adds GB from the unallocated pool) or decline a member's request. */
export async function respondToRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const h = await asOwner();
    const request = h.requests.find((r) => r.id === requestId);
    if (!request || request.status !== "pending") throw new UserError("That request has already been handled.");
    if (approve) {
      const unallocated = h.pool.sizeGb - allocatedTotal(h);
      if (unallocated < request.gb)
        throw new UserError(
          `Only ${unallocated} GB is unallocated. Free up ${request.gb - unallocated} GB in Allocate, or grow the pool.`,
        );
    }
    await (await getRepo()).respondToRequest(requestId, approve);
  });
}

/** Demo helper: add some random usage so the rings and bars move. */
export async function simulateUsage(): Promise<ActionResult> {
  return attempt(async () => {
    await asOwner();
    await (await getRepo()).simulateUsage();
  });
}

// ─── Members ─────────────────────────────────────────────────────────────────

/** A member asks the owner for more data. One pending request at a time. */
export async function requestData(gb: number, note: string): Promise<ActionResult> {
  return attempt(async () => {
    const h = await household();
    const me = h.members.find((m) => m.id === h.viewer.memberId)!;
    if (h.viewer.isOwner) throw new UserError("As the owner, you can allocate data yourself.");
    if (me.status !== "active") throw new UserError("Accept your invite first.");
    if (!Number.isInteger(gb) || gb < 1 || gb > h.pool.sizeGb) throw new UserError("Pick how much data you need.");
    if (h.requests.some((r) => r.memberId === me.id && r.status === "pending"))
      throw new UserError("You already have a request waiting for the owner.");
    await (await getRepo()).requestData(gb, note.trim().slice(0, 120));
  });
}

/** Accept or decline an invite to join a household. */
export async function respondToInvite(memberId: string, accept: boolean): Promise<ActionResult> {
  const result = await attempt(async () => {
    if (await isDemo()) {
      const h = await household();
      const me = h.members.find((m) => m.id === memberId);
      if (me?.id !== h.viewer.memberId || me.status !== "invited") throw new UserError("There's no invite to respond to.");
    }
    await (await getRepo()).respondToInvite(memberId, accept);
  });
  if (result) return result;
  redirect("/");
}

// ─── Session ─────────────────────────────────────────────────────────────────

/*
 * PROTOTYPE SIGN-IN, NOT SECURE: there's no SMS. Any Sri Lankan or Malaysian mobile number works and the code is always
 * 123456, so anyone can sign in as any number. Under the hood each number gets an ordinary Supabase
 * email/password account (a made-up address and a password derived from the number). Swap this for real
 * phone OTP (Supabase signInWithOtp + an SMS provider or Dialog's own gateway) before real users.
 */
const PROTOTYPE_CODE = "123456";
const accountEmail = (msisdn: string) => `${msisdn}@phone.air-fibre-pool.example`;
const accountPassword = (msisdn: string) => `air-fibre-pool-prototype-${msisdn}`;

export async function signInWithPhone(number: string, code: string): Promise<ActionResult> {
  const msisdn = normaliseMsisdn(number);
  if (!msisdn) return { error: `Enter a mobile number, like ${PHONE_EXAMPLE}.` };
  if (code !== PROTOTYPE_CODE) return { error: "That code isn't right. In this prototype the code is always 123456." };

  const supabase = await createClient();
  const credentials = { email: accountEmail(msisdn), password: accountPassword(msisdn) };

  const signIn = await supabase.auth.signInWithPassword(credentials);
  if (signIn.error) {
    if (signIn.error.code !== "invalid_credentials") return { error: signIn.error.message };

    // First time for this number: create the account. The profile picks up the number from metadata.
    const signUp = await supabase.auth.signUp({ ...credentials, options: { data: { msisdn } } });
    if (signUp.error) return { error: signUp.error.message };
    if (!signUp.data.session)
      return {
        error:
          "Account created but not signed in: switch off “Confirm email” in Supabase → Authentication → Sign In / Providers → Email.",
      };
  }

  (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}

export async function signOut() {
  if (await isDemo()) return exitDemo();
  await (await createClient()).auth.signOut();
  redirect("/login");
}

// ─── Demo controls ───────────────────────────────────────────────────────────

/** Start the demo from the login screen: fresh fake household, no sign-in. */
export async function enterDemo() {
  await resetDemoStore();
  (await cookies()).set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  redirect("/");
}

/** Leave the demo and go back to sign-in. */
export async function exitDemo() {
  await resetDemoStore();
  (await cookies()).delete(DEMO_COOKIE);
  redirect(demoForced ? "/" : "/login");
}

/** Demo stand-in for signing in as someone else in the household. */
export async function switchViewer(memberId: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!(await isDemo())) throw new UserError("Only available in demo mode.");
    const h = await household();
    if (!h.members.some((m) => m.id === memberId && m.kind === "line")) throw new UserError("Unknown person.");
    await writeViewerId(memberId);
  });
}

/** Put the demo back to the deck's family-of-five example. */
export async function resetDemo() {
  if (await isDemo()) await resetDemoStore();
  redirect("/");
}
