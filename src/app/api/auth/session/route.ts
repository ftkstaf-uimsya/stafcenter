import { NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { isServerSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const serverReady = isServerSupabaseConfigured();
  if (!serverReady) {
    return NextResponse.json(
      { user: null, serverConfigured: false },
      { status: 200 }
    );
  }

  const session = await getVerifiedServerSession();
  if (!session) {
    const res = NextResponse.json(
      { user: null, serverConfigured: true },
      { status: 200 }
    );
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  return NextResponse.json(
    {
      user: {
        id: session.id,
        username: session.username,
        fullName: session.fullName,
        email: session.email,
        role: session.role,
        allowedPages: session.allowedPages,
      },
      serverConfigured: true,
    },
    { status: 200 }
  );
}
