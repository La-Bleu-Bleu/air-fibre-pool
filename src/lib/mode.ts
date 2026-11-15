import { isSupabaseConfigured } from "./supabase/env";

/*
 * Two ways to use the app:
 * - Demo mode: no sign-in, the deck's fake household lives in a cookie, and a "view as" switch plays every role.
 * - Real mode: phone sign-in (prototype: code is always 123456) and data in Supabase.
 *
 * Visitors pick demo mode from the login screen (stored in DEMO_COOKIE). It's forced on when Supabase
 * isn't configured, or with NEXT_PUBLIC_DEMO_MODE=true (e.g. for a demo-only deployment).
 *
 * This file has no server-only imports so the proxy can use it; the per-request check is isDemo() in data.ts.
 */
export const DEMO_COOKIE = "afp-demo";
export const demoForced = !isSupabaseConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
