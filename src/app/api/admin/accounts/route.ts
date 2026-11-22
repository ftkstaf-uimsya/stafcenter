import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  invalidateStaffSessionCache,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StaffRole } from "@/types/sarpras";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi staf tidak valid atau telah berakhir." },
      { status: 401 }
    );
  }
  if (session.role !== "master_admin") {
    return NextResponse.json(
      { error: "Hanya Master Admin yang berhak mengelola akun staf." },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfigurasi server Supabase belum lengkap." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id, username, full_name, email, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data || [] }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi staf tidak valid atau telah berakhir." },
      { status: 401 }
    );
  }
  if (session.role !== "master_admin") {
    return NextResponse.json(
      { error: "Hanya Master Admin yang berhak menambah akun staf." },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfigurasi server Supabase belum lengkap." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      full_name?: string;
      email?: string;
      role?: StaffRole;
      password?: string;
    };

    const username = (body.username || "").trim().toLowerCase();
    const fullName = (body.full_name || "").trim();
    const email = (body.email || "").trim();
    const role: StaffRole =
      body.role === "master_admin" ? "master_admin" : "staff";
    const password = body.password || "";

    if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username wajib 3-40 karakter (huruf kecil, angka, titik, garis bawah, atau hubung).",
        },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Nama lengkap petugas wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi awal minimal 8 karakter." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("fn_create_staff_account", {
      p_username: username,
      p_full_name: fullName,
      p_email: email,
      p_role: role,
      p_password: password,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
        return NextResponse.json(
          { error: `Username "${username}" sudah digunakan oleh akun lain.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const account = Array.isArray(data) ? data[0] : data;
    if (account?.id) {
      invalidateStaffSessionCache(String(account.id));
    }
    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Payload pembuatan akun tidak valid." },
      { status: 400 }
    );
  }
}
