import { isSupabaseConfigured } from "./supabase/env";

/**
 * Demo mode: no sign-in, data lives in a cookie, and a "view as" switch lets you play every role.
 * On when Supabase isn't configured, or forced with NEXT_PUBLIC_DEMO_MODE=true (handy for presenting).
 */
export const isDemoMode = !isSupabaseConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
