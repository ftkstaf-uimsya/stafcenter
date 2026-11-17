import crypto from "node:crypto";
import { cookies } from "next/headers";
import { StaffRole } from "@/types/sarpras";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE_NAME = "stafcenter_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionStaffPayload {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
  exp: number;
}

function getSigningSecret(): string {
  const explicit = process.env.AUTH_SESSION_SECRET;
  if (explicit && explicit.length >= 16) {
    return explicit;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "stafcenter-dev-secret";
  return crypto
    .createHash("sha256")
    .update(`stafcenter-session:${serviceKey}`)
    .digest("hex");
}

function signTokenPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createSessionToken(
  user: Omit<SessionStaffPayload, "exp">
): string {
  const payload: SessionStaffPayload = {
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = signTokenPayload(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): SessionStaffPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expected = signTokenPayload(encoded);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionStaffPayload;
    if (!parsed.id || !parsed.username || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getVerifiedServerSession(): Promise<SessionStaffPayload | null> {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(rawToken);
  if (!parsed) return null;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  // Verifikasi akun masih aktif di tabel staff_accounts
  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id, username, full_name, email, role, is_active")
    .eq("id", parsed.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    id: data.id,
    username: data.username,
    fullName: data.full_name,
    email: data.email || "",
    role: data.role as StaffRole,
    exp: parsed.exp,
  };
}
