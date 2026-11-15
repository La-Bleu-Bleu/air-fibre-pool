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

/*
 * Mobile numbers. Supported for this prototype:
 *   Sri Lanka  07X XXX XXXX                    → stored 947XXXXXXXX
 *   Malaysia   01X-XXX XXXX / 011-XXXX XXXX    → stored 601XXXXXXXX(X)
 * The local prefixes (07 vs 01) don't overlap, so the country is inferred from what's typed.
 * Stored like Supabase Auth stores phones: country code, no "+". Keep in sync with save_plan() in SQL.
 */
const countries = [
  { code: "94", local: /^07\d{8}$/ },
  { code: "60", local: /^01\d{8,9}$/ },
];

/** Example numbers for placeholders and error messages. */
export const PHONE_EXAMPLE = "077 123 4567 or 012-345 6789";

/** Accepts local or international input (spaces, dashes, "+" all fine). Returns e.g. 94771234567, or null. */
export function normaliseMsisdn(input: string) {
  const digits = input.replace(/[\s().-]/g, "").replace(/^\+/, "");
  for (const c of countries) {
    const local = digits.startsWith(c.code) ? `0${digits.slice(c.code.length)}` : digits;
    if (c.local.test(local)) return `${c.code}${local.slice(1)}`;
  }
  return null;
}

/** 94771234567 → "077 123 4567"; 60123456789 → "012-345 6789"; 601123456789 → "011-2345 6789". */
export function formatMsisdn(msisdn: string) {
  if (msisdn.startsWith("60")) {
    const l = `0${msisdn.slice(2)}`;
    return l.length === 11 ? `${l.slice(0, 3)}-${l.slice(3, 7)} ${l.slice(7)}` : `${l.slice(0, 3)}-${l.slice(3, 6)} ${l.slice(6)}`;
  }
  const l = msisdn.startsWith("94") ? `0${msisdn.slice(2)}` : msisdn;
  return `${l.slice(0, 3)} ${l.slice(3, 6)} ${l.slice(6)}`;
}
