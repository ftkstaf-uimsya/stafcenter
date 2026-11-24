"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  isLoanVisibleOnDailyDesk,
  useTodayWibIso,
} from "@/lib/sarpras/sirkulasi-utils";
import { matchesFlexibleQuery } from "@/lib/search-normalize";
import { OfficeKitLoan } from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";
import { QuickLoanForm } from "@/components/sarpras/quick-loan-form";
import { LoanQuickRow } from "@/components/sarpras/loan-compact-card";

type MobileQuickTab = "form" | "borrowed" | "returned";

export function QuickLoanView() {
  const {
    officeKitItems,
    officeKitLoans,
    rooms,
    attachments,
    uiSimState,
    setUiSimState,
    checkinOfficeKitLoan,
    reopenOfficeKitLoan,
    deleteOfficeKitLoan,
  } = useSarpras();

  const todayWibIso = useTodayWibIso();
  const [listSearch, setListSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileQuickTab>("form");

  // Slide-over detail drawer
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Modal Check-In Pengembalian (Cek Rusak)
  const [returningLoan, setReturningLoan] = useState<OfficeKitLoan | null>(
    null
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [damagedReturnIds, setDamagedReturnIds] = useState<string[]>([]);

  // Modal Hapus Tiket
  const [deletingLoan, setDeletingLoan] = useState<OfficeKitLoan | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const dailyDeskLoans = useMemo(
    () =>
      officeKitLoans.filter((l) => isLoanVisibleOnDailyDesk(l, todayWibIso)),
    [officeKitLoans, todayWibIso]
  );

  const activeLoans = useMemo(
    () => dailyDeskLoans.filter((l) => l.status === "Dipinjam"),
    [dailyDeskLoans]
  );

  const returnedTodayLoans = useMemo(
    () => dailyDeskLoans.filter((l) => l.status === "Dikembalikan"),
    [dailyDeskLoans]
  );

  const filteredActiveLoans = useMemo(() => {
    const q = listSearch.trim();
    if (!q) return activeLoans;
    return activeLoans.filter((l) =>
      matchesFlexibleQuery(
        `${l.loan_code} ${l.class_code} ${l.dpm_name} ${l.borrower_name} ${l.kit_items_label} ${l.course_name || ""}`,
        q
      )
    );
  }, [activeLoans, listSearch]);

  const filteredReturnedTodayLoans = useMemo(() => {
    const q = listSearch.trim();
    if (!q) return returnedTodayLoans;
    return returnedTodayLoans.filter((l) =>
      matchesFlexibleQuery(
        `${l.loan_code} ${l.class_code} ${l.dpm_name} ${l.borrower_name} ${l.kit_items_label} ${l.course_name || ""}`,
        q
      )
    );
  }, [listSearch, returnedTodayLoans]);

  const selectedLoan =
    officeKitLoans.find((l) => l.id === selectedLoanId) || null;

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat loket Pinjam Cepat peralatan kantor staf..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Halaman Pinjam Cepat"
        description="Sistem gagal mengambil data alat kantor staf dan daftar peminjaman kelas."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openReturnModal = (loan: OfficeKitLoan) => {
    setReturningLoan(loan);
    setReturnNotes("");
    setDamagedReturnIds([]);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningLoan) return;
    checkinOfficeKitLoan(returningLoan.id, {
      returnConditionNotes: returnNotes,
      damagedItemIds: damagedReturnIds,
    });
    setReturningLoan(null);
  };

  const availableUnitsCount = officeKitItems.filter(
    (i) => i.is_active && i.status === "Tersedia" && i.condition !== "Hilang"
  ).length;

  return (
    <div className="space-y-5">
      {/* Header Operasional Loket Pinjam Cepat */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 02 • LOKET PINJAM CEPAT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Pinjam Cepat Alat Kantor Staf
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Catat peminjaman baru di sisi kiri sambil memantau dan memproses
            pengembalian alat di sisi kanan dalam satu layar loket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs font-mono font-bold text-amber-950 dark:text-amber-200">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{activeLoans.length} dipinjam</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-mono font-bold text-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{returnedTodayLoans.length} kembali hari ini</span>
          </span>
          <Link
            href="/sarpras/sirkulasi-invent"
            className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            <Cable className="w-4 h-4" aria-hidden="true" />
            <span>Meja &amp; Katalog</span>
          </Link>
        </div>
      </section>

      {/* Switcher Mobile & Tablet (< 1024px) */}
      <div
        role="tablist"
        aria-label="Pilih panel Pinjam Cepat"
        className="grid grid-cols-3 gap-1.5 lg:hidden rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "form"}
          onClick={() => setMobileTab("form")}
          className={`min-h-[44px] px-2 py-1.5 rounded-md text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
            mobileTab === "form"
              ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
              : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
          }`}
        >
          Form Pinjam
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "borrowed"}
          onClick={() => setMobileTab("borrowed")}
          className={`min-h-[44px] px-2 py-1.5 rounded-md text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
            mobileTab === "borrowed"
              ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
              : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
          }`}
        >
          Dipinjam ({activeLoans.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "returned"}
          onClick={() => setMobileTab("returned")}
          className={`min-h-[44px] px-2 py-1.5 rounded-md text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
            mobileTab === "returned"
              ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
              : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
          }`}
        >
          Kembali ({returnedTodayLoans.length})
        </button>
      </div>

      {/* Split Workspace 2 Kolom Desktop (Kiri Form, Kanan Dipinjam & Dikembalikan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Panel Kiri: Form Pinjamkan Alat Kantor Staf ke Kelas */}
        <section
          aria-label="Form Pinjamkan Alat Kantor Staf ke Kelas"
          className={`${
            mobileTab === "form" ? "block" : "hidden"
          } lg:block lg:col-span-5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto`}
        >
          <div className="pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ClipboardPlus
                  className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400 shrink-0"
                  aria-hidden="true"
                />
                <span>Pinjamkan Alat Kantor Staf ke Kelas</span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Pilih kelas (DPM otomatis tercatat) lalu pilih peralatan yang
                diambil.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
              {availableUnitsCount} siap
            </span>
          </div>

          <QuickLoanForm mode="inline" />
        </section>

        {/* Panel Kanan: Daftar Sedang Dipinjam & Dikembalikan */}
        <div
          className={`${
            mobileTab !== "form" ? "block" : "hidden"
          } lg:block lg:col-span-7 space-y-4`}
        >
          {/* Pencarian Cepat Antrean Loket */}
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Cari kelas (mis. MPI23A / MPI 23A), nama pengambil, atau barang..."
              aria-label="Cari antrean peminjaman dan pengembalian"
              className="min-h-[44px] w-full pl-10 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            />
          </div>

          {/* Panel Atas: SEDANG DIPINJAM */}
          <section
            aria-label="Daftar Sedang Dipinjam"
            className={`${
              mobileTab === "borrowed" ? "block" : "hidden"
            } lg:block rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  SEDANG DIPINJAM
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  {filteredActiveLoans.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Klik baris untuk melihat detail tiket
              </span>
            </div>

            {filteredActiveLoans.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {listSearch.trim()
                    ? `Tidak ada peminjaman aktif yang cocok dengan "${listSearch.trim()}".`
                    : "Tidak ada barang kantor staf yang sedang dipinjam kelas."}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {listSearch.trim()
                    ? "Coba kata kunci lain atau bersihkan kotak pencarian."
                    : "Gunakan form di sisi kiri untuk mencatat peminjaman baru."}
                </p>
                {listSearch.trim() ? (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                  >
                    Bersihkan pencarian
                  </button>
                ) : null}
              </div>
            ) : (
              <ul
                role="list"
                className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[42vh] overflow-y-auto"
              >
                {filteredActiveLoans.map((loan) => (
                  <LoanQuickRow
                    key={loan.id}
                    loan={loan}
                    todayWibIso={todayWibIso}
                    isSelected={selectedLoanId === loan.id}
                    onOpenDetail={() => setSelectedLoanId(loan.id)}
                    onQuickCheckin={() => checkinOfficeKitLoan(loan.id)}
                    onOpenCheckinModal={() => openReturnModal(loan)}
                    onReopen={() => reopenOfficeKitLoan(loan.id)}
                    onDelete={() => {
                      setDeleteError("");
                      setDeletingLoan(loan);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Panel Bawah: DIKEMBALIKAN */}
          <section
            aria-label="Daftar Dikembalikan Hari Ini"
            className={`${
              mobileTab === "returned" ? "block" : "hidden"
            } lg:block rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  DIKEMBALIKAN
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                  {filteredReturnedTodayLoans.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Hari ini (WIB: <span className="font-mono">{todayWibIso}</span>)
                • Otomatis bersih besok
              </span>
            </div>

            {filteredReturnedTodayLoans.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {listSearch.trim()
                    ? `Tidak ada pengembalian hari ini yang cocok dengan "${listSearch.trim()}".`
                    : "Belum ada alat yang dikembalikan pada hari ini."}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {listSearch.trim()
                    ? "Coba kata kunci lain atau bersihkan kotak pencarian."
                    : "Pengembalian dari hari sebelumnya tetap tercatat di tab Riwayat & Rekap pada menu Meja & Katalog."}
                </p>
                {listSearch.trim() ? (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                  >
                    Bersihkan pencarian
                  </button>
                ) : null}
              </div>
            ) : (
              <ul
                role="list"
                className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[38vh] overflow-y-auto"
              >
                {filteredReturnedTodayLoans.map((loan) => (
                  <LoanQuickRow
                    key={loan.id}
                    loan={loan}
                    todayWibIso={todayWibIso}
                    isSelected={selectedLoanId === loan.id}
                    onOpenDetail={() => setSelectedLoanId(loan.id)}
                    onQuickCheckin={() => checkinOfficeKitLoan(loan.id)}
                    onOpenCheckinModal={() => openReturnModal(loan)}
                    onReopen={() => reopenOfficeKitLoan(loan.id)}
                    onDelete={() => {
                      setDeleteError("");
                      setDeletingLoan(loan);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Drawer Detail Tiket Sirkulasi */}
      <Drawer
        isOpen={Boolean(selectedLoan)}
        onClose={() => setSelectedLoanId(null)}
        title={
          selectedLoan ? `Sirkulasi Kelas ${selectedLoan.class_code}` : ""
        }
        subtitle={
          selectedLoan
            ? `${selectedLoan.loan_code} • DPM: ${selectedLoan.dpm_name}`
            : undefined
        }
        headerBadge={
          selectedLoan ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedLoan.loan_code}
              </span>
              {selectedLoan.status === "Dipinjam" ? (
                <Badge tone="warning">Sedang Dipinjam</Badge>
              ) : (
                <Badge tone="success">Dikembalikan</Badge>
              )}
            </>
          ) : null
        }
        footer={
          selectedLoan ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingLoan(selectedLoan);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              {selectedLoan.status === "Dipinjam" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openReturnModal(selectedLoan)}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>Terima Kembali (Cek Rusak)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      checkinOfficeKitLoan(selectedLoan.id);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Tandai Dikembalikan</span>
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reopenOfficeKitLoan(selectedLoan.id)}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Ubah ke Dipinjam</span>
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {selectedLoan ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Kelas &amp; Prodi
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {selectedLoan.class_code} ({selectedLoan.prodi})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  DPM (Ketua Kelas)
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.dpm_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Pengambil Barang
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.borrower_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Kontak WA
                </dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedLoan.borrower_phone}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Ruang &amp; Jadwal
                </dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {(() => {
                    const rm = rooms.find((r) => r.id === selectedLoan.room_id);
                    return rm ? `${rm.code} (${rm.name})` : "Ruang Reguler";
                  })()}{" "}
                  • {selectedLoan.loan_date} ({selectedLoan.borrow_time}-
                  {selectedLoan.expected_return_time})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Mata Kuliah / Keperluan
                </dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedLoan.course_name || "-"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-600 dark:text-slate-400">
                  Barang Dipinjam
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.kit_items_label}
                </dd>
              </div>
              {selectedLoan.return_condition_notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan Pengembalian
                  </dt>
                  <dd className="mt-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                    {selectedLoan.return_condition_notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            {(() => {
              const loanPhotos = attachments.filter(
                (a) =>
                  a.entity_type === "office_loan" &&
                  a.entity_id === selectedLoan.id &&
                  a.mime_type.startsWith("image/") &&
                  (a.file_url.startsWith("https://") ||
                    a.file_url.startsWith("http://") ||
                    a.file_url.startsWith("blob:"))
              );
              if (loanPhotos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Foto Bukti Peminjaman ({loanPhotos.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {loanPhotos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.file_url}
                          alt={`Foto serah terima ${selectedLoan.loan_code}`}
                          className="w-full h-40 object-cover group-hover:opacity-90 transition-opacity"
                        />
                        <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                          {photo.file_name}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            <EntityDrawerSections
              entityType="office_loan"
              entityId={selectedLoan.id}
              baseEventDates={[selectedLoan.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Terima Pengembalian (Cek Rusak) */}
      <Modal
        isOpen={Boolean(returningLoan)}
        onClose={() => setReturningLoan(null)}
        title={`Terima Pengembalian: ${returningLoan?.class_code || ""}`}
        description={`Tiket ${returningLoan?.loan_code || ""} • Pastikan seluruh barang kembali ke loker kantor staf.`}
      >
        {returningLoan ? (
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Cek Kelengkapan &amp; Kondisi Barang yang Dikembalikan:
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Centang barang di bawah ini HANYA apabila barang kembali dalam
                kondisi bermasalah/rusak agar otomatis dikunci untuk perbaikan.
              </p>
              <div className="space-y-1.5">
                {returningLoan.kit_item_ids.map((itemId) => {
                  const item = officeKitItems.find((i) => i.id === itemId);
                  if (!item) return null;
                  const isDamaged = damagedReturnIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`min-h-[44px] flex items-center justify-between gap-2 p-2.5 rounded-md border text-xs cursor-pointer ${
                        isDamaged
                          ? "border-red-600 bg-red-50 dark:bg-red-950/40"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <span>
                        <strong className="font-mono">{item.kit_code}</strong> -{" "}
                        {item.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-red-800 dark:text-red-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={isDamaged}
                          onChange={() =>
                            setDamagedReturnIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((x) => x !== item.id)
                                : [...prev, item.id]
                            )
                          }
                          className="w-4 h-4 accent-red-700"
                        />
                        <span>Tandai Rusak</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Input
              label="Catatan Kondisi Saat Diterima"
              placeholder="Contoh: Kabel HDMI, stop kontak, dan remote TV lengkap serta berfungsi baik."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturningLoan(null)}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary">
                Konfirmasi Barang Kembali
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Modal Konfirmasi Hapus Tiket Sirkulasi */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingLoan)}
        onClose={() => {
          if (!deleting) {
            setDeletingLoan(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Tiket Sirkulasi"
        targetBadge={deletingLoan?.loan_code}
        targetName={`Peminjaman Kelas ${deletingLoan?.class_code || ""} (${deletingLoan?.borrower_name || ""})`}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingLoan?.status === "Dipinjam"
            ? [
                "Tiket ini masih berstatus Dipinjam. Menghapus tiket akan otomatis memulihkan status barang terkait menjadi Tersedia di Kantor Staf.",
              ]
            : [
                "Tiket ini sudah dikembalikan. Menghapus permanen akan turut menghapus catatan ini dari tab Riwayat & Rekap (Master Admin) serta memengaruhi rekap intensitas kelas dan sapras.",
              ]
        }
        onConfirm={async () => {
          if (!deletingLoan) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteOfficeKitLoan(deletingLoan.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus tiket sirkulasi.");
            return;
          }
          if (selectedLoanId === deletingLoan.id) setSelectedLoanId(null);
          setDeletingLoan(null);
        }}
      />
    </div>
  );
}
