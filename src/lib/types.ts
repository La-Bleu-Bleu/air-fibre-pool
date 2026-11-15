export type MemberKind = "home" | "line";
export type MemberRole = "owner" | "member";

export interface MemberBalance {
  id: string;
  label: string;
  kind: MemberKind;
  role: MemberRole;
  msisdn: string | null;
  allocatedGb: number;
  usedGb: number;
  color: string; // CSS colour token
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
