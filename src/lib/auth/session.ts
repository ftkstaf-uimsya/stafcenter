import crypto from "node:crypto";
import { cookies } from "next/headers";
import { normalizeAllowedPages } from "@/lib/auth/permissions";
import { SarprasPageKey, StaffRole } from "@/types/sarpras";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE_NAME = "stafcenter_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_VERIFY_TTL_MS = 30 * 1000;

export interface SessionStaffPayload {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
  allowedPages: SarprasPageKey[];
  exp: number;
}

const verifiedSessionCache = new Map<
  string,
  { data: Omit<SessionStaffPayload, "exp">; expiresAt: number }
>();

export function invalidateStaffSessionCache(staffId?: string): void {
  if (staffId) {
    verifiedSessionCache.delete(staffId);
  } else {
    verifiedSessionCache.clear();
  }
}

function getSigningSecret(): string {
  const explicit = process.env.AUTH_SESSION_SECRET;
  if (explicit && explicit.length >= 16) {
    return explicit;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (serviceKey && !serviceKey.includes("your-")) {
    return crypto
      .createHash("sha256")
      .update(`stafcenter-session:${serviceKey}`)
      .digest("hex");
  }
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return crypto
    .createHash("sha256")
    .update("stafcenter-session:stafcenter-dev-secret")
    .digest("hex");
}

function signTokenPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export function verifySameOriginRequest(
  request: Request
): { ok: true } | { ok: false; error: string } {
  const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return {
      ok: false,
      error: "Permintaan lintas situs (CSRF) ditolak oleh server.",
    };
  }

  const origin = request.headers.get("origin");
  const rawHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (origin && rawHost) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const targetHost = rawHost.split(",")[0].trim().toLowerCase();
      if (originHost !== targetHost) {
        return {
          ok: false,
          error: "Origin permintaan tidak sesuai dengan host server.",
        };
      }
    } catch {
      return {
        ok: false,
        error: "Header Origin permintaan tidak valid.",
      };
    }
  }

  return { ok: true };
}

export function createSessionToken(
  user: Omit<SessionStaffPayload, "exp">
): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET atau SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi di environment produksi."
    );
  }
  const payload: SessionStaffPayload = {
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = signTokenPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): SessionStaffPayload | null {
  if (!token) return null;
  const secret = getSigningSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expected = signTokenPayload(encoded, secret);
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
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(rawToken);
  if (!parsed) return null;

  const now = Date.now();
  const cached = verifiedSessionCache.get(parsed.id);
  if (cached && now < cached.expiresAt) {
    return {
      ...cached.data,
      exp: parsed.exp,
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  // Verifikasi akun masih aktif di tabel staff_accounts
  const { data, error } = await supabase
    .from("staff_accounts")
    .select("*")
    .eq("id", parsed.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    verifiedSessionCache.delete(parsed.id);
    return null;
  }

  const role = data.role as StaffRole;
  const staffData: Omit<SessionStaffPayload, "exp"> = {
    id: data.id,
    username: data.username,
    fullName: data.full_name,
    email: data.email || "",
    role,
    allowedPages: normalizeAllowedPages(
      role,
      (data as { allowed_pages?: unknown }).allowed_pages
    ),
  };

  verifiedSessionCache.set(parsed.id, {
    data: staffData,
    expiresAt: now + SESSION_VERIFY_TTL_MS,
  });

  return {
    ...staffData,
    exp: parsed.exp,
  };
}
