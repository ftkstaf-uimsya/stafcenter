import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ASSET_CATEGORY_LABELS,
  generateInventoryCode,
} from "@/lib/supabase/client";
import {
  ASSET_CATEGORY_CODES,
  ASSET_CONDITION_LIST,
  extractMaxInventorySequence,
  MAX_IMPORT_ROWS,
  NormalizedImportAssetPayload,
  normalizeSerialKey,
} from "@/lib/sarpras/asset-import-shared";
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
  | { action: "bulk_insert_assets"; items: NormalizedImportAssetPayload[] }
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
  | { action: "insert_lecturer"; data: Record<string, unknown> }
  | { action: "update_lecturer"; id: string; data: Record<string, unknown> }
  | { action: "delete_lecturer"; id: string }
  | { action: "insert_course"; data: Record<string, unknown> }
  | { action: "update_course"; id: string; data: Record<string, unknown> }
  | { action: "delete_course"; id: string }
  | { action: "insert_official"; data: Record<string, unknown> }
  | { action: "update_official"; id: string; data: Record<string, unknown> }
  | { action: "delete_official"; id: string }
  | { action: "insert_campus_unit"; data: Record<string, unknown> }
  | { action: "update_campus_unit"; id: string; data: Record<string, unknown> }
  | { action: "delete_campus_unit"; id: string }
  | { action: "insert_vendor"; data: Record<string, unknown> }
  | { action: "update_vendor"; id: string; data: Record<string, unknown> }
  | { action: "delete_vendor"; id: string }
  | { action: "insert_asset_category"; data: Record<string, unknown> }
  | { action: "update_asset_category"; id: string; data: Record<string, unknown> }
  | { action: "delete_asset_category"; id: string }
  | { action: "insert_funding_source"; data: Record<string, unknown> }
  | { action: "update_funding_source"; id: string; data: Record<string, unknown> }
  | { action: "delete_funding_source"; id: string }
  | { action: "insert_consumable_category"; data: Record<string, unknown> }
  | { action: "update_consumable_category"; id: string; data: Record<string, unknown> }
  | { action: "delete_consumable_category"; id: string }
  | { action: "insert_consumable_unit"; data: Record<string, unknown> }
  | { action: "update_consumable_unit"; id: string; data: Record<string, unknown> }
  | { action: "delete_consumable_unit"; id: string }
  | { action: "insert_academic_class"; data: Record<string, unknown> }
  | { action: "update_academic_class"; id: string; data: Record<string, unknown> }
  | { action: "delete_academic_class"; id: string }
  | { action: "insert_office_kit_item"; data: Record<string, unknown> }
  | { action: "update_office_kit_item"; id: string; data: Record<string, unknown> }
  | { action: "delete_office_kit_item"; id: string }
  | {
      action: "checkout_office_kit_loan";
      data: Record<string, unknown>;
      itemIds: string[];
    }
  | {
      action: "checkin_office_kit_loan";
      id: string;
      data: Record<string, unknown>;
      itemIds: string[];
      damagedItemIds?: string[];
    }
  | { action: "delete_office_kit_loan"; id: string }
  | { action: "insert_note"; data: Record<string, unknown> }
  | { action: "delete_attachment"; id: string; filePath?: string };

const DATA_MASTER_ACTIONS = new Set([
  "insert_building",
  "update_building",
  "delete_building",
  "insert_room",
  "update_room",
  "delete_room",
  "insert_lecturer",
  "update_lecturer",
  "delete_lecturer",
  "insert_course",
  "update_course",
  "delete_course",
  "insert_official",
  "update_official",
  "delete_official",
  "insert_campus_unit",
  "update_campus_unit",
  "delete_campus_unit",
  "insert_vendor",
  "update_vendor",
  "delete_vendor",
  "insert_asset_category",
  "update_asset_category",
  "delete_asset_category",
  "insert_funding_source",
  "update_funding_source",
  "delete_funding_source",
  "insert_consumable_category",
  "update_consumable_category",
  "delete_consumable_category",
  "insert_consumable_unit",
  "update_consumable_unit",
  "delete_consumable_unit",
  "insert_academic_class",
  "update_academic_class",
  "delete_academic_class",
]);

const DATA_MASTER_ENTITY_TYPES = new Set<string>([
  "room",
  "lecturer",
  "course",
  "official",
  "unit",
  "vendor",
  "class",
]);

function formatDataMasterError(message: string): string {
  if (
    message.includes("academic_classes") ||
    message.includes("office_kit_items") ||
    message.includes("office_kit_loans")
  ) {
    if (message.includes("does not exist") || message.includes("schema cache")) {
      return "Tabel Master Kelas & Sirkulasi Invent belum dibuat. Jalankan migrasi supabase/migrations/007_sirkulasi_invent_and_classes.sql di SQL Editor Supabase.";
    }
  }
  if (
    message.includes("campus_units") ||
    message.includes("maintenance_vendors") ||
    message.includes("asset_categories") ||
    message.includes("funding_sources") ||
    message.includes("consumable_categories") ||
    message.includes("consumable_units")
  ) {
    if (message.includes("does not exist") || message.includes("schema cache")) {
      return "Tabel Data Master lanjutan belum dibuat. Jalankan migrasi supabase/migrations/006_extended_master_data.sql di SQL Editor Supabase.";
    }
  }
  if (
    message.includes("lecturers") ||
    message.includes("courses") ||
    message.includes("campus_officials")
  ) {
    if (message.includes("does not exist") || message.includes("schema cache")) {
      return "Tabel Data Master belum dibuat. Jalankan migrasi supabase/migrations/005_data_master.sql di SQL Editor Supabase.";
    }
  }
  return message;
}

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

    if (
      DATA_MASTER_ACTIONS.has(body.action) &&
      session.role !== "master_admin"
    ) {
      return NextResponse.json(
        { error: "Hanya Master Admin yang berhak mengelola Data Master." },
        { status: 403 }
      );
    }

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
      case "bulk_insert_assets": {
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
          return NextResponse.json(
            { error: "Tidak ada data aset yang dikirim untuk diimport." },
            { status: 400 }
          );
        }
        if (items.length > MAX_IMPORT_ROWS) {
          return NextResponse.json(
            { error: `Maksimal ${MAX_IMPORT_ROWS} aset per sekali import.` },
            { status: 400 }
          );
        }

        const [roomsRes, assetsRes, catRes] = await Promise.all([
          supabase.from("rooms").select("id"),
          supabase.from("assets").select("inventory_code, serial_number"),
          supabase.from("asset_categories").select("code, name"),
        ]);

        if (roomsRes.error || assetsRes.error) {
          return NextResponse.json(
            {
              error:
                roomsRes.error?.message ||
                assetsRes.error?.message ||
                "Gagal memverifikasi data referensi aset.",
            },
            { status: 500 }
          );
        }

        const categoryMap = new Map<string, string>();
        if (!catRes.error && Array.isArray(catRes.data) && catRes.data.length > 0) {
          for (const c of catRes.data) {
            categoryMap.set(String(c.code).toUpperCase(), String(c.name));
          }
        } else {
          for (const code of ASSET_CATEGORY_CODES) {
            categoryMap.set(code, ASSET_CATEGORY_LABELS[code] || code);
          }
        }

        const validRoomIds = new Set(
          (roomsRes.data || []).map((r) => String(r.id))
        );
        const existingSerialMap = new Map<string, string>();
        const existingCodes: string[] = [];

        for (const row of assetsRes.data || []) {
          const code = String(row.inventory_code || "");
          if (code) existingCodes.push(code);
          const serialKey = normalizeSerialKey(row.serial_number as string | null);
          if (serialKey && !existingSerialMap.has(serialKey)) {
            existingSerialMap.set(serialKey, code);
          }
        }

        let seq = extractMaxInventorySequence(existingCodes);
        const batchSerials = new Set<string>();
        const dbRows: Array<Record<string, unknown>> = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const rowLabel = `Baris data ke-${i + 1}`;
          const normalizedCat = String(item.category || "").trim().toUpperCase();

          if (!categoryMap.has(normalizedCat)) {
            return NextResponse.json(
              { error: `${rowLabel}: Kategori inventaris tidak valid.` },
              { status: 400 }
            );
          }
          if (!ASSET_CONDITION_LIST.includes(item.condition)) {
            return NextResponse.json(
              { error: `${rowLabel}: Kondisi barang tidak valid.` },
              { status: 400 }
            );
          }
          if (item.room_id !== null && !validRoomIds.has(String(item.room_id))) {
            return NextResponse.json(
              {
                error: `${rowLabel}: Ruangan penempatan tidak ditemukan di database.`,
              },
              { status: 400 }
            );
          }

          const name = String(item.name ?? "").trim();
          const brandModel = String(item.brand_model ?? "").trim();
          const fundingSource = String(item.funding_source ?? "").trim();
          const year = Number(item.procurement_year);
          const cost = Number(item.acquisition_cost);
          const serial = String(item.serial_number ?? "").trim() || "-";
          const notes = String(item.notes ?? "").trim();

          if (!name || name.length > 180 || !brandModel || brandModel.length > 150 || !fundingSource || fundingSource.length > 100) {
            return NextResponse.json(
              {
                error: `${rowLabel}: Nama barang, merk/tipe, dan sumber dana wajib diisi sesuai batas karakter.`,
              },
              { status: 400 }
            );
          }
          if (!Number.isInteger(year) || year < 1990 || year > 2100) {
            return NextResponse.json(
              { error: `${rowLabel}: Tahun pengadaan tidak valid.` },
              { status: 400 }
            );
          }
          if (!Number.isFinite(cost) || cost < 0) {
            return NextResponse.json(
              { error: `${rowLabel}: Harga perolehan tidak valid.` },
              { status: 400 }
            );
          }
          if (serial.length > 100) {
            return NextResponse.json(
              { error: `${rowLabel}: Nomor seri melebihi 100 karakter.` },
              { status: 400 }
            );
          }

          const serialKey = normalizeSerialKey(serial);
          if (serialKey) {
            const existingCode = existingSerialMap.get(serialKey);
            if (existingCode) {
              return NextResponse.json(
                {
                  error: `${rowLabel}: Nomor seri "${serial}" sudah terdaftar pada aset ${existingCode}.`,
                },
                { status: 409 }
              );
            }
            if (batchSerials.has(serialKey)) {
              return NextResponse.json(
                {
                  error: `${rowLabel}: Nomor seri "${serial}" duplikat di dalam batch import.`,
                },
                { status: 409 }
              );
            }
            batchSerials.add(serialKey);
          }

          seq += 1;
          const normalizedCatCode = String(item.category || "").trim().toUpperCase();
          const inventoryCode = generateInventoryCode(normalizedCatCode, year, seq);

          dbRows.push({
            id: crypto.randomUUID(),
            inventory_code: inventoryCode,
            name,
            brand_model: brandModel,
            category: normalizedCatCode,
            category_label:
              categoryMap.get(normalizedCatCode) ||
              ASSET_CATEGORY_LABELS[normalizedCatCode] ||
              normalizedCatCode,
            room_id: item.room_id || null,
            procurement_year: year,
            funding_source: fundingSource,
            ...(item.funding_source_id
              ? { funding_source_id: item.funding_source_id }
              : {}),
            acquisition_cost: Math.round(cost),
            condition: item.condition,
            is_portable: Boolean(item.is_portable),
            serial_number: serial === "-" ? null : serial,
            photo_url: null,
            notes: notes || null,
          });
        }

        const { error } = await supabase.from("assets").insert(dbRows);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({
          ok: true,
          count: dbRows.length,
          codes: dbRows.map((r) => r.inventory_code),
        });
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
      case "insert_lecturer": {
        const { error } = await supabase.from("lecturers").insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_lecturer": {
        const { error } = await supabase
          .from("lecturers")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_lecturer": {
        await cleanupEntityArtifacts(supabase, "lecturer", body.id);
        const { error } = await supabase
          .from("lecturers")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_course": {
        const { error } = await supabase.from("courses").insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_course": {
        const { error } = await supabase
          .from("courses")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_course": {
        await cleanupEntityArtifacts(supabase, "course", body.id);
        const { error } = await supabase
          .from("courses")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_official": {
        const { error } = await supabase
          .from("campus_officials")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_official": {
        const { error } = await supabase
          .from("campus_officials")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_official": {
        await cleanupEntityArtifacts(supabase, "official", body.id);
        const { error } = await supabase
          .from("campus_officials")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_campus_unit": {
        const { error } = await supabase.from("campus_units").insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_campus_unit": {
        const { error } = await supabase
          .from("campus_units")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_campus_unit": {
        await cleanupEntityArtifacts(supabase, "unit", body.id);
        const { error } = await supabase
          .from("campus_units")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_vendor": {
        const { error } = await supabase
          .from("maintenance_vendors")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_vendor": {
        const { error } = await supabase
          .from("maintenance_vendors")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_vendor": {
        await cleanupEntityArtifacts(supabase, "vendor", body.id);
        const { error } = await supabase
          .from("maintenance_vendors")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_asset_category": {
        const { error } = await supabase
          .from("asset_categories")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_asset_category": {
        const { error } = await supabase
          .from("asset_categories")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_asset_category": {
        const { data: catRow } = await supabase
          .from("asset_categories")
          .select("code")
          .eq("id", body.id)
          .maybeSingle();
        if (catRow?.code) {
          const { count } = await supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .eq("category", catRow.code);
          if ((count || 0) > 0) {
            return NextResponse.json(
              {
                error: `Kategori "${catRow.code}" masih digunakan oleh ${count} unit aset di Inventaris. Ubah kategori aset tersebut terlebih dahulu.`,
              },
              { status: 409 }
            );
          }
        }
        const { error } = await supabase
          .from("asset_categories")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_funding_source": {
        const { error } = await supabase
          .from("funding_sources")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_funding_source": {
        const { error } = await supabase
          .from("funding_sources")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_funding_source": {
        const { error } = await supabase
          .from("funding_sources")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_category": {
        const { error } = await supabase
          .from("consumable_categories")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_consumable_category": {
        const { error } = await supabase
          .from("consumable_categories")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_consumable_category": {
        const { data: catRow } = await supabase
          .from("consumable_categories")
          .select("name")
          .eq("id", body.id)
          .maybeSingle();
        if (catRow?.name) {
          const { count } = await supabase
            .from("consumables")
            .select("id", { count: "exact", head: true })
            .eq("category", catRow.name);
          if ((count || 0) > 0) {
            return NextResponse.json(
              {
                error: `Kategori BHP "${catRow.name}" masih digunakan oleh ${count} item BHP. Pindahkan kategori item tersebut terlebih dahulu.`,
              },
              { status: 409 }
            );
          }
        }
        const { error } = await supabase
          .from("consumable_categories")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_unit": {
        const { error } = await supabase
          .from("consumable_units")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_consumable_unit": {
        const { error } = await supabase
          .from("consumable_units")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_consumable_unit": {
        const { data: unitRow } = await supabase
          .from("consumable_units")
          .select("name")
          .eq("id", body.id)
          .maybeSingle();
        if (unitRow?.name) {
          const { count } = await supabase
            .from("consumables")
            .select("id", { count: "exact", head: true })
            .eq("unit", unitRow.name);
          if ((count || 0) > 0) {
            return NextResponse.json(
              {
                error: `Satuan "${unitRow.name}" masih digunakan oleh ${count} item BHP. Ubah satuan item tersebut terlebih dahulu.`,
              },
              { status: 409 }
            );
          }
        }
        const { error } = await supabase
          .from("consumable_units")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_academic_class": {
        const { error } = await supabase
          .from("academic_classes")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_academic_class": {
        const { error } = await supabase
          .from("academic_classes")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_academic_class": {
        await cleanupEntityArtifacts(supabase, "class", body.id);
        const { error } = await supabase
          .from("academic_classes")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_office_kit_item": {
        const { error } = await supabase
          .from("office_kit_items")
          .insert(body.data);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_office_kit_item": {
        const { error } = await supabase
          .from("office_kit_items")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_office_kit_item": {
        const { data: kitRow } = await supabase
          .from("office_kit_items")
          .select("kit_code, status")
          .eq("id", body.id)
          .maybeSingle();
        if (kitRow?.status === "Dipinjam") {
          return NextResponse.json(
            {
              error: `Barang "${kitRow.kit_code}" sedang dipinjam kelas. Catat pengembalian terlebih dahulu sebelum menghapus.`,
            },
            { status: 409 }
          );
        }
        await cleanupEntityArtifacts(supabase, "office_kit", body.id);
        const { error } = await supabase
          .from("office_kit_items")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "checkout_office_kit_loan": {
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
        if (itemIds.length === 0) {
          return NextResponse.json(
            { error: "Pilih minimal 1 barang kantor staf untuk dipinjamkan." },
            { status: 400 }
          );
        }
        const { error: insertErr } = await supabase
          .from("office_kit_loans")
          .insert(body.data);
        if (insertErr) {
          return NextResponse.json(
            { error: formatDataMasterError(insertErr.message) },
            { status: 400 }
          );
        }
        await supabase
          .from("office_kit_items")
          .update({ status: "Dipinjam", updated_at: nowIso })
          .in("id", itemIds);
        return NextResponse.json({ ok: true });
      }
      case "checkin_office_kit_loan": {
        const { error: updErr } = await supabase
          .from("office_kit_loans")
          .update({ ...body.data, updated_at: nowIso })
          .eq("id", body.id);
        if (updErr) {
          return NextResponse.json(
            { error: formatDataMasterError(updErr.message) },
            { status: 400 }
          );
        }
        const damagedSet = new Set(
          Array.isArray(body.damagedItemIds) ? body.damagedItemIds : []
        );
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
        const okIds = itemIds.filter((id) => !damagedSet.has(id));
        const damagedIds = itemIds.filter((id) => damagedSet.has(id));
        if (okIds.length > 0) {
          await supabase
            .from("office_kit_items")
            .update({ status: "Tersedia", updated_at: nowIso })
            .in("id", okIds);
        }
        if (damagedIds.length > 0) {
          await supabase
            .from("office_kit_items")
            .update({
              status: "Perbaikan",
              condition: "Rusak Ringan",
              updated_at: nowIso,
            })
            .in("id", damagedIds);
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_office_kit_loan": {
        const { data: existingLoan } = await supabase
          .from("office_kit_loans")
          .select("id, status, kit_item_ids")
          .eq("id", body.id)
          .maybeSingle();

        await cleanupEntityArtifacts(supabase, "office_loan", body.id);
        const { error } = await supabase
          .from("office_kit_loans")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatDataMasterError(error.message) },
            { status: 400 }
          );
        }

        if (
          existingLoan?.status === "Dipinjam" &&
          Array.isArray(existingLoan.kit_item_ids) &&
          existingLoan.kit_item_ids.length > 0
        ) {
          await supabase
            .from("office_kit_items")
            .update({ status: "Tersedia", updated_at: nowIso })
            .in("id", existingLoan.kit_item_ids as string[])
            .eq("status", "Dipinjam");
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_note": {
        const entityType = String(body.data?.entity_type || "");
        if (
          DATA_MASTER_ENTITY_TYPES.has(entityType) &&
          session.role !== "master_admin"
        ) {
          return NextResponse.json(
            { error: "Hanya Master Admin yang berhak menambah catatan Data Master." },
            { status: 403 }
          );
        }
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
        const { data: attRow } = await supabase
          .from("sarpras_attachments")
          .select("entity_type")
          .eq("id", body.id)
          .maybeSingle();
        if (
          attRow &&
          DATA_MASTER_ENTITY_TYPES.has(String(attRow.entity_type)) &&
          session.role !== "master_admin"
        ) {
          return NextResponse.json(
            { error: "Hanya Master Admin yang berhak menghapus lampiran Data Master." },
            { status: 403 }
          );
        }
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
