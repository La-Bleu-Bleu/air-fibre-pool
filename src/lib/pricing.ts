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

/**
 * Sri Lankan mobile number typed as 077 123 4567, +94 77 123 4567 or 94771234567.
 * Returns the number the way Supabase Auth stores phones (country code, no "+"): 94771234567. Null if invalid.
 */
export function normaliseMsisdn(input: string) {
  const digits = input.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("94") ? `0${digits.slice(2)}` : digits;
  return /^07\d{8}$/.test(local) ? `94${local.slice(1)}` : null;
}

/** 94771234567 → "077 123 4567" */
export function formatMsisdn(msisdn: string) {
  const local = msisdn.startsWith("94") ? `0${msisdn.slice(2)}` : msisdn;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
