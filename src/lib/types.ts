export type MemberKind = "home" | "line";
export type MemberRole = "owner" | "member";
export type MemberStatus = "active" | "invited";

/** A connection in the household as stored (no derived fields). */
export interface Member {
  id: string;
  label: string;
  kind: MemberKind;
  role: MemberRole;
  status: MemberStatus;
  msisdn: string | null;
  allocatedGb: number;
}

/** A member plus this cycle's usage and display colour. */
export interface MemberBalance extends Member {
  usedGb: number;
  color: string; // CSS colour value
}

export interface HouseholdSummary {
  id: string;
  name: string;
  ownerName: string;
  pool: {
    sizeGb: number;
    priceLkr: number;
    cycleStart: string; // ISO date
    cycleEnd: string; // ISO date
  };
  members: MemberBalance[];
}

export interface PriceTier {
  poolGb: number;
  priceLkr: number;
}

export interface PackagePreset {
  id: string;
  name: string;
  poolGb: number;
  lines: number;
}

export interface Catalogue {
  tiers: PriceTier[];
  packages: PackagePreset[];
  extraLinePriceLkr: number;
  maxLines: number;
}
