import { NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi staf diperlukan untuk mengakses data." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfigurasi server Supabase belum lengkap." },
      { status: 503 }
    );
  }

  const [bRes, rRes, aRes, bkRes, mRes, cRes, ctRes] = await Promise.all([
    supabase.from("buildings").select("*").order("code"),
    supabase.from("rooms").select("*").order("code"),
    supabase.from("assets").select("*").order("inventory_code"),
    supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: false }),
    supabase
      .from("maintenance_logs")
      .select("*")
      .order("reported_at", { ascending: false }),
    supabase.from("consumables").select("*").order("code"),
    supabase
      .from("consumable_transactions")
      .select("*")
      .order("transaction_date", { ascending: false }),
  ]);

  const firstError =
    bRes.error ||
    rRes.error ||
    aRes.error ||
    bkRes.error ||
    mRes.error ||
    cRes.error ||
    ctRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  // Ambil catatan, lampiran, dan Data Master secara opsional (tidak menggagalkan aplikasi bila migrasi 003/005 belum dijalankan)
  const [notesRes, attachRes, lecturersRes, coursesRes, officialsRes] =
    await Promise.all([
      supabase
        .from("sarpras_notes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("sarpras_attachments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("lecturers").select("*").order("full_name"),
      supabase.from("courses").select("*").order("code"),
      supabase.from("campus_officials").select("*").order("official_code"),
    ]);

  return NextResponse.json(
    {
      buildings: bRes.data || [],
      rooms: rRes.data || [],
      assets: aRes.data || [],
      bookings: bkRes.data || [],
      maintenanceLogs: mRes.data || [],
      consumables: cRes.data || [],
      consumableTransactions: ctRes.data || [],
      notes: notesRes.error ? [] : notesRes.data || [],
      attachments: attachRes.error ? [] : attachRes.data || [],
      lecturers: lecturersRes.error ? [] : lecturersRes.data || [],
      courses: coursesRes.error ? [] : coursesRes.data || [],
      campusOfficials: officialsRes.error ? [] : officialsRes.data || [],
    },
    { status: 200 }
  );
}
