import { NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isMissingWorkspaceRelation(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("staff_workspace_") || msg.includes("staff_pomodoro_sessions");
}

function buildDefaultPreferences(staffId: string) {
  return {
    staff_id: staffId,
    weather_city: process.env.NEXT_PUBLIC_CAMPUS_CITY || "Jakarta",
    weather_lat: Number(process.env.NEXT_PUBLIC_CAMPUS_LAT) || -6.2088,
    weather_lon: Number(process.env.NEXT_PUBLIC_CAMPUS_LON) || 106.8456,
    room_theme: "auto",
    reduce_motion: false,
    pet_enabled: true,
    pet_name: "Oyen",
    sound_enabled: true,
    pomodoro_focus_min: 25,
    pomodoro_short_min: 5,
    pomodoro_long_min: 15,
    widget_layout: {},
  };
}

export async function GET() {
  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi staf diperlukan untuk membuka Meja Kerja." },
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

  const [prefRes, todoRes, noteRes, journalRes, eventRes, pomoRes] =
    await Promise.all([
      supabase
        .from("staff_workspace_preferences")
        .select("*")
        .eq("staff_id", session.id)
        .maybeSingle(),
      supabase
        .from("staff_workspace_todos")
        .select("*")
        .eq("staff_id", session.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_workspace_notes")
        .select("*")
        .eq("staff_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_workspace_journals")
        .select("*")
        .eq("staff_id", session.id)
        .order("entry_date", { ascending: false })
        .limit(90),
      supabase
        .from("staff_workspace_events")
        .select("*")
        .eq("staff_id", session.id)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("staff_pomodoro_sessions")
        .select("*")
        .eq("staff_id", session.id)
        .order("completed_at", { ascending: false })
        .limit(100),
    ]);

  const anyMissing = [
    prefRes.error,
    todoRes.error,
    noteRes.error,
    journalRes.error,
    eventRes.error,
    pomoRes.error,
  ].some((err) => isMissingWorkspaceRelation(err));

  if (anyMissing) {
    return NextResponse.json(
      {
        migrationMissing: true,
        preferences: buildDefaultPreferences(session.id),
        todos: [],
        notes: [],
        journals: [],
        events: [],
        pomodoroSessions: [],
      },
      { status: 200 }
    );
  }

  const hardErr =
    prefRes.error ||
    todoRes.error ||
    noteRes.error ||
    journalRes.error ||
    eventRes.error ||
    pomoRes.error;

  if (hardErr) {
    return NextResponse.json(
      { error: "Gagal memuat data Meja Kerja staf." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      migrationMissing: false,
      preferences: prefRes.data || buildDefaultPreferences(session.id),
      todos: todoRes.data || [],
      notes: noteRes.data || [],
      journals: journalRes.data || [],
      events: eventRes.data || [],
      pomodoroSessions: pomoRes.data || [],
    },
    { status: 200 }
  );
}
