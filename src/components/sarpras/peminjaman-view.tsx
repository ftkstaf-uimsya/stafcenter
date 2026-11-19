"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  KanbanSquare,
  Plus,
  RotateCcw,
  Table2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { TODAY_ISO } from "@/lib/supabase/seed-data";
import {
  Booking,
  BookingStatus,
  BookingTargetType,
  BorrowerRole,
} from "@/types/sarpras";
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
import { BookingStatusBadge } from "@/components/sarpras/status-badges";

const BORROWER_ROLES: BorrowerRole[] = ["Dosen", "Staf", "Mahasiswa/Ormawa"];
const TARGET_TYPES: BookingTargetType[] = [
  "Ruangan",
  "Alat",
  "Ruangan & Alat",
];
const BOOKING_STATUSES: BookingStatus[] = [
  "Menunggu Persetujuan",
  "Disetujui",
  "Sedang Dipinjam",
  "Selesai / Dikembalikan",
  "Ditolak",
];

function getBookingProgress(status: BookingStatus): {
  percent: number;
  tone: "navy" | "emerald" | "amber" | "danger";
  barClass: string;
} {
  switch (status) {
    case "Menunggu Persetujuan":
      return { percent: 25, tone: "amber", barClass: "bg-amber-500" };
    case "Disetujui":
      return { percent: 55, tone: "navy", barClass: "bg-[#1E3A5F] dark:bg-sky-400" };
    case "Sedang Dipinjam":
      return { percent: 80, tone: "amber", barClass: "bg-sky-600 dark:bg-sky-400" };
    case "Selesai / Dikembalikan":
      return { percent: 100, tone: "emerald", barClass: "bg-emerald-600 dark:bg-emerald-400" };
    case "Ditolak":
      return { percent: 100, tone: "danger", barClass: "bg-red-600 dark:bg-red-400" };
  }
}

export function PeminjamanView() {
  const {
    rooms,
    assets,
    bookings,
    notes,
    attachments,
    lecturers,
    uiSimState,
    setUiSimState,
    addBooking,
    updateBookingStatus,
    deleteBooking,
  } = useSarpras();

  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRole, setFilterRole] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  // Slide-over detail drawer
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );

  // Modal Form Pengajuan Peminjaman
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerRole, setBorrowerRole] = useState<BorrowerRole>("Dosen");
  const [selectedLecturerId, setSelectedLecturerId] = useState("");
  const [borrowerUnit, setBorrowerUnit] = useState("");
  const [borrowerPhone, setBorrowerPhone] = useState("");
  const [targetType, setTargetType] = useState<BookingTargetType>("Ruangan");
  const [roomId, setRoomId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [activityName, setActivityName] = useState("");
  const [attendeesCount, setAttendeesCount] = useState("30");
  const [bookingDate, setBookingDate] = useState(TODAY_ISO);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [conflictError, setConflictError] = useState("");

  // Modal Pengembalian & Catatan Kondisi Barang
  const [returningBooking, setReturningBooking] = useState<Booking | null>(
    null
  );
  const [returnNotes, setReturnNotes] = useState("");

  // Modal Konfirmasi Hapus Tiket Peminjaman
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && bookings.some((b) => b.id === inspect)) {
      setSelectedBookingId(inspect);
    }
  }, [bookings]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const portableAssets = useMemo(
    () => assets.filter((a) => a.is_portable && a.condition !== "Hilang"),
    [assets]
  );

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        b.booking_code.toLowerCase().includes(q) ||
        b.borrower_name.toLowerCase().includes(q) ||
        b.activity_name.toLowerCase().includes(q) ||
        b.borrower_unit.toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || b.status === filterStatus;
      const matchRole = filterRole === "ALL" || b.borrower_role === filterRole;
      return matchSearch && matchStatus && matchRole;
    });
  }, [bookings, searchQuery, filterStatus, filterRole]);

  const activeFilterCount =
    (filterStatus !== "ALL" ? 1 : 0) + (filterRole !== "ALL" ? 1 : 0);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat jadwal peminjaman ruangan dan sirkulasi alat..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Jadwal Peminjaman & Reservasi"
        description="Sistem tidak dapat memverifikasi kalender sirkulasi ruangan saat ini."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openBookingModal = () => {
    setBorrowerName("");
    setBorrowerRole("Dosen");
    setSelectedLecturerId("");
    setBorrowerUnit("");
    setBorrowerPhone("");
    setTargetType("Ruangan");
    setRoomId(rooms[0]?.id || "");
    setAssetId(portableAssets[0]?.id || "");
    setActivityName("");
    setAttendeesCount("35");
    setBookingDate(TODAY_ISO);
    setStartTime("13:00");
    setEndTime("15:00");
    setConflictError("");
    setBookingModalOpen(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError("");

    if (
      !borrowerName.trim() ||
      !borrowerUnit.trim() ||
      !activityName.trim()
    ) {
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

    const res = addBooking({
      borrower_name: borrowerName.trim(),
      borrower_role: borrowerRole,
      borrower_unit: borrowerUnit.trim(),
      borrower_phone: borrowerPhone.trim() || "-",
      target_type: targetType,
      room_id: selectedRoomId,
      asset_id: selectedAssetId,
      activity_name: activityName.trim(),
      attendees_count: Math.max(1, Number(attendeesCount) || 1),
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
    });

    if (!res.ok) {
      setConflictError(res.error || "Terjadi bentrok jadwal peminjaman.");
      return;
    }

    setBookingModalOpen(false);
  };

  const handleCompleteReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningBooking) return;
    updateBookingStatus(
      returningBooking.id,
      "Selesai / Dikembalikan",
      returnNotes.trim() ||
        "Dikembalikan tepat waktu dalam kondisi lengkap & baik."
    );
    setReturningBooking(null);
    setReturnNotes("");
  };

  const toggleColumnKey = (key: string) => {
    setHiddenColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const kanbanColumns: KanbanColumnDef<Booking>[] = [
    {
      id: "Menunggu Persetujuan",
      title: "Menunggu Persetujuan",
      dotColorClass: "bg-amber-500",
      items: filteredBookings.filter(
        (b) => b.status === "Menunggu Persetujuan"
      ),
      onQuickAdd: openBookingModal,
    },
    {
      id: "Disetujui",
      title: "Disetujui",
      dotColorClass: "bg-[#1E3A5F] dark:bg-sky-400",
      items: filteredBookings.filter((b) => b.status === "Disetujui"),
    },
    {
      id: "Sedang Dipinjam",
      title: "Sedang Dipinjam",
      dotColorClass: "bg-sky-600 dark:bg-sky-400",
      items: filteredBookings.filter((b) => b.status === "Sedang Dipinjam"),
    },
    {
      id: "Selesai / Dikembalikan",
      title: "Selesai / Dikembalikan",
      dotColorClass: "bg-emerald-600 dark:bg-emerald-400",
      items: filteredBookings.filter(
        (b) => b.status === "Selesai / Dikembalikan"
      ),
    },
    {
      id: "Ditolak",
      title: "Ditolak",
      dotColorClass: "bg-red-600",
      items: filteredBookings.filter((b) => b.status === "Ditolak"),
    },
  ];

  const columns: DataTableColumn<Booking>[] = [
    {
      key: "code_activity",
      header: "Kode Tiket & Kegiatan",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.booking_code}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {row.target_type}
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.activity_name}
          </p>
          {row.return_condition_notes ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              Catatan Kembali: {row.return_condition_notes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "borrower",
      header: "Peminjam & Unit",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.borrower_name}
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            {row.borrower_role} • {row.borrower_unit}
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            {row.borrower_phone}
          </p>
        </div>
      ),
    },
    {
      key: "facility",
      header: "Fasilitas Dipinjam",
      render: (row) => {
        const room = rooms.find((r) => r.id === row.room_id);
        const asset = assets.find((a) => a.id === row.asset_id);
        return (
          <div className="text-xs space-y-1">
            {room ? (
              <p>
                Ruang:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {room.code}
                </strong>{" "}
                ({room.name})
              </p>
            ) : null}
            {asset ? (
              <p>
                Alat:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {asset.inventory_code}
                </strong>{" "}
                ({asset.name})
              </p>
            ) : null}
            {row.deleted_target_label ? (
              <p className="font-mono text-amber-800 dark:text-amber-300">
                Arsip: {row.deleted_target_label}
              </p>
            ) : null}
            <p className="text-slate-600 dark:text-slate-400">
              Peserta: {row.attendees_count} orang
            </p>
          </div>
        );
      },
    },
    {
      key: "schedule",
      header: "Tanggal & Jam",
      render: (row) => (
        <div className="text-xs font-mono space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.booking_date}
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            {row.start_time} - {row.end_time} WIB
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Alur Status",
      render: (row) => <BookingStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Kendali Sirkulasi",
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {row.status === "Menunggu Persetujuan" ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  updateBookingStatus(
                    row.id,
                    "Disetujui",
                    undefined,
                    "Kepala Biro Sarpras"
                  )
                }
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Setujui</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => updateBookingStatus(row.id, "Ditolak")}
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tolak</span>
              </Button>
            </>
          ) : null}

          {row.status === "Disetujui" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => updateBookingStatus(row.id, "Sedang Dipinjam")}
            >
              <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Serah Terima Kunci/Alat</span>
            </Button>
          ) : null}

          {row.status === "Sedang Dipinjam" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReturningBooking(row);
                setReturnNotes("");
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Catat Pengembalian</span>
            </Button>
          ) : null}

          {(row.status === "Selesai / Dikembalikan" ||
            row.status === "Ditolak") && (
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Sirkulasi Selesai
            </span>
          )}
        </div>
      ),
    },
  ];

  const selectedProgress = selectedBooking
    ? getBookingProgress(selectedBooking.status)
    : null;
  const selectedRoom = selectedBooking
    ? rooms.find((r) => r.id === selectedBooking.room_id)
    : null;
  const selectedAsset = selectedBooking
    ? assets.find((a) => a.id === selectedBooking.asset_id)
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 04 • SIRKULASI RUANGAN & ALAT PORTABEL
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Peminjaman & Reservasi Fasilitas
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Alur sirkulasi dengan validasi deteksi bentrok jadwal otomatis (
            <em>Conflict Detection</em>). Klik kartu atau baris untuk membuka
            panel detail.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openBookingModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Ajukan Peminjaman Baru</span>
        </Button>
      </section>

      {/* Toolbar Ringkas Tunggal: Cari + Filter Popover + Pengalih Tampilan + Kolom */}
      <section
        aria-label="Toolbar Sirkulasi Peminjaman"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari tiket PJM-, peminjam, unit, atau kegiatan..."
            aria-label="Cari peminjaman"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Sirkulasi Peminjaman"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterStatus("ALL");
              setFilterRole("ALL");
            }}
            groups={[
              {
                key: "status",
                label: "Status Alur",
                value: filterStatus,
                onChange: setFilterStatus,
                options: [
                  { value: "ALL", label: "Semua Status" },
                  ...BOOKING_STATUSES.map((s) => ({ value: s, label: s })),
                ],
              },
              {
                key: "role",
                label: "Kategori Peminjam",
                value: filterRole,
                onChange: setFilterRole,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...BORROWER_ROLES.map((r) => ({ value: r, label: r })),
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
            aria-label="Pilih tampilan daftar peminjaman"
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

      {/* Konten Utama: Kanban Board atau DataTable */}
      {viewMode === "board" ? (
        <KanbanBoard
          columns={kanbanColumns}
          rowKey={(b) => b.id}
          activeItemId={selectedBookingId}
          onCardClick={(item) => setSelectedBookingId(item.id)}
          renderCard={(row) => {
            const room = rooms.find((r) => r.id === row.room_id);
            const asset = assets.find((a) => a.id === row.asset_id);
            const prog = getBookingProgress(row.status);
            const noteCount = notes.filter(
              (n) => n.entity_type === "booking" && n.entity_id === row.id
            ).length;
            const attCount = attachments.filter(
              (a) => a.entity_type === "booking" && a.entity_id === row.id
            ).length;

            const facilityLine = [
              room ? `Ruang ${room.code}` : "",
              asset ? asset.inventory_code : "",
            ]
              .filter(Boolean)
              .join(" + ");

            return {
              code: row.booking_code,
              title: row.activity_name,
              subtitle: facilityLine || row.target_type,
              description: `${row.borrower_unit} • ${row.booking_date} (${row.start_time}-${row.end_time})`,
              valueBadge: `${row.attendees_count} org`,
              assigneeName: row.borrower_name,
              progressPercent: prog.percent,
              progressColorClass: prog.barClass,
              notesCount: noteCount,
              attachmentsCount: attCount,
              ageLabel: `${row.start_time}-${row.end_time}`,
              footerAction:
                row.status === "Menunggu Persetujuan" ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        updateBookingStatus(
                          row.id,
                          "Disetujui",
                          undefined,
                          "Kepala Biro Sarpras"
                        )
                      }
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Setujui</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => updateBookingStatus(row.id, "Ditolak")}
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tolak</span>
                    </Button>
                  </div>
                ) : row.status === "Disetujui" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      updateBookingStatus(row.id, "Sedang Dipinjam")
                    }
                  >
                    <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Serah Terima Kunci/Alat</span>
                  </Button>
                ) : row.status === "Sedang Dipinjam" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setReturningBooking(row);
                      setReturnNotes("");
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Catat Pengembalian</span>
                  </Button>
                ) : null,
            };
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredBookings}
          rowKey={(b) => b.id}
          hiddenColumnKeys={hiddenColumnKeys}
          activeRowKey={selectedBookingId}
          onRowClick={(row) => setSelectedBookingId(row.id)}
          emptyTitle="Tidak Ada Jadwal Peminjaman"
          emptyDescription="Belum ada reservasi ruangan atau alat pada kriteria filter yang dipilih."
          emptyActionLabel="Ajukan Peminjaman Baru"
          onEmptyAction={openBookingModal}
        />
      )}

      {/* Slide-Over Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBookingId(null)}
        title={selectedBooking?.activity_name || ""}
        subtitle={
          selectedBooking
            ? `${selectedBooking.booking_code} • ${selectedBooking.borrower_name} (${selectedBooking.borrower_unit})`
            : undefined
        }
        headerBadge={
          selectedBooking ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedBooking.booking_code}
              </span>
              <BookingStatusBadge status={selectedBooking.status} />
            </>
          ) : null
        }
        footer={
          selectedBooking ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedBookingId(null)}
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeleteError("");
                    setDeletingBooking(selectedBooking);
                  }}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus Tiket</span>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedBooking.status === "Menunggu Persetujuan" ? (
                  <>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() =>
                        updateBookingStatus(selectedBooking.id, "Ditolak")
                      }
                    >
                      Tolak Pengajuan
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() =>
                        updateBookingStatus(
                          selectedBooking.id,
                          "Disetujui",
                          undefined,
                          "Kepala Biro Sarpras"
                        )
                      }
                    >
                      Setujui Peminjaman
                    </Button>
                  </>
                ) : null}
                {selectedBooking.status === "Disetujui" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      updateBookingStatus(selectedBooking.id, "Sedang Dipinjam")
                    }
                  >
                    Serah Terima Kunci / Alat
                  </Button>
                ) : null}
                {selectedBooking.status === "Sedang Dipinjam" ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setReturningBooking(selectedBooking);
                      setReturnNotes("");
                    }}
                  >
                    Catat Pengembalian Selesai
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {selectedBooking && selectedProgress ? (
          <div className="space-y-5">
            {/* Peringatan Tindakan Berikutnya */}
            {selectedBooking.status === "Menunggu Persetujuan" ? (
              <div className="p-3.5 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200">
                <strong>Menunggu Persetujuan Sarpras:</strong> Tinjau jadwal{" "}
                <span className="font-mono font-bold">
                  {selectedBooking.booking_date} ({selectedBooking.start_time}-
                  {selectedBooking.end_time} WIB)
                </span>{" "}
                sebelum melakukan persetujuan agar ruang/alat siap dipakai.
              </div>
            ) : null}

            {/* Ring Progres & Ringkasan Sirkulasi */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center gap-4">
              <ProgressRing
                percent={selectedProgress.percent}
                tone={selectedProgress.tone}
              />
              <div className="space-y-1 text-xs min-w-0">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Tahap Sirkulasi: {selectedBooking.status}
                </p>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  Jadwal: {selectedBooking.booking_date} •{" "}
                  {selectedBooking.start_time} - {selectedBooking.end_time} WIB
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Peserta: {selectedBooking.attendees_count} orang • Kontak:{" "}
                  {selectedBooking.borrower_phone}
                </p>
              </div>
            </div>

            {/* Rincian Fasilitas */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Peminjam & Peran
                </dt>
                <dd className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                  {selectedBooking.borrower_name} ({selectedBooking.borrower_role})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Unit / Ormawa
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedBooking.borrower_unit}
                </dd>
              </div>
              {selectedRoom ? (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">
                    Ruangan Kampus
                  </dt>
                  <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {selectedRoom.code} ({selectedRoom.name})
                  </dd>
                </div>
              ) : null}
              {selectedAsset ? (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">
                    Alat Portabel
                  </dt>
                  <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {selectedAsset.inventory_code} ({selectedAsset.name})
                  </dd>
                </div>
              ) : null}
              {selectedBooking.deleted_target_label ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Riwayat Target Terhapus
                  </dt>
                  <dd className="mt-0.5 font-mono text-amber-800 dark:text-amber-300">
                    {selectedBooking.deleted_target_label}
                  </dd>
                </div>
              ) : null}
              {selectedBooking.approved_by ? (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">
                    Disetujui Oleh
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                    {selectedBooking.approved_by}
                  </dd>
                </div>
              ) : null}
              {selectedBooking.return_condition_notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan Kondisi Pengembalian
                  </dt>
                  <dd className="mt-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                    {selectedBooking.return_condition_notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <EntityDrawerSections
              entityType="booking"
              entityId={selectedBooking.id}
              baseEventDates={[selectedBooking.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Form Pengajuan Peminjaman (Dengan Conflict Detection) */}
      <Modal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        title="Form Pengajuan Peminjaman Ruangan & Alat"
        description="Sistem secara otomatis memeriksa apakah ruangan atau alat sudah dipesan pada jam yang sama."
        maxWidthClass="max-w-2xl"
      >
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
                  if (found.phone) setBorrowerPhone(found.phone);
                }
              }}
              options={[
                { value: "", label: "-- Pilih dosen atau ketik manual di bawah --" },
                ...lecturers
                  .filter((l) => l.is_active)
                  .map((l) => ({
                    value: l.id,
                    label: `${l.nidn_nip} - ${l.full_name} (${l.homebase_prodi})`,
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
              }}
              options={BORROWER_ROLES.map((r) => ({ value: r, label: r }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Program Studi / Unit / Ormawa *"
              placeholder="Contoh: Prodi Teknik Informatika / BEM"
              value={borrowerUnit}
              onChange={(e) => setBorrowerUnit(e.target.value)}
              required
            />
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
              onChange={(e) => setBookingDate(e.target.value)}
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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBookingModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Validasi & Simpan Reservasi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Catat Pengembalian & Kondisi Barang */}
      <Modal
        isOpen={Boolean(returningBooking)}
        onClose={() => setReturningBooking(null)}
        title={`Pengembalian Fasilitas: ${returningBooking?.booking_code || ""}`}
        description="Catat kondisi ruangan atau alat saat dikembalikan oleh peminjam."
      >
        <form onSubmit={handleCompleteReturn} className="space-y-4">
          <Input
            label="Catatan Kondisi Barang / Ruangan Saat Dikembalikan *"
            placeholder="Contoh: Kunci ruang & proyektor dikembalikan lengkap, kondisi baik."
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            required
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturningBooking(null)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Konfirmasi Pengembalian Selesai
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingBooking)}
        onClose={() => {
          if (!deleting) {
            setDeletingBooking(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Tiket Peminjaman"
        targetBadge={deletingBooking?.booking_code}
        targetName={deletingBooking?.activity_name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingBooking
            ? [
                `Peminjam: ${deletingBooking.borrower_name} (${deletingBooking.borrower_unit})`,
                ...(deletingBooking.status === "Sedang Dipinjam" &&
                deletingBooking.room_id
                  ? [
                      "Status ruangan terkait akan otomatis dipulihkan menjadi Tersedia.",
                    ]
                  : []),
                `Catatan & berkas lampiran terkait (${
                  notes.filter(
                    (n) =>
                      n.entity_type === "booking" &&
                      n.entity_id === deletingBooking.id
                  ).length
                } catatan, ${
                  attachments.filter(
                    (a) =>
                      a.entity_type === "booking" &&
                      a.entity_id === deletingBooking.id
                  ).length
                } file) ikut dihapus permanen.`,
              ]
            : []
        }
        onConfirm={async () => {
          if (!deletingBooking) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteBooking(deletingBooking.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus tiket peminjaman.");
            return;
          }
          if (selectedBookingId === deletingBooking.id) {
            setSelectedBookingId(null);
          }
          setDeletingBooking(null);
        }}
      />
    </div>
  );
}
