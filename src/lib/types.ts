export type MemberKind = "home" | "line";
export type MemberRole = "owner" | "member";
export type MemberStatus = "active" | "invited";
export type RequestStatus = "pending" | "approved" | "declined";

/** A connection in the household as stored (no derived fields). */
export interface Member {
  id: string;
  label: string; // the owner's name for this connection: "Home", "Me", "Kid 1"
  kind: MemberKind;
  role: MemberRole;
  status: MemberStatus;
  msisdn: string | null;
  allocatedGb: number;
}

/** A member plus this cycle's usage and display fields. */
export interface MemberBalance extends Member {
  usedGb: number;
  color: string; // CSS colour value
  displayLabel: string; // label as seen by the current viewer ("Me" → owner's name for members)
}

/** A member asking the owner for more data. */
export interface DataRequest {
  id: string;
  memberId: string;
  gb: number;
  note: string;
  status: RequestStatus;
  createdAt: string; // ISO timestamp
}

export interface Viewer {
  memberId: string;
  isOwner: boolean;
  name: string; // for greetings
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
  requests: DataRequest[]; // newest first
  viewer: Viewer;
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
