"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ImagePlus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { useTodayWibIso } from "@/lib/sarpras/sirkulasi-utils";
import { compressPhotoIfNeeded } from "@/lib/media/compress-image";
import {
  BookingTargetType,
  BorrowerRole,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CameraPhotoModal } from "@/components/ui/camera-photo-modal";

const BORROWER_ROLES: BorrowerRole[] = ["Dosen", "Staf", "Mahasiswa/Ormawa"];
const TARGET_TYPES: BookingTargetType[] = [
  "Ruangan",
  "Alat",
  "Ruangan & Alat",
];

type DeskBookingInitialStatus =
  | "Menunggu Persetujuan"
  | "Disetujui"
  | "Sedang Dipinjam";

interface BookingLoanFormProps {
  mode: "inline" | "modal";
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BookingLoanForm({
  mode,
  onSuccess,
  onCancel,
}: BookingLoanFormProps) {
  const {
    rooms,
    assets,
    lecturers,
    campusOfficials,
    campusUnits,
    academicClasses,
    addBooking,
    uploadEntityFile,
  } = useSarpras();

  const todayWibIso = useTodayWibIso();

  const portableAssets = useMemo(
    () => assets.filter((a) => a.is_portable && a.condition !== "Hilang"),
    [assets]
  );

  const activeUnits = useMemo(
    () => campusUnits.filter((u) => u.is_active),
    [campusUnits]
  );

  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerRole, setBorrowerRole] = useState<BorrowerRole>("Dosen");
  const [selectedLecturerId, setSelectedLecturerId] = useState("");
  const [selectedOfficialId, setSelectedOfficialId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState(
    () => activeUnits[0]?.id || ""
  );
  const [borrowerUnit, setBorrowerUnit] = useState(
    () => activeUnits[0]?.name || ""
  );
  const [borrowerPhone, setBorrowerPhone] = useState("");
  const [targetType, setTargetType] = useState<BookingTargetType>("Ruangan");
  const [roomId, setRoomId] = useState(() => rooms[0]?.id || "");
  const [assetId, setAssetId] = useState(() => portableAssets[0]?.id || "");
  const [activityName, setActivityName] = useState("");
  const [attendeesCount, setAttendeesCount] = useState("35");
  const [bookingDate, setBookingDate] = useState(todayWibIso);
  const [bookingDateDirty, setBookingDateDirty] = useState(false);
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");
  const [initialStatus, setInitialStatus] =
    useState<DeskBookingInitialStatus>("Menunggu Persetujuan");

  const [conflictError, setConflictError] = useState("");
  const [inlineSuccessMessage, setInlineSuccessMessage] = useState("");

  // Foto Bukti Peminjaman (Opsional)
  const [cameraPhotoModalOpen, setCameraPhotoModalOpen] = useState(false);
  const [bookingPhotoFile, setBookingPhotoFile] = useState<File | null>(null);
  const [bookingPhotoPreview, setBookingPhotoPreview] = useState<string | null>(
    null
  );
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const galleryPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bookingDateDirty) {
      setBookingDate(todayWibIso);
    }
  }, [bookingDateDirty, todayWibIso]);

  useEffect(() => {
    if (!selectedUnitId && !borrowerUnit && activeUnits.length > 0) {
      setSelectedUnitId(activeUnits[0].id);
      setBorrowerUnit(activeUnits[0].name);
    }
  }, [activeUnits, borrowerUnit, selectedUnitId]);

  useEffect(() => {
    if (!roomId && rooms.length > 0) {
      setRoomId(rooms[0].id);
    }
  }, [roomId, rooms]);

  useEffect(() => {
    if (!assetId && portableAssets.length > 0) {
      setAssetId(portableAssets[0].id);
    }
  }, [assetId, portableAssets]);

  useEffect(() => {
    return () => {
      if (bookingPhotoPreview) {
        URL.revokeObjectURL(bookingPhotoPreview);
      }
    };
  }, [bookingPhotoPreview]);

  const handlePickPhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setConflictError(
        "Pilih berkas gambar (JPG, PNG, atau WEBP) untuk foto bukti peminjaman."
      );
      return;
    }
    setConflictError("");
    setBookingPhotoFile(file);
    setBookingPhotoPreview(URL.createObjectURL(file));
  };

  const handleClearPhoto = () => {
    setBookingPhotoFile(null);
    setBookingPhotoPreview(null);
  };

  const resetFormFields = (keepSuccessNotice = false) => {
    const firstUnit = activeUnits[0] || null;
    setBorrowerName("");
    setBorrowerRole("Dosen");
    setSelectedLecturerId("");
    setSelectedOfficialId("");
    setSelectedClassId("");
    setSelectedUnitId(firstUnit?.id || "");
    setBorrowerUnit(firstUnit?.name || "");
    setBorrowerPhone("");
    setTargetType("Ruangan");
    setRoomId(rooms[0]?.id || "");
    setAssetId(portableAssets[0]?.id || "");
    setActivityName("");
    setAttendeesCount("35");
    setBookingDate(todayWibIso);
    setBookingDateDirty(false);
    setStartTime("13:00");
    setEndTime("15:00");
    setInitialStatus("Menunggu Persetujuan");
    setConflictError("");
    if (!keepSuccessNotice) {
      setInlineSuccessMessage("");
    }
    setBookingPhotoFile(null);
    setBookingPhotoPreview(null);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingBooking) return;
    setConflictError("");
    setInlineSuccessMessage("");

    const matchedUnit = campusUnits.find((u) => u.id === selectedUnitId);
    const finalUnitName = (matchedUnit?.name || borrowerUnit).trim();

    if (!borrowerName.trim() || !finalUnitName || !activityName.trim()) {
      setConflictError(
        "Nama Peminjam, Unit/Prodi, dan Nama Kegiatan wajib diisi."
      );
      return;
    }

    const selectedRoomId =
      targetType === "Ruangan" || targetType === "Ruangan & Alat"
        ? roomId || null
        : null;
    const selectedAssetId =
      targetType === "Alat" || targetType === "Ruangan & Alat"
        ? assetId || null
        : null;

    if (!selectedRoomId && !selectedAssetId) {
      setConflictError("Pilih minimal satu ruangan atau satu alat portabel.");
      return;
    }

    const matchedClass = academicClasses.find((c) => c.id === selectedClassId);
    const savedActivity = activityName.trim();
    const savedBorrower = borrowerName.trim();
    const chosenStatus: DeskBookingInitialStatus =
      mode === "inline" ? initialStatus : "Menunggu Persetujuan";

    const res = addBooking(
      {
        borrower_name: savedBorrower,
        borrower_role: borrowerRole,
        borrower_unit: finalUnitName,
        unit_id: matchedUnit?.id || null,
        class_id:
          borrowerRole === "Mahasiswa/Ormawa" ? matchedClass?.id || null : null,
        class_code:
          borrowerRole === "Mahasiswa/Ormawa"
            ? matchedClass?.class_code || null
            : null,
        borrower_lecturer_id:
          borrowerRole === "Dosen" ? selectedLecturerId || null : null,
        borrower_official_id:
          borrowerRole === "Staf" ? selectedOfficialId || null : null,
        borrower_phone: borrowerPhone.trim() || "-",
        target_type: targetType,
        room_id: selectedRoomId,
        asset_id: selectedAssetId,
        activity_name: savedActivity,
        attendees_count: Math.max(1, Number(attendeesCount) || 1),
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
      },
      mode === "inline" ? { initialStatus: chosenStatus } : undefined
    );

    if (!res.ok) {
      setConflictError(res.error || "Terjadi bentrok jadwal peminjaman.");
      return;
    }

    const pendingPhoto = bookingPhotoFile;
    if (pendingPhoto && res.id) {
      setSubmittingBooking(true);
      try {
        const compressed = await compressPhotoIfNeeded(pendingPhoto);
        await uploadEntityFile("booking", res.id, compressed);
      } finally {
        setSubmittingBooking(false);
      }
    }

    if (mode === "inline") {
      resetFormFields(true);
      setInlineSuccessMessage(
        `Reservasi "${savedActivity}" (${savedBorrower}) berhasil dicatat dengan status ${chosenStatus}.`
      );
    }

    onSuccess?.();
  };

  return (
    <>
      <form onSubmit={handleBookingSubmit} className="space-y-4">
        {conflictError ? (
          <div
            role="alert"
            className="p-3.5 rounded-md bg-red-50 dark:bg-red-950 border-2 border-red-600 text-xs text-red-900 dark:text-red-200 flex items-start gap-2.5"
          >
            <AlertCircle
              className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold">Konflik Jadwal / Validasi Gagal</p>
              <p className="mt-0.5">{conflictError}</p>
            </div>
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

        {borrowerRole === "Dosen" && lecturers.length > 0 ? (
          <Select
            label="Pilih dari Data Master Dosen (Opsional)"
            value={selectedLecturerId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedLecturerId(id);
              const found = lecturers.find((l) => l.id === id);
              if (found) {
                setBorrowerName(found.full_name);
                setBorrowerUnit(found.homebase_prodi);
                const matchedUnit =
                  campusUnits.find((u) => u.id === found.unit_id) ||
                  campusUnits.find(
                    (u) =>
                      u.name.trim().toLowerCase() ===
                      found.homebase_prodi.trim().toLowerCase()
                  );
                setSelectedUnitId(matchedUnit?.id || "");
                if (found.phone) setBorrowerPhone(found.phone);
              }
            }}
            options={[
              {
                value: "",
                label: "-- Pilih dosen atau ketik manual di bawah --",
              },
              ...lecturers
                .filter((l) => l.is_active)
                .map((l) => ({
                  value: l.id,
                  label: `${l.nidn_nip} - ${l.full_name} (${l.homebase_prodi})`,
                })),
            ]}
          />
        ) : null}

        {borrowerRole === "Staf" && campusOfficials.length > 0 ? (
          <Select
            label="Pilih dari Data Master Pengurus / Staf (Opsional)"
            value={selectedOfficialId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedOfficialId(id);
              const found = campusOfficials.find((o) => o.id === id);
              if (found) {
                setBorrowerName(found.full_name);
                setBorrowerUnit(found.unit_name);
                const matchedUnit =
                  campusUnits.find((u) => u.id === found.unit_id) ||
                  campusUnits.find(
                    (u) =>
                      u.name.trim().toLowerCase() ===
                      found.unit_name.trim().toLowerCase()
                  );
                setSelectedUnitId(matchedUnit?.id || "");
                if (found.phone) setBorrowerPhone(found.phone);
              }
            }}
            options={[
              {
                value: "",
                label: "-- Pilih pengurus/staf atau ketik manual --",
              },
              ...campusOfficials
                .filter((o) => o.is_active)
                .map((o) => ({
                  value: o.id,
                  label: `${o.official_code} - ${o.full_name} (${o.unit_name})`,
                })),
            ]}
          />
        ) : null}

        {borrowerRole === "Mahasiswa/Ormawa" &&
        academicClasses.some((c) => c.is_active) ? (
          <Select
            label="Pilih dari Data Master Kelas & DPM (Opsional)"
            value={selectedClassId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedClassId(id);
              const cls = academicClasses.find((c) => c.id === id);
              if (cls) {
                setBorrowerName(`${cls.dpm_name} (DPM ${cls.class_code})`);
                if (cls.dpm_phone && cls.dpm_phone !== "-") {
                  setBorrowerPhone(cls.dpm_phone);
                }
                setAttendeesCount(String(cls.students_count));
                const matchedUnit =
                  campusUnits.find((u) => u.id === cls.unit_id) ||
                  campusUnits.find(
                    (u) => u.code.toUpperCase() === cls.prodi.toUpperCase()
                  );
                setSelectedUnitId(matchedUnit?.id || "");
                setBorrowerUnit(matchedUnit?.name || cls.prodi);
                if (cls.default_room_id) {
                  setRoomId(cls.default_room_id);
                }
              }
            }}
            options={[
              {
                value: "",
                label: "-- Pilih kelas & DPM atau pilih Ormawa di bawah --",
              },
              ...academicClasses
                .filter((c) => c.is_active)
                .map((c) => ({
                  value: c.id,
                  label: `${c.class_code} - DPM: ${c.dpm_name} (${c.students_count} mhs)`,
                })),
            ]}
          />
        ) : null}

        {borrowerRole === "Mahasiswa/Ormawa" &&
        campusUnits.some((u) => u.is_active && u.unit_type === "Ormawa / UKM") ? (
          <Select
            label="Pilih dari Master Ormawa / UKM (Opsional)"
            value={selectedUnitId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedUnitId(id);
              setSelectedClassId("");
              const found = campusUnits.find((u) => u.id === id);
              if (found) {
                setBorrowerUnit(found.name);
                if (found.leader_name && !borrowerName.trim()) {
                  setBorrowerName(found.leader_name);
                }
                if (found.phone && !borrowerPhone.trim()) {
                  setBorrowerPhone(found.phone);
                }
              }
            }}
            options={[
              { value: "", label: "-- Pilih Ormawa/UKM atau isi manual --" },
              ...campusUnits
                .filter((u) => u.is_active && u.unit_type === "Ormawa / UKM")
                .map((u) => ({
                  value: u.id,
                  label: `${u.code} - ${u.name}${
                    u.leader_name ? ` (Ketua: ${u.leader_name})` : ""
                  }`,
                })),
            ]}
          />
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nama Lengkap Peminjam *"
            placeholder="Contoh: Dr. Eng. Lukman Hakim, M.T."
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            required
          />
          <Select
            label="Kategori Peminjam *"
            value={borrowerRole}
            onChange={(e) => {
              const nextRole = e.target.value as BorrowerRole;
              setBorrowerRole(nextRole);
              if (nextRole !== "Dosen") setSelectedLecturerId("");
              if (nextRole !== "Staf") setSelectedOfficialId("");
              if (nextRole !== "Mahasiswa/Ormawa") setSelectedClassId("");
            }}
            options={BORROWER_ROLES.map((r) => ({ value: r, label: r }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeUnits.length > 0 ? (
            <Select
              label="Program Studi / Unit / Ormawa *"
              value={selectedUnitId || (borrowerUnit ? "__LEGACY__" : "")}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__LEGACY__") {
                  setSelectedUnitId("");
                  return;
                }
                setSelectedUnitId(val);
                const found = campusUnits.find((u) => u.id === val);
                if (found) setBorrowerUnit(found.name);
              }}
              options={[
                ...activeUnits.map((u) => ({
                  value: u.id,
                  label: `${u.code} - ${u.name} (${u.unit_type})`,
                })),
                ...(!selectedUnitId && borrowerUnit
                  ? [
                      {
                        value: "__LEGACY__",
                        label: `${borrowerUnit} (Manual)`,
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <Input
              label="Program Studi / Unit / Ormawa *"
              placeholder="Contoh: Prodi Teknik Informatika / BEM"
              value={borrowerUnit}
              onChange={(e) => setBorrowerUnit(e.target.value)}
              required
            />
          )}
          <Input
            label="Nomor WhatsApp / Telepon Aktif *"
            placeholder="Contoh: 0813-2211-9001"
            value={borrowerPhone}
            onChange={(e) => setBorrowerPhone(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Objek Peminjaman *"
            value={targetType}
            onChange={(e) =>
              setTargetType(e.target.value as BookingTargetType)
            }
            options={TARGET_TYPES.map((t) => ({ value: t, label: t }))}
          />

          {targetType === "Ruangan" || targetType === "Ruangan & Alat" ? (
            <div className="sm:col-span-2">
              <Select
                label="Pilih Ruangan Kampus *"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                options={rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name} (Kap. ${r.capacity})`,
                }))}
              />
            </div>
          ) : null}

          {targetType === "Alat" ? (
            <div className="sm:col-span-2">
              <Select
                label="Pilih Alat Portabel *"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                options={portableAssets.map((a) => ({
                  value: a.id,
                  label: `${a.inventory_code} - ${a.name}`,
                }))}
              />
            </div>
          ) : null}
        </div>

        {targetType === "Ruangan & Alat" ? (
          <Select
            label="Pilih Alat Portabel Pendukung *"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            options={portableAssets.map((a) => ({
              value: a.id,
              label: `${a.inventory_code} - ${a.name}`,
            }))}
          />
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Nama Kegiatan / Acara *"
              placeholder="Contoh: Seminar Nasional / Praktikum Pengganti"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              required
            />
          </div>
          <Input
            label="Estimasi Peserta"
            type="number"
            min={1}
            max={1500}
            value={attendeesCount}
            onChange={(e) => setAttendeesCount(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Tanggal Penggunaan *"
            type="date"
            value={bookingDate}
            onChange={(e) => {
              setBookingDateDirty(true);
              setBookingDate(e.target.value);
            }}
            required
          />
          <Input
            label="Jam Mulai *"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Jam Selesai *"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        {mode === "inline" ? (
          <Select
            label="Status Awal Loket *"
            value={initialStatus}
            onChange={(e) =>
              setInitialStatus(e.target.value as DeskBookingInitialStatus)
            }
            options={[
              {
                value: "Menunggu Persetujuan",
                label: "Menunggu Persetujuan (Baku)",
              },
              {
                value: "Disetujui",
                label: "Langsung Disetujui",
              },
              {
                value: "Sedang Dipinjam",
                label: "Langsung Sedang Dipinjam (Serah Terima)",
              },
            ]}
          />
        ) : null}

        {/* Input Foto Bukti Peminjaman / Serah Terima (Opsional) */}
        <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Foto Bukti Peminjaman (Opsional)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Dokumentasi ruangan, kunci, atau alat portabel yang dipinjam
                (JPG/PNG/WEBP, otomatis dikompres).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={galleryPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handlePickPhoto(e.target.files?.[0] || null);
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

          {bookingPhotoPreview && bookingPhotoFile ? (
            <div className="flex items-center gap-3 p-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bookingPhotoPreview}
                alt="Pratinjau foto peminjaman fasilitas"
                className="w-16 h-16 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {bookingPhotoFile.name}
                </p>
                <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  {Math.max(1, Math.round(bookingPhotoFile.size / 1024))} KB
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleClearPhoto}
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
              disabled={submittingBooking}
              onClick={onCancel}
            >
              Batal
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={submittingBooking}
              onClick={() => resetFormFields(false)}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset Form</span>
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={submittingBooking}>
            <CalendarPlus className="w-4 h-4" aria-hidden="true" />
            <span>
              {submittingBooking
                ? "Menyimpan & Mengunggah Foto..."
                : "Validasi & Simpan Reservasi"}
            </span>
          </Button>
        </div>
      </form>

      <CameraPhotoModal
        isOpen={cameraPhotoModalOpen}
        onClose={() => setCameraPhotoModalOpen(false)}
        title="Ambil Foto Bukti Peminjaman Fasilitas"
        onCapture={(file) => handlePickPhoto(file)}
      />
    </>
  );
}
