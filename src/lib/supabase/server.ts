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

let cachedServerClient: SupabaseClient | null = null;
let cachedConfigKey = "";

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isServerSupabaseConfigured()) {
    cachedServerClient = null;
    cachedConfigKey = "";
    return null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const configKey = `${url}|${serviceKey}`;
  if (!cachedServerClient || cachedConfigKey !== configKey) {
    cachedServerClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = configKey;
  }
  return cachedServerClient;
}
