import ExcelJS from "exceljs";
import {
  ASSET_CATEGORY_CODES,
  ASSET_CONDITION_LIST,
  ASSET_PORTABLE_OPTIONS,
  cleanCellText,
  ExistingAssetRef,
  formatCategoryDropdownOption,
  formatRoomDropdownOption,
  GUDANG_ROOM_LABEL,
  IMPORT_TEMPLATE_HEADERS,
  ImportParseResult,
  MAX_IMPORT_ROWS,
  RawImportAssetRow,
  RoomLookupRef,
  validateImportAssetRows,
} from "@/lib/sarpras/asset-import-shared";

const SHEET_IMPORT = "Import_Aset";
const SHEET_REF = "Referensi_Enum";
const SHEET_GUIDE = "Panduan_Pengisian";

function normalizeHeaderKey(header: string): string {
  return header.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function extractExcelCellString(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return "";

  if (typeof val === "object") {
    if ("result" in val && val.result !== undefined && val.result !== null) {
      return cleanCellText(val.result);
    }
    if ("richText" in val && Array.isArray(val.richText)) {
      return cleanCellText(val.richText.map((part) => part.text).join(""));
    }
    if ("text" in val && val.text !== undefined) {
      return cleanCellText(val.text);
    }
    if (val instanceof Date) {
      return String(val.getFullYear());
    }
  }

  return cleanCellText(val);
}

/**
 * Menghasilkan file Excel (.xlsx) template import aset lengkap dengan dropdown enum
 * Kategori Inventaris, Lokasi Penempatan Ruangan (dinamis dari database), dan Kondisi Barang.
 */
export async function buildAssetImportTemplateBuffer(
  rooms: RoomLookupRef[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StafCenter Sarpras";
  workbook.created = new Date();

  const importSheet = workbook.addWorksheet(SHEET_IMPORT, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const refSheet = workbook.addWorksheet(SHEET_REF);
  const guideSheet = workbook.addWorksheet(SHEET_GUIDE);

  // 1. Isi Sheet Referensi_Enum
  const categoryOptions = ASSET_CATEGORY_CODES.map(formatCategoryDropdownOption);
  const roomOptions = [
    ...rooms.map(formatRoomDropdownOption),
    GUDANG_ROOM_LABEL,
  ];
  const conditionOptions = [...ASSET_CONDITION_LIST];
  const portableOptions = [...ASSET_PORTABLE_OPTIONS];

  refSheet.columns = [
    { header: "Kategori Inventaris", key: "cat", width: 30 },
    { header: "Lokasi Penempatan Ruangan", key: "room", width: 38 },
    { header: "Kondisi Barang", key: "cond", width: 20 },
    { header: "Aset Portabel", key: "port", width: 16 },
  ];

  const refHeader = refSheet.getRow(1);
  refHeader.height = 24;
  refHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const maxRefRows = Math.max(
    categoryOptions.length,
    roomOptions.length,
    conditionOptions.length,
    portableOptions.length
  );

  for (let i = 0; i < maxRefRows; i++) {
    refSheet.addRow([
      categoryOptions[i] ?? "",
      roomOptions[i] ?? "",
      conditionOptions[i] ?? "",
      portableOptions[i] ?? "",
    ]);
  }

  // Proteksi ringan agar daftar enum referensi tidak sengaja terhapus pengguna
  await refSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  // 2. Susun Sheet Import_Aset
  const columnWidths = [28, 36, 32, 26, 18, 22, 20, 28, 24, 24, 34];
  importSheet.columns = IMPORT_TEMPLATE_HEADERS.map((header, idx) => ({
    header,
    key: `col_${idx}`,
    width: columnWidths[idx] || 24,
  }));

  const headerRow = importSheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  const catRange = `=${SHEET_REF}!$A$2:$A$${1 + categoryOptions.length}`;
  const roomRange = `=${SHEET_REF}!$B$2:$B$${1 + roomOptions.length}`;
  const condRange = `=${SHEET_REF}!$C$2:$C$${1 + conditionOptions.length}`;
  const portRange = `=${SHEET_REF}!$D$2:$D$${1 + portableOptions.length}`;

  // Format kolom dan pasang Data Validation untuk baris 2 s.d. MAX_IMPORT_ROWS + 1
  for (let rowIdx = 2; rowIdx <= MAX_IMPORT_ROWS + 1; rowIdx++) {
    const row = importSheet.getRow(rowIdx);

    row.getCell(1).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [catRange],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Kategori Inventaris Tidak Valid",
      error: "Pilih kategori dari dropdown yang tersedia.",
    };

    row.getCell(2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [roomRange],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Lokasi Ruangan Tidak Valid",
      error: "Pilih ruangan dari dropdown atau pilih Gudang Cadangan Sarpras.",
    };

    const yearCell = row.getCell(5);
    yearCell.numFmt = "0";
    yearCell.dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [1990, 2100],
      allowBlank: false,
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Tahun Pengadaan Tidak Valid",
      error: "Isi tahun pengadaan berupa angka antara 1990 hingga 2100.",
    };

    const costCell = row.getCell(6);
    costCell.numFmt = "#,##0";
    costCell.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: false,
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Harga Perolehan Tidak Valid",
      error: "Isi harga perolehan berupa angka >= 0 tanpa huruf.",
    };

    row.getCell(7).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [condRange],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Kondisi Barang Tidak Valid",
      error: "Pilih salah satu kondisi: Baik, Rusak Ringan, Rusak Berat, atau Hilang.",
    };

    // Format teks agar nomor seri berawalan nol tidak hilang
    row.getCell(9).numFmt = "@";

    row.getCell(10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [portRange],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Pilihan Aset Portabel Tidak Valid",
      error: "Pilih Ya atau Tidak.",
    };
  }

  // 3. Susun Sheet Panduan_Pengisian
  guideSheet.columns = [
    { header: "Nama Kolom", key: "col", width: 32 },
    { header: "Status", key: "req", width: 14 },
    { header: "Keterangan & Aturan Pengisian", key: "desc", width: 64 },
    { header: "Contoh Isian", key: "ex", width: 34 },
  ];

  const guideHeader = guideSheet.getRow(1);
  guideHeader.height = 26;
  guideHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const sampleRoom =
    rooms.length > 0 ? formatRoomDropdownOption(rooms[0]) : GUDANG_ROOM_LABEL;

  const guideRows: Array<[string, string, string, string]> = [
    [
      "Kategori Inventaris *",
      "Wajib",
      "Pilih dari dropdown pada sheet Import_Aset (ELK, KOM, KLM, AUD, MBL, LNY). Kode INV-[KATEGORI]-[TAHUN]-[URUT] dibuat otomatis oleh sistem.",
      "ELK - Elektronik & Visual",
    ],
    [
      "Lokasi Penempatan Ruangan *",
      "Wajib",
      "Pilih ruangan terdaftar dari dropdown atau 'Gudang Cadangan Sarpras' jika aset belum ditempatkan.",
      sampleRoom,
    ],
    [
      "Nama Barang / Aset *",
      "Wajib",
      "Nama deskriptif unit barang/aset (maksimal 180 karakter).",
      "Proyektor Laser WUXGA",
    ],
    [
      "Merk / Tipe / Model *",
      "Wajib",
      "Merk dan tipe/model unit (maksimal 150 karakter).",
      "Epson EB-L530U",
    ],
    [
      "Tahun Pengadaan *",
      "Wajib",
      "Bilangan bulat tahun pengadaan antara 1990 sampai 2100.",
      "2026",
    ],
    [
      "Harga Perolehan (Rp) *",
      "Wajib",
      "Angka nominal harga dalam Rupiah (>= 0) tanpa simbol mata uang.",
      "5000000",
    ],
    [
      "Kondisi Barang *",
      "Wajib",
      "Pilih dari dropdown: Baik, Rusak Ringan, Rusak Berat, atau Hilang.",
      "Baik",
    ],
    [
      "Sumber Dana Pengadaan *",
      "Wajib",
      "Sumber anggaran pengadaan barang (maksimal 100 karakter).",
      "Dana Operasional Kampus",
    ],
    [
      "Nomor Seri Pabrik",
      "Opsional",
      "Nomor seri unik pabrik. Jika diisi, tidak boleh duplikat dengan aset lain maupun antarbaris Excel.",
      "EPS-L530-9921",
    ],
    [
      "Aset Portabel (Ya/Tidak)",
      "Opsional",
      "Pilih 'Ya' agar aset muncul di menu Peminjaman lintas ruangan, atau 'Tidak' jika permanen (default: Tidak).",
      "Tidak",
    ],
    [
      "Catatan Teknis / Posisi",
      "Opsional",
      "Catatan posisi pemasangan atau kelengkapan aset.",
      "Terpasang pada bracket plafon baris depan",
    ],
  ];

  for (const item of guideRows) {
    const r = guideSheet.addRow(item);
    r.alignment = { vertical: "top", wrapText: true };
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/**
 * Membaca buffer berkas Excel (.xlsx), memetakan header, dan menjalankan validasi
 * menyeluruh sebelum pratinjau maupun import.
 */
export async function parseAssetImportWorkbook(
  buffer: ArrayBuffer | Buffer,
  rooms: RoomLookupRef[],
  existingAssets: ExistingAssetRef[]
): Promise<ImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    await workbook.xlsx.load(nodeBuf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return {
      ok: false,
      error:
        "Berkas tidak dapat dibaca sebagai dokumen Excel (.xlsx). Pastikan format berkas benar dan tidak terproteksi kata sandi.",
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  const sheet =
    workbook.getWorksheet(SHEET_IMPORT) || workbook.worksheets[0];

  if (!sheet) {
    return {
      ok: false,
      error: "Lembar kerja tidak ditemukan di dalam berkas Excel.",
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  const headerRow = sheet.getRow(1);
  const colIndexByNormalizedHeader = new Map<string, number>();

  headerRow.eachCell((cell, colNumber) => {
    const text = extractExcelCellString(cell);
    const key = normalizeHeaderKey(text);
    if (key && !colIndexByNormalizedHeader.has(key)) {
      colIndexByNormalizedHeader.set(key, colNumber);
    }
  });

  const requiredKeys = [
    "Kategori Inventaris *",
    "Lokasi Penempatan Ruangan *",
    "Nama Barang / Aset *",
    "Merk / Tipe / Model *",
    "Tahun Pengadaan *",
    "Harga Perolehan (Rp) *",
    "Kondisi Barang *",
    "Sumber Dana Pengadaan *",
  ];

  const missingHeaders = requiredKeys.filter(
    (h) => !colIndexByNormalizedHeader.has(normalizeHeaderKey(h))
  );

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      error: `Header kolom tidak sesuai template StafCenter. Kolom berikut tidak ditemukan pada baris 1: ${missingHeaders.join(", ")}.`,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  const getColIndex = (label: string): number | undefined =>
    colIndexByNormalizedHeader.get(normalizeHeaderKey(label));

  const idxCat = getColIndex("Kategori Inventaris *")!;
  const idxRoom = getColIndex("Lokasi Penempatan Ruangan *")!;
  const idxName = getColIndex("Nama Barang / Aset *")!;
  const idxBrand = getColIndex("Merk / Tipe / Model *")!;
  const idxYear = getColIndex("Tahun Pengadaan *")!;
  const idxCost = getColIndex("Harga Perolehan (Rp) *")!;
  const idxCond = getColIndex("Kondisi Barang *")!;
  const idxFunding = getColIndex("Sumber Dana Pengadaan *")!;
  const idxSerial = getColIndex("Nomor Seri Pabrik");
  const idxPortable = getColIndex("Aset Portabel (Ya/Tidak)");
  const idxNotes = getColIndex("Catatan Teknis / Posisi");

  const rawRows: RawImportAssetRow[] = [];
  const totalSheetRows = sheet.rowCount;

  for (let r = 2; r <= totalSheetRows; r++) {
    const row = sheet.getRow(r);
    const readCol = (colIdx: number | undefined): string =>
      colIdx ? extractExcelCellString(row.getCell(colIdx)) : "";

    const category = readCol(idxCat);
    const room = readCol(idxRoom);
    const name = readCol(idxName);
    const brandModel = readCol(idxBrand);
    const procurementYear = readCol(idxYear);
    const acquisitionCost = readCol(idxCost);
    const condition = readCol(idxCond);
    const fundingSource = readCol(idxFunding);
    const serialNumber = readCol(idxSerial);
    const isPortable = readCol(idxPortable);
    const notes = readCol(idxNotes);

    const hasAnyValue = [
      category,
      room,
      name,
      brandModel,
      procurementYear,
      acquisitionCost,
      condition,
      fundingSource,
      serialNumber,
      isPortable,
      notes,
    ].some((v) => v.length > 0);

    if (!hasAnyValue) continue;

    rawRows.push({
      rowNumber: r,
      category,
      room,
      name,
      brandModel,
      procurementYear,
      acquisitionCost,
      condition,
      fundingSource,
      serialNumber,
      isPortable,
      notes,
    });
  }

  return validateImportAssetRows(rawRows, rooms, existingAssets);
}
