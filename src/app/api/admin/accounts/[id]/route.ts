import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StaffRole } from "@/types/sarpras";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
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
      { error: "Hanya Master Admin yang berhak mengedit akun staf." },
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

  const { id: targetId } = await context.params;

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("staff_accounts")
      .select("id, username, role, is_active")
      .eq("id", targetId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: "Akun staf tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      username?: string;
      full_name?: string;
      email?: string;
      role?: StaffRole;
      is_active?: boolean;
      new_password?: string;
    };

    const username = (body.username || "").trim().toLowerCase();
    const fullName = (body.full_name || "").trim();
    const email = (body.email || "").trim();
    const role: StaffRole =
      body.role === "master_admin" ? "master_admin" : "staff";
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : existing.is_active;
    const newPassword = body.new_password || "";

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

    if (newPassword && newPassword.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi baru minimal 8 karakter." },
        { status: 400 }
      );
    }

    // Proteksi akun Master Admin utama ('staf') dan sesi aktif sendiri
    if (existing.username === "staf") {
      if (username !== "staf") {
        return NextResponse.json(
          { error: "Username akun Master Admin utama ('staf') tidak dapat diubah." },
          { status: 400 }
        );
      }
      if (role !== "master_admin" || !isActive) {
        return NextResponse.json(
          {
            error:
              "Akun Master Admin utama ('staf') tidak boleh diturunkan perannya atau dinonaktifkan.",
          },
          { status: 400 }
        );
      }
    }

    if (targetId === session.id && !isActive) {
      return NextResponse.json(
        { error: "Anda tidak dapat menonaktifkan akun yang sedang dipakai masuk." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("fn_update_staff_account", {
      p_id: targetId,
      p_username: username,
      p_full_name: fullName,
      p_email: email,
      p_role: role,
      p_is_active: isActive,
      p_new_password: newPassword || null,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
        return NextResponse.json(
          { error: `Username "${username}" sudah dipakai akun lain.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const account = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ account }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Payload pembaruan akun tidak valid." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
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
      { error: "Hanya Master Admin yang berhak menghapus akun staf." },
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

  const { id: targetId } = await context.params;
  if (targetId === session.id) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun yang sedang Anda gunakan." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("staff_accounts")
    .select("id, username")
    .eq("id", targetId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "Akun staf tidak ditemukan." },
      { status: 404 }
    );
  }

  if (existing.username === "staf") {
    return NextResponse.json(
      { error: "Akun Master Admin utama ('staf') dilindungi dan tidak dapat dihapus." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("staff_accounts")
    .delete()
    .eq("id", targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
