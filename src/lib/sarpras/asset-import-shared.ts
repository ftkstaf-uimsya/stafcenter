import {
  ASSET_CATEGORY_LABELS,
  generateInventoryCode,
} from "@/lib/supabase/client";
import {
  Asset,
  AssetCategory,
  AssetCategoryCode,
  AssetCondition,
  FundingSource,
  Room,
} from "@/types/sarpras";

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const GUDANG_ROOM_LABEL = "Gudang Cadangan Sarpras";

export const ASSET_CATEGORY_CODES: AssetCategoryCode[] = [
  "ELK",
  "KOM",
  "KLM",
  "AUD",
  "MBL",
  "LNY",
];

export type AssetCategoryRef = Pick<AssetCategory, "code" | "name">;
export type FundingSourceRef = Pick<FundingSource, "id" | "code" | "name">;

export const DEFAULT_ASSET_CATEGORY_REFS: AssetCategoryRef[] =
  ASSET_CATEGORY_CODES.map((code) => ({
    code,
    name: ASSET_CATEGORY_LABELS[code] || code,
  }));

export const ASSET_CONDITION_LIST: AssetCondition[] = [
  "Baik",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
];

export const ASSET_PORTABLE_OPTIONS = ["Tidak", "Ya"] as const;

export const IMPORT_TEMPLATE_HEADERS = [
  "Kategori Inventaris *",
  "Lokasi Penempatan Ruangan *",
  "Nama Barang / Aset *",
  "Merk / Tipe / Model *",
  "Tahun Pengadaan *",
  "Harga Perolehan (Rp) *",
  "Kondisi Barang *",
  "Sumber Dana Pengadaan *",
  "Nomor Seri Pabrik",
  "Aset Portabel (Ya/Tidak)",
  "Catatan Teknis / Posisi",
] as const;

export interface RawImportAssetRow {
  rowNumber: number;
  category: string;
  room: string;
  name: string;
  brandModel: string;
  procurementYear: string;
  acquisitionCost: string;
  condition: string;
  fundingSource: string;
  serialNumber: string;
  isPortable: string;
  notes: string;
}

export interface NormalizedImportAssetPayload {
  category: AssetCategoryCode;
  category_label: string;
  room_id: string | null;
  name: string;
  brand_model: string;
  procurement_year: number;
  acquisition_cost: number;
  condition: AssetCondition;
  funding_source: string;
  funding_source_id?: string | null;
  serial_number: string;
  is_portable: boolean;
  notes: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  rawCategory: string;
  rawRoom: string;
  name: string;
  brandModel: string;
  rawYear: string;
  rawCost: string;
  rawCondition: string;
  fundingSource: string;
  fundingSourceId?: string | null;
  serialNumber: string;
  rawPortable: string;
  notes: string;
  projectedCode: string | null;
  roomLabel: string;
  errors: string[];
  isValid: boolean;
  payload: NormalizedImportAssetPayload | null;
}

export interface ImportParseResult {
  ok: boolean;
  error?: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ImportPreviewRow[];
}

export type RoomLookupRef = Pick<Room, "id" | "code" | "name">;
export type ExistingAssetRef = Pick<Asset, "id" | "inventory_code" | "serial_number">;

/**
 * Menghitung nomor urut maksimum dari daftar kode inventaris berformat INV-[KAT]-[TAHUN]-[URUT].
 */
export function extractMaxInventorySequence(codes: string[]): number {
  let maxSeq = codes.length;
  for (const code of codes) {
    const parts = code.split("-");
    const last = Number(parts[parts.length - 1]);
    if (!Number.isNaN(last) && last > maxSeq) {
      maxSeq = last;
    }
  }
  return maxSeq;
}

/**
 * Menormalkan nomor seri untuk deteksi duplikat (kosong atau "-" dianggap tidak memiliki serial).
 */
export function normalizeSerialKey(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned === "-") return null;
  return cleaned.toLowerCase();
}

export function cleanCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u0000/g, "").trim();
}

export function formatCategoryDropdownOption(
  codeOrCategory: AssetCategoryCode | AssetCategoryRef
): string {
  if (typeof codeOrCategory === "string") {
    return `${codeOrCategory} - ${ASSET_CATEGORY_LABELS[codeOrCategory] || codeOrCategory}`;
  }
  return `${codeOrCategory.code} - ${codeOrCategory.name}`;
}

export function formatFundingSourceDropdownOption(
  source: FundingSourceRef
): string {
  return source.name;
}

export function formatRoomDropdownOption(room: Pick<Room, "code" | "name">): string {
  return `${room.code} - ${room.name}`;
}

export function resolveCategoryEntry(
  raw: string,
  categories: AssetCategoryRef[] = DEFAULT_ASSET_CATEGORY_REFS
): AssetCategoryRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const list = categories.length > 0 ? categories : DEFAULT_ASSET_CATEGORY_REFS;
  const upper = trimmed.toUpperCase();

  const directMatch = list.find((c) => c.code.toUpperCase() === upper);
  if (directMatch) return directMatch;

  // Cocokkan format "ELK - Elektronik & Visual" atau "ELK-..."
  const prefixToken = upper.split(/[\s\-–:]+/)[0];
  const prefixMatch = list.find((c) => c.code.toUpperCase() === prefixToken);
  if (prefixMatch) return prefixMatch;

  // Cocokkan berdasarkan label penuh
  const lower = trimmed.toLowerCase();
  const labelMatch = list.find((c) => c.name.toLowerCase() === lower);
  if (labelMatch) return labelMatch;

  return null;
}

export function resolveCategoryCode(
  raw: string,
  categories: AssetCategoryRef[] = DEFAULT_ASSET_CATEGORY_REFS
): AssetCategoryCode | null {
  return resolveCategoryEntry(raw, categories)?.code || null;
}

export function resolveFundingSourceSelection(
  raw: string,
  fundingSources?: FundingSourceRef[]
): { matched: true; id: string | null; name: string } | { matched: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { matched: false };

  if (!fundingSources || fundingSources.length === 0) {
    return { matched: true, id: null, name: trimmed };
  }

  const lower = trimmed.toLowerCase();
  for (const fs of fundingSources) {
    const codeName = `${fs.code} - ${fs.name}`.toLowerCase();
    if (
      lower === fs.name.toLowerCase() ||
      lower === fs.code.toLowerCase() ||
      lower === codeName
    ) {
      return { matched: true, id: fs.id, name: fs.name };
    }
  }

  return { matched: false };
}

export function resolveRoomSelection(
  raw: string,
  rooms: RoomLookupRef[]
): { matched: true; roomId: string | null; label: string } | { matched: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { matched: false };

  const lower = trimmed.toLowerCase();
  if (
    lower === GUDANG_ROOM_LABEL.toLowerCase() ||
    lower === "gudang" ||
    lower === "gudang cadangan"
  ) {
    return { matched: true, roomId: null, label: GUDANG_ROOM_LABEL };
  }

  for (const room of rooms) {
    const formatted = formatRoomDropdownOption(room).toLowerCase();
    const parenFormatted = `${room.code} (${room.name})`.toLowerCase();
    if (
      lower === formatted ||
      lower === parenFormatted ||
      lower === room.code.toLowerCase() ||
      lower === room.name.toLowerCase()
    ) {
      return {
        matched: true,
        roomId: room.id,
        label: formatRoomDropdownOption(room),
      };
    }
  }

  // Fallback jika pengguna mengubah teks setelah tanda " - "
  const prefix = trimmed.split(/\s+-\s+/)[0]?.trim().toLowerCase();
  if (prefix) {
    const byPrefix = rooms.find((r) => r.code.toLowerCase() === prefix);
    if (byPrefix) {
      return {
        matched: true,
        roomId: byPrefix.id,
        label: formatRoomDropdownOption(byPrefix),
      };
    }
  }

  return { matched: false };
}

export function resolveCondition(raw: string): AssetCondition | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return ASSET_CONDITION_LIST.find((c) => c.toLowerCase() === trimmed) || null;
}

export function resolvePortableFlag(
  raw: string
): { valid: true; value: boolean } | { valid: false } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "tidak" || trimmed === "no" || trimmed === "false" || trimmed === "0") {
    return { valid: true, value: false };
  }
  if (trimmed === "ya" || trimmed === "yes" || trimmed === "true" || trimmed === "1") {
    return { valid: true, value: true };
  }
  return { valid: false };
}

/**
 * Mengurai string nominal Rupiah atau angka Excel menjadi angka non-negatif.
 */
export function parseCurrencyNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Jika sudah format angka standar JS/Excel (mis. "5000000" atau "5000000.5")
  const normalizedPlain = trimmed.replace(/\s+/g, "").replace(/^rp\.?/i, "");
  if (/^\d+(\.\d+)?$/.test(normalizedPlain)) {
    const num = Number(normalizedPlain);
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
  }

  // Format pemisah ribuan titik ala Indonesia: "5.000.000" atau "5.000.000,00"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalizedPlain)) {
    const num = Number(normalizedPlain.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
  }

  // Format pemisah ribuan koma ala US: "5,000,000" atau "5,000,000.00"
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalizedPlain)) {
    const num = Number(normalizedPlain.replace(/,/g, ""));
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
  }

  return null;
}

/**
 * Memvalidasi seluruh baris hasil baca Excel dan mendeteksi duplikasi nomor seri
 * baik terhadap data aset eksisting maupun antarbaris di dalam berkas Excel.
 */
export function validateImportAssetRows(
  rawRows: RawImportAssetRow[],
  rooms: RoomLookupRef[],
  existingAssets: ExistingAssetRef[],
  categories: AssetCategoryRef[] = DEFAULT_ASSET_CATEGORY_REFS,
  fundingSources?: FundingSourceRef[]
): ImportParseResult {
  if (rawRows.length === 0) {
    return {
      ok: false,
      error: "Berkas Excel tidak berisi data aset untuk diimport.",
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Jumlah baris melebihi batas maksimal ${MAX_IMPORT_ROWS} aset per sekali import (ditemukan ${rawRows.length} baris). Bagi berkas menjadi beberapa bagian.`,
      totalRows: rawRows.length,
      validCount: 0,
      errorCount: rawRows.length,
      rows: [],
    };
  }

  const activeCategories =
    categories.length > 0 ? categories : DEFAULT_ASSET_CATEGORY_REFS;
  const categoryCodesHint = activeCategories.map((c) => c.code).join(", ");

  const existingSerialMap = new Map<string, string>();
  for (const asset of existingAssets) {
    const key = normalizeSerialKey(asset.serial_number);
    if (key && !existingSerialMap.has(key)) {
      existingSerialMap.set(key, asset.inventory_code);
    }
  }

  const batchSerialFirstRow = new Map<string, number>();
  for (const row of rawRows) {
    const key = normalizeSerialKey(row.serialNumber);
    if (key && !batchSerialFirstRow.has(key)) {
      batchSerialFirstRow.set(key, row.rowNumber);
    }
  }

  let nextSeq = extractMaxInventorySequence(existingAssets.map((a) => a.inventory_code));
  const seenSerialInLoop = new Map<string, number>();

  const previewRows: ImportPreviewRow[] = rawRows.map((raw) => {
    const errors: string[] = [];

    const categoryMatch = resolveCategoryEntry(raw.category, activeCategories);
    if (!categoryMatch) {
      errors.push(
        raw.category
          ? `Kategori "${raw.category}" tidak dikenal (gunakan: ${categoryCodesHint}).`
          : "Kategori Inventaris wajib diisi."
      );
    }

    const roomMatch = resolveRoomSelection(raw.room, rooms);
    if (!roomMatch.matched) {
      errors.push(
        raw.room
          ? `Lokasi ruangan "${raw.room}" tidak ditemukan di Master Ruangan.`
          : "Lokasi Penempatan Ruangan wajib diisi (pilih ruangan atau Gudang Cadangan Sarpras)."
      );
    }

    const name = raw.name.trim();
    if (!name) {
      errors.push("Nama Barang / Aset wajib diisi.");
    } else if (name.length > 180) {
      errors.push("Nama Barang maksimal 180 karakter.");
    }

    const brandModel = raw.brandModel.trim();
    if (!brandModel) {
      errors.push("Merk / Tipe / Model wajib diisi.");
    } else if (brandModel.length > 150) {
      errors.push("Merk / Tipe / Model maksimal 150 karakter.");
    }

    const yearNum = Number(raw.procurementYear.trim());
    if (
      !raw.procurementYear.trim() ||
      !Number.isInteger(yearNum) ||
      yearNum < 1990 ||
      yearNum > 2100
    ) {
      errors.push("Tahun Pengadaan harus berupa bilangan bulat antara 1990 hingga 2100.");
    }

    const costNum = parseCurrencyNumber(raw.acquisitionCost);
    if (costNum === null) {
      errors.push("Harga Perolehan (Rp) harus berupa angka >= 0.");
    }

    const condition = resolveCondition(raw.condition);
    if (!condition) {
      errors.push(
        raw.condition
          ? `Kondisi "${raw.condition}" tidak valid (pilih Baik, Rusak Ringan, Rusak Berat, atau Hilang).`
          : "Kondisi Barang wajib diisi."
      );
    }

    const rawFunding = raw.fundingSource.trim();
    const fundingMatch = resolveFundingSourceSelection(rawFunding, fundingSources);
    if (!rawFunding) {
      errors.push("Sumber Dana Pengadaan wajib diisi.");
    } else if (rawFunding.length > 100) {
      errors.push("Sumber Dana maksimal 100 karakter.");
    } else if (!fundingMatch.matched) {
      errors.push(
        `Sumber Dana "${rawFunding}" tidak terdaftar di Master Sumber Dana.`
      );
    }

    const fundingSource = fundingMatch.matched ? fundingMatch.name : rawFunding;
    const fundingSourceId = fundingMatch.matched ? fundingMatch.id : null;

    const serialNumber = raw.serialNumber.trim() || "-";
    if (serialNumber.length > 100) {
      errors.push("Nomor Seri Pabrik maksimal 100 karakter.");
    } else {
      const serialKey = normalizeSerialKey(serialNumber);
      if (serialKey) {
        const existingCode = existingSerialMap.get(serialKey);
        if (existingCode) {
          errors.push(
            `Nomor seri "${serialNumber}" sudah terdaftar pada aset ${existingCode}.`
          );
        } else {
          const prevRowNum = seenSerialInLoop.get(serialKey);
          if (prevRowNum !== undefined) {
            errors.push(
              `Nomor seri "${serialNumber}" duplikat dengan baris Excel ke-${prevRowNum}.`
            );
          } else {
            seenSerialInLoop.set(serialKey, raw.rowNumber);
          }
        }
      }
    }

    const portableRes = resolvePortableFlag(raw.isPortable);
    if (!portableRes.valid) {
      errors.push(
        `Kolom Aset Portabel "${raw.isPortable}" harus diisi "Ya" atau "Tidak".`
      );
    }

    const notes = raw.notes.trim();
    const isValid = errors.length === 0;

    let projectedCode: string | null = null;
    let payload: NormalizedImportAssetPayload | null = null;

    if (
      isValid &&
      categoryMatch &&
      roomMatch.matched &&
      condition &&
      costNum !== null &&
      portableRes.valid
    ) {
      nextSeq += 1;
      projectedCode = generateInventoryCode(categoryMatch.code, yearNum, nextSeq);
      payload = {
        category: categoryMatch.code,
        category_label: categoryMatch.name,
        room_id: roomMatch.roomId,
        name,
        brand_model: brandModel,
        procurement_year: yearNum,
        acquisition_cost: costNum,
        condition,
        funding_source: fundingSource,
        funding_source_id: fundingSourceId,
        serial_number: serialNumber,
        is_portable: portableRes.value,
        notes,
      };
    }

    return {
      rowNumber: raw.rowNumber,
      rawCategory: raw.category,
      rawRoom: raw.room,
      name,
      brandModel,
      rawYear: raw.procurementYear,
      rawCost: raw.acquisitionCost,
      rawCondition: raw.condition,
      fundingSource,
      fundingSourceId,
      serialNumber,
      rawPortable: raw.isPortable || "Tidak",
      notes,
      projectedCode,
      roomLabel: roomMatch.matched ? roomMatch.label : raw.room || "-",
      errors,
      isValid,
      payload,
    };
  });

  const validCount = previewRows.filter((r) => r.isValid).length;
  const errorCount = previewRows.length - validCount;

  return {
    ok: true,
    totalRows: previewRows.length,
    validCount,
    errorCount,
    rows: previewRows,
  };
}
