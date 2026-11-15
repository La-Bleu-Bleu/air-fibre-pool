"use server";

import { redirect } from "next/navigation";
import { getCatalogue } from "@/lib/data";
import { readPlan, resetPlan, writePlan } from "@/lib/demo-store";
import { normaliseMsisdn } from "@/lib/pricing";
import type { Member } from "@/lib/types";

export type ActionResult = { error: string } | undefined;

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
  const plan = await readPlan();

  if (!catalogue.tiers.some((t) => t.poolGb === poolGb)) return { error: "Pick one of the pool sizes." };
  if (lines.length < 1 || lines.length > catalogue.maxLines)
    return { error: `A household can have 1 to ${catalogue.maxLines} mobile lines.` };

  const existing = new Map(plan.members.map((m) => [m.id, m]));
  const owner = plan.members.find((m) => m.role === "owner");
  if (!owner || !lines.some((l) => l.id === owner.id)) return { error: "The owner's line can't be removed." };

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

  const total = members.reduce((s, m) => s + m.allocatedGb, 0);
  if (total > poolGb) {
    const ratio = poolGb / total;
    members = members.map((m) => ({ ...m, allocatedGb: Math.floor(m.allocatedGb * ratio) }));
  }

  await writePlan({ poolGb, members });
  redirect("/allocate");
}

/** Save GB per member (step 2). The total may not exceed the pool. */
export async function saveAllocations(allocations: Record<string, number>): Promise<ActionResult> {
  const plan = await readPlan();

  const members = plan.members.map((m) => ({ ...m, allocatedGb: allocations[m.id] ?? m.allocatedGb }));
  if (Object.keys(allocations).some((id) => !plan.members.some((m) => m.id === id)))
    return { error: "Someone was removed from the household. Reload and try again." };
  if (members.some((m) => !Number.isFinite(m.allocatedGb) || m.allocatedGb < 0))
    return { error: "Allocations must be zero or more." };

  const total = members.reduce((s, m) => s + m.allocatedGb, 0);
  if (total > plan.poolGb) return { error: `That's ${total} GB, but the pool is ${plan.poolGb} GB.` };

  await writePlan({ ...plan, members });
  redirect("/");
}

/** Put the demo back to the deck's family-of-five example. */
export async function resetDemo() {
  await resetPlan();
  redirect("/");
}
