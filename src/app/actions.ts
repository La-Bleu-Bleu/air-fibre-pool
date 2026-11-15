"use server";

import { redirect } from "next/navigation";
import { getCatalogue } from "@/lib/data";
import { readPlan, readViewerId, resetDemoStore, writePlan, writeViewerId, type DemoPlan } from "@/lib/demo-store";
import { normaliseMsisdn } from "@/lib/pricing";
import type { Member } from "@/lib/types";

export type ActionResult = { error: string } | undefined;

/** Who is acting. Stands in for the Supabase session until sign-in exists. */
async function getActor() {
  const plan = await readPlan();
  const viewerId = await readViewerId(plan);
  const me = plan.members.find((m) => m.id === viewerId)!;
  return { plan, me, isOwner: me.role === "owner" };
}

const ownerOnly: ActionResult = { error: "Only the household owner can do that." };
const allocatedTotal = (members: Member[]) => members.reduce((s, m) => s + m.allocatedGb, 0);

// ─── Owner: plan and allocations ─────────────────────────────────────────────

export interface PlanLineInput {
  id?: string; // existing member id; omitted for a new line
  label: string;
  msisdn: string;
}

/**
 * Save the pool size and the set of mobile lines (step 1), then go to Allocate.
 * Existing members keep their allocations; new lines start at 0 GB and are "invited".
 * If the new pool is smaller than what's allocated, allocations shrink proportionally.
 */
export async function savePlan(poolGb: number, lines: PlanLineInput[]): Promise<ActionResult> {
  const catalogue = await getCatalogue();
  const { plan, isOwner } = await getActor();
  if (!isOwner) return ownerOnly;

  if (!catalogue.tiers.some((t) => t.poolGb === poolGb)) return { error: "Pick one of the pool sizes." };
  if (lines.length < 1 || lines.length > catalogue.maxLines)
    return { error: `A household can have 1 to ${catalogue.maxLines} mobile lines.` };

  const existing = new Map(plan.members.map((m) => [m.id, m]));
  const owner = plan.members.find((m) => m.role === "owner")!;
  if (!lines.some((l) => l.id === owner.id)) return { error: "The owner's line can't be removed." };

  const seen = new Set<string>();
  const nextLines: Member[] = [];
  for (const line of lines) {
    const label = line.label.trim();
    if (!label || label.length > 20) return { error: "Each line needs a name of up to 20 characters." };
    const prev = line.id ? existing.get(line.id) : undefined;
    if (line.id && (!prev || prev.kind !== "line")) return { error: "That line no longer exists. Reload and try again." };

    const msisdn = prev?.msisdn ?? normaliseMsisdn(line.msisdn);
    if (!msisdn) return { error: `${label}: enter a Dialog mobile number like 077 123 4567.` };
    if (seen.has(msisdn)) return { error: `${label}: that number is already in the household.` };
    seen.add(msisdn);

    nextLines.push(
      prev
        ? { ...prev, label }
        : {
            id: `line-${crypto.randomUUID().slice(0, 8)}`,
            label,
            kind: "line",
            role: "member",
            status: "invited",
            msisdn,
            allocatedGb: 0,
          },
    );
  }

  const home = plan.members.find((m) => m.kind === "home")!;
  let members = [home, ...nextLines];

  const total = allocatedTotal(members);
  if (total > poolGb) {
    const ratio = poolGb / total;
    members = members.map((m) => ({ ...m, allocatedGb: Math.floor(m.allocatedGb * ratio) }));
  }

  const kept = new Set(members.map((m) => m.id));
  await writePlan({ poolGb, members, requests: plan.requests.filter((r) => kept.has(r.memberId)) });
  redirect("/allocate");
}

/** Save GB per member (step 2). The total may not exceed the pool. */
export async function saveAllocations(allocations: Record<string, number>): Promise<ActionResult> {
  const { plan, isOwner } = await getActor();
  if (!isOwner) return ownerOnly;

  if (Object.keys(allocations).some((id) => !plan.members.some((m) => m.id === id)))
    return { error: "Someone was removed from the household. Reload and try again." };
  const members = plan.members.map((m) => ({ ...m, allocatedGb: allocations[m.id] ?? m.allocatedGb }));
  if (members.some((m) => !Number.isFinite(m.allocatedGb) || m.allocatedGb < 0))
    return { error: "Allocations must be zero or more." };

  const total = allocatedTotal(members);
  if (total > plan.poolGb) return { error: `That's ${total} GB, but the pool is ${plan.poolGb} GB.` };

  await writePlan({ ...plan, members });
  redirect("/");
}

// ─── Owner: household management ─────────────────────────────────────────────

/** Remove a line (or cancel its invite). Its allocation returns to the pool. */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const { plan, isOwner } = await getActor();
  if (!isOwner) return ownerOnly;

  const member = plan.members.find((m) => m.id === memberId);
  if (!member) return { error: "That person is no longer in the household." };
  if (member.kind === "home" || member.role === "owner") return { error: "The home router and the owner can't be removed." };

  await writePlan(withoutMember(plan, memberId));
}

/** Approve (adds GB from the unallocated pool) or decline a member's request. */
export async function respondToRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const { plan, isOwner } = await getActor();
  if (!isOwner) return ownerOnly;

  const request = plan.requests.find((r) => r.id === requestId);
  if (!request || request.status !== "pending") return { error: "That request has already been handled." };
  const member = plan.members.find((m) => m.id === request.memberId);
  if (!member) return { error: "That person is no longer in the household." };

  let members = plan.members;
  if (approve) {
    const unallocated = plan.poolGb - allocatedTotal(plan.members);
    if (unallocated < request.gb)
      return {
        error: `Only ${unallocated} GB is unallocated. Free up ${request.gb - unallocated} GB in Allocate, or grow the pool.`,
      };
    members = plan.members.map((m) => (m.id === member.id ? { ...m, allocatedGb: m.allocatedGb + request.gb } : m));
  }

  const requests = plan.requests.map((r) =>
    r.id === requestId ? { ...r, status: approve ? ("approved" as const) : ("declined" as const) } : r,
  );
  await writePlan({ ...plan, members, requests });
}

// ─── Members ─────────────────────────────────────────────────────────────────

/** A member asks the owner for more data. One pending request at a time. */
export async function requestData(gb: number, note: string): Promise<ActionResult> {
  const { plan, me, isOwner } = await getActor();
  if (isOwner) return { error: "As the owner, you can allocate data yourself." };
  if (me.status !== "active") return { error: "Accept your invite first." };
  if (!Number.isInteger(gb) || gb < 1 || gb > plan.poolGb) return { error: "Pick how much data you need." };
  if (plan.requests.some((r) => r.memberId === me.id && r.status === "pending"))
    return { error: "You already have a request waiting for the owner." };

  const request = {
    id: `req-${crypto.randomUUID().slice(0, 8)}`,
    memberId: me.id,
    gb,
    note: note.trim().slice(0, 120),
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  await writePlan({ ...plan, requests: [request, ...plan.requests] });
}

/** An invited member accepts or declines joining the household. */
export async function respondToInvite(accept: boolean): Promise<ActionResult> {
  const { plan, me } = await getActor();
  if (me.status !== "invited") return { error: "There's no invite to respond to." };

  if (accept) {
    await writePlan({ ...plan, members: plan.members.map((m) => (m.id === me.id ? { ...m, status: "active" as const } : m)) });
  } else {
    await writePlan(withoutMember(plan, me.id));
    redirect("/");
  }
}

// ─── Demo controls ───────────────────────────────────────────────────────────

/** Demo stand-in for signing in as someone else in the household. */
export async function switchViewer(memberId: string): Promise<ActionResult> {
  const plan = await readPlan();
  if (!plan.members.some((m) => m.id === memberId && m.kind === "line")) return { error: "Unknown person." };
  await writeViewerId(memberId);
}

/** Put the demo back to the deck's family-of-five example. */
export async function resetDemo() {
  await resetDemoStore();
  redirect("/");
}

function withoutMember(plan: DemoPlan, memberId: string): DemoPlan {
  return {
    ...plan,
    members: plan.members.filter((m) => m.id !== memberId),
    requests: plan.requests.filter((r) => r.memberId !== memberId),
  };
}
