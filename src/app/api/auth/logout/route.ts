import { NextRequest, NextResponse } from "next/server";
import {
  invalidateStaffSessionCache,
  SESSION_COOKIE_NAME,
  verifySameOriginRequest,
  verifySessionToken,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(rawToken);
  if (parsed?.id) {
    invalidateStaffSessionCache(parsed.id);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
