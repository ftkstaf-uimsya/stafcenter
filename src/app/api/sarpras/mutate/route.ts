import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DeleteStrategyMode, SarprasEntityType } from "@/types/sarpras";

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

type MutationPayload =
  | { action: "insert_building"; data: Record<string, unknown> }
  | { action: "update_building"; id: string; data: Record<string, unknown> }
  | { action: "delete_building"; id: string }
  | { action: "insert_room"; data: Record<string, unknown> }
  | { action: "update_room"; id: string; data: Record<string, unknown> }
  | {
      action: "delete_room";
      id: string;
      mode?: DeleteStrategyMode;
      forceActive?: boolean;
    }
  | { action: "insert_asset"; data: Record<string, unknown> }
  | { action: "update_asset"; id: string; data: Record<string, unknown> }
  | {
      action: "delete_asset";
      id: string;
      mode?: DeleteStrategyMode;
      forceActive?: boolean;
    }
  | { action: "insert_booking"; data: Record<string, unknown> }
  | {
      action: "update_booking_status";
      id: string;
      data: Record<string, unknown>;
      roomId?: string | null;
      nextRoomStatus?: string | null;
    }
  | { action: "delete_booking"; id: string }
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
  | { action: "delete_maintenance"; id: string }
  | { action: "insert_consumable"; data: Record<string, unknown> }
  | { action: "update_consumable"; id: string; data: Record<string, unknown> }
  | { action: "delete_consumable"; id: string }
  | { action: "insert_consumable_tx"; data: Record<string, unknown> }
  | { action: "insert_note"; data: Record<string, unknown> }
  | { action: "delete_attachment"; id: string; filePath?: string };

const ACTIVE_BOOKING_STATUSES = new Set([
  "Menunggu Persetujuan",
  "Disetujui",
  "Sedang Dipinjam",
]);

const OPEN_MAINT_STATUSES = new Set(["Dilaporkan", "Dalam Pengerjaan"]);

async function cleanupEntityArtifacts(
  supabase: SupabaseAdminClient,
  entityType: SarprasEntityType,
  entityId: string
) {
  await supabase
    .from("sarpras_notes")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  const { data: attachments, error: attachReadErr } = await supabase
    .from("sarpras_attachments")
    .select("id, file_path")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (!attachReadErr && attachments && attachments.length > 0) {
    const filePaths = attachments
      .map((a) => a.file_path as string)
      .filter(Boolean);
    if (filePaths.length > 0) {
      await supabase.storage.from("sarpras-files").remove(filePaths);
    }
    await supabase
      .from("sarpras_attachments")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
  }
}

async function reconcileMaintenanceTargets(
  supabase: SupabaseAdminClient,
  assetId: string | null,
  roomId: string | null,
  nowIso: string
) {
  if (assetId) {
    const { data: remainingMaint } = await supabase
      .from("maintenance_logs")
      .select("damage_severity, status")
      .eq("asset_id", assetId)
      .neq("status", "Selesai Diperbaiki");

    const hasHeavy = (remainingMaint || []).some(
      (m) => m.damage_severity === "Rusak Berat"
    );
    const hasLight = (remainingMaint || []).some(
      (m) => m.damage_severity === "Rusak Ringan"
    );

    const { data: assetRow } = await supabase
      .from("assets")
      .select("condition")
      .eq("id", assetId)
      .maybeSingle();

    if (assetRow) {
      let nextCondition = assetRow.condition as string;
      if (hasHeavy) nextCondition = "Rusak Berat";
      else if (hasLight) nextCondition = "Rusak Ringan";
      else if (nextCondition === "Rusak Berat" || nextCondition === "Rusak Ringan") {
        nextCondition = "Baik";
      }
      if (nextCondition !== assetRow.condition) {
        await supabase
          .from("assets")
          .update({ condition: nextCondition, updated_at: nowIso })
          .eq("id", assetId);
      }
    }
  }

  if (roomId) {
    const { data: urgentOpen } = await supabase
      .from("maintenance_logs")
      .select("id")
      .eq("room_id", roomId)
      .neq("status", "Selesai Diperbaiki")
      .eq("priority", "Tinggi/Darurat");

    if (!urgentOpen || urgentOpen.length === 0) {
      await supabase
        .from("rooms")
        .update({ status: "Tersedia", updated_at: nowIso })
        .eq("id", roomId)
        .eq("status", "Perbaikan");
    }
  }
}

async function handleRoomOrAssetDelete(
  supabase: SupabaseAdminClient,
  kind: "room" | "asset",
  id: string,
  mode: DeleteStrategyMode,
  forceActive: boolean,
  nowIso: string
): Promise<NextResponse> {
  const fkCol = kind === "room" ? "room_id" : "asset_id";
  const otherCol = kind === "room" ? "asset_id" : "room_id";
  const downgradedTargetType = kind === "room" ? "Alat" : "Ruangan";

  const { data: relatedBookings, error: bkErr } = await supabase
    .from("bookings")
    .select("id, booking_code, status, target_type, room_id, asset_id")
    .eq(fkCol, id);

  if (bkErr) {
    return NextResponse.json({ error: bkErr.message }, { status: 400 });
  }

  const { data: relatedMaint, error: mErr } = await supabase
    .from("maintenance_logs")
    .select("id, ticket_code, status, room_id, asset_id")
    .eq(fkCol, id);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 400 });
  }

  const activeBk = (relatedBookings || []).filter((b) =>
    ACTIVE_BOOKING_STATUSES.has(String(b.status))
  );
  const openMaint = (relatedMaint || []).filter((m) =>
    OPEN_MAINT_STATUSES.has(String(m.status))
  );

  if ((activeBk.length > 0 || openMaint.length > 0) && !forceActive) {
    const parts: string[] = [];
    if (activeBk.length > 0) {
      parts.push(
        `${activeBk.length} peminjaman aktif (${activeBk
          .slice(0, 3)
          .map((b) => b.booking_code)
          .join(", ")})`
      );
    }
    if (openMaint.length > 0) {
      parts.push(
        `${openMaint.length} tiket pemeliharaan terbuka (${openMaint
          .slice(0, 3)
          .map((m) => m.ticket_code)
          .join(", ")})`
      );
    }
    return NextResponse.json(
      {
        error: `Tidak dapat menghapus karena masih terikat pada ${parts.join(
          " dan "
        )}. Selesaikan transaksi tersebut terlebih dahulu atau centang konfirmasi hapus paksa di dialog konfirmasi.`,
      },
      { status: 409 }
    );
  }

  if (mode === "cascade") {
    for (const bk of relatedBookings || []) {
      const hasOther = Boolean(bk[otherCol]);
      if (hasOther) {
        await supabase
          .from("bookings")
          .update({
            [fkCol]: null,
            target_type: downgradedTargetType,
            updated_at: nowIso,
          })
          .eq("id", bk.id);
      } else {
        await cleanupEntityArtifacts(supabase, "booking", String(bk.id));
        const { error: delBkErr } = await supabase
          .from("bookings")
          .delete()
          .eq("id", bk.id);
        if (delBkErr) {
          return NextResponse.json({ error: delBkErr.message }, { status: 400 });
        }
      }
    }

    for (const mt of relatedMaint || []) {
      const hasOther = Boolean(mt[otherCol]);
      if (hasOther && kind === "asset") {
        await supabase
          .from("maintenance_logs")
          .update({ asset_id: null, updated_at: nowIso })
          .eq("id", mt.id);
      } else {
        await cleanupEntityArtifacts(supabase, "maintenance", String(mt.id));
        const { error: delMtErr } = await supabase
          .from("maintenance_logs")
          .delete()
          .eq("id", mt.id);
        if (delMtErr) {
          return NextResponse.json({ error: delMtErr.message }, { status: 400 });
        }
      }
    }
  } else {
    // Mode "archive": untuk tiket gabungan ('Ruangan & Alat'), lepaskan FK & sesuaikan target_type
    for (const bk of relatedBookings || []) {
      if (bk[otherCol]) {
        await supabase
          .from("bookings")
          .update({
            [fkCol]: null,
            target_type: downgradedTargetType,
            updated_at: nowIso,
          })
          .eq("id", bk.id);
      }
    }
  }

  await cleanupEntityArtifacts(supabase, kind, id);

  const table = kind === "room" ? "rooms" : "assets";
  const { error: delErr } = await supabase.from(table).delete().eq("id", id);

  if (delErr) {
    const msg = delErr.message || "";
    if (
      msg.includes("chk_booking_target") ||
      msg.includes("chk_maintenance_target")
    ) {
      return NextResponse.json(
        {
          error:
            "Unit ini memiliki tiket peminjaman atau kerusakan yang merujuk eksklusif padanya. Pilih opsi 'Hapus Bersih Beserta Riwayat' di dialog konfirmasi, atau jalankan migrasi supabase/migrations/004_safe_delete_and_integrity.sql di SQL Editor Supabase agar mode arsip histori aktif.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

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
      case "update_building": {
        const { error } = await supabase
          .from("buildings")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "delete_building": {
        const { count, error: countErr } = await supabase
          .from("rooms")
          .select("id", { count: "exact", head: true })
          .eq("building_id", body.id);
        if (countErr) {
          return NextResponse.json({ error: countErr.message }, { status: 400 });
        }
        if ((count || 0) > 0) {
          return NextResponse.json(
            {
              error: `Gedung tidak dapat dihapus karena masih memiliki ${count} ruangan terdaftar. Hapus atau pindahkan seluruh ruangan di gedung ini terlebih dahulu.`,
            },
            { status: 409 }
          );
        }
        const { error } = await supabase
          .from("buildings")
          .delete()
          .eq("id", body.id);
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
        return handleRoomOrAssetDelete(
          supabase,
          "room",
          body.id,
          body.mode || "archive",
          Boolean(body.forceActive),
          nowIso
        );
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
        return handleRoomOrAssetDelete(
          supabase,
          "asset",
          body.id,
          body.mode || "archive",
          Boolean(body.forceActive),
          nowIso
        );
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
      case "delete_booking": {
        const { data: existing } = await supabase
          .from("bookings")
          .select("id, status, room_id")
          .eq("id", body.id)
          .maybeSingle();

        await cleanupEntityArtifacts(supabase, "booking", body.id);
        const { error } = await supabase
          .from("bookings")
          .delete()
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (existing?.status === "Sedang Dipinjam" && existing.room_id) {
          await supabase
            .from("rooms")
            .update({ status: "Tersedia", updated_at: nowIso })
            .eq("id", existing.room_id)
            .eq("status", "Digunakan");
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
      case "delete_maintenance": {
        const { data: existing } = await supabase
          .from("maintenance_logs")
          .select("id, asset_id, room_id")
          .eq("id", body.id)
          .maybeSingle();

        await cleanupEntityArtifacts(supabase, "maintenance", body.id);
        const { error } = await supabase
          .from("maintenance_logs")
          .delete()
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (existing) {
          await reconcileMaintenanceTargets(
            supabase,
            (existing.asset_id as string | null) || null,
            (existing.room_id as string | null) || null,
            nowIso
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable": {
        const { error } = await supabase.from("consumables").insert(body.data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "update_consumable": {
        const { error } = await supabase
          .from("consumables")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "delete_consumable": {
        await cleanupEntityArtifacts(supabase, "consumable", body.id);
        const { error } = await supabase
          .from("consumables")
          .delete()
          .eq("id", body.id);
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
