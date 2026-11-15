"use server";

import { redirect } from "next/navigation";
import { repo } from "@/lib/data";
import { resetDemoStore, writeViewerId } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/mode";
import { normaliseMsisdn } from "@/lib/pricing";
import { UserError, type PlanLine } from "@/lib/repo/types";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | undefined;

/** Run a write, turning UserErrors into a message for the form. Anything else is a real bug and is rethrown. */
async function attempt(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

/** The caller's household, or a UserError. Permission checks here give friendly messages; storage enforces them too. */
async function household() {
  const h = await repo.getHousehold();
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
    await repo.createHousehold(name.trim().slice(0, 40), displayName.trim().slice(0, 40));
  });
  if (result) return result;
  redirect("/build");
}

// ─── Owner: plan and allocations ─────────────────────────────────────────────

export interface PlanLineInput {
  id?: string;
  label: string;
  msisdn: string;
}

/** Save the pool size and lines (step 1), then go to Allocate. */
export async function savePlan(poolGb: number, lines: PlanLineInput[]): Promise<ActionResult> {
  const result = await attempt(async () => {
    const h = await asOwner();
    const catalogue = await repo.getCatalogue();

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
      if (!msisdn) throw new UserError(`${label}: enter a Dialog mobile number like 077 123 4567.`);
      if (seen.has(msisdn)) throw new UserError(`${label}: that number is already in the household.`);
      seen.add(msisdn);
      clean.push({ id: line.id, label, msisdn });
    }

    await repo.savePlan(poolGb, clean);
  });
  if (result) return result;
  redirect("/allocate");
}

/** Save GB per member (step 2). The total may not exceed the pool. */
export async function saveAllocations(allocations: Record<string, number>): Promise<ActionResult> {
  const result = await attempt(async () => {
    const h = await asOwner();
    if (Object.keys(allocations).some((id) => !h.members.some((m) => m.id === id)))
      throw new UserError("Someone was removed from the household. Reload and try again.");
    if (Object.values(allocations).some((gb) => !Number.isFinite(gb) || gb < 0))
      throw new UserError("Allocations must be zero or more.");
    const total = h.members.reduce((s, m) => s + (allocations[m.id] ?? m.allocatedGb), 0);
    if (total > h.pool.sizeGb) throw new UserError(`That's ${total} GB, but the pool is ${h.pool.sizeGb} GB.`);
    await repo.saveAllocations(allocations);
  });
  if (result) return result;
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
    await repo.removeMember(memberId);
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
    await repo.respondToRequest(requestId, approve);
  });
}

/** Demo helper: add some random usage so the rings and bars move. */
export async function simulateUsage(): Promise<ActionResult> {
  return attempt(async () => {
    await asOwner();
    await repo.simulateUsage();
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
    await repo.requestData(gb, note.trim().slice(0, 120));
  });
}

/** Accept or decline an invite to join a household. */
export async function respondToInvite(memberId: string, accept: boolean): Promise<ActionResult> {
  const result = await attempt(async () => {
    if (isDemoMode) {
      const h = await household();
      const me = h.members.find((m) => m.id === memberId);
      if (me?.id !== h.viewer.memberId || me.status !== "invited") throw new UserError("There's no invite to respond to.");
    }
    await repo.respondToInvite(memberId, accept);
  });
  if (result) return result;
  redirect("/");
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function signOut() {
  if (!isDemoMode) await (await createClient()).auth.signOut();
  redirect(isDemoMode ? "/" : "/login");
}

// ─── Demo controls ───────────────────────────────────────────────────────────

/** Demo stand-in for signing in as someone else in the household. */
export async function switchViewer(memberId: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!isDemoMode) throw new UserError("Only available in demo mode.");
    const h = await household();
    if (!h.members.some((m) => m.id === memberId && m.kind === "line")) throw new UserError("Unknown person.");
    await writeViewerId(memberId);
  });
}

/** Put the demo back to the deck's family-of-five example. */
export async function resetDemo() {
  if (isDemoMode) await resetDemoStore();
  redirect("/");
}
