"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { formatCurrencyIDR } from "@/lib/supabase/client";
import {
  ImportParseResult,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  NormalizedImportAssetPayload,
} from "@/lib/sarpras/asset-import-shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetImportModal({ isOpen, onClose }: AssetImportModalProps) {
  const { rooms, assets, isLiveSupabase, importAssets, notify } = useSarpras();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedFileName, setSelectedFileName] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"ALL" | "ERROR">("ALL");

  const resetState = () => {
    setSelectedFileName("");
    setGlobalError("");
    setParseResult(null);
    setPreviewFilter("ALL");
    setParsingFile(false);
    setSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (submitting || parsingFile) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setGlobalError("");
    setDownloadingTemplate(true);
    try {
      const res = isLiveSupabase
        ? await fetch("/api/sarpras/assets/template", {
            method: "GET",
            cache: "no-store",
          })
        : await fetch("/api/sarpras/assets/template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rooms: rooms.map((r) => ({
                id: r.id,
                code: r.code,
                name: r.name,
              })),
            }),
          });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error || "Gagal membuat berkas template Excel dari server."
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Template_Import_Inventaris_StafCenter.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      notify(
        "info",
        "Template Excel Diunduh",
        "Isi data pada sheet Import_Aset menggunakan dropdown enum yang tersedia."
      );
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat mengunduh template Excel."
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    setGlobalError("");
    setParseResult(null);
    setPreviewFilter("ALL");

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setSelectedFileName("");
      setGlobalError(
        "Format berkas tidak didukung. Gunakan file Excel berekstensi .xlsx sesuai template."
      );
      return;
    }

    if (file.size === 0) {
      setSelectedFileName("");
      setGlobalError("Berkas Excel yang dipilih kosong.");
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setSelectedFileName("");
      setGlobalError("Ukuran berkas melebihi batas maksimal 5 MB.");
      return;
    }

    setSelectedFileName(file.name);
    setParsingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (!isLiveSupabase) {
        formData.append(
          "roomsJson",
          JSON.stringify(
            rooms.map((r) => ({ id: r.id, code: r.code, name: r.name }))
          )
        );
        formData.append(
          "assetsJson",
          JSON.stringify(
            assets.map((a) => ({
              id: a.id,
              inventory_code: a.inventory_code,
              serial_number: a.serial_number,
            }))
          )
        );
      }

      const res = await fetch("/api/sarpras/assets/parse", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as ImportParseResult;

      if (!res.ok || !data.ok) {
        setGlobalError(
          data.error ||
            "Berkas Excel gagal divalidasi. Pastikan header sesuai dengan template resmi."
        );
        return;
      }

      setParseResult(data);
      if (data.errorCount > 0) {
        setPreviewFilter("ERROR");
      }
    } catch {
      setGlobalError(
        "Koneksi ke server terputus saat membaca berkas Excel. Silakan coba lagi."
      );
    } finally {
      setParsingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (parsingFile || submitting) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const displayedRows = useMemo(() => {
    if (!parseResult) return [];
    if (previewFilter === "ERROR") {
      return parseResult.rows.filter((r) => !r.isValid);
    }
    return parseResult.rows;
  }, [parseResult, previewFilter]);

  const canCommitImport =
    Boolean(parseResult) &&
    parseResult!.ok &&
    parseResult!.validCount > 0 &&
    parseResult!.errorCount === 0 &&
    !parsingFile &&
    !submitting;

  const handleCommitImport = async () => {
    if (!parseResult || !canCommitImport) return;
    const payloads = parseResult.rows
      .map((r) => r.payload)
      .filter((p): p is NormalizedImportAssetPayload => p !== null);

    setGlobalError("");
    setSubmitting(true);
    const res = await importAssets(payloads);
    setSubmitting(false);

    if (!res.ok) {
      setGlobalError(
        res.error ||
          "Gagal menyimpan data import ke database. Periksa kembali baris data atau muat ulang halaman."
      );
      return;
    }

    resetState();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Data Inventaris Aset via Excel"
      description="Unduh template ber-dropdown enum, isi daftar aset, lalu tinjau hasil validasi sebelum disimpan ke database."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Langkah 1: Unduh Template Dinamis */}
        <section className="p-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
              Langkah 1 • Template Excel (.xlsx)
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Template menyertakan dropdown enum <strong>Kategori Inventaris *</strong>,{" "}
              <strong>Lokasi Penempatan Ruangan *</strong> ({rooms.length} ruang aktif + Gudang Cadangan),
              dan <strong>Kondisi Barang *</strong>. Maksimal {MAX_IMPORT_ROWS} baris per import.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate || submitting}
            className="shrink-0"
          >
            {downloadingTemplate ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {downloadingTemplate ? "Menyiapkan..." : "Unduh Template Excel"}
            </span>
          </Button>
        </section>

        {/* Langkah 2: Unggah File Excel */}
        <section className="space-y-2">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            Langkah 2 • Unggah Berkas Hasil Pengisian
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`p-5 rounded-lg border border-dashed transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isDragging
                ? "border-[#1E3A5F] bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40"
                : "border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shrink-0">
                <FileSpreadsheet
                  className="w-5 h-5 text-[#1E3A5F] dark:text-sky-400"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedFileName
                    ? `Berkas dipilih: ${selectedFileName}`
                    : "Seret berkas .xlsx ke sini atau pilih dari komputer"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Hanya mendukung format <code>.xlsx</code> (maks. 5 MB). Nomor seri duplikat akan ditolak otomatis.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="sr-only"
                id="asset-excel-file-input"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile || submitting}
              >
                {parsingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {parsingFile
                    ? "Memvalidasi..."
                    : selectedFileName
                    ? "Ganti Berkas"
                    : "Pilih Berkas Excel"}
                </span>
              </Button>
            </div>
          </div>
        </section>

        {/* Loading State Parsing / Submit */}
        {parsingFile ? (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3 text-xs text-slate-800 dark:text-slate-200"
          >
            <Loader2
              className="w-4 h-4 animate-spin text-[#1E3A5F] dark:text-sky-400 shrink-0"
              aria-hidden="true"
            />
            <span>
              Sedang membaca lembar kerja, memverifikasi lokasi ruangan, dan mengecek duplikasi nomor seri...
            </span>
          </div>
        ) : null}

        {/* Global Error State */}
        {globalError ? (
          <div
            role="alert"
            className="p-3.5 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-600 text-xs text-red-900 dark:text-red-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold">Berkas Tidak Dapat Diproses</p>
              <p>{globalError}</p>
            </div>
          </div>
        ) : null}

        {/* Hasil Pratinjau Validasi */}
        {parseResult && parseResult.ok ? (
          <section className="space-y-3" aria-label="Pratinjau Validasi Import">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                  Total Baris: <strong className="font-mono">{parseResult.totalRows}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-md border border-emerald-600/40 bg-emerald-100 dark:bg-emerald-950 font-semibold text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Valid: <strong className="font-mono">{parseResult.validCount}</strong>
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md border font-semibold inline-flex items-center gap-1.5 ${
                    parseResult.errorCount > 0
                      ? "border-red-600/50 bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200"
                      : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  Error: <strong className="font-mono">{parseResult.errorCount}</strong>
                </span>
              </div>

              {parseResult.errorCount > 0 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("ALL")}
                    className={`min-h-[36px] px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      previewFilter === "ALL"
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500 font-semibold"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Semua ({parseResult.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("ERROR")}
                    className={`min-h-[36px] px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      previewFilter === "ERROR"
                        ? "bg-red-700 text-white border-red-700 dark:bg-red-600 dark:border-red-600 font-semibold"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Bermasalah ({parseResult.errorCount})
                  </button>
                </div>
              ) : null}
            </div>

            {parseResult.errorCount > 0 ? (
              <div
                role="alert"
                className="p-3 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-600 text-xs text-red-900 dark:text-red-200"
              >
                <strong>Import dikunci:</strong> Ditemukan {parseResult.errorCount} baris yang belum valid (termasuk duplikat nomor seri bila ada). Perbaiki seluruh baris bermasalah di file Excel Anda, lalu unggah ulang berkas.
              </div>
            ) : (
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-600/50 text-xs text-emerald-900 dark:text-emerald-200">
                Seluruh {parseResult.validCount} baris lolos validasi dan siap didaftarkan dengan kode inventaris otomatis.
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Baris
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Proyeksi Kode & Barang
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Lokasi & Kondisi
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Pengadaan
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Status Validasi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {displayedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.isValid
                          ? "bg-white dark:bg-slate-900"
                          : "bg-red-50/60 dark:bg-red-950/25"
                      }
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 align-top">
                        #{row.rowNumber}
                      </td>
                      <td className="px-3 py-2.5 align-top space-y-0.5">
                        {row.projectedCode ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono font-bold text-[11px] text-slate-900 dark:text-slate-100">
                            {row.projectedCode}
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 font-mono font-bold text-[11px] text-red-900 dark:text-red-200">
                            KODE TERTUNDA
                          </span>
                        )}
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.name || "(Nama kosong)"}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {row.brandModel || "-"} • SN:{" "}
                          <span className="font-mono">{row.serialNumber || "-"}</span>
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top space-y-0.5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {row.roomLabel}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Kondisi: {row.rawCondition || "-"} •{" "}
                          {row.payload?.is_portable ? "Portabel" : "Permanen"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top space-y-0.5">
                        <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {row.payload
                            ? formatCurrencyIDR(row.payload.acquisition_cost)
                            : row.rawCost || "-"}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {row.rawYear || "-"} • {row.fundingSource || "-"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Siap</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 font-semibold">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Error ({row.errors.length})</span>
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-red-800 dark:text-red-300">
                              {row.errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Footer Modal */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting || parsingFile}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleCommitImport}
            disabled={!canCommitImport}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {submitting
                ? "Menyimpan..."
                : parseResult && parseResult.validCount > 0
                ? `Import ${parseResult.validCount} Aset`
                : "Import Aset"}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
