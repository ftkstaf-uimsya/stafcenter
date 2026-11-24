"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { useTodayWibIso } from "@/lib/sarpras/sirkulasi-utils";
import {
  matchesFlexibleQuery,
  normalizeCompactSearch,
} from "@/lib/search-normalize";
import { compressPhotoIfNeeded } from "@/lib/media/compress-image";
import { OfficeKitCategory } from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BarcodeScannerModal,
  ScanCodeOutcome,
} from "@/components/ui/barcode-scanner-modal";
import { CameraPhotoModal } from "@/components/ui/camera-photo-modal";

const OFFICE_KIT_CATEGORIES: OfficeKitCategory[] = [
  "Kabel HDMI",
  "Stop Kontak",
  "Remote TV",
  "Kunci & Akses",
  "Adapter & Converter",
  "Lainnya",
];

interface QuickLoanFormProps {
  mode: "inline" | "modal";
  preselectedKitId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function QuickLoanForm({
  mode,
  preselectedKitId,
  onSuccess,
  onCancel,
}: QuickLoanFormProps) {
  const {
    officeKitItems,
    officeKitLoans,
    academicClasses,
    rooms,
    courses,
    checkoutOfficeKitLoan,
    uploadEntityFile,
  } = useSarpras();

  const todayWibIso = useTodayWibIso();

  const activeClasses = useMemo(
    () => academicClasses.filter((c) => c.is_active),
    [academicClasses]
  );

  const firstClass = activeClasses[0] || null;

  const [selectedClassId, setSelectedClassId] = useState(
    () => firstClass?.id || ""
  );
  const [borrowerType, setBorrowerType] = useState<"dpm" | "representative">(
    "representative"
  );
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerPhone, setBorrowerPhone] = useState(
    () => firstClass?.dpm_phone || ""
  );
  const [roomId, setRoomId] = useState(
    () => firstClass?.default_room_id || rooms[0]?.id || ""
  );
  const [courseName, setCourseName] = useState("");
  const [selectedKitIds, setSelectedKitIds] = useState<string[]>(() =>
    preselectedKitId ? [preselectedKitId] : []
  );
  const [loanDate, setLoanDate] = useState(todayWibIso);
  const [loanDateDirty, setLoanDateDirty] = useState(false);
  const [borrowTime, setBorrowTime] = useState("08:00");
  const [expectedReturnTime, setExpectedReturnTime] = useState("10:30");
  const [checkoutError, setCheckoutError] = useState("");
  const [inlineSuccessMessage, setInlineSuccessMessage] = useState("");
  const [kitPickerSearch, setKitPickerSearch] = useState("");
  const [kitPickerCategory, setKitPickerCategory] = useState("ALL");
  const [scanFeedback, setScanFeedback] = useState<{
    tone: "success" | "warning" | "error";
    text: string;
  } | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [cameraPhotoModalOpen, setCameraPhotoModalOpen] = useState(false);
  const [checkoutPhotoFile, setCheckoutPhotoFile] = useState<File | null>(null);
  const [checkoutPhotoPreview, setCheckoutPhotoPreview] = useState<
    string | null
  >(null);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const galleryPhotoInputRef = useRef<HTMLInputElement>(null);

  // Sinkronkan tanggal default jika berganti hari WIB dan user belum mengubah tanggal manual
  useEffect(() => {
    if (!loanDateDirty) {
      setLoanDate(todayWibIso);
    }
  }, [loanDateDirty, todayWibIso]);

  // Sinkronkan pilihan awal kelas setelah data Supabase selesai dimuat
  useEffect(() => {
    if (!selectedClassId && activeClasses.length > 0) {
      const first = activeClasses[0];
      setSelectedClassId(first.id);
      setBorrowerPhone((prev) => prev || first.dpm_phone || "");
      setRoomId((prev) => prev || first.default_room_id || rooms[0]?.id || "");
    }
  }, [activeClasses, rooms, selectedClassId]);

  useEffect(() => {
    if (preselectedKitId) {
      setSelectedKitIds([preselectedKitId]);
    }
  }, [preselectedKitId]);

  useEffect(() => {
    return () => {
      if (checkoutPhotoPreview) {
        URL.revokeObjectURL(checkoutPhotoPreview);
      }
    };
  }, [checkoutPhotoPreview]);

  const selectedClassObj = useMemo(
    () => academicClasses.find((c) => c.id === selectedClassId) || null,
    [academicClasses, selectedClassId]
  );

  const availableKitItems = useMemo(
    () =>
      officeKitItems.filter(
        (item) =>
          item.is_active &&
          item.status === "Tersedia" &&
          item.condition !== "Hilang"
      ),
    [officeKitItems]
  );

  const pickerFilteredKitItems = useMemo(() => {
    const q = kitPickerSearch.trim();
    return availableKitItems.filter((item) => {
      if (kitPickerCategory !== "ALL" && item.category !== kitPickerCategory) {
        return false;
      }
      if (!q) return true;
      return matchesFlexibleQuery(
        `${item.kit_code} ${item.name} ${item.category} ${item.brand_spec} ${item.storage_tray}`,
        q
      );
    });
  }, [availableKitItems, kitPickerCategory, kitPickerSearch]);

  const resetFormFields = (keepSuccessNotice = false) => {
    const cls = activeClasses[0] || null;
    setSelectedClassId(cls?.id || "");
    setBorrowerType("representative");
    setBorrowerName("");
    setBorrowerPhone(cls?.dpm_phone || "");
    setRoomId(cls?.default_room_id || rooms[0]?.id || "");
    setCourseName("");
    setSelectedKitIds([]);
    setLoanDate(todayWibIso);
    setLoanDateDirty(false);
    setBorrowTime("08:00");
    setExpectedReturnTime("10:30");
    setCheckoutError("");
    if (!keepSuccessNotice) {
      setInlineSuccessMessage("");
    }
    setKitPickerSearch("");
    setKitPickerCategory("ALL");
    setScanFeedback(null);
    setCheckoutPhotoFile(null);
    setCheckoutPhotoPreview(null);
  };

  const handlePickCheckoutPhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCheckoutError(
        "Pilih berkas gambar (JPG, PNG, atau WEBP) untuk foto peminjaman."
      );
      return;
    }
    setCheckoutError("");
    setCheckoutPhotoFile(file);
    setCheckoutPhotoPreview(URL.createObjectURL(file));
  };

  const handleClearCheckoutPhoto = () => {
    setCheckoutPhotoFile(null);
    setCheckoutPhotoPreview(null);
  };

  const handleClassChange = (clsId: string) => {
    setSelectedClassId(clsId);
    const cls = academicClasses.find((c) => c.id === clsId);
    if (!cls) return;
    if (borrowerType === "dpm") {
      setBorrowerName(`${cls.dpm_name} (DPM)`);
    }
    setBorrowerPhone(cls.dpm_phone || "");
    if (cls.default_room_id) {
      setRoomId(cls.default_room_id);
    }
  };

  const handleToggleKitSelection = (id: string) => {
    setSelectedKitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleScanOrQuickAddCode = (rawCode: string): ScanCodeOutcome => {
    const clean = rawCode.trim();
    const normalized = clean.toUpperCase();
    const compact = normalizeCompactSearch(clean);
    if (!normalized) {
      return {
        status: "not_found",
        message: "Kode barang masih kosong.",
      };
    }

    const exactItem =
      officeKitItems.find(
        (item) => item.kit_code.trim().toUpperCase() === normalized
      ) ||
      (compact
        ? officeKitItems.find(
            (item) => normalizeCompactSearch(item.kit_code) === compact
          )
        : undefined);

    if (!exactItem) {
      return {
        status: "not_found",
        message: `Kode "${clean}" tidak ditemukan pada katalog barang kantor staf.`,
      };
    }

    if (exactItem.status === "Dipinjam") {
      const activeLoan = officeKitLoans.find(
        (l) => l.status === "Dipinjam" && l.kit_item_ids.includes(exactItem.id)
      );
      return {
        status: "unavailable",
        message: `${exactItem.kit_code} (${exactItem.name}) sedang dipinjam${
          activeLoan ? ` oleh kelas ${activeLoan.class_code}` : ""
        }.`,
      };
    }

    if (
      !exactItem.is_active ||
      exactItem.status !== "Tersedia" ||
      exactItem.condition === "Hilang"
    ) {
      return {
        status: "unavailable",
        message: `${exactItem.kit_code} (${exactItem.name}) tidak tersedia (${exactItem.status} / ${exactItem.condition}).`,
      };
    }

    if (selectedKitIds.includes(exactItem.id)) {
      return {
        status: "duplicate",
        message: `${exactItem.kit_code} (${exactItem.name}) sudah dipilih.`,
      };
    }

    setSelectedKitIds((prev) =>
      prev.includes(exactItem.id) ? prev : [...prev, exactItem.id]
    );
    return {
      status: "added",
      message: `Ditambahkan: ${exactItem.kit_code} (${exactItem.name}).`,
    };
  };

  const handlePickerSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const clean = kitPickerSearch.trim();
    if (!clean) return;

    const outcome = handleScanOrQuickAddCode(clean);
    if (outcome.status === "added") {
      setScanFeedback({ tone: "success", text: outcome.message });
      setKitPickerSearch("");
      return;
    }
    if (outcome.status === "duplicate") {
      setScanFeedback({ tone: "warning", text: outcome.message });
      setKitPickerSearch("");
      return;
    }
    if (outcome.status === "unavailable") {
      setScanFeedback({ tone: "error", text: outcome.message });
      return;
    }

    if (pickerFilteredKitItems.length === 1) {
      const single = pickerFilteredKitItems[0];
      const already = selectedKitIds.includes(single.id);
      if (!already) {
        setSelectedKitIds((prev) => [...prev, single.id]);
        setScanFeedback({
          tone: "success",
          text: `Ditambahkan: ${single.kit_code} (${single.name}).`,
        });
      } else {
        setScanFeedback({
          tone: "warning",
          text: `${single.kit_code} (${single.name}) sudah dipilih.`,
        });
      }
      setKitPickerSearch("");
      return;
    }

    setScanFeedback({ tone: "error", text: outcome.message });
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingCheckout) return;
    setCheckoutError("");
    setInlineSuccessMessage("");

    if (!selectedClassObj) {
      setCheckoutError(
        "Pilih Kelas Mahasiswa terlebih dahulu dari Data Master Kelas."
      );
      return;
    }

    const finalBorrowerName =
      borrowerType === "dpm"
        ? `${selectedClassObj.dpm_name} (DPM)`
        : borrowerName.trim();

    if (!finalBorrowerName) {
      setCheckoutError(
        "Isi nama perwakilan mahasiswa yang mengambil barang di kantor staf."
      );
      return;
    }

    const res = checkoutOfficeKitLoan({
      class_id: selectedClassObj.id,
      class_code: selectedClassObj.class_code,
      prodi: selectedClassObj.prodi,
      dpm_name: selectedClassObj.dpm_name,
      borrower_name: finalBorrowerName,
      borrower_phone:
        borrowerPhone.trim() || selectedClassObj.dpm_phone || "-",
      room_id: roomId || null,
      course_name: courseName.trim(),
      kit_item_ids: selectedKitIds,
      loan_date: loanDate,
      borrow_time: borrowTime,
      expected_return_time: expectedReturnTime,
    });

    if (!res.ok) {
      setCheckoutError(res.error || "Gagal mencatat peminjaman alat.");
      return;
    }

    const pendingPhoto = checkoutPhotoFile;
    if (pendingPhoto && res.id) {
      setSubmittingCheckout(true);
      try {
        const compressed = await compressPhotoIfNeeded(pendingPhoto);
        await uploadEntityFile("office_loan", res.id, compressed);
      } finally {
        setSubmittingCheckout(false);
      }
    }

    if (mode === "inline") {
      const count = selectedKitIds.length;
      const clsCode = selectedClassObj.class_code;
      resetFormFields(true);
      setInlineSuccessMessage(
        `Berhasil diserahkan: ${count} barang untuk kelas ${clsCode} (${finalBorrowerName}).`
      );
    }

    onSuccess?.();
  };

  return (
    <>
      <form onSubmit={handleCheckoutSubmit} className="space-y-4">
        {checkoutError ? (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
          >
            {checkoutError}
          </div>
        ) : null}

        {mode === "inline" && inlineSuccessMessage ? (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-600 text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{inlineSuccessMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setInlineSuccessMessage("")}
              aria-label="Tutup pesan berhasil"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <Select
          label="Pilih Kelas Mahasiswa (Data Master Kelas & DPM) *"
          value={selectedClassId}
          onChange={(e) => handleClassChange(e.target.value)}
          options={
            activeClasses.length === 0
              ? [
                  {
                    value: "",
                    label: "Belum ada kelas aktif di Master Kelas",
                  },
                ]
              : activeClasses.map((c) => ({
                  value: c.id,
                  label: `${c.class_code} | Prodi ${c.prodi} Angk. '${c.angkatan_year} Bagian ${c.class_section} (DPM: ${c.dpm_name})`,
                }))
          }
        />

        {selectedClassObj ? (
          <div className="p-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                Kode Kelas:
              </span>{" "}
              <strong className="font-mono text-[#1E3A5F] dark:text-sky-400">
                {selectedClassObj.class_code}
              </strong>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                DPM (Ketua Kelas):
              </span>{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {selectedClassObj.dpm_name}
              </strong>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                WA DPM:
              </span>{" "}
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                {selectedClassObj.dpm_phone}
              </strong>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Pengambil di Loket Kantor Staf *"
            value={borrowerType}
            onChange={(e) => {
              const modeVal = e.target.value as "dpm" | "representative";
              setBorrowerType(modeVal);
              if (modeVal === "dpm" && selectedClassObj) {
                setBorrowerName(`${selectedClassObj.dpm_name} (DPM)`);
                setBorrowerPhone(selectedClassObj.dpm_phone || "");
              } else {
                setBorrowerName("");
              }
            }}
            options={[
              {
                value: "representative",
                label: "Perwakilan Mahasiswa Kelas",
              },
              {
                value: "dpm",
                label: "Langsung DPM (Ketua Kelas)",
              },
            ]}
          />

          {borrowerType === "representative" ? (
            <Input
              label="Nama Perwakilan Mahasiswa *"
              placeholder="Ketik nama mahasiswa yang mengambil alat"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              required
            />
          ) : (
            <Input
              label="Nama DPM Pengambil"
              value={
                selectedClassObj ? `${selectedClassObj.dpm_name} (DPM)` : ""
              }
              readOnly
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="No. WhatsApp Kontak"
            placeholder="08xx-xxxx-xxxx"
            value={borrowerPhone}
            onChange={(e) => setBorrowerPhone(e.target.value)}
          />
          <Select
            label="Ruang Perkuliahan"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            options={[
              { value: "", label: "Pilih ruangan (opsional)" },
              ...rooms.map((r) => ({
                value: r.id,
                label: `${r.code} - ${r.name}`,
              })),
            ]}
          />
          <Select
            label="Mata Kuliah / Keperluan"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            allowCustomValue
            placeholder="Contoh: Manajemen Mutu"
            options={courses.map((c) => ({
              value: c.name,
              label: `${c.code} - ${c.name} (${c.prodi})`,
            }))}
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Pilih Barang Kantor Staf yang Dipinjam * ({selectedKitIds.length}{" "}
              dipilih)
            </span>
            {selectedKitIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedKitIds([])}
                className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
              >
                Kosongkan pilihan
              </button>
            ) : null}
          </div>

          {/* Chip barang yang sudah terpilih agar selalu terlihat saat mencari */}
          {selectedKitIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30">
              {selectedKitIds.map((kitId) => {
                const kit = officeKitItems.find((k) => k.id === kitId);
                if (!kit) return null;
                return (
                  <span
                    key={kit.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-white dark:bg-slate-900 border border-[#1E3A5F]/40 dark:border-sky-500/50 text-slate-900 dark:text-slate-100"
                  >
                    <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                      {kit.kit_code}
                    </span>
                    <span className="max-w-[140px] truncate">{kit.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleKitSelection(kit.id)}
                      aria-label={`Hapus pilihan ${kit.kit_code}`}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* Toolbar Pencarian, Filter Kategori & Scan Barcode Kamera */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <div className="sm:col-span-6 relative">
              <Search
                className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={kitPickerSearch}
                onChange={(e) => {
                  setKitPickerSearch(e.target.value);
                  if (scanFeedback) setScanFeedback(null);
                }}
                onKeyDown={handlePickerSearchKeyDown}
                placeholder="Cari kode/nama atau scan barcode + Enter..."
                aria-label="Cari atau scan kode barang kantor staf"
                className="min-h-[44px] w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={kitPickerCategory}
                onChange={(e) => setKitPickerCategory(e.target.value)}
                aria-label="Filter kategori barang"
                className="min-h-[44px] w-full px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              >
                <option value="ALL">Semua Kategori</option>
                {OFFICE_KIT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setScannerModalOpen(true)}
              >
                <ScanLine className="w-4 h-4" aria-hidden="true" />
                <span>Scan Kamera</span>
              </Button>
            </div>
          </div>

          {scanFeedback ? (
            <div
              role="status"
              className={`p-2.5 rounded-md border text-xs font-semibold flex items-center justify-between gap-2 ${
                scanFeedback.tone === "success"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-500 dark:text-emerald-200"
                  : scanFeedback.tone === "warning"
                  ? "border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:border-sky-500 dark:text-sky-200"
                  : "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:border-amber-500 dark:text-amber-200"
              }`}
            >
              <span>{scanFeedback.text}</span>
              <button
                type="button"
                onClick={() => setScanFeedback(null)}
                aria-label="Tutup pesan scan"
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {availableKitItems.length === 0 ? (
            <p className="p-3 rounded-md border border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
              Seluruh Kabel HDMI, Stop Kontak, dan Remote TV di kantor staf
              sedang dipinjam atau dalam perbaikan.
            </p>
          ) : pickerFilteredKitItems.length === 0 ? (
            <div className="p-3 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <p>
                Tidak ada barang tersedia yang cocok dengan pencarian atau filter
                kategori.
              </p>
              <button
                type="button"
                onClick={() => {
                  setKitPickerSearch("");
                  setKitPickerCategory("ALL");
                }}
                className="font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
              >
                Reset pencarian barang
              </button>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto p-1 ${
                mode === "inline" ? "max-h-56" : "max-h-52"
              }`}
            >
              {pickerFilteredKitItems.map((item) => {
                const checked = selectedKitIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`min-h-[44px] flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer text-xs transition-colors ${
                      checked
                        ? "border-[#1E3A5F] bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/40"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleKitSelection(item.id)}
                      className="mt-0.5 w-4 h-4 accent-[#1E3A5F]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <strong className="font-mono text-slate-900 dark:text-slate-100">
                          {item.kit_code}
                        </strong>
                        <span className="text-[11px] font-semibold text-[#1E3A5F] dark:text-sky-400">
                          ({item.category})
                        </span>
                      </span>
                      <span className="block font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Tanggal *"
            type="date"
            value={loanDate}
            onChange={(e) => {
              setLoanDateDirty(true);
              setLoanDate(e.target.value);
            }}
            required
          />
          <Input
            label="Jam Ambil *"
            type="time"
            value={borrowTime}
            onChange={(e) => setBorrowTime(e.target.value)}
            required
          />
          <Input
            label="Estimasi Kembali *"
            type="time"
            value={expectedReturnTime}
            onChange={(e) => setExpectedReturnTime(e.target.value)}
            required
          />
        </div>

        {/* Input Foto Bukti Serah Terima (Opsional) */}
        <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Foto Bukti Peminjaman (Opsional)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Dokumentasi barang &amp; pengambil di loket (JPG/PNG/WEBP,
                otomatis dikompres).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={galleryPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handlePickCheckoutPhoto(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => galleryPhotoInputRef.current?.click()}
              >
                <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Pilih Foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCameraPhotoModalOpen(true)}
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ambil Foto</span>
              </Button>
            </div>
          </div>

          {checkoutPhotoPreview && checkoutPhotoFile ? (
            <div className="flex items-center gap-3 p-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={checkoutPhotoPreview}
                alt="Pratinjau foto peminjaman"
                className="w-16 h-16 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {checkoutPhotoFile.name}
                </p>
                <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  {Math.max(1, Math.round(checkoutPhotoFile.size / 1024))} KB
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleClearCheckoutPhoto}
                aria-label="Hapus foto peminjaman"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          {mode === "modal" && onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={submittingCheckout}
              onClick={onCancel}
            >
              Batal
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={submittingCheckout}
              onClick={() => resetFormFields(false)}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset Form</span>
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={submittingCheckout}>
            <PackageCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {submittingCheckout
                ? "Menyimpan & Mengunggah Foto..."
                : "Serahkan Alat ke Kelas"}
            </span>
          </Button>
        </div>
      </form>

      <BarcodeScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        onScanCode={handleScanOrQuickAddCode}
        selectedCount={selectedKitIds.length}
      />

      <CameraPhotoModal
        isOpen={cameraPhotoModalOpen}
        onClose={() => setCameraPhotoModalOpen(false)}
        onCapture={(file) => handlePickCheckoutPhoto(file)}
      />
    </>
  );
}
