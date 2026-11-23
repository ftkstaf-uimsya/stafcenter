import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { normalizeAllowedPages } from "@/lib/auth/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StaffRole } from "@/types/sarpras";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function recordFailedAttempt(key: string): { count: number; resetAt: number } {
  const now = Date.now();
  const current = failedLoginAttempts.get(key);
  if (!current || now >= current.resetAt) {
    const entry = { count: 1, resetAt: now + LOGIN_WINDOW_MS };
    failedLoginAttempts.set(key, entry);
    return entry;
  }
  current.count += 1;
  failedLoginAttempts.set(key, current);
  return current;
}

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

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

    const rateKey = `${getClientIp(request)}:${username.toLowerCase()}`;
    const existingAttempt = failedLoginAttempts.get(rateKey);
    const now = Date.now();
    if (existingAttempt && now >= existingAttempt.resetAt) {
      failedLoginAttempts.delete(rateKey);
    } else if (existingAttempt && existingAttempt.count >= LOGIN_MAX_ATTEMPTS) {
      const retrySeconds = Math.max(
        1,
        Math.ceil((existingAttempt.resetAt - now) / 1000)
      );
      return NextResponse.json(
        {
          error:
            "Terlalu banyak percobaan masuk yang gagal. Silakan tunggu beberapa menit sebelum mencoba kembali.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(retrySeconds) },
        }
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
        { error: "Gagal memverifikasi akun pada layanan autentikasi." },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      recordFailedAttempt(rateKey);
      return NextResponse.json(
        { error: "Username atau kata sandi tidak cocok, atau akun nonaktif." },
        { status: 401 }
      );
    }

    failedLoginAttempts.delete(rateKey);

    const role = row.role as StaffRole;
    const userPayload = {
      id: row.id as string,
      username: row.username as string,
      fullName: row.full_name as string,
      email: (row.email as string | null) || "",
      role,
      allowedPages: normalizeAllowedPages(
        role,
        (row as { allowed_pages?: unknown }).allowed_pages
      ),
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
