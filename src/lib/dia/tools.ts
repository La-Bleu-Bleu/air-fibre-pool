import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { formatGb, formatLkr } from "../format";
import { formatMsisdn, monthlyPrice, normaliseMsisdn } from "../pricing";
import type { Catalogue, HouseholdSummary } from "../types";
import type { DiaProposal } from "./types";

/*
 * Dia's tools. None of them change anything: each validates the model's request against the real
 * household and turns it into a proposal the user confirms in the app (which then calls the normal
 * server action, with the normal permission checks). Invalid requests come back to the model as errors.
 */

const ChangeAllocations = z.object({
  changes: z.array(z.object({ member_id: z.string(), gb: z.number().int().min(0) })).min(1),
});
const ChangePlan = z.object({
  pool_gb: z.number().int().nullable(),
  add_lines: z.array(z.object({ name: z.string(), mobile_number: z.string() })),
  remove_member_ids: z.array(z.string()),
});
const DecideRequest = z.object({ request_id: z.string(), approve: z.boolean() });
const RequestMoreData = z.object({ gb: z.number().int().min(1), note: z.string() });

const ownerTools: Anthropic.Beta.BetaTool[] = [
  {
    name: "change_allocations",
    description:
      "Prepare new allocations (absolute GB per connection) for the owner to confirm. Include every connection whose allocation changes; others stay as they are. The total must fit in the pool.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["changes"],
      properties: {
        changes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["member_id", "gb"],
            properties: {
              member_id: { type: "string", description: "member_id from the account snapshot" },
              gb: { type: "integer", description: "New allocation in GB (0 or more)" },
            },
          },
        },
      },
    },
  },
  {
    name: "change_plan",
    description:
      "Prepare a plan change for the owner to confirm: a new pool size and/or adding or removing mobile lines. New lines are invited to join. Use null for pool_gb to keep the current size.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["pool_gb", "add_lines", "remove_member_ids"],
      properties: {
        pool_gb: { type: ["integer", "null"], description: "One of the available pool sizes in GB, or null for no change" },
        add_lines: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "mobile_number"],
            properties: {
              name: { type: "string", description: "Short name for the line, e.g. Amma" },
              mobile_number: { type: "string", description: "Sri Lankan or Malaysian mobile number" },
            },
          },
        },
        remove_member_ids: { type: "array", items: { type: "string" }, description: "member_ids of mobile lines to remove" },
      },
    },
  },
  {
    name: "decide_request",
    description: "Prepare approving or declining a member's data request, for the owner to confirm.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["request_id", "approve"],
      properties: {
        request_id: { type: "string", description: "request_id from the account snapshot (must be pending)" },
        approve: { type: "boolean" },
      },
    },
  },
];

const memberTools: Anthropic.Beta.BetaTool[] = [
  {
    name: "request_more_data",
    description: "Prepare a request to the household owner for more data, for the member to confirm.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["gb", "note"],
      properties: {
        gb: { type: "integer", description: "How many GB to ask for" },
        note: { type: "string", description: "Short reason, or empty string" },
      },
    },
  },
];

export const toolsFor = (isOwner: boolean) => (isOwner ? ownerTools : memberTools);

export type ToolOutcome = { proposal: DiaProposal } | { error: string };

/** Validate one tool call against the household and turn it into a proposal (or an error for the model). */
export function buildProposal(name: string, input: unknown, h: HouseholdSummary, catalogue: Catalogue): ToolOutcome {
  const isOwner = h.viewer.isOwner;
  const byId = new Map(h.members.map((m) => [m.id, m]));
  const id = `p-${crypto.randomUUID().slice(0, 8)}`;

  if (name === "change_allocations" && isOwner) {
    const parsed = ChangeAllocations.safeParse(input);
    if (!parsed.success) return { error: "Invalid input. Give member_id and whole GB for each change." };
    const allocations = Object.fromEntries(h.members.map((m) => [m.id, m.allocatedGb]));
    const lines: string[] = [];
    for (const c of parsed.data.changes) {
      const m = byId.get(c.member_id);
      if (!m) return { error: `Unknown member_id ${c.member_id}.` };
      if (allocations[m.id] !== c.gb) lines.push(`${m.displayLabel}: ${formatGb(m.allocatedGb)} → ${formatGb(c.gb)}`);
      allocations[m.id] = c.gb;
    }
    const total = Object.values(allocations).reduce((s, v) => s + v, 0);
    if (total > h.pool.sizeGb)
      return { error: `That totals ${total} GB but the pool is ${h.pool.sizeGb} GB. Take some from another connection in the same call.` };
    if (lines.length === 0) return { error: "Those are already the current allocations." };
    lines.push(`Unallocated after: ${formatGb(h.pool.sizeGb - total)}`);
    return { proposal: { id, kind: "allocations", title: "Change allocations", lines, allocations } };
  }

  if (name === "change_plan" && isOwner) {
    const parsed = ChangePlan.safeParse(input);
    if (!parsed.success) return { error: "Invalid input." };
    const { pool_gb, add_lines, remove_member_ids } = parsed.data;
    const poolGb = pool_gb ?? h.pool.sizeGb;
    if (!catalogue.tiers.some((t) => t.poolGb === poolGb))
      return { error: `Pool size must be one of: ${catalogue.tiers.map((t) => t.poolGb).join(", ")} GB.` };

    const lines: string[] = [];
    const current = h.members.filter((m) => m.kind === "line");
    for (const rid of remove_member_ids) {
      const m = byId.get(rid);
      if (!m || m.kind !== "line") return { error: `member_id ${rid} isn't a mobile line in this household.` };
      if (m.role === "owner") return { error: "The owner's line can't be removed." };
      lines.push(`Remove ${m.displayLabel}${m.allocatedGb ? ` (their ${formatGb(m.allocatedGb)} returns to the pool)` : ""}`);
    }
    const kept = current.filter((m) => !remove_member_ids.includes(m.id));
    const seen = new Set(kept.map((m) => m.msisdn));
    const added: { label: string; msisdn: string }[] = [];
    for (const l of add_lines) {
      const msisdn = normaliseMsisdn(l.mobile_number);
      const label = l.name.trim().slice(0, 20);
      if (!label) return { error: "Each new line needs a name." };
      if (!msisdn) return { error: `${l.mobile_number} isn't a valid Sri Lankan or Malaysian mobile number.` };
      if (seen.has(msisdn)) return { error: `${formatMsisdn(msisdn)} is already in the household.` };
      seen.add(msisdn);
      added.push({ label, msisdn });
      lines.push(`Add ${label} (${formatMsisdn(msisdn)}), invited to join`);
    }
    const lineCount = kept.length + added.length;
    if (lineCount > catalogue.maxLines) return { error: `A household can have at most ${catalogue.maxLines} mobile lines.` };
    if (poolGb !== h.pool.sizeGb) lines.unshift(`Pool: ${h.pool.sizeGb} GB → ${poolGb} GB`);
    if (lines.length === 0) return { error: "That's the same as the current plan." };

    const allocated = h.members.filter((m) => !remove_member_ids.includes(m.id)).reduce((s, m) => s + m.allocatedGb, 0);
    if (allocated > poolGb) lines.push(`Allocations will shrink proportionally to fit ${poolGb} GB`);
    const newPrice = monthlyPrice(catalogue, poolGb, lineCount);
    lines.push(`Price: ${formatLkr(h.pool.priceLkr)} → ${formatLkr(newPrice)}/month`);

    return {
      proposal: {
        id,
        kind: "plan",
        title: "Change plan",
        lines,
        poolGb,
        planLines: [
          ...kept.map((m) => ({ id: m.id, label: m.label, msisdn: m.msisdn ?? "" })),
          ...added.map((a) => ({ label: a.label, msisdn: a.msisdn })),
        ],
      },
    };
  }

  if (name === "decide_request" && isOwner) {
    const parsed = DecideRequest.safeParse(input);
    if (!parsed.success) return { error: "Invalid input." };
    const r = h.requests.find((x) => x.id === parsed.data.request_id);
    if (!r || r.status !== "pending") return { error: "That request isn't pending (or doesn't exist)." };
    const who = byId.get(r.memberId)?.displayLabel ?? "Member";
    const unallocated = h.pool.sizeGb - h.members.reduce((s, m) => s + m.allocatedGb, 0);
    if (parsed.data.approve && unallocated < r.gb)
      return {
        error: `Only ${unallocated} GB is unallocated, so approving ${r.gb} GB would fail. Suggest freeing space with change_allocations first.`,
      };
    return {
      proposal: {
        id,
        kind: "request_decision",
        title: parsed.data.approve ? `Give ${who} ${formatGb(r.gb)}` : `Decline ${who}'s request`,
        lines: [`${who} asked for ${formatGb(r.gb)}${r.note ? `: "${r.note}"` : ""}`],
        requestId: r.id,
        approve: parsed.data.approve,
      },
    };
  }

  if (name === "request_more_data" && !isOwner) {
    const parsed = RequestMoreData.safeParse(input);
    if (!parsed.success) return { error: "Invalid input." };
    const me = byId.get(h.viewer.memberId)!;
    if (me.status !== "active") return { error: "They need to accept the household invite first." };
    if (h.requests.some((r) => r.memberId === me.id && r.status === "pending"))
      return { error: "They already have a request waiting for the owner." };
    if (parsed.data.gb > h.pool.sizeGb) return { error: `That's more than the whole ${h.pool.sizeGb} GB pool.` };
    const note = parsed.data.note.trim().slice(0, 120);
    return {
      proposal: {
        id,
        kind: "data_request",
        title: `Ask ${h.ownerName} for ${formatGb(parsed.data.gb)}`,
        lines: note ? [`Note: "${note}"`] : [],
        gb: parsed.data.gb,
        note,
      },
    };
  }

  return { error: `The ${name} tool isn't available to this user.` };
}
