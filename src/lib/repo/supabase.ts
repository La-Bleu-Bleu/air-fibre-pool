import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { monthlyPrice } from "../pricing";
import { createClient } from "../supabase/server";
import type { Catalogue, DataRequest, Member } from "../types";
import { shapeHousehold } from "./shape";
import { UserError, type Repo } from "./types";

/*
 * Supabase storage. Reads go through row-level security; multi-row writes go through the
 * SQL functions in supabase/migrations, which check ownership and keep each change atomic.
 */

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: (data?.claims?.sub as string | undefined) ?? null };
}

/** The caller's active membership, or null if they aren't in a household yet. */
async function membership(supabase: SupabaseClient, uid: string | null) {
  if (!uid) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("id, household_id")
    .eq("profile_id", uid)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw toUserError(error);
  return data as { id: string; household_id: string } | null;
}

async function requireMembership() {
  const { supabase, uid } = await session();
  const me = await membership(supabase, uid);
  if (!me) throw new UserError("You're not in a household yet.");
  return { supabase, me };
}

function must<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toUserError(result.error);
  if (result.data === null) throw new UserError("Something went missing. Reload and try again.");
  return result.data;
}

/** Turn database errors into messages people can act on. Our SQL functions already raise readable ones. */
function toUserError(error: PostgrestError): Error {
  if (error.message.startsWith("Allocations (")) return new UserError("That's more than the pool. Free up some data first.");
  if (error.code === "23505" && error.message.includes("one_pending_request"))
    return new UserError("You already have a request waiting for the owner.");
  if (error.code === "42501") return new UserError("You don't have permission to do that.");
  if (error.code === "P0001" || error.code === "P0002" || error.code === "23505") return new UserError(error.message);
  console.error("Supabase error", error);
  return new Error(error.message);
}

export const supabaseRepo: Repo = {
  async getHousehold() {
    const { supabase, uid } = await session();
    const me = await membership(supabase, uid);
    if (!me) return null;
    const hid = me.household_id;

    const [household, members, pool, balances, requests, catalogue] = await Promise.all([
      supabase.from("households").select("id, name, owner_id").eq("id", hid).single(),
      supabase
        .from("household_members")
        .select("id, label, kind, role, status, msisdn")
        .eq("household_id", hid)
        .order("created_at"),
      supabase
        .from("pools")
        .select("size_gb, cycle_start, cycle_end")
        .eq("household_id", hid)
        .eq("status", "active")
        .single(),
      supabase.from("member_balances").select("member_id, allocated_gb, used_gb").eq("household_id", hid),
      supabase
        .from("data_requests")
        .select("id, member_id, gb, note, status, created_at")
        .eq("household_id", hid)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseRepo.getCatalogue(),
    ]);

    const h = must(household) as { id: string; name: string; owner_id: string };
    const owner = must(await supabase.from("profiles").select("display_name").eq("id", h.owner_id).single()) as {
      display_name: string;
    };
    const p = must(pool) as { size_gb: number; cycle_start: string; cycle_end: string };
    const bal = new Map(
      (must(balances) as { member_id: string; allocated_gb: number; used_gb: number }[]).map((b) => [b.member_id, b]),
    );

    const memberRows = must(members) as Omit<Member, "allocatedGb">[];
    const shapedMembers: Member[] = memberRows.map((m) => ({ ...m, allocatedGb: Number(bal.get(m.id)?.allocated_gb ?? 0) }));
    const usedGb = Object.fromEntries([...bal].map(([id, b]) => [id, Math.round(Number(b.used_gb) * 10) / 10]));

    const reqs = (
      must(requests) as { id: string; member_id: string; gb: number; note: string; status: DataRequest["status"]; created_at: string }[]
    ).map((r) => ({ id: r.id, memberId: r.member_id, gb: r.gb, note: r.note, status: r.status, createdAt: r.created_at }));

    return shapeHousehold({
      id: h.id,
      name: h.name,
      ownerName: owner.display_name || "Owner",
      poolGb: p.size_gb,
      priceLkr: monthlyPrice(catalogue, p.size_gb, shapedMembers.filter((m) => m.kind === "line").length),
      cycleStart: p.cycle_start,
      cycleEnd: p.cycle_end,
      members: shapedMembers,
      usedGb,
      requests: reqs,
      viewerId: me.id,
    });
  },

  async getInvites() {
    const { supabase, uid } = await session();
    if (!uid) return [];
    const rows = must(await supabase.rpc("my_invites")) as {
      member_id: string;
      label: string;
      household_name: string;
      owner_name: string;
    }[];
    return rows.map((r) => ({ memberId: r.member_id, label: r.label, householdName: r.household_name, ownerName: r.owner_name }));
  },

  async getCatalogue(): Promise<Catalogue> {
    const supabase = await createClient();
    const [tiers, packages, settings] = await Promise.all([
      supabase.from("price_tiers").select("pool_gb, price_lkr").order("pool_gb"),
      supabase.from("packages").select("id, name, pool_gb, lines").order("sort_order"),
      supabase.from("settings").select("key, value"),
    ]);
    const s = Object.fromEntries((must(settings) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    return {
      tiers: (must(tiers) as { pool_gb: number; price_lkr: number }[]).map((t) => ({ poolGb: t.pool_gb, priceLkr: t.price_lkr })),
      packages: (must(packages) as { id: string; name: string; pool_gb: number; lines: number }[]).map((p) => ({
        id: p.id,
        name: p.name,
        poolGb: p.pool_gb,
        lines: p.lines,
      })),
      extraLinePriceLkr: Number(s.extra_line_price_lkr ?? 0),
      maxLines: Number(s.max_lines ?? 6),
    };
  },

  async createHousehold(name, displayName) {
    const supabase = await createClient();
    must(await supabase.rpc("create_household", { p_name: name, p_display_name: displayName, p_pool_gb: 100 }));
  },

  async savePlan(poolGb, lines) {
    const { supabase, me } = await requireMembership();
    const result = await supabase.rpc("save_plan", {
      p_household: me.household_id,
      p_pool_gb: poolGb,
      p_lines: lines.map((l) => ({ id: l.id ?? null, label: l.label, msisdn: l.id ? null : l.msisdn })),
    });
    if (result.error) throw toUserError(result.error);
  },

  async saveAllocations(allocations) {
    const { supabase, me } = await requireMembership();
    const result = await supabase.rpc("save_allocations", { p_household: me.household_id, p_allocations: allocations });
    if (result.error) throw toUserError(result.error);
  },

  async removeMember(memberId) {
    const { supabase } = await requireMembership();
    const deleted = must(await supabase.from("household_members").delete().eq("id", memberId).select("id"));
    if (deleted.length === 0) throw new UserError("That person is no longer in the household.");
  },

  async respondToRequest(requestId, approve) {
    const { supabase } = await requireMembership();
    const result = await supabase.rpc("respond_to_data_request", { request_id: requestId, approve });
    if (result.error) throw toUserError(result.error);
  },

  async requestData(gb, note) {
    const { supabase, me } = await requireMembership();
    const result = await supabase
      .from("data_requests")
      .insert({ household_id: me.household_id, member_id: me.id, gb, note });
    if (result.error) throw toUserError(result.error);
  },

  async respondToInvite(memberId, accept) {
    const supabase = await createClient();
    const result = await supabase.rpc("respond_to_invite", { member_id: memberId, accept });
    if (result.error) throw toUserError(result.error);
  },

  async simulateUsage() {
    const { supabase, me } = await requireMembership();
    const result = await supabase.rpc("simulate_usage", { p_household: me.household_id });
    if (result.error) throw toUserError(result.error);
  },
};
