"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Plus,
  RotateCcw,
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
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

export function PeminjamanView() {
  const {
    rooms,
    assets,
    bookings,
    uiSimState,
    setUiSimState,
    addBooking,
    updateBookingStatus,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");

  // Modal Form Pengajuan Peminjaman
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerRole, setBorrowerRole] = useState<BorrowerRole>("Dosen");
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
      const matchDate = !filterDate || b.booking_date === filterDate;
      return matchSearch && matchStatus && matchDate;
    });
  }, [bookings, searchQuery, filterStatus, filterDate]);

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
      returnNotes.trim() || "Dikembalikan tepat waktu dalam kondisi lengkap & baik."
    );
    setReturningBooking(null);
    setReturnNotes("");
  };

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
        <div className="flex flex-wrap items-center gap-1.5">
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 04 • SIRKULASI RUANGAN & ALAT PORTABEL
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Peminjaman & Reservasi Fasilitas
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Dilengkapi validasi deteksi bentrok jadwal otomatis (
            <em>Conflict Detection</em>) pada tanggal dan rentang jam yang sama.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openBookingModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Ajukan Peminjaman Baru</span>
        </Button>
      </section>

      {/* Filter Sirkulasi */}
      <section
        aria-label="Filter Peminjaman"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <Input
          label="Cari Peminjam / Kegiatan / Kode Tiket"
          placeholder="Ketik nama dosen, BEM, atau PJM-..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          label="Filter Status Peminjaman"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Status Sirkulasi" },
            ...BOOKING_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Input
          label="Filter Tanggal Kegiatan"
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
      </section>

      {/* Tabel Data Peminjaman */}
      <DataTable
        columns={columns}
        data={filteredBookings}
        rowKey={(b) => b.id}
        emptyTitle="Tidak Ada Jadwal Peminjaman"
        emptyDescription="Belum ada reservasi ruangan atau alat pada kriteria tanggal dan status yang dipilih."
        emptyActionLabel="Ajukan Peminjaman Baru"
        onEmptyAction={openBookingModal}
      />

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
              onChange={(e) => setBorrowerRole(e.target.value as BorrowerRole)}
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
    </div>
  );
}
