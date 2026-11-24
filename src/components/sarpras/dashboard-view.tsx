"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Building2,
  Cable,
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  Package,
  Plus,
  ScrollText,
  Wrench,
} from "lucide-react";
import { getThesisHref } from "@/lib/auth/permissions";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { TODAY_ISO } from "@/lib/supabase/seed-data";
import { formatCurrencyIDR } from "@/lib/supabase/client";
import {
  EmptyStateView,
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import {
  BookingStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
  RoomStatusBadge,
} from "@/components/sarpras/status-badges";

export function DashboardView() {
  const {
    buildings,
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    officeKitItems,
    officeKitLoans,
    thesisWorkflows,
    canAccessPage,
    uiSimState,
    setUiSimState,
    resetToSeedData,
  } = useSarpras();

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat ringkasan operasional sarana prasarana kampus..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Ringkasan Operasional Sarpras"
        description="Koneksi ke layanan data sarana prasarana terputus sementara. Periksa jaringan kampus atau muat ulang halaman."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  if (
    rooms.length === 0 &&
    assets.length === 0 &&
    bookings.length === 0 &&
    maintenanceLogs.length === 0 &&
    thesisWorkflows.length === 0
  ) {
    return (
      <EmptyStateView
        title="Belum Ada Data Operasional Sarana Prasarana"
        description="Seluruh tabel ruangan, inventaris aset, dan jadwal peminjaman masih kosong. Anda dapat memulihkan data simulasi kampus atau mulai menambahkan gedung dan ruangan baru."
        actionLabel="Pulihkan Data Seed Kampus"
        onAction={resetToSeedData}
      />
    );
  }

  const activeRoomsCount = rooms.filter((r) => r.status !== "Perbaikan").length;
  const occupiedRooms = rooms.filter((r) => r.status === "Digunakan");
  const damagedAssets = assets.filter(
    (a) => a.condition === "Rusak Ringan" || a.condition === "Rusak Berat"
  );
  const severeAssetsCount = assets.filter(
    (a) => a.condition === "Rusak Berat"
  ).length;
  const repairOfficeKitsCount = officeKitItems.filter(
    (k) =>
      k.status === "Perbaikan" ||
      k.condition === "Rusak Ringan" ||
      k.condition === "Rusak Berat"
  ).length;
  const todayActiveBookings = bookings.filter(
    (b) =>
      b.booking_date === TODAY_ISO &&
      (b.status === "Sedang Dipinjam" ||
        b.status === "Disetujui" ||
        b.status === "Menunggu Persetujuan")
  );
  const openTickets = maintenanceLogs.filter(
    (m) => m.status !== "Selesai Diperbaiki"
  );
  const criticalConsumables = consumables.filter(
    (c) => c.current_stock < c.min_stock
  );
  const activeOfficeKitLoans = officeKitLoans.filter(
    (l) => l.status === "Dipinjam"
  );

  const totalAssetValue = assets.reduce(
    (acc, item) => acc + item.acquisition_cost,
    0
  );

  return (
    <div className="space-y-8">
      {/* Header Halaman & Aksi Cepat Operasional */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            PUSAT KENDALI FASILITAS KAMPUS (DATA SIMULASI TERLABEL)
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard Ringkasan Sarana Prasarana
          </h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 max-w-2xl">
            Pemantauan ketersediaan ruang perkuliahan, kondisi inventaris fisik,
            sirkulasi peminjaman harian, serta antrean tiket perbaikan teknisi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canAccessPage("sirkulasi-invent") ? (
            <Link
              href="/sarpras/sirkulasi-invent"
              className="min-h-[44px] px-4 py-2.5 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <Cable className="w-4 h-4" aria-hidden="true" />
              <span>Sirkulasi Invent</span>
            </Link>
          ) : null}
          {canAccessPage("peminjaman") ? (
            <Link
              href="/sarpras/peminjaman"
              className="min-h-[44px] px-4 py-2.5 inline-flex items-center gap-2 rounded-md bg-[#1E3A5F] text-white hover:bg-[#152943] dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Catat Peminjaman</span>
            </Link>
          ) : null}
          {canAccessPage("pemeliharaan") ? (
            <Link
              href="/sarpras/pemeliharaan"
              className="min-h-[44px] px-4 py-2.5 inline-flex items-center gap-2 rounded-md bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <Wrench className="w-4 h-4" aria-hidden="true" />
              <span>Lapor Kerusakan</span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* KPI Cards dengan Variasi Bobot Hierarki (R-14: Focal Point pada Perbaikan & Sirkulasi) */}
      <section aria-label="Indikator Kinerja Utama Sarana Prasarana">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Kartu Fokus Utama (4 kolom): Aset Rusak / Perlu Perbaikan */}
          <div className="lg:col-span-4 rounded-lg border-2 border-amber-700 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-mono font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  PERHATIAN TEKNIS UTAMA
                </span>
                <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  Aset Rusak / Perlu Perbaikan
                </h2>
              </div>
              <span className="p-2.5 rounded-md bg-amber-700 text-white dark:bg-amber-500 dark:text-slate-950">
                <Wrench className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>

            <div className="my-4 flex items-baseline gap-3">
              <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                {damagedAssets.length}
              </span>
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                unit ({severeAssetsCount} rusak berat,{" "}
                {damagedAssets.length - severeAssetsCount} rusak ringan
                {repairOfficeKitsCount > 0
                  ? `, +${repairOfficeKitsCount} alat kantor`
                  : ""}
                )
              </span>
            </div>

            <div className="pt-3 border-t border-amber-700/20 dark:border-amber-500/30 flex items-center justify-between text-xs">
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {openTickets.length} tiket pemeliharaan aktif
              </span>
              {canAccessPage("pemeliharaan") ? (
                <Link
                  href="/sarpras/pemeliharaan"
                  className="font-bold text-amber-900 dark:text-amber-300 underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 rounded px-1 py-0.5"
                >
                  Tindak Lanjuti
                </Link>
              ) : null}
            </div>
          </div>

          {/* Kartu 2 (3 kolom): Total Ruangan Aktif */}
          <div className="lg:col-span-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  KAPASITAS RUANG
                </p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  Total Ruangan Aktif
                </h2>
              </div>
              <span className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-[#1E3A5F] dark:text-sky-400">
                <DoorOpen className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                  {activeRoomsCount}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  dari {rooms.length} ruang terdaftar
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                {occupiedRooms.length} sedang digunakan,{" "}
                {rooms.filter((r) => r.status === "Tersedia").length} siap pakai
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                {buildings.length} gedung kampus
              </span>
              {canAccessPage("ruangan") ? (
                <Link
                  href="/sarpras/ruangan"
                  className="font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-1 py-0.5"
                >
                  Kelola Ruang
                </Link>
              ) : null}
            </div>
          </div>

          {/* Kartu 3 (3 kolom): Total Aset Terdaftar */}
          <div className="lg:col-span-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  REGISTRASI INVENTARIS
                </p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  Total Aset Terdaftar
                </h2>
              </div>
              <span className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-[#1E3A5F] dark:text-sky-400">
                <Package className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                  {assets.length}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  unit terdata
                </span>
              </div>
              <p className="mt-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                Nilai: {formatCurrencyIDR(totalAssetValue)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                {assets.filter((a) => a.is_portable).length} unit portabel
              </span>
              {canAccessPage("inventaris") ? (
                <Link
                  href="/sarpras/inventaris"
                  className="font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-1 py-0.5"
                >
                  Buka Inventaris
                </Link>
              ) : null}
            </div>
          </div>

          {/* Kartu 4 (2 kolom): Peminjaman Aktif Hari Ini */}
          <div className="lg:col-span-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  SIRKULASI HARI INI
                </p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  Peminjaman Aktif
                </h2>
              </div>
              <span className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-[#1E3A5F] dark:text-sky-400">
                <CalendarClock className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>

            <div className="my-4">
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                {todayActiveBookings.length}
              </span>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                jadwal tanggal {TODAY_ISO}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              {canAccessPage("peminjaman") ? (
                <Link
                  href="/sarpras/peminjaman"
                  className="font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-1 py-0.5"
                >
                  Cek Jadwal
                </Link>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Terjadwal
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Panel Operasional Dua Kolom Asimetris (RHYTHM 2: 7 Kolom Okupansi vs 5 Kolom Tiket Kerusakan) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (7/12): Ruangan yang Sedang Digunakan & Sirkulasi Hari Ini */}
        <div className="lg:col-span-7 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Ruangan yang Sedang Digunakan & Sirkulasi Aktif
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Daftar ruang perkuliahan/laboratorium berstatus digunakan beserta
                agenda peminjaman hari ini.
              </p>
            </div>
            {canAccessPage("ruangan") ? (
              <Link
                href="/sarpras/ruangan"
                className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Semua Ruangan ({rooms.length})
              </Link>
            ) : null}
          </div>

          <div className="p-5 space-y-4 flex-1">
            {occupiedRooms.length === 0 ? (
              <div className="p-6 text-center rounded-md border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Tidak ada ruangan yang sedang digunakan saat ini.
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Seluruh ruangan aktif berstatus Tersedia untuk dipinjam.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" role="list">
                {occupiedRooms.map((room) => {
                  const building = buildings.find(
                    (b) => b.id === room.building_id
                  );
                  const activeBooking = bookings.find(
                    (b) =>
                      b.room_id === room.id &&
                      (b.status === "Sedang Dipinjam" ||
                        b.status === "Disetujui")
                  );
                  const roomAssetsCount = assets.filter(
                    (a) => a.room_id === room.id
                  ).length;

                  return (
                    <li
                      key={room.id}
                      className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                            {room.code}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {room.name}
                          </h3>
                          <RoomStatusBadge status={room.status} />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {building?.name || "Gedung Kampus"} • Lantai{" "}
                          {room.floor} • Kapasitas {room.capacity} kursi •{" "}
                          {roomAssetsCount} aset terpasang
                        </p>
                        {activeBooking ? (
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 pt-1">
                            Agenda: {activeBooking.activity_name} (
                            <span className="font-mono">
                              {activeBooking.start_time}-{activeBooking.end_time}
                            </span>{" "}
                            • Peminjam: {activeBooking.borrower_name})
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
                            PIC Ruang: {room.pic_name} ({room.pic_contact})
                          </p>
                        )}
                      </div>
                      {canAccessPage("ruangan") ? (
                        <div className="shrink-0">
                          <Link
                            href={`/sarpras/ruangan?inspect=${encodeURIComponent(
                              room.id
                            )}`}
                            className="min-h-[44px] px-3 py-2 inline-flex items-center justify-center text-xs font-semibold rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                          >
                            Detail Ruangan
                          </Link>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Daftar Ringkas Jadwal Peminjaman Hari Ini */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5">
                Agenda Reservasi & Sirkulasi Hari Ini ({TODAY_ISO})
              </h3>
              <div className="space-y-2">
                {todayActiveBookings.map((bk) => {
                  const room = rooms.find((r) => r.id === bk.room_id);
                  const asset = assets.find((a) => a.id === bk.asset_id);
                  return (
                    <Link
                      key={bk.id}
                      href={`/sarpras/peminjaman?inspect=${encodeURIComponent(bk.id)}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded border border-slate-200 dark:border-slate-800 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {bk.start_time}-{bk.end_time}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {bk.activity_name}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">
                          {bk.borrower_name} ({bk.borrower_unit}) • Target:{" "}
                          {room ? `Ruang ${room.code}` : ""}
                          {room && asset ? " + " : ""}
                          {asset ? `${asset.name} (${asset.inventory_code})` : ""}
                        </p>
                      </div>
                      <BookingStatusBadge status={bk.status} />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan (5/12): Tiket Laporan Kerusakan Terbaru */}
        <div className="lg:col-span-5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tiket Laporan Kerusakan Terbaru
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Diurutkan berdasarkan prioritas penanganan teknisi sarpras.
              </p>
            </div>
            {canAccessPage("pemeliharaan") ? (
              <Link
                href="/sarpras/pemeliharaan"
                className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Semua Tiket ({maintenanceLogs.length})
              </Link>
            ) : null}
          </div>

          <div className="p-5 space-y-3 flex-1">
            {maintenanceLogs.map((ticket) => {
              const asset = assets.find((a) => a.id === ticket.asset_id);
              const officeKit = ticket.office_kit_item_id
                ? officeKitItems.find((k) => k.id === ticket.office_kit_item_id)
                : null;
              const room = rooms.find((r) => r.id === ticket.room_id);
              return (
                <article
                  key={ticket.id}
                  className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/sarpras/pemeliharaan?inspect=${encodeURIComponent(ticket.id)}`}
                      className="font-mono text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-0.5"
                    >
                      {ticket.ticket_code}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={ticket.priority} />
                      <MaintenanceStatusBadge status={ticket.status} />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {ticket.issue_title}
                  </h3>

                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {ticket.issue_description}
                  </p>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      Lokasi:{" "}
                      <strong className="font-mono text-slate-900 dark:text-slate-100">
                        {room?.code || (officeKit ? "Kantor Staf" : "-")}
                      </strong>{" "}
                      • {officeKit ? "Alat Kantor" : "Aset"}:{" "}
                      <strong className="font-mono text-slate-900 dark:text-slate-100">
                        {officeKit?.kit_code || asset?.inventory_code || "-"}
                      </strong>
                    </span>
                    <span>Pelapor: {ticket.reporter_name}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Panel Sirkulasi Invent Kantor Staf: Alat Sedang Dipinjam Kelas */}
      <section className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <Cable
              className="w-5 h-5 text-[#1E3A5F] dark:text-sky-400"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Sirkulasi Invent Kantor Staf (Alat Sedang Dipinjam Kelas)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Pantauan Kabel HDMI, Stop Kontak, dan Remote TV yang sedang
                dibawa perwakilan mahasiswa. Total tersedia di loker:{" "}
                {officeKitItems.filter((i) => i.status === "Tersedia").length}{" "}
                dari {officeKitItems.length} unit.
              </p>
            </div>
          </div>
          {canAccessPage("sirkulasi-invent") ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sarpras/sirkulasi-invent/pinjam-cepat"
                className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Pinjam Cepat
              </Link>
              <Link
                href="/sarpras/sirkulasi-invent"
                className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Buka Sirkulasi Invent ({activeOfficeKitLoans.length} aktif)
              </Link>
            </div>
          ) : null}
        </div>

        {activeOfficeKitLoans.length === 0 ? (
          <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-700/40 flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Seluruh Kabel HDMI, Stop Kontak, dan Remote TV berada di loker
              kantor staf.
            </span>
          </div>
        ) : (
          <ul
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            role="list"
          >
            {activeOfficeKitLoans.map((loan) => {
              const room = rooms.find((r) => r.id === loan.room_id);
              return (
                <li key={loan.id}>
                  <Link
                    href={`/sarpras/sirkulasi-invent?inspect=${encodeURIComponent(loan.id)}`}
                    className="block p-3.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors space-y-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                          {loan.class_code}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {loan.loan_code}
                        </span>
                      </div>
                      <span className="font-mono text-amber-900 dark:text-amber-300 font-semibold">
                        {loan.borrow_time} - {loan.expected_return_time} WIB
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {loan.kit_items_label}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      Pengambil: {loan.borrower_name} • DPM: {loan.dpm_name}
                      {room ? ` • Ruang ${room.code}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Panel Bawah: Peringatan Stok BHP Minimum & Ringkasan Gedung (Variasi Komposisi RHYTHM 2) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Boxes
                className="w-5 h-5 text-red-700 dark:text-red-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Peringatan Stok Minimum Barang Habis Pakai (ATK)
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Item operasional yang berada di bawah ambang stok minimum.
                </p>
              </div>
            </div>
            {canAccessPage("bhp") ? (
              <Link
                href="/sarpras/bhp"
                className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Mutasi & Restock
              </Link>
            ) : null}
          </div>

          {criticalConsumables.length === 0 ? (
            <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-700/40 flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Seluruh stok barang habis pakai berada di atas batas minimum.
              </span>
            </div>
          ) : (
            <ul className="space-y-2.5" role="list">
              {criticalConsumables.map((item) => (
                <li
                  key={item.id}
                  className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-red-900 dark:text-red-200">
                        {item.code}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                      Lokasi: {item.storage_location}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-700 text-white text-xs font-mono font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Sisa: {item.current_stock} {item.unit}
                    </span>
                    <p className="text-[11px] text-red-800 dark:text-red-300 mt-0.5">
                      Min. stok: {item.min_stock} {item.unit}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-6 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Building2
                className="w-5 h-5 text-[#1E3A5F] dark:text-sky-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Distribusi Fasilitas per Gedung Kampus
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Sebaran ruangan dan unit inventaris pada masing-masing zona.
                </p>
              </div>
            </div>
            {canAccessPage("ruangan") ? (
              <Link
                href="/sarpras/ruangan"
                className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
              >
                Master Gedung
              </Link>
            ) : null}
          </div>

          <ul className="space-y-2.5" role="list">
            {buildings.map((bld) => {
              const bldRooms = rooms.filter((r) => r.building_id === bld.id);
              const bldRoomIds = new Set(bldRooms.map((r) => r.id));
              const bldAssets = assets.filter(
                (a) => a.room_id && bldRoomIds.has(a.room_id)
              );

              return (
                <li
                  key={bld.id}
                  className="p-3 rounded-md border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                        {bld.code}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {bld.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {bld.zone} • {bld.floors_count} Lantai
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                    <span>{bldRooms.length} Ruang</span>
                    <span>•</span>
                    <span>{bldAssets.length} Aset</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {(() => {
        const allowedTaBoards = (
          [
            {
              key: "ta-skripsi-proposal",
              track: "skripsi",
              stage: "proposal",
              label: "Skripsi: Proposal",
            },
            {
              key: "ta-skripsi-sidang",
              track: "skripsi",
              stage: "sidang",
              label: "Skripsi: Sidang",
            },
            {
              key: "ta-artikel-proposal",
              track: "artikel_jurnal",
              stage: "proposal",
              label: "Artikel Jurnal: Proposal",
            },
            {
              key: "ta-artikel-sidang",
              track: "artikel_jurnal",
              stage: "sidang",
              label: "Artikel Jurnal: Sidang",
            },
          ] as const
        ).filter((item) => canAccessPage(item.key));

        if (allowedTaBoards.length === 0) return null;

        return (
          <section aria-label="Ringkasan Antrean Tugas Akhir">
            <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <ScrollText
                    className="w-5 h-5 text-[#1E3A5F] dark:text-sky-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Antrean Tugas Akhir
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Jumlah berkas aktif (belum diarsipkan) pada papan kerja Skripsi &amp; Artikel Jurnal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {allowedTaBoards.map((board) => {
                  const activeCount = thesisWorkflows.filter(
                    (w) =>
                      w.track === board.track &&
                      w.stage === board.stage &&
                      w.board_column !== "selesai_arsip"
                  ).length;
                  return (
                    <Link
                      key={board.key}
                      href={getThesisHref(board.track, board.stage)}
                      className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-[#1E3A5F] dark:hover:border-sky-400 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {board.label}
                      </span>
                      <span className="px-2 py-0.5 text-sm font-mono font-extrabold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                        {activeCount}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
