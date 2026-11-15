import type { Catalogue, HouseholdSummary } from "../types";

/** An error whose message is safe and helpful to show the user. */
export class UserError extends Error {}

export interface Invite {
  memberId: string;
  label: string;
  householdName: string;
  ownerName: string;
}

export interface PlanLine {
  id?: string; // existing member; omitted for a new line
  label: string;
  msisdn: string; // normalised 947XXXXXXXX (ignored for existing lines)
}

/**
 * Storage behind the app. Validation that needs the household lives in the server actions;
 * implementations persist, and enforce permissions themselves (Supabase via RLS and SQL functions).
 */
export interface Repo {
  getHousehold(): Promise<HouseholdSummary | null>;
  getInvites(): Promise<Invite[]>;
  getCatalogue(): Promise<Catalogue>;

  createHousehold(name: string, displayName: string): Promise<void>;
  savePlan(poolGb: number, lines: PlanLine[]): Promise<void>;
  saveAllocations(allocations: Record<string, number>): Promise<void>;
  removeMember(memberId: string): Promise<void>;
  respondToRequest(requestId: string, approve: boolean): Promise<void>;
  requestData(gb: number, note: string): Promise<void>;
  respondToInvite(memberId: string, accept: boolean): Promise<void>;
  simulateUsage(): Promise<void>;
}
