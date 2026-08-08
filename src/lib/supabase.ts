import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredPublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_URL = (configuredUrl || "http://127.0.0.1:54321").replace(
  /\/$/,
  "",
);
export const SUPABASE_PUBLISHABLE_KEY =
  configuredPublishableKey || "missing-publishable-key";
export const SUPABASE_FUNCTION_NAME =
  import.meta.env.VITE_SUPABASE_FUNCTION_NAME?.trim() || "ruanguji-api";

export const isSupabaseConfigured = Boolean(configuredUrl && configuredPublishableKey);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Sesi aplikasi disimpan oleh src/lib/session.ts agar pilihan "ingat saya"
    // tetap bekerja seperti sebelumnya.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
