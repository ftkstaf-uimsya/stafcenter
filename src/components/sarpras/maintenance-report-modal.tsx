"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileText, ImagePlus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  DamageSeverity,
  MaintenancePriority,
} from "@/types/sarpras";
import { compressPhotoIfNeeded } from "@/lib/media/compress-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { CameraPhotoModal } from "@/components/ui/camera-photo-modal";

const PRIORITIES: MaintenancePriority[] = [
  "Rendah",
  "Sedang",
  "Tinggi/Darurat",
];

const SEVERITIES: DamageSeverity[] = ["Rusak Ringan", "Rusak Berat", "Hilang"];

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export interface MaintenanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetKind?: "asset" | "office_kit" | "room";
  initialOfficeKitIds?: string[];
  initialSeverity?: DamageSeverity;
  initialRoomId?: string;
  bulkPresetLabel?: string;
  onSubmitted?: () => void;
}

export function MaintenanceReportModal({
  isOpen,
  onClose,
  initialTargetKind = "asset",
  initialOfficeKitIds,
  initialSeverity = "Rusak Ringan",
  initialRoomId,
  bulkPresetLabel,
  onSubmitted,
}: MaintenanceReportModalProps) {
  const {
    rooms,
    assets,
    officeKitItems,
    campusOfficials,
    lecturers,
    addMaintenanceLog,
    uploadEntityFile,
  } = useSarpras();

  const [targetKind, setTargetKind] = useState<
    "asset" | "office_kit" | "room"
  >(initialTargetKind);
  const [assetId, setAssetId] = useState("");
  const [selectedOfficeKitIds, setSelectedOfficeKitIds] = useState<string[]>(
    []
  );
  const [roomId, setRoomId] = useState("");
  const [reporterQuickPick, setReporterQuickPick] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterRole, setReporterRole] = useState("PIC Ruangan / Dosen");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [damageSeverity, setDamageSeverity] =
    useState<DamageSeverity>(initialSeverity);
  const [priority, setPriority] = useState<MaintenancePriority>("Sedang");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sinkronkan state form setiap kali modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    const kind = initialTargetKind;
    setTargetKind(kind);
    setDamageSeverity(initialSeverity);
    setPriority(initialSeverity === "Rusak Ringan" ? "Sedang" : "Tinggi/Darurat");
    setFormError("");
    setReporterQuickPick("");
    setReporterName("");
    setReporterRole(
      kind === "office_kit" ? "Staf Loket / Sarpras" : "PIC Ruangan / Dosen"
    );
    setIssueTitle(
      bulkPresetLabel
        ? `Perbaikan Massal (${bulkPresetLabel})`
        : ""
    );
    setIssueDescription(
      bulkPresetLabel
        ? `Pelaporan tindak lanjut massal untuk alat kantor staf berstatus ${bulkPresetLabel}.`
        : ""
    );
    setSelectedFile(null);

    if (kind === "office_kit") {
      const validIds = (initialOfficeKitIds || []).filter((id) =>
        officeKitItems.some((k) => k.id === id)
      );
      const fallbackId = officeKitItems[0]?.id || "";
      const nextIds = validIds.length > 0 ? validIds : fallbackId ? [fallbackId] : [];
      setSelectedOfficeKitIds(nextIds);
      setAssetId("");
      const firstKit = officeKitItems.find((k) => k.id === nextIds[0]);
      setRoomId(initialRoomId ?? firstKit?.linked_room_id ?? "");
    } else if (kind === "asset") {
      const defaultAsset = assets[0];
      setAssetId(defaultAsset?.id || "");
      setSelectedOfficeKitIds([]);
      setRoomId(initialRoomId ?? defaultAsset?.room_id ?? rooms[0]?.id ?? "");
    } else {
      setAssetId("");
      setSelectedOfficeKitIds([]);
      setRoomId(initialRoomId ?? rooms[0]?.id ?? "");
    }
  }, [
    isOpen,
    initialTargetKind,
    initialOfficeKitIds,
    initialSeverity,
    initialRoomId,
    bulkPresetLabel,
    assets,
    officeKitItems,
    rooms,
  ]);

  // Preview URL untuk gambar terpilih
  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const isMultiKitMode =
    targetKind === "office_kit" &&
    (Boolean(bulkPresetLabel) || selectedOfficeKitIds.length > 1);

  const selectedKits = useMemo(
    () => officeKitItems.filter((k) => selectedOfficeKitIds.includes(k.id)),
    [officeKitItems, selectedOfficeKitIds]
  );

  const hasBorrowedKit = selectedKits.some((k) => k.status === "Dipinjam");

  const handleTargetKindChange = (
    nextKind: "asset" | "office_kit" | "room"
  ) => {
    setTargetKind(nextKind);
    setFormError("");
    if (nextKind === "asset") {
      const nextAsset =
        assets.find((a) => a.id === assetId) || assets[0];
      setAssetId(nextAsset?.id || "");
      setSelectedOfficeKitIds([]);
      setRoomId(nextAsset?.room_id || rooms[0]?.id || "");
    } else if (nextKind === "office_kit") {
      const currentFirst = selectedOfficeKitIds[0];
      const nextKit =
        officeKitItems.find((k) => k.id === currentFirst) ||
        officeKitItems[0];
      setSelectedOfficeKitIds(nextKit ? [nextKit.id] : []);
      setAssetId("");
      setRoomId(nextKit?.linked_room_id || "");
    } else {
      setAssetId("");
      setSelectedOfficeKitIds([]);
      setRoomId((prev) => prev || rooms[0]?.id || "");
    }
  };

  const handleAssetSelectionChange = (newAssetId: string) => {
    setAssetId(newAssetId);
    const found = assets.find((a) => a.id === newAssetId);
    if (found?.room_id) {
      setRoomId(found.room_id);
    }
  };

  const handleSingleOfficeKitChange = (newKitId: string) => {
    setSelectedOfficeKitIds(newKitId ? [newKitId] : []);
    const found = officeKitItems.find((k) => k.id === newKitId);
    setRoomId(found?.linked_room_id || "");
  };

  const toggleMultiOfficeKit = (kitId: string) => {
    setSelectedOfficeKitIds((prev) =>
      prev.includes(kitId)
        ? prev.filter((id) => id !== kitId)
        : [...prev, kitId]
    );
  };

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFormError("Ukuran file dokumentasi melebihi batas maksimal 5 MB.");
      return;
    }
    setFormError("");
    setSelectedFile(file);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetKind === "asset" && !assetId) {
      setFormError("Pilih aset inventaris yang bermasalah terlebih dahulu.");
      return;
    }
    if (targetKind === "office_kit" && selectedOfficeKitIds.length === 0) {
      setFormError("Pilih minimal satu alat kantor staf yang bermasalah.");
      return;
    }
    if (targetKind === "room" && !roomId) {
      setFormError("Pilih lokasi ruangan fasilitas yang bermasalah.");
      return;
    }
    if (
      !reporterName.trim() ||
      !issueTitle.trim() ||
      !issueDescription.trim()
    ) {
      setFormError(
        "Nama Pelapor, Judul Kendala, dan Deskripsi Kerusakan wajib diisi."
      );
      return;
    }

    setSubmitting(true);
    try {
      let preparedFile: File | null = selectedFile;
      if (preparedFile && preparedFile.type.startsWith("image/")) {
        preparedFile = await compressPhotoIfNeeded(preparedFile);
      }

      const createdTicketIds: string[] = [];

      if (targetKind === "office_kit") {
        selectedOfficeKitIds.forEach((kitId, idx) => {
          const kitObj = officeKitItems.find((k) => k.id === kitId);
          const resolvedRoomId = roomId || kitObj?.linked_room_id || null;
          const created = addMaintenanceLog(
            {
              asset_id: null,
              office_kit_item_id: kitId,
              room_id: resolvedRoomId,
              reporter_name: reporterName.trim(),
              reporter_role: reporterRole.trim() || "Staf Kampus",
              issue_title: issueTitle.trim(),
              issue_description: issueDescription.trim(),
              damage_severity: damageSeverity,
              priority,
              photo_url: undefined,
              repair_cost: 0,
            },
            { sequenceOffset: idx }
          );
          if (created?.id) createdTicketIds.push(created.id);
        });
      } else {
        const created = addMaintenanceLog({
          asset_id: targetKind === "asset" ? assetId || null : null,
          office_kit_item_id: null,
          room_id: roomId || null,
          reporter_name: reporterName.trim(),
          reporter_role: reporterRole.trim() || "Staf Kampus",
          issue_title: issueTitle.trim(),
          issue_description: issueDescription.trim(),
          damage_severity: damageSeverity,
          priority,
          photo_url: undefined,
          repair_cost: 0,
        });
        if (created?.id) createdTicketIds.push(created.id);
      }

      if (preparedFile && createdTicketIds.length > 0) {
        const fileToUpload = preparedFile;
        setTimeout(() => {
          createdTicketIds.forEach((ticketId) => {
            void uploadEntityFile("maintenance", ticketId, fileToUpload);
          });
        }, 400);
      }

      onSubmitted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Form Pelaporan Kerusakan Aset / Alat Kantor / Ruangan"
        description="Kondisi Aset Inventaris atau status Alat Kantor Staf otomatis disinkronkan saat tiket dibuat maupun selesai diperbaiki."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {formError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Jenis Objek yang Dilaporkan *
            </span>
            <div
              role="group"
              aria-label="Jenis objek laporan kerusakan"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {(
                [
                  { id: "asset", label: "Aset Inventaris" },
                  { id: "office_kit", label: "Alat Kantor Staf" },
                  { id: "room", label: "Fasilitas Fisik Ruangan" },
                ] as const
              ).map((opt) => {
                const active = targetKind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleTargetKindChange(opt.id)}
                    aria-pressed={active}
                    className={`min-h-[44px] px-3 py-2 rounded-md border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                      active
                        ? "border-[#1E3A5F] bg-[#1E3A5F] text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isMultiKitMode ? (
            <div className="space-y-2.5 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Alat Kantor Staf Terpilih ({selectedOfficeKitIds.length} barang)
                </span>
                {bulkPresetLabel ? (
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                    Filter Otomatis: {bulkPresetLabel}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {officeKitItems.map((k) => {
                  const checked = selectedOfficeKitIds.includes(k.id);
                  return (
                    <label
                      key={k.id}
                      className={`min-h-[44px] flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                        checked
                          ? "border-[#1E3A5F] bg-sky-50/80 dark:border-sky-400 dark:bg-sky-950/40"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiOfficeKit(k.id)}
                        className="mt-0.5 w-4 h-4 accent-[#1E3A5F] dark:accent-sky-400 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                            {k.kit_code}
                          </span>{" "}
                          {k.name}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {k.condition} • {k.status}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {targetKind === "asset" ? (
              <Select
                label="Pilih Aset Inventaris Bermasalah *"
                value={assetId}
                onChange={(e) => handleAssetSelectionChange(e.target.value)}
                options={
                  assets.length === 0
                    ? [{ value: "", label: "Belum ada data aset terdaftar" }]
                    : assets.map((a) => ({
                        value: a.id,
                        label: `${a.inventory_code} - ${a.name}`,
                      }))
                }
              />
            ) : targetKind === "office_kit" ? (
              !isMultiKitMode ? (
                <Select
                  label="Pilih Alat Kantor Staf Bermasalah *"
                  value={selectedOfficeKitIds[0] || ""}
                  onChange={(e) => handleSingleOfficeKitChange(e.target.value)}
                  options={
                    officeKitItems.length === 0
                      ? [
                          {
                            value: "",
                            label: "Belum ada barang di katalog kantor staf",
                          },
                        ]
                      : officeKitItems.map((k) => ({
                          value: k.id,
                          label: `${k.kit_code} - ${k.name} [${k.category}] (${k.status})`,
                        }))
                  }
                />
              ) : (
                <div className="flex items-end pb-1">
                  <p className="w-full min-h-[44px] px-3.5 py-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300">
                    {selectedOfficeKitIds.length} barang kantor staf akan dibuatkan
                    tiket perbaikan secara bersamaan.
                  </p>
                </div>
              )
            ) : (
              <div className="flex items-end pb-1">
                <p className="w-full min-h-[44px] px-3.5 py-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300">
                  Target laporan ditujukan langsung pada prasarana fisik ruangan.
                </p>
              </div>
            )}

            <Select
              label={
                targetKind === "office_kit"
                  ? "Lokasi Ruangan (Opsional)"
                  : "Lokasi Ruangan *"
              }
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              options={
                targetKind === "office_kit"
                  ? [
                      {
                        value: "",
                        label: "Kantor Staf / Universal (Tanpa Ruang Khusus)",
                      },
                      ...rooms.map((r) => ({
                        value: r.id,
                        label: `${r.code} - ${r.name}`,
                      })),
                    ]
                  : rooms.map((r) => ({
                      value: r.id,
                      label: `${r.code} - ${r.name}`,
                    }))
              }
            />
          </div>

          {targetKind === "office_kit" && hasBorrowedKit ? (
            <div className="p-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200">
              Ada barang yang saat ini berstatus <strong>Dipinjam</strong>. Kondisi
              rusaknya akan tercatat pada laporan kerusakan dan item akan otomatis
              beralih ke Perbaikan setelah pengembalian diterima.
            </div>
          ) : null}

          {campusOfficials.length > 0 || lecturers.length > 0 ? (
            <Select
              label="Pilih Pelapor dari Data Master (Opsional)"
              value={reporterQuickPick}
              onChange={(e) => {
                const val = e.target.value;
                setReporterQuickPick(val);
                if (!val) return;
                if (val.startsWith("official:")) {
                  const found = campusOfficials.find(
                    (o) => o.id === val.slice("official:".length)
                  );
                  if (found) {
                    setReporterName(found.full_name);
                    setReporterRole(found.position_title);
                  }
                } else if (val.startsWith("lecturer:")) {
                  const found = lecturers.find(
                    (l) => l.id === val.slice("lecturer:".length)
                  );
                  if (found) {
                    setReporterName(found.full_name);
                    setReporterRole(`Dosen (${found.homebase_prodi})`);
                  }
                }
              }}
              options={[
                { value: "", label: "-- Pilih pelapor atau ketik manual --" },
                ...campusOfficials
                  .filter((o) => o.is_active)
                  .map((o) => ({
                    value: `official:${o.id}`,
                    label: `[Pengurus] ${o.full_name} (${o.position_title})`,
                  })),
                ...lecturers
                  .filter((l) => l.is_active)
                  .map((l) => ({
                    value: `lecturer:${l.id}`,
                    label: `[Dosen] ${l.full_name} (${l.homebase_prodi})`,
                  })),
              ]}
            />
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Pelapor *"
              placeholder="Contoh: Hendra Wijaya, S.T."
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              required
            />
            <Input
              label="Jabatan / Peran Pelapor *"
              placeholder="Contoh: PIC Ruangan / Dosen Pengampu"
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              required
            />
          </div>

          <Input
            label="Judul Kendala / Kerusakan *"
            placeholder="Contoh: Kompresor AC mati & kebocoran pipa drainase"
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            required
          />

          <Input
            label="Deskripsi Detail Kendala *"
            placeholder="Jelaskan gejala kerusakan agar teknisi dapat menyiapkan suku cadang..."
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tingkat Keparahan Kerusakan Aset *"
              value={damageSeverity}
              onChange={(e) =>
                setDamageSeverity(e.target.value as DamageSeverity)
              }
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Prioritas Penanganan *"
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as MaintenancePriority)
              }
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Unggah Foto Dokumentasi Kerusakan (Opsional, JPG/PNG/PDF maks 5 MB)
            </span>
            <input
              ref={fileInputRef}
              id="maintenance-photo-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                handlePickFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
              className="sr-only"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Pilih File / Foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCameraModalOpen(true)}
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Ambil Foto</span>
              </Button>
              {selectedFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Hapus file dokumentasi"
                  onClick={() => setSelectedFile(null)}
                  className="text-red-700 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus</span>
                </Button>
              ) : null}
            </div>

            {selectedFile ? (
              <div className="flex items-center gap-3 p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Pratinjau foto kerusakan"
                    className="w-12 h-12 rounded object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                    <FileText
                      className="w-5 h-5 text-slate-600 dark:text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={submitting}
            >
              {submitting
                ? "Menyimpan..."
                : selectedOfficeKitIds.length > 1 && targetKind === "office_kit"
                ? `Kirim ${selectedOfficeKitIds.length} Laporan Kerusakan`
                : "Kirim Laporan Kerusakan"}
            </Button>
          </div>
        </form>
      </Modal>

      <CameraPhotoModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(file) => handlePickFile(file)}
      />
    </>
  );
}
