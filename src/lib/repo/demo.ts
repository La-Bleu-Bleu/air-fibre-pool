import "server-only";
import { demoCatalogue, demoHouseholdMeta, demoUsageGb } from "../demo-data";
import { readPlan, readViewerId, writePlan, type DemoPlan } from "../demo-store";
import { monthlyPrice } from "../pricing";
import type { Member } from "../types";
import { shapeHousehold } from "./shape";
import { UserError, type Repo } from "./types";

/** Demo storage: one household in a cookie, with a "view as" switch standing in for sign-in. */
export const demoRepo: Repo = {
  async getHousehold() {
    const plan = await readPlan();
    const viewerId = await readViewerId(plan);
    return shapeHousehold({
      id: demoHouseholdMeta.id,
      name: demoHouseholdMeta.name,
      ownerName: demoHouseholdMeta.ownerName,
      poolGb: plan.poolGb,
      priceLkr: monthlyPrice(demoCatalogue, plan.poolGb, plan.members.filter((m) => m.kind === "line").length),
      cycleStart: demoHouseholdMeta.cycleStart,
      cycleEnd: demoHouseholdMeta.cycleEnd,
      members: plan.members,
      usedGb: demoUsageGb,
      requests: plan.requests,
      viewerId,
    });
  },

  async getInvites() {
    return []; // demo invites live inside the household (switch to the invited person)
  },

  async getCatalogue() {
    return demoCatalogue;
  },

  async getMyPhone() {
    return null;
  },

  async createHousehold() {
    throw new UserError("The demo already has a household. Use “Reset demo data” to start over.");
  },

  async savePlan(poolGb, lines) {
    const plan = await readPlan();
    const existing = new Map(plan.members.map((m) => [m.id, m]));

    const nextLines: Member[] = lines.map((line) => {
      const prev = line.id ? existing.get(line.id) : undefined;
      return prev
        ? { ...prev, label: line.label }
        : {
            id: `line-${crypto.randomUUID().slice(0, 8)}`,
            label: line.label,
            kind: "line",
            role: "member",
            status: "invited",
            msisdn: line.msisdn,
            allocatedGb: 0,
          };
    });

    const home = plan.members.find((m) => m.kind === "home")!;
    let members = [home, ...nextLines];
    const total = members.reduce((s, m) => s + m.allocatedGb, 0);
    if (total > poolGb) {
      const ratio = poolGb / total;
      members = members.map((m) => ({ ...m, allocatedGb: Math.floor(m.allocatedGb * ratio) }));
    }

    const kept = new Set(members.map((m) => m.id));
    await writePlan({ poolGb, members, requests: plan.requests.filter((r) => kept.has(r.memberId)) });
  },

  async saveAllocations(allocations) {
    const plan = await readPlan();
    await writePlan({
      ...plan,
      members: plan.members.map((m) => ({ ...m, allocatedGb: allocations[m.id] ?? m.allocatedGb })),
    });
  },

  async removeMember(memberId) {
    await writePlan(withoutMember(await readPlan(), memberId));
  },

  async respondToRequest(requestId, approve) {
    const plan = await readPlan();
    const request = plan.requests.find((r) => r.id === requestId)!;
    await writePlan({
      ...plan,
      members: approve
        ? plan.members.map((m) => (m.id === request.memberId ? { ...m, allocatedGb: m.allocatedGb + request.gb } : m))
        : plan.members,
      requests: plan.requests.map((r) =>
        r.id === requestId ? { ...r, status: approve ? ("approved" as const) : ("declined" as const) } : r,
      ),
    });
  },

  async requestData(gb, note) {
    const plan = await readPlan();
    const viewerId = await readViewerId(plan);
    const request = {
      id: `req-${crypto.randomUUID().slice(0, 8)}`,
      memberId: viewerId,
      gb,
      note,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    await writePlan({ ...plan, requests: [request, ...plan.requests] });
  },

  async respondToInvite(memberId, accept) {
    const plan = await readPlan();
    await writePlan(
      accept
        ? { ...plan, members: plan.members.map((m) => (m.id === memberId ? { ...m, status: "active" as const } : m)) }
        : withoutMember(plan, memberId),
    );
  },

  async simulateUsage() {
    throw new UserError("Usage is fixed in the demo.");
  },
};

function withoutMember(plan: DemoPlan, memberId: string): DemoPlan {
  return {
    ...plan,
    members: plan.members.filter((m) => m.id !== memberId),
    requests: plan.requests.filter((r) => r.memberId !== memberId),
  };
}
