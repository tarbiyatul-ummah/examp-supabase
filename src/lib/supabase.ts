import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const SUPABASE_URL = (configuredUrl || "http://127.0.0.1:54321").replace(
  /\/$/,
  "",
);
export const SUPABASE_ANON_KEY = configuredAnonKey || "missing-anon-key";
export const SUPABASE_FUNCTION_NAME =
  import.meta.env.VITE_SUPABASE_FUNCTION_NAME?.trim() || "ruanguji-api";

export const isSupabaseConfigured = Boolean(
  configuredUrl && configuredAnonKey,
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Sesi aplikasi disimpan oleh src/lib/session.ts agar pilihan "ingat saya"
    // tetap bekerja seperti sebelumnya.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
