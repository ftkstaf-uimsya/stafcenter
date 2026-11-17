import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function isServerSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return (
    Boolean(url) &&
    Boolean(serviceKey) &&
    !url.includes("your-project") &&
    !serviceKey.includes("your-")
  );
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isServerSupabaseConfigured()) {
    return null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
