import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type MutationPayload =
  | { action: "insert_building"; data: Record<string, unknown> }
  | { action: "insert_room"; data: Record<string, unknown> }
  | { action: "update_room"; id: string; data: Record<string, unknown> }
  | { action: "delete_room"; id: string }
  | { action: "insert_asset"; data: Record<string, unknown> }
  | { action: "update_asset"; id: string; data: Record<string, unknown> }
  | { action: "delete_asset"; id: string }
  | { action: "insert_booking"; data: Record<string, unknown> }
  | {
      action: "update_booking_status";
      id: string;
      data: Record<string, unknown>;
      roomId?: string | null;
      nextRoomStatus?: string | null;
    }
  | {
      action: "insert_maintenance";
      data: Record<string, unknown>;
      roomId?: string | null;
      setRoomRepair?: boolean;
    }
  | {
      action: "update_maintenance";
      id: string;
      data: Record<string, unknown>;
      roomId?: string | null;
      setRoomAvailable?: boolean;
    }
  | { action: "insert_consumable"; data: Record<string, unknown> }
  | { action: "insert_consumable_tx"; data: Record<string, unknown> }
  | { action: "insert_note"; data: Record<string, unknown> }
  | { action: "delete_attachment"; id: string; filePath?: string };

export async function POST(request: NextRequest) {
  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi staf tidak valid. Silakan masuk kembali." },
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

  try {
    const body = (await request.json()) as MutationPayload;
    const nowIso = new Date().toISOString();

    switch (body.action) {
      case "insert_building": {
        const { error } = await supabase.from("buildings").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "insert_room": {
        const { error } = await supabase.from("rooms").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "update_room": {
        const { error } = await supabase
          .from("rooms")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "delete_room": {
        const { error } = await supabase.from("rooms").delete().eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "insert_asset": {
        const { error } = await supabase.from("assets").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "update_asset": {
        const { error } = await supabase
          .from("assets")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "delete_asset": {
        const { error } = await supabase.from("assets").delete().eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "insert_booking": {
        const { error } = await supabase.from("bookings").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "update_booking_status": {
        const { error } = await supabase
          .from("bookings")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (body.roomId && body.nextRoomStatus) {
          await supabase
            .from("rooms")
            .update({ status: body.nextRoomStatus, updated_at: nowIso })
            .eq("id", body.roomId);
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_maintenance": {
        const { error } = await supabase
          .from("maintenance_logs")
          .insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (body.roomId && body.setRoomRepair) {
          await supabase
            .from("rooms")
            .update({ status: "Perbaikan", updated_at: nowIso })
            .eq("id", body.roomId);
        }
        return NextResponse.json({ ok: true });
      }
      case "update_maintenance": {
        const { error } = await supabase
          .from("maintenance_logs")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (body.roomId && body.setRoomAvailable) {
          await supabase
            .from("rooms")
            .update({ status: "Tersedia", updated_at: nowIso })
            .eq("id", body.roomId);
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable": {
        const { error } = await supabase.from("consumables").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_tx": {
        const { error } = await supabase
          .from("consumable_transactions")
          .insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "insert_note": {
        const { error } = await supabase.from("sarpras_notes").insert({
          ...body.data,
          author_id: session.id,
          author_name: session.fullName || session.username,
        });
        if (error) {
          const msg = error.message || "";
          if (msg.includes("sarpras_notes")) {
            return NextResponse.json(
              {
                error:
                  "Tabel catatan belum dibuat. Jalankan migrasi supabase/migrations/003_notes_and_attachments.sql di SQL Editor Supabase.",
              },
              { status: 400 }
            );
          }
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_attachment": {
        if (body.filePath) {
          await supabase.storage.from("sarpras-files").remove([body.filePath]);
        }
        const { error } = await supabase
          .from("sarpras_attachments")
          .delete()
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json(
          { error: "Aksi mutasi tidak dikenal." },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Format payload mutasi tidak valid." },
      { status: 400 }
    );
  }
}
