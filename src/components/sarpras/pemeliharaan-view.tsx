"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { KanbanSquare, Plus, Table2, Trash2, Wrench } from "lucide-react";
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
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ColumnsTogglePopover,
  FilterPopover,
} from "@/components/ui/filter-popover";
import { KanbanBoard, KanbanColumnDef } from "@/components/ui/kanban-board";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/sarpras/status-badges";
import { MaintenanceReportModal } from "@/components/sarpras/maintenance-report-modal";

const PRIORITIES: MaintenancePriority[] = [
  "Rendah",
  "Sedang",
  "Tinggi/Darurat",
];
const STATUSES: MaintenanceStatus[] = [
  "Dilaporkan",
  "Dalam Pengerjaan",
  "Selesai Diperbaiki",
];

function isUrlImage(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  );
}

function getMaintenanceProgress(status: MaintenanceStatus): {
  percent: number;
  tone: "navy" | "emerald" | "amber" | "danger";
  barClass: string;
} {
  switch (status) {
    case "Dilaporkan":
      return { percent: 25, tone: "amber", barClass: "bg-amber-500" };
    case "Dalam Pengerjaan":
      return { percent: 65, tone: "navy", barClass: "bg-[#1E3A5F] dark:bg-sky-400" };
    case "Selesai Diperbaiki":
      return { percent: 100, tone: "emerald", barClass: "bg-emerald-600 dark:bg-emerald-400" };
  }
}

export function PemeliharaanView() {
  const {
    rooms,
    assets,
    officeKitItems,
    maintenanceLogs,
    maintenanceVendors,
    notes,
    attachments,
    uiSimState,
    setUiSimState,
    updateMaintenanceStatus,
    deleteMaintenanceLog,
  } = useSarpras();

  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  // Slide-over detail drawer
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Modal Lapor Kerusakan Baru
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportInitialKind, setReportInitialKind] = useState<
    "asset" | "office_kit" | "room"
  >("asset");
  const [reportInitialKitIds, setReportInitialKitIds] = useState<string[]>([]);
  const handledReportKitRef = useRef<string | null>(null);

  // Modal Update Tracking Perbaikan
  const [trackingTicket, setTrackingTicket] = useState<MaintenanceLog | null>(
    null
  );
  const [trackStatus, setTrackStatus] =
    useState<MaintenanceStatus>("Dalam Pengerjaan");
  const [vendorId, setVendorId] = useState("");
  const [technicianVendor, setTechnicianVendor] = useState("");
  const [repairCost, setRepairCost] = useState("0");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Modal Konfirmasi Hapus Tiket Kerusakan
  const [deletingTicket, setDeletingTicket] = useState<MaintenanceLog | null>(
    null
  );
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inspect = params.get("inspect");
    if (inspect && maintenanceLogs.some((m) => m.id === inspect)) {
      setSelectedTicketId(inspect);
    }
    const reportKit = params.get("reportKit");
    if (reportKit && handledReportKitRef.current !== reportKit) {
      const matchedKit = officeKitItems.find((k) => k.id === reportKit);
      if (matchedKit) {
        handledReportKitRef.current = reportKit;
        setReportInitialKind("office_kit");
        setReportInitialKitIds([matchedKit.id]);
        setReportModalOpen(true);
      }
    }
  }, [maintenanceLogs, officeKitItems]);

  const selectedTicket = useMemo(
    () => maintenanceLogs.find((m) => m.id === selectedTicketId) || null,
    [maintenanceLogs, selectedTicketId]
  );

  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      const kit = m.office_kit_item_id
        ? officeKitItems.find((k) => k.id === m.office_kit_item_id)
        : null;
      const asset = m.asset_id
        ? assets.find((a) => a.id === m.asset_id)
        : null;
      const matchSearch =
        !q ||
        m.ticket_code.toLowerCase().includes(q) ||
        m.issue_title.toLowerCase().includes(q) ||
        m.reporter_name.toLowerCase().includes(q) ||
        (m.technician_vendor || "").toLowerCase().includes(q) ||
        (kit &&
          (kit.kit_code.toLowerCase().includes(q) ||
            kit.name.toLowerCase().includes(q))) ||
        (asset &&
          (asset.inventory_code.toLowerCase().includes(q) ||
            asset.name.toLowerCase().includes(q)));
      const matchPriority =
        filterPriority === "ALL" || m.priority === filterPriority;
      const matchStatus = filterStatus === "ALL" || m.status === filterStatus;
      return matchSearch && matchPriority && matchStatus;
    });
  }, [
    assets,
    filterPriority,
    filterStatus,
    maintenanceLogs,
    officeKitItems,
    searchQuery,
  ]);

  const activeFilterCount =
    (filterPriority !== "ALL" ? 1 : 0) + (filterStatus !== "ALL" ? 1 : 0);

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
    const defaultKind: "asset" | "office_kit" | "room" =
      assets.length > 0
        ? "asset"
        : officeKitItems.length > 0
        ? "office_kit"
        : "room";
    setReportInitialKind(defaultKind);
    setReportInitialKitIds([]);
    setReportModalOpen(true);
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
    const matchedVendor =
      maintenanceVendors.find((v) => v.id === ticket.vendor_id) ||
      maintenanceVendors.find(
        (v) =>
          ticket.technician_vendor &&
          ticket.technician_vendor.toLowerCase().includes(v.name.toLowerCase())
      ) ||
      (!ticket.technician_vendor
        ? maintenanceVendors.find((v) => v.is_active)
        : undefined);
    setVendorId(matchedVendor?.id || "");
    setTechnicianVendor(
      ticket.technician_vendor ||
        (matchedVendor
          ? `${matchedVendor.name} (${matchedVendor.pic_name})`
          : "")
    );
    setRepairCost(String(ticket.repair_cost || 0));
    setResolutionNotes(ticket.resolution_notes || "");
  };

  const handleTrackingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingTicket) return;
    const matchedVendor = maintenanceVendors.find((v) => v.id === vendorId);
    const vendorDisplay = matchedVendor
      ? matchedVendor.vendor_type === "Teknisi Internal"
        ? matchedVendor.name
        : `${matchedVendor.name} (${matchedVendor.pic_name})`
      : technicianVendor.trim() || "Tim Teknisi Sarpras";
    updateMaintenanceStatus(trackingTicket.id, {
      status: trackStatus,
      technician_vendor: vendorDisplay,
      vendor_id: matchedVendor?.id || null,
      repair_cost: Math.max(0, Number(repairCost) || 0),
      resolution_notes: resolutionNotes.trim(),
    });
    setTrackingTicket(null);
  };

  const toggleColumnKey = (key: string) => {
    setHiddenColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const kanbanColumns: KanbanColumnDef<MaintenanceLog>[] = [
    {
      id: "Dilaporkan",
      title: "Dilaporkan",
      dotColorClass: "bg-red-600",
      items: filteredLogs.filter((m) => m.status === "Dilaporkan"),
      onQuickAdd: openReportModal,
    },
    {
      id: "Dalam Pengerjaan",
      title: "Dalam Pengerjaan",
      dotColorClass: "bg-amber-500",
      items: filteredLogs.filter((m) => m.status === "Dalam Pengerjaan"),
    },
    {
      id: "Selesai Diperbaiki",
      title: "Selesai Diperbaiki",
      dotColorClass: "bg-emerald-600 dark:bg-emerald-400",
      items: filteredLogs.filter((m) => m.status === "Selesai Diperbaiki"),
    },
  ];

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
      header: "Objek & Lokasi Ruang",
      render: (row) => {
        const asset = assets.find((a) => a.id === row.asset_id);
        const officeKit = row.office_kit_item_id
          ? officeKitItems.find((k) => k.id === row.office_kit_item_id)
          : null;
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
            {officeKit ? (
              <p>
                Alat Kantor:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {officeKit.kit_code}
                </strong>{" "}
                ({officeKit.name})
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
            {row.deleted_target_label ? (
              <p className="font-mono text-amber-800 dark:text-amber-300">
                Arsip: {row.deleted_target_label}
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
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openTrackingModal(row)}
          >
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Update Status</span>
          </Button>
        </div>
      ),
    },
  ];

  const selectedProgress = selectedTicket
    ? getMaintenanceProgress(selectedTicket.status)
    : null;
  const selectedAsset = selectedTicket
    ? assets.find((a) => a.id === selectedTicket.asset_id)
    : null;
  const selectedOfficeKit = selectedTicket?.office_kit_item_id
    ? officeKitItems.find((k) => k.id === selectedTicket.office_kit_item_id)
    : null;
  const selectedRoom = selectedTicket
    ? rooms.find((r) => r.id === selectedTicket.room_id)
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 05 • TICKETING & PEMELIHARAAN FASILITAS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Pemeliharaan & Laporan Kerusakan
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Otomatisasi kondisi aset inventaris & alat kantor staf terhubung
            langsung. Klik kartu tiket untuk dokumentasi dan progres teknisi,
            atau seret kartu antar kolom status.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={openReportModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Buat Tiket Laporan Kerusakan</span>
        </Button>
      </section>

      {/* Toolbar Ringkas */}
      <section
        aria-label="Toolbar Tiket Pemeliharaan"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari tiket MNT-, kendala, pelapor, atau teknisi..."
            aria-label="Cari tiket pemeliharaan"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Tiket Kerusakan"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterPriority("ALL");
              setFilterStatus("ALL");
            }}
            groups={[
              {
                key: "priority",
                label: "Tingkat Prioritas",
                value: filterPriority,
                onChange: setFilterPriority,
                options: [
                  { value: "ALL", label: "Semua Prioritas" },
                  ...PRIORITIES.map((p) => ({ value: p, label: p })),
                ],
              },
              {
                key: "status",
                label: "Status Penanganan",
                value: filterStatus,
                onChange: setFilterStatus,
                options: [
                  { value: "ALL", label: "Semua Status" },
                  ...STATUSES.map((s) => ({ value: s, label: s })),
                ],
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "table" ? (
            <ColumnsTogglePopover
              columns={columns.map((c) => ({ key: c.key, label: c.header }))}
              hiddenKeys={hiddenColumnKeys}
              onToggleKey={toggleColumnKey}
            />
          ) : null}

          <div
            role="group"
            aria-label="Pilih tampilan daftar pemeliharaan"
            className="inline-flex rounded-md border border-slate-400 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setViewMode("board")}
              aria-pressed={viewMode === "board"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "board"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <KanbanSquare className="w-4 h-4" aria-hidden="true" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
              <span>Tabel</span>
            </button>
          </div>
        </div>
      </section>

      {/* Papan Kanban atau Tabel */}
      {viewMode === "board" ? (
        <KanbanBoard
          columns={kanbanColumns}
          rowKey={(m) => m.id}
          activeItemId={selectedTicketId}
          onCardClick={(item) => setSelectedTicketId(item.id)}
          onCardDrop={(item, _sourceColId, targetColId) => {
            updateMaintenanceStatus(item.id, {
              status: targetColId as MaintenanceStatus,
            });
          }}
          renderCustomCard={(row, meta) => {
            const room = rooms.find((r) => r.id === row.room_id);
            const asset = assets.find((a) => a.id === row.asset_id);
            const officeKit = row.office_kit_item_id
              ? officeKitItems.find((k) => k.id === row.office_kit_item_id)
              : null;

            const locLabel = room
              ? `Ruang ${room.code}`
              : officeKit
              ? "Kantor Staf"
              : "Fasilitas";
            const itemLabel = asset
              ? `${asset.inventory_code} - ${asset.name}`
              : officeKit
              ? `${officeKit.kit_code} (${officeKit.name})`
              : "Prasarana Ruangan";

            return (
              <div
                className={`rounded-lg border transition-colors ${
                  meta.isSelected
                    ? "border-[#1E3A5F] bg-sky-50/90 dark:border-sky-400 dark:bg-sky-950/40"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <button
                  type="button"
                  onClick={meta.onClick}
                  className="w-full text-left p-3.5 space-y-2 rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                      {row.ticket_code}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {row.issue_title}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                    {locLabel} • {itemLabel} • {row.damage_severity}
                  </p>
                </button>
                <div
                  className="px-3.5 pb-3 pt-1 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openTrackingModal(row)}
                  >
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Update Status</span>
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError("");
                      setDeletingTicket(row);
                    }}
                    aria-label={`Hapus tiket ${row.ticket_code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredLogs}
          rowKey={(m) => m.id}
          hiddenColumnKeys={hiddenColumnKeys}
          activeRowKey={selectedTicketId}
          onRowClick={(row) => setSelectedTicketId(row.id)}
          emptyTitle="Tidak Ada Tiket Laporan Kerusakan"
          emptyDescription="Belum ada laporan kerusakan fasilitas yang sesuai dengan filter yang dipilih."
          emptyActionLabel="Buat Tiket Laporan Kerusakan"
          onEmptyAction={openReportModal}
        />
      )}

      {/* Slide-Over Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicketId(null)}
        title={selectedTicket?.issue_title || ""}
        subtitle={
          selectedTicket
            ? `${selectedTicket.ticket_code} • Dilaporkan ${selectedTicket.reported_at.slice(
                0,
                10
              )} oleh ${selectedTicket.reporter_name}`
            : undefined
        }
        headerBadge={
          selectedTicket ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedTicket.ticket_code}
              </span>
              <PriorityBadge priority={selectedTicket.priority} />
              <MaintenanceStatusBadge status={selectedTicket.status} />
            </>
          ) : null
        }
        footer={
          selectedTicket ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTicketId(null)}
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeleteError("");
                    setDeletingTicket(selectedTicket);
                  }}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus Tiket</span>
                </Button>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => openTrackingModal(selectedTicket)}
              >
                <Wrench className="w-4 h-4" aria-hidden="true" />
                <span>Update Progres Teknisi</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedTicket && selectedProgress ? (
          <div className="space-y-5">
            {selectedTicket.priority === "Tinggi/Darurat" &&
            selectedTicket.status !== "Selesai Diperbaiki" ? (
              <div className="p-3.5 rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/50 dark:border-red-700 text-xs text-red-950 dark:text-red-200">
                <strong>Prioritas Darurat:</strong> Kendala ini menandai
                kerusakan kritis. Pastikan penugasan teknisi segera diperbarui
                agar fasilitas ruang dapat kembali digunakan.
              </div>
            ) : null}

            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center gap-4">
              <ProgressRing
                percent={selectedProgress.percent}
                tone={selectedProgress.tone}
              />
              <div className="space-y-1 text-xs min-w-0">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Status: {selectedTicket.status} ({selectedTicket.damage_severity})
                </p>
                <p className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                  Realisasi Biaya: {formatCurrencyIDR(selectedTicket.repair_cost)}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Teknisi/Vendor:{" "}
                  {selectedTicket.technician_vendor || "Belum ditugaskan"}
                </p>
              </div>
            </div>

            {isUrlImage(selectedTicket.photo_url) ? (
              <div className="space-y-1.5">
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Foto Kondisi Lapangan
                </p>
                <div className="rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 max-h-56 bg-slate-100 dark:bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedTicket.photo_url}
                    alt={`Foto kerusakan ${selectedTicket.ticket_code}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : null}

            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div>
                <p className="text-slate-600 dark:text-slate-400">
                  Deskripsi Detail Kendala
                </p>
                <p className="mt-1 text-slate-900 dark:text-slate-100 leading-relaxed">
                  {selectedTicket.issue_description}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">
                    Objek Terkait
                  </span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {selectedAsset
                      ? `${selectedAsset.inventory_code} - ${selectedAsset.name}`
                      : selectedOfficeKit
                      ? `${selectedOfficeKit.kit_code} - ${selectedOfficeKit.name} (Alat Kantor Staf)`
                      : selectedTicket.deleted_target_label ||
                        "Fasilitas Fisik Ruangan"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400 block">
                    Lokasi Ruangan
                  </span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {selectedRoom
                      ? `${selectedRoom.code} (${selectedRoom.name})`
                      : selectedOfficeKit
                      ? selectedOfficeKit.storage_tray || "Kantor Staf"
                      : "-"}
                  </strong>
                </div>
              </div>
              {selectedTicket.resolution_notes ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 block">
                    Tindakan Perbaikan Teknisi
                  </span>
                  <p className="mt-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                    {selectedTicket.resolution_notes}
                  </p>
                </div>
              ) : null}
            </div>

            <EntityDrawerSections
              entityType="maintenance"
              entityId={selectedTicket.id}
              baseEventDates={[selectedTicket.reported_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Form Lapor Kerusakan */}
      <MaintenanceReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        initialTargetKind={reportInitialKind}
        initialOfficeKitIds={reportInitialKitIds}
      />

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

          {maintenanceVendors.some((v) => v.is_active) ? (
            <Select
              label="Teknisi / Vendor Pelaksana *"
              value={vendorId || (technicianVendor ? "__LEGACY__" : "")}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__LEGACY__") {
                  setVendorId("");
                  return;
                }
                setVendorId(val);
                const found = maintenanceVendors.find((v) => v.id === val);
                if (found) {
                  setTechnicianVendor(
                    found.vendor_type === "Teknisi Internal"
                      ? found.name
                      : `${found.name} (${found.pic_name})`
                  );
                }
              }}
              options={[
                ...maintenanceVendors
                  .filter((v) => v.is_active)
                  .map((v) => ({
                    value: v.id,
                    label: `${v.vendor_code} - ${v.name} [${v.specialty}] (PIC: ${v.pic_name})`,
                  })),
                ...(!vendorId && technicianVendor
                  ? [
                      {
                        value: "__LEGACY__",
                        label: `${technicianVendor} (Data Historis)`,
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <Input
              label="Nama Teknisi / Vendor Pelaksana *"
              placeholder="Contoh: CV Sejuk Teknik Mandiri (Pak Wahyu)"
              value={technicianVendor}
              onChange={(e) => setTechnicianVendor(e.target.value)}
              required
            />
          )}

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

      <ConfirmDeleteModal
        isOpen={Boolean(deletingTicket)}
        onClose={() => {
          if (!deleting) {
            setDeletingTicket(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Tiket Kerusakan"
        targetBadge={deletingTicket?.ticket_code}
        targetName={deletingTicket?.issue_title || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingTicket
            ? [
                ...(deletingTicket.asset_id
                  ? [
                      "Kondisi fisik aset terkait akan dievaluasi ulang otomatis berdasarkan sisa tiket aktif lainnya.",
                    ]
                  : []),
                ...(deletingTicket.office_kit_item_id
                  ? [
                      "Kondisi dan ketersediaan alat kantor staf terkait akan dievaluasi ulang otomatis.",
                    ]
                  : []),
                ...(deletingTicket.room_id
                  ? [
                      "Status ruangan terkait akan dipulihkan bila tidak ada lagi kendala darurat aktif.",
                    ]
                  : []),
                `Catatan & lampiran foto/dokumen terkait (${
                  notes.filter(
                    (n) =>
                      n.entity_type === "maintenance" &&
                      n.entity_id === deletingTicket.id
                  ).length
                } catatan, ${
                  attachments.filter(
                    (a) =>
                      a.entity_type === "maintenance" &&
                      a.entity_id === deletingTicket.id
                  ).length
                } file) ikut dihapus permanen.`,
              ]
            : []
        }
        onConfirm={async () => {
          if (!deletingTicket) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteMaintenanceLog(deletingTicket.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus tiket kerusakan.");
            return;
          }
          if (selectedTicketId === deletingTicket.id) {
            setSelectedTicketId(null);
          }
          setDeletingTicket(null);
        }}
      />
    </div>
  );
}
