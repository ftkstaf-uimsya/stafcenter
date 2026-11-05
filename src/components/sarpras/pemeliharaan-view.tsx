"use client";

import React, { useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  DamageSeverity,
  MaintenanceLog,
  MaintenancePriority,
  MaintenanceStatus,
} from "@/types/sarpras";
import { formatCurrencyIDR } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/sarpras/status-badges";

const PRIORITIES: MaintenancePriority[] = [
  "Rendah",
  "Sedang",
  "Tinggi/Darurat",
];
const SEVERITIES: DamageSeverity[] = ["Rusak Ringan", "Rusak Berat"];
const STATUSES: MaintenanceStatus[] = [
  "Dilaporkan",
  "Dalam Pengerjaan",
  "Selesai Diperbaiki",
];

export function PemeliharaanView() {
  const {
    rooms,
    assets,
    maintenanceLogs,
    uiSimState,
    setUiSimState,
    addMaintenanceLog,
    updateMaintenanceStatus,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modal Lapor Kerusakan Baru
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterRole, setReporterRole] = useState("PIC Ruangan / Dosen");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [damageSeverity, setDamageSeverity] =
    useState<DamageSeverity>("Rusak Ringan");
  const [priority, setPriority] = useState<MaintenancePriority>("Sedang");
  const [photoUrl, setPhotoUrl] = useState("");
  const [formError, setFormError] = useState("");

  // Modal Update Tracking Perbaikan
  const [trackingTicket, setTrackingTicket] = useState<MaintenanceLog | null>(
    null
  );
  const [trackStatus, setTrackStatus] =
    useState<MaintenanceStatus>("Dalam Pengerjaan");
  const [technicianVendor, setTechnicianVendor] = useState("");
  const [repairCost, setRepairCost] = useState("0");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.ticket_code.toLowerCase().includes(q) ||
        m.issue_title.toLowerCase().includes(q) ||
        m.reporter_name.toLowerCase().includes(q) ||
        (m.technician_vendor || "").toLowerCase().includes(q);
      const matchPriority =
        filterPriority === "ALL" || m.priority === filterPriority;
      const matchStatus = filterStatus === "ALL" || m.status === filterStatus;
      return matchSearch && matchPriority && matchStatus;
    });
  }, [maintenanceLogs, searchQuery, filterPriority, filterStatus]);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat antrean tiket pemeliharaan dan laporan kerusakan..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Log Pemeliharaan & Perbaikan"
        description="Sistem pelaporan teknisi mengalami kendala jaringan. Silakan muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openReportModal = () => {
    const firstAsset = assets[0];
    setAssetId(firstAsset?.id || "");
    setRoomId(firstAsset?.room_id || rooms[0]?.id || "");
    setReporterName("");
    setReporterRole("PIC Ruangan / Staf");
    setIssueTitle("");
    setIssueDescription("");
    setDamageSeverity("Rusak Ringan");
    setPriority("Sedang");
    setPhotoUrl("");
    setFormError("");
    setReportModalOpen(true);
  };

  const handleAssetSelectionChange = (newAssetId: string) => {
    setAssetId(newAssetId);
    const found = assets.find((a) => a.id === newAssetId);
    if (found?.room_id) {
      setRoomId(found.room_id);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    addMaintenanceLog({
      asset_id: assetId || null,
      room_id: roomId || null,
      reporter_name: reporterName.trim(),
      reporter_role: reporterRole.trim() || "Staf Kampus",
      issue_title: issueTitle.trim(),
      issue_description: issueDescription.trim(),
      damage_severity: damageSeverity,
      priority,
      photo_url: photoUrl.trim() || undefined,
      repair_cost: 0,
    });

    setReportModalOpen(false);
  };

  const openTrackingModal = (ticket: MaintenanceLog) => {
    setTrackingTicket(ticket);
    setTrackStatus(
      ticket.status === "Dilaporkan"
        ? "Dalam Pengerjaan"
        : ticket.status === "Dalam Pengerjaan"
        ? "Selesai Diperbaiki"
        : ticket.status
    );
    setTechnicianVendor(ticket.technician_vendor || "");
    setRepairCost(String(ticket.repair_cost || 0));
    setResolutionNotes(ticket.resolution_notes || "");
  };

  const handleTrackingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingTicket) return;
    updateMaintenanceStatus(trackingTicket.id, {
      status: trackStatus,
      technician_vendor: technicianVendor.trim() || "Tim Teknisi Sarpras",
      repair_cost: Math.max(0, Number(repairCost) || 0),
      resolution_notes: resolutionNotes.trim(),
    });
    setTrackingTicket(null);
  };

  const columns: DataTableColumn<MaintenanceLog>[] = [
    {
      key: "ticket",
      header: "Tiket & Kendala Fasilitas",
      render: (row) => (
        <div className="space-y-1 max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.ticket_code}
            </span>
            <PriorityBadge priority={row.priority} />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              ({row.damage_severity})
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.issue_title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.issue_description}
          </p>
        </div>
      ),
    },
    {
      key: "target",
      header: "Aset & Lokasi Ruang",
      render: (row) => {
        const asset = assets.find((a) => a.id === row.asset_id);
        const room = rooms.find((r) => r.id === row.room_id);
        return (
          <div className="text-xs space-y-1">
            {asset ? (
              <p>
                Aset:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {asset.inventory_code}
                </strong>{" "}
                ({asset.name})
              </p>
            ) : null}
            {room ? (
              <p>
                Ruang:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {room.code}
                </strong>{" "}
                ({room.name})
              </p>
            ) : null}
            <p className="text-slate-600 dark:text-slate-400">
              Pelapor: {row.reporter_name} ({row.reporter_role})
            </p>
          </div>
        );
      },
    },
    {
      key: "vendor_cost",
      header: "Teknisi / Vendor & Biaya",
      render: (row) => (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.technician_vendor || "Belum ditugaskan"}
          </p>
          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
            Biaya: {formatCurrencyIDR(row.repair_cost)}
          </p>
          {row.resolution_notes ? (
            <p className="text-slate-600 dark:text-slate-400">
              Tindakan: {row.resolution_notes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status Perbaikan",
      render: (row) => <MaintenanceStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Tindak Lanjut",
      render: (row) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openTrackingModal(row)}
        >
          <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Update Status</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 05 • TICKETING & PEMELIHARAAN FASILITAS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Pemeliharaan & Laporan Kerusakan
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Otomatisasi terintegrasi: pelaporan aset <strong>Rusak Berat</strong>{" "}
            langsung memperbarui status kondisi aset di tabel Inventaris, dan
            kembali menjadi <strong>Baik</strong> saat perbaikan diselesaikan.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={openReportModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Buat Tiket Laporan Kerusakan</span>
        </Button>
      </section>

      {/* Filter Tiket */}
      <section
        aria-label="Filter Tiket Pemeliharaan"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <Input
          label="Cari Nomor Tiket / Kendala / Teknisi"
          placeholder="Ketik MNT-202611 atau Kompresor AC..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          label="Filter Tingkat Prioritas"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Tingkat Prioritas" },
            ...PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label="Filter Status Pengerjaan"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Status" },
            ...STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
      </section>

      {/* Tabel Data Tiket */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        rowKey={(m) => m.id}
        emptyTitle="Tidak Ada Tiket Laporan Kerusakan"
        emptyDescription="Belum ada laporan kerusakan fasilitas yang sesuai dengan filter yang dipilih."
        emptyActionLabel="Buat Tiket Laporan Kerusakan"
        onEmptyAction={openReportModal}
      />

      {/* Modal Form Lapor Kerusakan */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Form Pelaporan Kerusakan Aset / Ruangan"
        description="Jika tingkat kerusakan dipilih Rusak Berat, kondisi aset di Inventaris otomatis berubah menjadi Rusak Berat."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Pilih Aset yang Bermasalah *"
              value={assetId}
              onChange={(e) => handleAssetSelectionChange(e.target.value)}
              options={[
                ...assets.map((a) => ({
                  value: a.id,
                  label: `${a.inventory_code} - ${a.name}`,
                })),
                { value: "", label: "Fasilitas Fisik Ruangan (Non-Inventaris)" },
              ]}
            />
            <Select
              label="Lokasi Ruangan *"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              options={rooms.map((r) => ({
                value: r.id,
                label: `${r.code} - ${r.name}`,
              }))}
            />
          </div>

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

          <Input
            label="Tautan / Nama Dokumentasi Foto Kondisi (Opsional)"
            placeholder="Contoh: foto-ac-2sm4.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="secondary">
              Kirim Laporan Kerusakan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Update Tracking Perbaikan */}
      <Modal
        isOpen={Boolean(trackingTicket)}
        onClose={() => setTrackingTicket(null)}
        title={`Tracking Perbaikan: ${trackingTicket?.ticket_code || ""}`}
        description="Perbarui status pengerjaan, nama teknisi/vendor, dan realisasi biaya perbaikan."
      >
        <form onSubmit={handleTrackingSubmit} className="space-y-4">
          <Select
            label="Status Penanganan *"
            value={trackStatus}
            onChange={(e) =>
              setTrackStatus(e.target.value as MaintenanceStatus)
            }
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />

          <Input
            label="Nama Teknisi / Vendor Pelaksana *"
            placeholder="Contoh: CV Sejuk Teknik Mandiri (Pak Wahyu)"
            value={technicianVendor}
            onChange={(e) => setTechnicianVendor(e.target.value)}
            required
          />

          <Input
            label="Biaya Perbaikan (Rp) *"
            type="number"
            min={0}
            step={25000}
            value={repairCost}
            onChange={(e) => setRepairCost(e.target.value)}
            required
          />

          <Input
            label="Catatan Tindakan / Penyelesaian"
            placeholder="Contoh: Penggantian kapasitor outdoor dan pengurasan pipa drainase selesai."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTrackingTicket(null)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Pembaruan Perbaikan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
