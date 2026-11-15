import type { HouseholdSummary, PackagePreset, PriceTier } from "./types";

/**
 * Demo data used until Supabase is connected (and for presenting).
 * Mirrors the "Family of five" example from the deck (slide 6): 500 GB pool.
 * Prices are placeholders, matching supabase/seed.sql.
 */
export const demoPriceTiers: PriceTier[] = [
  { poolGb: 10, priceLkr: 990 },
  { poolGb: 20, priceLkr: 1690 },
  { poolGb: 50, priceLkr: 3490 },
  { poolGb: 100, priceLkr: 5990 },
  { poolGb: 200, priceLkr: 9490 },
  { poolGb: 500, priceLkr: 17990 },
];

export const demoPackages: PackagePreset[] = [
  { id: "solo", name: "Solo", poolGb: 100, lines: 1 },
  { id: "couple", name: "Couple", poolGb: 200, lines: 2 },
  { id: "family", name: "Family", poolGb: 500, lines: 5 },
];

export const demoHousehold: HouseholdSummary = {
  id: "demo",
  name: "Perera home",
  ownerName: "Nadeesha",
  pool: { sizeGb: 500, priceLkr: 17990, cycleStart: "2026-11-01", cycleEnd: "2026-12-01" },
  members: [
    { id: "home", label: "Home", kind: "home", role: "member", msisdn: "Air Fibre router", allocatedGb: 300, usedGb: 162.4, color: "var(--member-home)" },
    { id: "me", label: "Me", kind: "line", role: "owner", msisdn: "077 123 4567", allocatedGb: 60, usedGb: 31.2, color: "var(--member-1)" },
    { id: "partner", label: "Partner", kind: "line", role: "member", msisdn: "077 234 5678", allocatedGb: 50, usedGb: 18.9, color: "var(--member-2)" },
    { id: "kid1", label: "Kid 1", kind: "line", role: "member", msisdn: "076 345 6789", allocatedGb: 30, usedGb: 26.1, color: "var(--member-3)" },
    { id: "kid2", label: "Kid 2", kind: "line", role: "member", msisdn: "076 456 7890", allocatedGb: 30, usedGb: 9.8, color: "var(--member-4)" },
    { id: "kid3", label: "Kid 3", kind: "line", role: "member", msisdn: "076 567 8901", allocatedGb: 30, usedGb: 14.0, color: "var(--member-5)" },
  ],
};
