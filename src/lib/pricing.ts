import type { Catalogue } from "./types";

/**
 * Monthly price = pool tier price + a flat add-on per mobile line.
 * The home router is always included. All numbers are placeholders (see supabase/seed.sql).
 */
export function monthlyPrice(catalogue: Catalogue, poolGb: number, lines: number) {
  const tier = catalogue.tiers.find((t) => t.poolGb === poolGb);
  if (!tier) throw new Error(`No price tier for ${poolGb} GB`);
  return tier.priceLkr + lines * catalogue.extraLinePriceLkr;
}

/** Slider step for allocations: coarse on big pools, fine on small ones. */
export const allocationStep = (poolGb: number) => (poolGb >= 100 ? 5 : 1);

/** Sri Lankan mobile number: 07X XXX XXXX (spaces/dashes ignored). Returns normalised digits or null. */
export function normaliseMsisdn(input: string) {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+94/, "0");
  return /^07\d{8}$/.test(digits) ? digits : null;
}

export const formatMsisdn = (digits: string) =>
  `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
