import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "stafcenter_session";
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isLiveSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return (
    Boolean(url) &&
    Boolean(anonKey) &&
    !url.includes("your-project") &&
    !anonKey.includes("your-")
  );
}

function hasValidUnexpiredCookieShape(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  try {
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    const parsed = JSON.parse(atob(padded)) as {
      id?: string;
      username?: string;
      exp?: number;
    };
    if (!parsed.id || !parsed.username || typeof parsed.exp !== "number") {
      return false;
    }
    return Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
    if (fetchSite === "cross-site") {
      return NextResponse.json(
        { error: "Permintaan lintas situs (CSRF) ditolak oleh server." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin");
    const rawHost =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (origin && rawHost) {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        const targetHost = rawHost.split(",")[0].trim().toLowerCase();
        if (originHost !== targetHost) {
          return NextResponse.json(
            { error: "Permintaan lintas situs (CSRF) ditolak oleh server." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Header Origin permintaan tidak valid." },
          { status: 403 }
        );
      }
    }
  }

  if (
    (pathname.startsWith("/sarpras") || pathname.startsWith("/tugas-akhir")) &&
    isLiveSupabaseConfigured()
  ) {
    const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!hasValidUnexpiredCookieShape(rawCookie)) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/sarpras/:path*", "/tugas-akhir/:path*"],
};
