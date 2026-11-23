import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import {
  ACTION_TO_PAGE_KEY,
  canAccessPage,
  ENTITY_TYPE_TO_PAGE_KEY,
  getPageMeta,
  getThesisEntityType,
  getThesisPageKey,
} from "@/lib/auth/permissions";
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
import {
  DeleteStrategyMode,
  SarprasEntityType,
  ThesisStage,
  ThesisTrack,
} from "@/types/sarpras";

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
      officeKitItemId?: string | null;
      assetId?: string | null;
      damageSeverity?: string;
      setRoomRepair?: boolean;
    }
  | {
      action: "update_maintenance";
      id: string;
      data: Record<string, unknown>;
      roomId?: string | null;
      officeKitItemId?: string | null;
      assetId?: string | null;
      status?: string;
      damageSeverity?: string;
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
  | {
      action: "reopen_office_kit_loan";
      id: string;
      itemIds: string[];
      data?: Record<string, unknown>;
    }
  | { action: "delete_office_kit_loan"; id: string }
  | { action: "insert_thesis_workflow"; data: Record<string, unknown> }
  | { action: "update_thesis_workflow"; id: string; data: Record<string, unknown> }
  | { action: "delete_thesis_workflow"; id: string }
  | { action: "insert_note"; data: Record<string, unknown> }
  | { action: "delete_attachment"; id: string; filePath?: string };

const TABLE_ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  buildings: ["id", "code", "name", "floors_count", "zone", "description"],
  rooms: [
    "id",
    "code",
    "name",
    "building_id",
    "floor",
    "category",
    "capacity",
    "pic_name",
    "pic_contact",
    "pic_official_id",
    "pic_lecturer_id",
    "status",
    "facilities_notes",
  ],
  assets: [
    "id",
    "inventory_code",
    "name",
    "brand_model",
    "category",
    "category_label",
    "room_id",
    "procurement_year",
    "funding_source",
    "funding_source_id",
    "acquisition_cost",
    "condition",
    "is_portable",
    "serial_number",
    "photo_url",
    "notes",
  ],
  bookings: [
    "id",
    "booking_code",
    "borrower_name",
    "borrower_role",
    "borrower_unit",
    "unit_id",
    "class_id",
    "class_code",
    "borrower_lecturer_id",
    "borrower_official_id",
    "borrower_phone",
    "target_type",
    "room_id",
    "asset_id",
    "deleted_target_label",
    "activity_name",
    "attendees_count",
    "booking_date",
    "start_time",
    "end_time",
    "status",
    "return_condition_notes",
    "approved_by",
    "approved_by_official_id",
  ],
  maintenance_logs: [
    "id",
    "ticket_code",
    "asset_id",
    "room_id",
    "office_kit_item_id",
    "deleted_target_label",
    "reporter_name",
    "reporter_role",
    "issue_title",
    "issue_description",
    "damage_severity",
    "priority",
    "photo_url",
    "status",
    "technician_vendor",
    "vendor_id",
    "repair_cost",
    "reported_at",
    "completed_at",
    "resolution_notes",
  ],
  consumables: [
    "id",
    "code",
    "name",
    "category",
    "unit",
    "current_stock",
    "min_stock",
    "storage_location",
    "last_restocked_at",
  ],
  consumable_transactions: [
    "id",
    "consumable_id",
    "transaction_type",
    "quantity",
    "actor_name",
    "actor_unit",
    "unit_id",
    "purpose_notes",
    "transaction_date",
  ],
  lecturers: [
    "id",
    "nidn_nip",
    "full_name",
    "homebase_prodi",
    "unit_id",
    "employment_status",
    "academic_rank",
    "email",
    "phone",
    "office_room_id",
    "is_active",
    "notes",
  ],
  courses: [
    "id",
    "code",
    "name",
    "prodi",
    "unit_id",
    "semester",
    "curriculum_year",
    "sks_theory",
    "sks_practice",
    "course_type",
    "lecturer_id",
    "preferred_room_id",
    "is_active",
    "description",
  ],
  campus_officials: [
    "id",
    "official_code",
    "full_name",
    "position_title",
    "unit_name",
    "unit_id",
    "category",
    "email",
    "phone",
    "period_label",
    "is_active",
    "notes",
  ],
  campus_units: [
    "id",
    "code",
    "name",
    "unit_type",
    "parent_unit_id",
    "leader_name",
    "phone",
    "email",
    "is_active",
    "notes",
  ],
  maintenance_vendors: [
    "id",
    "vendor_code",
    "name",
    "vendor_type",
    "specialty",
    "pic_name",
    "phone",
    "email",
    "address",
    "is_active",
    "notes",
  ],
  asset_categories: [
    "id",
    "code",
    "name",
    "useful_life_years",
    "description",
    "is_active",
  ],
  funding_sources: [
    "id",
    "code",
    "name",
    "source_type",
    "is_active",
    "notes",
  ],
  consumable_categories: ["id", "code", "name", "description", "is_active"],
  consumable_units: ["id", "code", "name", "description", "is_active"],
  academic_classes: [
    "id",
    "class_code",
    "prodi",
    "unit_id",
    "angkatan_year",
    "class_section",
    "dpm_name",
    "dpm_phone",
    "students_count",
    "default_room_id",
    "is_active",
    "notes",
  ],
  office_kit_items: [
    "id",
    "kit_code",
    "name",
    "category",
    "brand_spec",
    "storage_tray",
    "linked_room_id",
    "condition",
    "status",
    "is_active",
    "notes",
  ],
  office_kit_loans: [
    "id",
    "loan_code",
    "class_id",
    "class_code",
    "prodi",
    "dpm_name",
    "borrower_name",
    "borrower_phone",
    "room_id",
    "course_name",
    "kit_item_ids",
    "kit_items_label",
    "loan_date",
    "borrow_time",
    "expected_return_time",
    "returned_at",
    "status",
    "handed_by_staff",
    "received_by_staff",
    "return_condition_notes",
  ],
  thesis_workflows: [
    "id",
    "ticket_code",
    "track",
    "stage",
    "board_column",
    "student_name",
    "student_nim",
    "student_phone",
    "prodi",
    "class_id",
    "class_code",
    "title",
    "journal_name",
    "journal_url",
    "supervisor_1_id",
    "supervisor_2_id",
    "examiner_1_id",
    "examiner_2_id",
    "registered_at",
    "document_notes",
    "schedule_date",
    "schedule_start_time",
    "schedule_end_time",
    "room_id",
    "letter_number",
    "letter_date",
    "letter_signer_official_id",
    "letter_status",
    "archived_at",
    "archive_notes",
    "source_workflow_id",
    "created_by_staff",
  ],
  sarpras_notes: ["id", "entity_type", "entity_id", "note_text"],
};

function sanitizeTablePayload(
  table: string,
  raw: Record<string, unknown> | undefined | null,
  isUpdate = false
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const allowed = TABLE_ALLOWED_COLUMNS[table];
  if (!allowed) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const col of allowed) {
    if (isUpdate && col === "id") continue;
    if (Object.prototype.hasOwnProperty.call(raw, col)) {
      const val = raw[col];
      if (val !== undefined) {
        out[col] = val;
      }
    }
  }
  return out;
}

function formatSafeDbError(message: string): string {
  const lower = (message || "").toLowerCase();
  if (lower.includes("thesis_workflows")) {
    if (lower.includes("does not exist") || lower.includes("schema cache")) {
      return "Tabel Tugas Akhir belum dibuat. Jalankan migrasi supabase/migrations/011_tugas_akhir_workflow.sql di SQL Editor Supabase.";
    }
  }
  if (
    lower.includes("uq_thesis_source") ||
    (lower.includes("23505") && lower.includes("source_workflow_id"))
  ) {
    return "Data ini sudah disalin ke antrean Sidang.";
  }
  if (
    lower.includes("academic_classes") ||
    lower.includes("office_kit_items") ||
    lower.includes("office_kit_loans")
  ) {
    if (lower.includes("does not exist") || lower.includes("schema cache")) {
      return "Tabel Master Kelas & Sirkulasi Invent belum dibuat. Jalankan migrasi supabase/migrations/007_sirkulasi_invent_and_classes.sql di SQL Editor Supabase.";
    }
  }
  if (
    lower.includes("campus_units") ||
    lower.includes("maintenance_vendors") ||
    lower.includes("asset_categories") ||
    lower.includes("funding_sources") ||
    lower.includes("consumable_categories") ||
    lower.includes("consumable_units")
  ) {
    if (lower.includes("does not exist") || lower.includes("schema cache")) {
      return "Tabel Data Master lanjutan belum dibuat. Jalankan migrasi supabase/migrations/006_extended_master_data.sql di SQL Editor Supabase.";
    }
  }
  if (
    lower.includes("lecturers") ||
    lower.includes("courses") ||
    lower.includes("campus_officials")
  ) {
    if (lower.includes("does not exist") || lower.includes("schema cache")) {
      return "Tabel Data Master belum dibuat. Jalankan migrasi supabase/migrations/005_data_master.sql di SQL Editor Supabase.";
    }
  }
  if (
    lower.includes("stok barang habis pakai tidak mencukupi")
  ) {
    return "Stok barang habis pakai tidak mencukupi untuk pengeluaran ini.";
  }
  if (lower.includes("23505") || lower.includes("duplicate key")) {
    return "Data sudah terdaftar (kode atau pengenal duplikat).";
  }
  if (lower.includes("23503") || lower.includes("foreign key constraint")) {
    return "Referensi data terkait tidak valid atau masih digunakan oleh transaksi lain.";
  }
  if (lower.includes("23514") || lower.includes("check constraint")) {
    return "Nilai kolom tidak memenuhi aturan atau pilihan yang valid.";
  }
  if (lower.includes("23502") || lower.includes("not-null constraint")) {
    return "Terdapat kolom wajib yang belum diisi.";
  }
  if (lower.includes("22p02") || lower.includes("invalid input syntax")) {
    return "Format ID atau tipe data tidak valid.";
  }
  return "Permintaan mutasi data tidak dapat diproses oleh server.";
}

const ACTIVE_BOOKING_STATUSES = new Set([
  "Menunggu Persetujuan",
  "Disetujui",
  "Sedang Dipinjam",
]);

const OPEN_MAINT_STATUSES = new Set(["Dilaporkan", "Dalam Pengerjaan"]);
const ARTIFACTS_MISSING_CACHE_MS = 5 * 60 * 1000;
let artifactsTablesMissingUntil = 0;

function isMissingRelationError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = (err.code || "").toUpperCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function cleanupEntityArtifactsBatch(
  supabase: SupabaseAdminClient,
  entityType: SarprasEntityType,
  entityIds: string[]
) {
  if (entityIds.length === 0) return;
  if (Date.now() < artifactsTablesMissingUntil) return;

  const [notesDelRes, attachReadRes] = await Promise.all([
    supabase
      .from("sarpras_notes")
      .delete()
      .eq("entity_type", entityType)
      .in("entity_id", entityIds),
    supabase
      .from("sarpras_attachments")
      .select("id, file_path")
      .eq("entity_type", entityType)
      .in("entity_id", entityIds),
  ]);

  if (
    isMissingRelationError(notesDelRes.error) &&
    isMissingRelationError(attachReadRes.error)
  ) {
    artifactsTablesMissingUntil = Date.now() + ARTIFACTS_MISSING_CACHE_MS;
    return;
  }

  if (
    !attachReadRes.error &&
    attachReadRes.data &&
    attachReadRes.data.length > 0
  ) {
    const filePaths = attachReadRes.data
      .map((a) => a.file_path as string)
      .filter(Boolean);
    const cleanupJobs: Array<PromiseLike<unknown>> = [
      supabase
        .from("sarpras_attachments")
        .delete()
        .eq("entity_type", entityType)
        .in("entity_id", entityIds),
    ];
    if (filePaths.length > 0) {
      cleanupJobs.push(supabase.storage.from("sarpras-files").remove(filePaths));
    }
    await Promise.all(cleanupJobs);
  }
}

async function cleanupEntityArtifacts(
  supabase: SupabaseAdminClient,
  entityType: SarprasEntityType,
  entityId: string
) {
  return cleanupEntityArtifactsBatch(supabase, entityType, [entityId]);
}

async function reconcileMaintenanceTargets(
  supabase: SupabaseAdminClient,
  assetId: string | null,
  roomId: string | null,
  officeKitItemId: string | null,
  nowIso: string
) {
  const [remMaintRes, assetRowRes, urgentRoomRes, remKitMaintRes, kitRowRes] =
    await Promise.all([
      assetId
        ? supabase
            .from("maintenance_logs")
            .select("damage_severity, status")
            .eq("asset_id", assetId)
            .neq("status", "Selesai Diperbaiki")
        : Promise.resolve({ data: null }),
      assetId
        ? supabase
            .from("assets")
            .select("condition")
            .eq("id", assetId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      roomId
        ? supabase
            .from("maintenance_logs")
            .select("id")
            .eq("room_id", roomId)
            .neq("status", "Selesai Diperbaiki")
            .eq("priority", "Tinggi/Darurat")
        : Promise.resolve({ data: null }),
      officeKitItemId
        ? supabase
            .from("maintenance_logs")
            .select("damage_severity, status")
            .eq("office_kit_item_id", officeKitItemId)
            .neq("status", "Selesai Diperbaiki")
        : Promise.resolve({ data: null }),
      officeKitItemId
        ? supabase
            .from("office_kit_items")
            .select("condition, status")
            .eq("id", officeKitItemId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const updates: Array<PromiseLike<unknown>> = [];

  if (assetId && assetRowRes.data) {
    const remainingMaint = remMaintRes.data || [];
    const hasHeavy = remainingMaint.some(
      (m) => m.damage_severity === "Rusak Berat"
    );
    const hasLight = remainingMaint.some(
      (m) => m.damage_severity === "Rusak Ringan"
    );
    let nextCondition = assetRowRes.data.condition as string;
    if (hasHeavy) nextCondition = "Rusak Berat";
    else if (hasLight) nextCondition = "Rusak Ringan";
    else if (nextCondition === "Rusak Berat" || nextCondition === "Rusak Ringan") {
      nextCondition = "Baik";
    }
    if (nextCondition !== assetRowRes.data.condition) {
      updates.push(
        supabase
          .from("assets")
          .update({ condition: nextCondition, updated_at: nowIso })
          .eq("id", assetId)
      );
    }
  }

  if (officeKitItemId && kitRowRes.data) {
    const remainingKitMaint = remKitMaintRes.data || [];
    const hasHeavy = remainingKitMaint.some(
      (m) => m.damage_severity === "Rusak Berat"
    );
    const hasLight = remainingKitMaint.some(
      (m) => m.damage_severity === "Rusak Ringan"
    );
    const currentCondition = String(kitRowRes.data.condition || "Baik");
    const currentStatus = String(kitRowRes.data.status || "Tersedia");
    let nextCondition = currentCondition;
    let nextStatus = currentStatus;

    if (hasHeavy) {
      nextCondition = "Rusak Berat";
      if (currentStatus === "Tersedia") nextStatus = "Perbaikan";
    } else if (hasLight) {
      if (currentCondition === "Baik" || currentCondition === "Rusak Berat") {
        nextCondition = "Rusak Ringan";
      }
      if (currentStatus === "Tersedia") nextStatus = "Perbaikan";
    } else {
      if (currentCondition === "Rusak Berat" || currentCondition === "Rusak Ringan") {
        nextCondition = "Baik";
      }
      if (currentStatus === "Perbaikan") {
        nextStatus = "Tersedia";
      }
    }

    if (nextCondition !== currentCondition || nextStatus !== currentStatus) {
      updates.push(
        supabase
          .from("office_kit_items")
          .update({
            condition: nextCondition,
            status: nextStatus,
            updated_at: nowIso,
          })
          .eq("id", officeKitItemId)
      );
    }
  }

  if (roomId) {
    if (urgentRoomRes.data && urgentRoomRes.data.length > 0) {
      updates.push(
        supabase
          .from("rooms")
          .update({ status: "Perbaikan", updated_at: nowIso })
          .eq("id", roomId)
          .eq("status", "Tersedia")
      );
    } else {
      updates.push(
        supabase
          .from("rooms")
          .update({ status: "Tersedia", updated_at: nowIso })
          .eq("id", roomId)
          .eq("status", "Perbaikan")
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
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

  const [bkRes, maintRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_code, status, target_type, room_id, asset_id")
      .eq(fkCol, id),
    supabase.from("maintenance_logs").select("*").eq(fkCol, id),
  ]);

  if (bkRes.error) {
    return NextResponse.json(
      { error: formatSafeDbError(bkRes.error.message) },
      { status: 400 }
    );
  }
  if (maintRes.error) {
    return NextResponse.json(
      { error: formatSafeDbError(maintRes.error.message) },
      { status: 400 }
    );
  }

  const relatedBookings = bkRes.data || [];
  const relatedMaint = maintRes.data || [];

  const activeBk = relatedBookings.filter((b) =>
    ACTIVE_BOOKING_STATUSES.has(String(b.status))
  );
  const openMaint = relatedMaint.filter((m) =>
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
    const bookingIdsToDowngrade: string[] = [];
    const bookingIdsToDelete: string[] = [];
    for (const bk of relatedBookings) {
      if (bk[otherCol]) {
        bookingIdsToDowngrade.push(String(bk.id));
      } else {
        bookingIdsToDelete.push(String(bk.id));
      }
    }

    const maintIdsToClearAsset: string[] = [];
    const maintIdsToClearRoom: string[] = [];
    const maintIdsToDelete: string[] = [];
    for (const mt of relatedMaint) {
      if (mt[otherCol] && kind === "asset") {
        maintIdsToClearAsset.push(String(mt.id));
      } else if (mt.office_kit_item_id && kind === "room") {
        maintIdsToClearRoom.push(String(mt.id));
      } else {
        maintIdsToDelete.push(String(mt.id));
      }
    }

    const batchJobs: Array<PromiseLike<{ error?: { message: string } | null } | void>> = [];

    if (bookingIdsToDowngrade.length > 0) {
      batchJobs.push(
        supabase
          .from("bookings")
          .update({
            [fkCol]: null,
            target_type: downgradedTargetType,
            updated_at: nowIso,
          })
          .in("id", bookingIdsToDowngrade)
      );
    }
    if (bookingIdsToDelete.length > 0) {
      batchJobs.push(
        cleanupEntityArtifactsBatch(supabase, "booking", bookingIdsToDelete)
      );
      batchJobs.push(
        supabase.from("bookings").delete().in("id", bookingIdsToDelete)
      );
    }
    if (maintIdsToClearAsset.length > 0) {
      batchJobs.push(
        supabase
          .from("maintenance_logs")
          .update({ asset_id: null, updated_at: nowIso })
          .in("id", maintIdsToClearAsset)
      );
    }
    if (maintIdsToClearRoom.length > 0) {
      batchJobs.push(
        supabase
          .from("maintenance_logs")
          .update({ room_id: null, updated_at: nowIso })
          .in("id", maintIdsToClearRoom)
      );
    }
    if (maintIdsToDelete.length > 0) {
      batchJobs.push(
        cleanupEntityArtifactsBatch(supabase, "maintenance", maintIdsToDelete)
      );
      batchJobs.push(
        supabase.from("maintenance_logs").delete().in("id", maintIdsToDelete)
      );
    }

    if (batchJobs.length > 0) {
      const results = await Promise.all(batchJobs);
      for (const res of results) {
        if (res && typeof res === "object" && "error" in res && res.error) {
          return NextResponse.json(
            { error: formatSafeDbError(res.error.message) },
            { status: 400 }
          );
        }
      }
    }
  } else {
    // Mode "archive": untuk tiket gabungan ('Ruangan & Alat'), lepaskan FK & sesuaikan target_type
    const bookingIdsToDowngrade = relatedBookings
      .filter((bk) => Boolean(bk[otherCol]))
      .map((bk) => String(bk.id));
    if (bookingIdsToDowngrade.length > 0) {
      await supabase
        .from("bookings")
        .update({
          [fkCol]: null,
          target_type: downgradedTargetType,
          updated_at: nowIso,
        })
        .in("id", bookingIdsToDowngrade);
    }
  }

  const table = kind === "room" ? "rooms" : "assets";
  const [, delRes] = await Promise.all([
    cleanupEntityArtifacts(supabase, kind, id),
    supabase.from(table).delete().eq("id", id),
  ]);

  if (delRes.error) {
    const msg = delRes.error.message || "";
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
    return NextResponse.json(
      { error: formatSafeDbError(msg) },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

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

    const requiredPage = ACTION_TO_PAGE_KEY[body.action];
    if (requiredPage && !canAccessPage(session, requiredPage)) {
      const pageLabel = getPageMeta(requiredPage)?.label || requiredPage;
      return NextResponse.json(
        {
          error: `Akun Anda tidak memiliki otoritas untuk mengelola halaman ${pageLabel}.`,
        },
        { status: 403 }
      );
    }

    switch (body.action) {
      case "insert_building": {
        const cleanData = sanitizeTablePayload("buildings", body.data, false);
        const { error } = await supabase.from("buildings").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_building": {
        const cleanData = sanitizeTablePayload("buildings", body.data, true);
        const { error } = await supabase
          .from("buildings")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_building": {
        const { count, error: countErr } = await supabase
          .from("rooms")
          .select("id", { count: "exact", head: true })
          .eq("building_id", body.id);
        if (countErr) {
          return NextResponse.json(
            { error: formatSafeDbError(countErr.message) },
            { status: 400 }
          );
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
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_room": {
        const cleanData = sanitizeTablePayload("rooms", body.data, false);
        const { error } = await supabase.from("rooms").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_room": {
        const cleanData = sanitizeTablePayload("rooms", body.data, true);
        const { error } = await supabase
          .from("rooms")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
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
        const cleanData = sanitizeTablePayload("assets", body.data, false);
        const { error } = await supabase.from("assets").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
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
              error: formatSafeDbError(
                roomsRes.error?.message ||
                  assetsRes.error?.message ||
                  "Gagal memverifikasi data referensi aset."
              ),
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
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }

        return NextResponse.json({
          ok: true,
          count: dbRows.length,
          codes: dbRows.map((r) => r.inventory_code),
        });
      }
      case "update_asset": {
        const cleanData = sanitizeTablePayload("assets", body.data, true);
        const { error } = await supabase
          .from("assets")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
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
        const cleanData = sanitizeTablePayload("bookings", body.data, false);
        const { error } = await supabase.from("bookings").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_booking_status": {
        const cleanData = sanitizeTablePayload("bookings", body.data, true);
        const jobs: [
          PromiseLike<{ error: { message: string } | null }>,
          PromiseLike<unknown>
        ] = [
          supabase
            .from("bookings")
            .update({ ...cleanData, updated_at: nowIso })
            .eq("id", body.id),
          body.roomId && body.nextRoomStatus
            ? supabase
                .from("rooms")
                .update({ status: body.nextRoomStatus, updated_at: nowIso })
                .eq("id", body.roomId)
            : Promise.resolve(null),
        ];
        const [bkUpdRes] = await Promise.all(jobs);
        if (bkUpdRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(bkUpdRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_booking": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "booking", body.id),
          supabase
            .from("bookings")
            .delete()
            .eq("id", body.id)
            .select("id, status, room_id")
            .maybeSingle(),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }

        const existing = delRes.data;
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
        const cleanData = sanitizeTablePayload(
          "maintenance_logs",
          body.data,
          false
        );
        if (cleanData.office_kit_item_id == null) {
          delete cleanData.office_kit_item_id;
        }
        const officeKitItemId =
          body.officeKitItemId ||
          (cleanData.office_kit_item_id as string | undefined) ||
          null;
        const { error: insErr } = await supabase
          .from("maintenance_logs")
          .insert(cleanData);
        if (insErr) {
          if (insErr.message?.includes("office_kit_item_id")) {
            return NextResponse.json(
              {
                error:
                  "Kolom pelaporan Alat Kantor Staf belum terpasang. Jalankan migrasi supabase/migrations/009_maintenance_office_kit.sql di SQL Editor Supabase.",
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: formatSafeDbError(insErr.message) },
            { status: 400 }
          );
        }
        await reconcileMaintenanceTargets(
          supabase,
          body.assetId || (cleanData.asset_id as string | undefined) || null,
          body.roomId || (cleanData.room_id as string | undefined) || null,
          officeKitItemId,
          nowIso
        );
        return NextResponse.json({ ok: true });
      }
      case "update_maintenance": {
        const cleanData = sanitizeTablePayload(
          "maintenance_logs",
          body.data,
          true
        );
        const { data: updatedRow, error: updErr } = await supabase
          .from("maintenance_logs")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id)
          .select("*")
          .maybeSingle();
        if (updErr) {
          return NextResponse.json(
            { error: formatSafeDbError(updErr.message) },
            { status: 400 }
          );
        }
        if (updatedRow) {
          await reconcileMaintenanceTargets(
            supabase,
            (updatedRow.asset_id as string | null) || null,
            (updatedRow.room_id as string | null) || null,
            (updatedRow.office_kit_item_id as string | null) || null,
            nowIso
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_maintenance": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "maintenance", body.id),
          supabase
            .from("maintenance_logs")
            .delete()
            .eq("id", body.id)
            .select("*")
            .maybeSingle(),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }

        const existing = delRes.data;
        if (existing) {
          await reconcileMaintenanceTargets(
            supabase,
            (existing.asset_id as string | null) || null,
            (existing.room_id as string | null) || null,
            (existing.office_kit_item_id as string | null) || null,
            nowIso
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable": {
        const cleanData = sanitizeTablePayload("consumables", body.data, false);
        const { error } = await supabase.from("consumables").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_consumable": {
        const cleanData = sanitizeTablePayload("consumables", body.data, true);
        const { error } = await supabase
          .from("consumables")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_consumable": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "consumable", body.id),
          supabase.from("consumables").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_tx": {
        const cleanData = sanitizeTablePayload(
          "consumable_transactions",
          body.data,
          false
        );
        const { error } = await supabase
          .from("consumable_transactions")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_lecturer": {
        const cleanData = sanitizeTablePayload("lecturers", body.data, false);
        const { error } = await supabase.from("lecturers").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_lecturer": {
        const cleanData = sanitizeTablePayload("lecturers", body.data, true);
        const { error } = await supabase
          .from("lecturers")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_lecturer": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "lecturer", body.id),
          supabase.from("lecturers").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_course": {
        const cleanData = sanitizeTablePayload("courses", body.data, false);
        const { error } = await supabase.from("courses").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_course": {
        const cleanData = sanitizeTablePayload("courses", body.data, true);
        const { error } = await supabase
          .from("courses")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_course": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "course", body.id),
          supabase.from("courses").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_official": {
        const cleanData = sanitizeTablePayload(
          "campus_officials",
          body.data,
          false
        );
        const { error } = await supabase
          .from("campus_officials")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_official": {
        const cleanData = sanitizeTablePayload(
          "campus_officials",
          body.data,
          true
        );
        const { error } = await supabase
          .from("campus_officials")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_official": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "official", body.id),
          supabase.from("campus_officials").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_campus_unit": {
        const cleanData = sanitizeTablePayload(
          "campus_units",
          body.data,
          false
        );
        const { error } = await supabase.from("campus_units").insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_campus_unit": {
        const cleanData = sanitizeTablePayload("campus_units", body.data, true);
        const { error } = await supabase
          .from("campus_units")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_campus_unit": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "unit", body.id),
          supabase.from("campus_units").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_vendor": {
        const cleanData = sanitizeTablePayload(
          "maintenance_vendors",
          body.data,
          false
        );
        const { error } = await supabase
          .from("maintenance_vendors")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_vendor": {
        const cleanData = sanitizeTablePayload(
          "maintenance_vendors",
          body.data,
          true
        );
        const { error } = await supabase
          .from("maintenance_vendors")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_vendor": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "vendor", body.id),
          supabase.from("maintenance_vendors").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_asset_category": {
        const cleanData = sanitizeTablePayload(
          "asset_categories",
          body.data,
          false
        );
        const { error } = await supabase
          .from("asset_categories")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_asset_category": {
        const cleanData = sanitizeTablePayload(
          "asset_categories",
          body.data,
          true
        );
        const { error } = await supabase
          .from("asset_categories")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
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
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_funding_source": {
        const cleanData = sanitizeTablePayload(
          "funding_sources",
          body.data,
          false
        );
        const { error } = await supabase
          .from("funding_sources")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_funding_source": {
        const cleanData = sanitizeTablePayload(
          "funding_sources",
          body.data,
          true
        );
        const { error } = await supabase
          .from("funding_sources")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
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
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_category": {
        const cleanData = sanitizeTablePayload(
          "consumable_categories",
          body.data,
          false
        );
        const { error } = await supabase
          .from("consumable_categories")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_consumable_category": {
        const cleanData = sanitizeTablePayload(
          "consumable_categories",
          body.data,
          true
        );
        const { error } = await supabase
          .from("consumable_categories")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
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
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_consumable_unit": {
        const cleanData = sanitizeTablePayload(
          "consumable_units",
          body.data,
          false
        );
        const { error } = await supabase
          .from("consumable_units")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_consumable_unit": {
        const cleanData = sanitizeTablePayload(
          "consumable_units",
          body.data,
          true
        );
        const { error } = await supabase
          .from("consumable_units")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
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
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_academic_class": {
        const cleanData = sanitizeTablePayload(
          "academic_classes",
          body.data,
          false
        );
        const { error } = await supabase
          .from("academic_classes")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_academic_class": {
        const cleanData = sanitizeTablePayload(
          "academic_classes",
          body.data,
          true
        );
        const { error } = await supabase
          .from("academic_classes")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_academic_class": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "class", body.id),
          supabase.from("academic_classes").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_office_kit_item": {
        const cleanData = sanitizeTablePayload(
          "office_kit_items",
          body.data,
          false
        );
        const { error } = await supabase
          .from("office_kit_items")
          .insert(cleanData);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_office_kit_item": {
        const cleanData = sanitizeTablePayload(
          "office_kit_items",
          body.data,
          true
        );
        const { error } = await supabase
          .from("office_kit_items")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_office_kit_item": {
        const { data: kitRow } = await supabase
          .from("office_kit_items")
          .select("kit_code, name, status")
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
        if (kitRow) {
          const snapshotLabel = `Alat Kantor ${kitRow.kit_code} (${kitRow.name}) [Dihapus]`;
          await supabase
            .from("maintenance_logs")
            .update({ deleted_target_label: snapshotLabel, updated_at: nowIso })
            .eq("office_kit_item_id", body.id)
            .is("deleted_target_label", null);
        }
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "office_kit", body.id),
          supabase.from("office_kit_items").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
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
        const cleanData = sanitizeTablePayload(
          "office_kit_loans",
          body.data,
          false
        );
        const [insRes] = await Promise.all([
          supabase.from("office_kit_loans").insert(cleanData),
          supabase
            .from("office_kit_items")
            .update({ status: "Dipinjam", updated_at: nowIso })
            .in("id", itemIds),
        ]);
        if (insRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(insRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "checkin_office_kit_loan": {
        const cleanData = sanitizeTablePayload(
          "office_kit_loans",
          body.data,
          true
        );
        const damagedSet = new Set(
          Array.isArray(body.damagedItemIds) ? body.damagedItemIds : []
        );
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
        const okIds = itemIds.filter((id) => !damagedSet.has(id));
        const damagedIds = itemIds.filter((id) => damagedSet.has(id));

        const [updRes] = await Promise.all([
          supabase
            .from("office_kit_loans")
            .update({ ...cleanData, updated_at: nowIso })
            .eq("id", body.id),
          okIds.length > 0
            ? supabase
                .from("office_kit_items")
                .update({ status: "Tersedia", updated_at: nowIso })
                .in("id", okIds)
            : Promise.resolve(null),
          damagedIds.length > 0
            ? supabase
                .from("office_kit_items")
                .update({
                  status: "Perbaikan",
                  condition: "Rusak Ringan",
                  updated_at: nowIso,
                })
                .in("id", damagedIds)
            : Promise.resolve(null),
        ]);
        if (updRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(updRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "reopen_office_kit_loan": {
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
        if (itemIds.length > 0) {
          const { data: kitRows, error: kitErr } = await supabase
            .from("office_kit_items")
            .select("id, kit_code, status")
            .in("id", itemIds);
          if (kitErr) {
            return NextResponse.json(
              { error: formatSafeDbError(kitErr.message) },
              { status: 400 }
            );
          }
          const unavailable = (kitRows || []).filter(
            (k) => k.status !== "Tersedia"
          );
          if (unavailable.length > 0) {
            return NextResponse.json(
              {
                error: `Tidak dapat mengembalikan tiket ke status Dipinjam karena ${unavailable
                  .map((k) => `${k.kit_code} (${k.status})`)
                  .join(", ")} sedang tidak tersedia.`,
              },
              { status: 409 }
            );
          }
        }
        const cleanData = sanitizeTablePayload(
          "office_kit_loans",
          body.data || {
            status: "Dipinjam",
            returned_at: null,
            received_by_staff: null,
          },
          true
        );
        const [updRes] = await Promise.all([
          supabase
            .from("office_kit_loans")
            .update({ ...cleanData, updated_at: nowIso })
            .eq("id", body.id),
          itemIds.length > 0
            ? supabase
                .from("office_kit_items")
                .update({ status: "Dipinjam", updated_at: nowIso })
                .in("id", itemIds)
            : Promise.resolve(null),
        ]);
        if (updRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(updRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_office_kit_loan": {
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, "office_loan", body.id),
          supabase
            .from("office_kit_loans")
            .delete()
            .eq("id", body.id)
            .select("id, status, kit_item_ids")
            .maybeSingle(),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }

        const existingLoan = delRes.data;
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
      case "insert_thesis_workflow": {
        const rawTrack = String(body.data?.track || "");
        const rawStage = String(body.data?.stage || "");
        if (
          (rawTrack !== "skripsi" && rawTrack !== "artikel_jurnal") ||
          (rawStage !== "proposal" && rawStage !== "sidang")
        ) {
          return NextResponse.json(
            { error: "Jalur atau tahap Tugas Akhir tidak valid." },
            { status: 400 }
          );
        }
        const track = rawTrack as ThesisTrack;
        const stage = rawStage as ThesisStage;
        const thesisPageKey = getThesisPageKey(track, stage);
        if (!canAccessPage(session, thesisPageKey)) {
          const pageLabel = getPageMeta(thesisPageKey)?.label || thesisPageKey;
          return NextResponse.json(
            {
              error: `Akun Anda tidak memiliki otoritas untuk mengelola halaman ${pageLabel}.`,
            },
            { status: 403 }
          );
        }

        const cleanData = sanitizeTablePayload(
          "thesis_workflows",
          body.data,
          false
        );

        if (cleanData.source_workflow_id) {
          const { data: sourceRow, error: sourceErr } = await supabase
            .from("thesis_workflows")
            .select("id, track, stage")
            .eq("id", String(cleanData.source_workflow_id))
            .maybeSingle();

          if (sourceErr && isMissingRelationError(sourceErr)) {
            return NextResponse.json(
              {
                error:
                  "Tabel Tugas Akhir belum dibuat. Jalankan migrasi supabase/migrations/011_tugas_akhir_workflow.sql di SQL Editor Supabase.",
              },
              { status: 400 }
            );
          }

          if (!sourceRow) {
            return NextResponse.json(
              { error: "Data Proposal sumber tidak ditemukan." },
              { status: 400 }
            );
          }

          const sourcePageKey = getThesisPageKey(
            sourceRow.track as ThesisTrack,
            sourceRow.stage as ThesisStage
          );
          if (!canAccessPage(session, sourcePageKey)) {
            return NextResponse.json(
              {
                error:
                  "Anda tidak memiliki otoritas untuk menyalin data dari halaman Proposal sumber.",
              },
              { status: 403 }
            );
          }
        }

        const { error } = await supabase.from("thesis_workflows").insert({
          ...cleanData,
          track,
          stage,
          created_by_staff:
            cleanData.created_by_staff || session.fullName || session.username,
        });
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "update_thesis_workflow": {
        const { data: existingRow, error: readErr } = await supabase
          .from("thesis_workflows")
          .select("id, track, stage, schedule_date")
          .eq("id", body.id)
          .maybeSingle();

        if (readErr) {
          if (isMissingRelationError(readErr)) {
            return NextResponse.json(
              {
                error:
                  "Tabel Tugas Akhir belum dibuat. Jalankan migrasi supabase/migrations/011_tugas_akhir_workflow.sql di SQL Editor Supabase.",
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: formatSafeDbError(readErr.message) },
            { status: 400 }
          );
        }
        if (!existingRow) {
          return NextResponse.json(
            { error: "Data Tugas Akhir tidak ditemukan." },
            { status: 404 }
          );
        }

        const thesisPageKey = getThesisPageKey(
          existingRow.track as ThesisTrack,
          existingRow.stage as ThesisStage
        );
        if (!canAccessPage(session, thesisPageKey)) {
          const pageLabel = getPageMeta(thesisPageKey)?.label || thesisPageKey;
          return NextResponse.json(
            {
              error: `Akun Anda tidak memiliki otoritas untuk mengelola halaman ${pageLabel}.`,
            },
            { status: 403 }
          );
        }

        const cleanData = sanitizeTablePayload(
          "thesis_workflows",
          body.data,
          true
        );
        delete cleanData.track;
        delete cleanData.stage;
        delete cleanData.ticket_code;
        delete cleanData.source_workflow_id;

        if (
          cleanData.board_column === "bikin_surat" ||
          cleanData.board_column === "selesai_arsip"
        ) {
          const effectiveSchedule =
            cleanData.schedule_date !== undefined
              ? cleanData.schedule_date
              : existingRow.schedule_date;
          if (!effectiveSchedule) {
            return NextResponse.json(
              {
                error:
                  "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat.",
              },
              { status: 400 }
            );
          }
        }

        const { error } = await supabase
          .from("thesis_workflows")
          .update({ ...cleanData, updated_at: nowIso })
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_thesis_workflow": {
        const { data: existingRow, error: readErr } = await supabase
          .from("thesis_workflows")
          .select("id, track, stage")
          .eq("id", body.id)
          .maybeSingle();

        if (readErr) {
          if (isMissingRelationError(readErr)) {
            return NextResponse.json(
              {
                error:
                  "Tabel Tugas Akhir belum dibuat. Jalankan migrasi supabase/migrations/011_tugas_akhir_workflow.sql di SQL Editor Supabase.",
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: formatSafeDbError(readErr.message) },
            { status: 400 }
          );
        }
        if (!existingRow) {
          return NextResponse.json(
            { error: "Data Tugas Akhir tidak ditemukan." },
            { status: 404 }
          );
        }

        const thesisPageKey = getThesisPageKey(
          existingRow.track as ThesisTrack,
          existingRow.stage as ThesisStage
        );
        if (!canAccessPage(session, thesisPageKey)) {
          const pageLabel = getPageMeta(thesisPageKey)?.label || thesisPageKey;
          return NextResponse.json(
            {
              error: `Akun Anda tidak memiliki otoritas untuk mengelola halaman ${pageLabel}.`,
            },
            { status: 403 }
          );
        }

        const entityType = getThesisEntityType(
          existingRow.track as ThesisTrack,
          existingRow.stage as ThesisStage
        );
        const [, delRes] = await Promise.all([
          cleanupEntityArtifacts(supabase, entityType, body.id),
          supabase.from("thesis_workflows").delete().eq("id", body.id),
        ]);
        if (delRes.error) {
          return NextResponse.json(
            { error: formatSafeDbError(delRes.error.message) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "insert_note": {
        artifactsTablesMissingUntil = 0;
        const entityType = String(body.data?.entity_type || "") as SarprasEntityType;
        const notePageKey = ENTITY_TYPE_TO_PAGE_KEY[entityType];
        if (!notePageKey || !canAccessPage(session, notePageKey)) {
          return NextResponse.json(
            { error: "Anda tidak memiliki otoritas untuk menambah catatan pada modul ini." },
            { status: 403 }
          );
        }
        const cleanData = sanitizeTablePayload("sarpras_notes", body.data, false);
        const { error } = await supabase.from("sarpras_notes").insert({
          ...cleanData,
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
          return NextResponse.json(
            { error: formatSafeDbError(msg) },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "delete_attachment": {
        const { data: attRow } = await supabase
          .from("sarpras_attachments")
          .select("id, entity_type, file_path")
          .eq("id", body.id)
          .maybeSingle();
        if (!attRow) {
          return NextResponse.json(
            { error: "Lampiran tidak ditemukan." },
            { status: 404 }
          );
        }
        const attPageKey =
          ENTITY_TYPE_TO_PAGE_KEY[
            String(attRow.entity_type) as SarprasEntityType
          ];
        if (!attPageKey || !canAccessPage(session, attPageKey)) {
          return NextResponse.json(
            { error: "Anda tidak memiliki otoritas untuk menghapus lampiran pada modul ini." },
            { status: 403 }
          );
        }
        if (attRow.file_path) {
          await supabase.storage
            .from("sarpras-files")
            .remove([String(attRow.file_path)]);
        }
        const { error } = await supabase
          .from("sarpras_attachments")
          .delete()
          .eq("id", body.id);
        if (error) {
          return NextResponse.json(
            { error: formatSafeDbError(error.message) },
            { status: 400 }
          );
        }
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
