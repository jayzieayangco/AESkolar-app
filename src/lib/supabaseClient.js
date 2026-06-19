import { createClient } from "@supabase/supabase-js";

/**
 * Normalizes the project URL to the base host only (no /rest/v1/ suffix).
 * @param {string | undefined} rawUrl
 * @returns {string | null}
 */
export function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  let url = rawUrl.trim();

  // Remove accidental REST path segments
  url = url.replace(/\/rest\/v1\/?$/i, "");
  url = url.replace(/\/+$/, "");

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }

  return url;
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing or invalid Supabase configuration. Set VITE_SUPABASE_URL (base project URL only, e.g. https://xxxx.supabase.co) and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: "public",
  },
});

export default supabase;
