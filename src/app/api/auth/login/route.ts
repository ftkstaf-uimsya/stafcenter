import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StaffRole } from "@/types/sarpras";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Konfigurasi server SUPABASE_SERVICE_ROLE_KEY belum dipasang pada environment.",
        },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.rpc("fn_verify_staff_login", {
      p_username: username,
      p_password: password,
    });

    if (error) {
      const msg = error.message || "";
      if (
        msg.includes("fn_verify_staff_login") ||
        msg.includes("staff_accounts")
      ) {
        return NextResponse.json(
          {
            error:
              "Tabel atau fungsi staff_accounts belum dimigrasikan di Supabase. Jalankan supabase/migrations/002_staff_accounts.sql di SQL Editor Supabase.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Gagal memverifikasi akun: ${error.message}` },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json(
        { error: "Username atau kata sandi tidak cocok, atau akun nonaktif." },
        { status: 401 }
      );
    }

    const userPayload = {
      id: row.id as string,
      username: row.username as string,
      fullName: row.full_name as string,
      email: (row.email as string | null) || "",
      role: row.role as StaffRole,
    };

    const token = createSessionToken(userPayload);
    const response = NextResponse.json({ user: userPayload }, { status: 200 });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Permintaan masuk tidak valid." },
      { status: 400 }
    );
  }
}
