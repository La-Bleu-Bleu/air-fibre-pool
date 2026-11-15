export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until .env.local is filled in; the app then falls back to demo data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
