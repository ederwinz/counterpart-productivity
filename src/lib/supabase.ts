import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Falls back to null (rather than throwing) when the env vars aren't set yet —
// e.g. before .env is configured with a real Supabase project. Callers must
// check for null before using it.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
