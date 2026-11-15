import type { Catalogue, HouseholdSummary, Member } from "./types";

/**
 * Demo data used until Supabase is connected (and for presenting).
 * Mirrors the "Family of five" example from the deck (slide 6): 500 GB pool.
 * Prices are placeholders, matching supabase/seed.sql.
 */
export const demoCatalogue: Catalogue = {
  tiers: [
    { poolGb: 10, priceLkr: 990 },
    { poolGb: 20, priceLkr: 1690 },
    { poolGb: 50, priceLkr: 3490 },
    { poolGb: 100, priceLkr: 5990 },
    { poolGb: 200, priceLkr: 9490 },
    { poolGb: 500, priceLkr: 17990 },
  ],
  packages: [
    { id: "solo", name: "Solo", poolGb: 100, lines: 1 },
    { id: "couple", name: "Couple", poolGb: 200, lines: 2 },
    { id: "family", name: "Family", poolGb: 500, lines: 5 },
  ],
  extraLinePriceLkr: 290,
  maxLines: 6,
};

export const demoMembers: Member[] = [
  { id: "home", label: "Home", kind: "home", role: "member", status: "active", msisdn: null, allocatedGb: 300 },
  { id: "me", label: "Me", kind: "line", role: "owner", status: "active", msisdn: "0771234567", allocatedGb: 60 },
  { id: "partner", label: "Partner", kind: "line", role: "member", status: "active", msisdn: "0772345678", allocatedGb: 50 },
  { id: "kid1", label: "Kid 1", kind: "line", role: "member", status: "active", msisdn: "0763456789", allocatedGb: 30 },
  { id: "kid2", label: "Kid 2", kind: "line", role: "member", status: "active", msisdn: "0764567890", allocatedGb: 30 },
  { id: "kid3", label: "Kid 3", kind: "line", role: "member", status: "active", msisdn: "0765678901", allocatedGb: 30 },
];

/** Simulated usage so far this cycle, by member id. New lines start at 0. */
export const demoUsageGb: Record<string, number> = {
  home: 162.4,
  me: 31.2,
  partner: 18.9,
  kid1: 26.1,
  kid2: 9.8,
  kid3: 14.0,
};

export const demoHouseholdMeta: Omit<HouseholdSummary, "members" | "pool"> & {
  cycleStart: string;
  cycleEnd: string;
} = {
  id: "demo",
  name: "Perera home",
  ownerName: "Nadeesha",
  cycleStart: "2026-11-01",
  cycleEnd: "2026-12-01",
};

export const demoPoolGb = 500;
