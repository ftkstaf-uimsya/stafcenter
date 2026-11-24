"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Cable,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  formatWibDateTime,
  isBookingOverdueDay,
  isBookingVisibleOnQuickDesk,
  isLoanVisibleOnDailyDesk,
  useTodayWibIso,
} from "@/lib/sarpras/sirkulasi-utils";
import { matchesFlexibleQuery } from "@/lib/search-normalize";
import {
  Booking,
  OfficeKitLoan,
  SarprasAttachment,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ResizableSplitPane } from "@/components/ui/resizable-split-pane";
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";
import { QuickLoanForm } from "@/components/sarpras/quick-loan-form";
import { LoanQuickRow } from "@/components/sarpras/loan-compact-card";
import { BookingLoanForm } from "@/components/sarpras/booking-loan-form";
import { BookingQuickRow } from "@/components/sarpras/booking-quick-row";
import { BookingStatusBadge } from "@/components/sarpras/status-badges";

type MobileQuickTab = "form" | "borrowed" | "returned";
type QuickDeskMode = "alat-staf" | "fasilitas";
type FacilityActiveFilter =
  | "ALL"
  | "Menunggu Persetujuan"
  | "Disetujui"
  | "Sedang Dipinjam";

function isSafePreviewImageAttachment(att: SarprasAttachment): boolean {
  return (
    att.mime_type.startsWith("image/") &&
    (att.file_url.startsWith("https://") ||
      att.file_url.startsWith("http://") ||
      att.file_url.startsWith("blob:"))
  );
}

function getFacilityProgressPercent(status: Booking["status"]): {
  percent: number;
  tone: "navy" | "emerald" | "amber" | "danger";
} {
  switch (status) {
    case "Menunggu Persetujuan":
      return { percent: 25, tone: "amber" };
    case "Disetujui":
      return { percent: 55, tone: "navy" };
    case "Sedang Dipinjam":
      return { percent: 80, tone: "amber" };
    case "Selesai / Dikembalikan":
      return { percent: 100, tone: "emerald" };
    case "Ditolak":
      return { percent: 100, tone: "danger" };
  }
}

export function QuickLoanView() {
  const {
    officeKitItems,
    officeKitLoans,
    bookings,
    assets,
    rooms,
    notes,
    attachments,
    authUser,
    canAccessPage,
    uiSimState,
    setUiSimState,
    checkinOfficeKitLoan,
    reopenOfficeKitLoan,
    deleteOfficeKitLoan,
    updateBookingStatus,
    deleteBooking,
  } = useSarpras();

  const canAlatStaf = canAccessPage("sirkulasi-invent");
  const canFasilitas = canAccessPage("peminjaman");

  const [deskMode, setDeskMode] = useState<QuickDeskMode>(() =>
    canAlatStaf ? "alat-staf" : "fasilitas"
  );
  const [mobileTab, setMobileTab] = useState<MobileQuickTab>("form");

  // Sync mode from URL query (?mode=fasilitas | ?mode=alat-staf) and enforce permissions
  useEffect(() => {
    const syncModeFromUrl = (explicitMode?: QuickDeskMode) => {
      const paramMode =
        explicitMode ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("mode")
          : null);

      if (paramMode === "fasilitas" && canFasilitas) {
        setDeskMode("fasilitas");
        return;
      }
      if (paramMode === "alat-staf" && canAlatStaf) {
        setDeskMode("alat-staf");
        return;
      }
      if (!canAlatStaf && canFasilitas) {
        setDeskMode("fasilitas");
      } else {
        setDeskMode("alat-staf");
      }
    };

    syncModeFromUrl();

    const handlePopState = () => syncModeFromUrl();
    const handleCustomMode = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: QuickDeskMode }>).detail;
      syncModeFromUrl(detail?.mode);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("stafcenter:pinjam-cepat-mode", handleCustomMode);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(
        "stafcenter:pinjam-cepat-mode",
        handleCustomMode
      );
    };
  }, [canAlatStaf, canFasilitas]);

  const activeDeskMode: QuickDeskMode =
    deskMode === "fasilitas" && canFasilitas
      ? "fasilitas"
      : canAlatStaf
      ? "alat-staf"
      : "fasilitas";

  const handleSwitchDeskMode = (nextMode: QuickDeskMode) => {
    if (nextMode === "alat-staf" && !canAlatStaf) return;
    if (nextMode === "fasilitas" && !canFasilitas) return;
    setDeskMode(nextMode);
    setMobileTab("form");
    setSelectedLoanId(null);
    setSelectedBookingId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", nextMode);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const todayWibIso = useTodayWibIso();

  // State Mode 1: Alat Kantor Staf
  const [listSearch, setListSearch] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [returningLoan, setReturningLoan] = useState<OfficeKitLoan | null>(
    null
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [damagedReturnIds, setDamagedReturnIds] = useState<string[]>([]);
  const [deletingLoan, setDeletingLoan] = useState<OfficeKitLoan | null>(null);

  // State Mode 2: Ruangan & Alat Portabel
  const [facilitySearch, setFacilitySearch] = useState("");
  const [facilityStatusFilter, setFacilityStatusFilter] =
    useState<FacilityActiveFilter>("ALL");
  const [recentlyFinishedBookingIds, setRecentlyFinishedBookingIds] = useState<
    string[]
  >([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );
  const [returningBooking, setReturningBooking] = useState<Booking | null>(
    null
  );
  const [bookingReturnNotes, setBookingReturnNotes] = useState("");
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  // Shared delete modal loading & error state
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Derived Mode 1: Alat Kantor Staf
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

  // Derived Mode 2: Ruangan & Alat Portabel
  const recentlyFinishedSet = useMemo(
    () => new Set(recentlyFinishedBookingIds),
    [recentlyFinishedBookingIds]
  );

  const dailyDeskBookings = useMemo(
    () =>
      bookings.filter((b) =>
        isBookingVisibleOnQuickDesk(b, todayWibIso, recentlyFinishedSet)
      ),
    [bookings, recentlyFinishedSet, todayWibIso]
  );

  const activeBookings = useMemo(
    () =>
      dailyDeskBookings.filter(
        (b) =>
          b.status === "Menunggu Persetujuan" ||
          b.status === "Disetujui" ||
          b.status === "Sedang Dipinjam"
      ),
    [dailyDeskBookings]
  );

  const finishedTodayBookings = useMemo(
    () =>
      dailyDeskBookings.filter(
        (b) => b.status === "Selesai / Dikembalikan" || b.status === "Ditolak"
      ),
    [dailyDeskBookings]
  );

  const filteredActiveBookings = useMemo(() => {
    const q = facilitySearch.trim();
    return activeBookings.filter((b) => {
      if (
        facilityStatusFilter !== "ALL" &&
        b.status !== facilityStatusFilter
      ) {
        return false;
      }
      if (!q) return true;
      const room = rooms.find((r) => r.id === b.room_id);
      const asset = assets.find((a) => a.id === b.asset_id);
      return matchesFlexibleQuery(
        `${b.booking_code} ${b.borrower_name} ${b.borrower_unit} ${b.activity_name} ${b.class_code || ""} ${room?.code || ""} ${room?.name || ""} ${asset?.inventory_code || ""} ${asset?.name || ""}`,
        q
      );
    });
  }, [activeBookings, assets, facilitySearch, facilityStatusFilter, rooms]);

  const filteredFinishedBookings = useMemo(() => {
    const q = facilitySearch.trim();
    if (!q) return finishedTodayBookings;
    return finishedTodayBookings.filter((b) => {
      const room = rooms.find((r) => r.id === b.room_id);
      const asset = assets.find((a) => a.id === b.asset_id);
      return matchesFlexibleQuery(
        `${b.booking_code} ${b.borrower_name} ${b.borrower_unit} ${b.activity_name} ${b.class_code || ""} ${room?.code || ""} ${room?.name || ""} ${asset?.inventory_code || ""} ${asset?.name || ""}`,
        q
      );
    });
  }, [assets, facilitySearch, finishedTodayBookings, rooms]);

  const bookingPhotoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const att of attachments) {
      if (
        att.entity_type === "booking" &&
        isSafePreviewImageAttachment(att)
      ) {
        counts.set(att.entity_id, (counts.get(att.entity_id) || 0) + 1);
      }
    }
    return counts;
  }, [attachments]);

  const selectedLoan =
    officeKitLoans.find((l) => l.id === selectedLoanId) || null;
  const selectedBooking =
    bookings.find((b) => b.id === selectedBookingId) || null;
  const selectedBookingProgress = selectedBooking
    ? getFacilityProgressPercent(selectedBooking.status)
    : null;
  const selectedBookingRoom = selectedBooking
    ? rooms.find((r) => r.id === selectedBooking.room_id)
    : null;
  const selectedBookingAsset = selectedBooking
    ? assets.find((a) => a.id === selectedBooking.asset_id)
    : null;

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat loket Pinjam Cepat peralatan kantor staf dan reservasi fasilitas..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Halaman Pinjam Cepat"
        description="Sistem gagal mengambil data peminjaman alat kantor staf dan reservasi fasilitas."
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

  const markBookingRecentlyFinished = (bookingId: string) => {
    setRecentlyFinishedBookingIds((prev) =>
      prev.includes(bookingId) ? prev : [...prev, bookingId]
    );
  };

  const handleBookingReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningBooking) return;
    updateBookingStatus(
      returningBooking.id,
      "Selesai / Dikembalikan",
      bookingReturnNotes.trim() ||
        "Dikembalikan tepat waktu dalam kondisi lengkap & baik."
    );
    markBookingRecentlyFinished(returningBooking.id);
    setReturningBooking(null);
    setBookingReturnNotes("");
  };

  const availableUnitsCount = officeKitItems.filter(
    (i) => i.is_active && i.status === "Tersedia" && i.condition !== "Hilang"
  ).length;

  const isAlatMode = activeDeskMode === "alat-staf";

  return (
    <div className="space-y-5">
      {/* Header Operasional Loket Pinjam Cepat */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            {isAlatMode
              ? "SUB-MODUL 02 • LOKET PINJAM CEPAT"
              : "SUB-MODUL 04 • LOKET CEPAT RUANGAN & ALAT PORTABEL"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isAlatMode
              ? "Pinjam Cepat Alat Kantor Staf"
              : "Pinjam Cepat Ruangan & Alat Portabel"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            {isAlatMode
              ? "Catat peminjaman baru di sisi kiri sambil memantau dan memproses pengembalian alat di sisi kanan dalam satu layar loket."
              : "Ajukan reservasi ruangan atau alat portabel dengan foto bukti di sisi kiri sambil menyetujui, serah terima, dan menerima kembali di sisi kanan."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAlatMode ? (
            <>
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
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs font-mono font-bold text-amber-950 dark:text-amber-200">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{activeBookings.length} antrean aktif</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-mono font-bold text-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{finishedTodayBookings.length} selesai hari ini</span>
              </span>
              <Link
                href="/sarpras/peminjaman"
                className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              >
                <CalendarClock className="w-4 h-4" aria-hidden="true" />
                <span>Peminjaman &amp; Reservasi</span>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Switch Mode Pengelolaan Loket (Alat Kantor Staf vs Ruangan & Alat Portabel) */}
      {canAlatStaf && canFasilitas ? (
        <div
          role="group"
          aria-label="Switch mode pengelolaan Pinjam Cepat"
          className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 w-full sm:w-auto"
        >
          <button
            type="button"
            aria-pressed={isAlatMode}
            onClick={() => handleSwitchDeskMode("alat-staf")}
            className={`min-h-[44px] flex-1 sm:flex-initial px-3.5 py-2 rounded-md text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
              isAlatMode
                ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
            }`}
          >
            <Cable className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Alat Kantor Staf</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                isAlatMode
                  ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {activeLoans.length}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={!isAlatMode}
            onClick={() => handleSwitchDeskMode("fasilitas")}
            className={`min-h-[44px] flex-1 sm:flex-initial px-3.5 py-2 rounded-md text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
              !isAlatMode
                ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ruangan &amp; Alat Portabel</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                !isAlatMode
                  ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {activeBookings.length}
            </span>
          </button>
        </div>
      ) : null}

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
          {isAlatMode
            ? `Dipinjam (${activeLoans.length})`
            : `Aktif (${activeBookings.length})`}
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
          {isAlatMode
            ? `Kembali (${returnedTodayLoans.length})`
            : `Selesai (${finishedTodayBookings.length})`}
        </button>
      </div>

      {/* MODE 1: ALAT KANTOR STAF */}
      {isAlatMode ? (
        <ResizableSplitPane
          storageKey="stafcenter_pinjam_cepat_split_v1"
          leftVisibleOnMobile={mobileTab === "form"}
          rightVisibleOnMobile={mobileTab !== "form"}
          left={
            <section
              aria-label="Form Pinjamkan Alat Kantor Staf ke Kelas"
              className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:sticky lg:top-20"
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
                    Pilih kelas (DPM otomatis tercatat) lalu pilih peralatan
                    yang diambil.
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  {availableUnitsCount} siap
                </span>
              </div>

              <QuickLoanForm mode="inline" />
            </section>
          }
          right={
            <div className="space-y-4">
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
        }
      />
      ) : (
        /* MODE 2: RUANGAN & ALAT PORTABEL (PEMINJAMAN & RESERVASI) */
        <ResizableSplitPane
          storageKey="stafcenter_pinjam_cepat_split_v1"
          leftVisibleOnMobile={mobileTab === "form"}
          rightVisibleOnMobile={mobileTab !== "form"}
          left={
            <section
              aria-label="Form Pengajuan Peminjaman Ruangan & Alat"
              className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:sticky lg:top-20"
            >
              <div className="pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2
                      className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Form Peminjaman Ruangan &amp; Alat</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Deteksi bentrok jadwal otomatis (<em>Conflict Detection</em>)
                    beserta dokumentasi foto bukti.
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  {rooms.length} ruang
                </span>
              </div>

              <BookingLoanForm mode="inline" />
            </section>
          }
          right={
            <div className="space-y-4">
              <div className="relative">
              <Search
                className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Cari kode tiket PJM, peminjam, unit, ruang (A21), alat (INVELK), atau kegiatan..."
                aria-label="Cari antrean reservasi ruangan dan alat"
                className="min-h-[44px] w-full pl-10 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              />
            </div>

            {/* Panel Atas: ANTREAN & SEDANG DIPINJAM */}
            <section
              aria-label="Daftar Antrean & Sedang Dipinjam Fasilitas"
              className={`${
                mobileTab === "borrowed" ? "block" : "hidden"
              } lg:block rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"
                      aria-hidden="true"
                    />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      ANTREAN &amp; SEDANG DIPINJAM
                    </h2>
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      {filteredActiveBookings.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Klik baris untuk melihat detail tiket &amp; foto
                  </span>
                </div>

                {/* Filter Status Cepat */}
                <div
                  role="group"
                  aria-label="Filter status antrean fasilitas"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      { key: "ALL", label: "Semua" },
                      { key: "Menunggu Persetujuan", label: "Menunggu" },
                      { key: "Disetujui", label: "Disetujui" },
                      { key: "Sedang Dipinjam", label: "Dipinjam" },
                    ] as const
                  ).map((chip) => {
                    const active = facilityStatusFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFacilityStatusFilter(chip.key)}
                        className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                          active
                            ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredActiveBookings.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {facilitySearch.trim() || facilityStatusFilter !== "ALL"
                      ? "Tidak ada antrean peminjaman fasilitas yang cocok dengan filter saat ini."
                      : "Tidak ada antrean reservasi maupun peminjaman ruangan/alat yang sedang aktif."}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {facilitySearch.trim() || facilityStatusFilter !== "ALL"
                      ? "Reset pencarian atau pilih status Semua untuk melihat antrean aktif."
                      : "Gunakan form di sisi kiri untuk mencatat reservasi ruangan atau alat portabel."}
                  </p>
                  {facilitySearch.trim() || facilityStatusFilter !== "ALL" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFacilitySearch("");
                        setFacilityStatusFilter("ALL");
                      }}
                      className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                    >
                      Reset filter antrean
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul
                  role="list"
                  className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[42vh] overflow-y-auto"
                >
                  {filteredActiveBookings.map((booking) => (
                    <BookingQuickRow
                      key={booking.id}
                      booking={booking}
                      room={rooms.find((r) => r.id === booking.room_id)}
                      asset={assets.find((a) => a.id === booking.asset_id)}
                      photoCount={bookingPhotoCounts.get(booking.id) || 0}
                      todayWibIso={todayWibIso}
                      isSelected={selectedBookingId === booking.id}
                      onOpenDetail={() => setSelectedBookingId(booking.id)}
                      onApprove={() =>
                        updateBookingStatus(
                          booking.id,
                          "Disetujui",
                          undefined,
                          authUser?.fullName || "Kepala Biro Sarpras"
                        )
                      }
                      onReject={() => {
                        updateBookingStatus(booking.id, "Ditolak");
                        markBookingRecentlyFinished(booking.id);
                      }}
                      onHandover={() =>
                        updateBookingStatus(booking.id, "Sedang Dipinjam")
                      }
                      onOpenReturnModal={() => {
                        setReturningBooking(booking);
                        setBookingReturnNotes("");
                      }}
                      onDelete={() => {
                        setDeleteError("");
                        setDeletingBooking(booking);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Panel Bawah: SELESAI / DIKEMBALIKAN */}
            <section
              aria-label="Daftar Selesai & Dikembalikan Fasilitas"
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
                    SELESAI / DIKEMBALIKAN
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    {filteredFinishedBookings.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Hari ini (WIB: <span className="font-mono">{todayWibIso}</span>)
                  • Otomatis bersih besok
                </span>
              </div>

              {filteredFinishedBookings.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {facilitySearch.trim()
                      ? `Tidak ada transaksi selesai hari ini yang cocok dengan "${facilitySearch.trim()}".`
                      : "Belum ada peminjaman ruangan/alat yang selesai pada hari ini."}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {facilitySearch.trim()
                      ? "Coba kata kunci lain atau bersihkan kotak pencarian."
                      : "Riwayat pengembalian dan penolakan hari sebelumnya tetap tersimpan lengkap pada menu Peminjaman & Reservasi."}
                  </p>
                  {facilitySearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => setFacilitySearch("")}
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
                  {filteredFinishedBookings.map((booking) => (
                    <BookingQuickRow
                      key={booking.id}
                      booking={booking}
                      room={rooms.find((r) => r.id === booking.room_id)}
                      asset={assets.find((a) => a.id === booking.asset_id)}
                      photoCount={bookingPhotoCounts.get(booking.id) || 0}
                      todayWibIso={todayWibIso}
                      isSelected={selectedBookingId === booking.id}
                      onOpenDetail={() => setSelectedBookingId(booking.id)}
                      onApprove={() =>
                        updateBookingStatus(
                          booking.id,
                          "Disetujui",
                          undefined,
                          authUser?.fullName || "Kepala Biro Sarpras"
                        )
                      }
                      onReject={() => {
                        updateBookingStatus(booking.id, "Ditolak");
                        markBookingRecentlyFinished(booking.id);
                      }}
                      onHandover={() =>
                        updateBookingStatus(booking.id, "Sedang Dipinjam")
                      }
                      onOpenReturnModal={() => {
                        setReturningBooking(booking);
                        setBookingReturnNotes("");
                      }}
                      onDelete={() => {
                        setDeleteError("");
                        setDeletingBooking(booking);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
            </div>
          }
        />
      )}

      {/* Drawer Detail Tiket Sirkulasi Alat Kantor Staf */}
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
              {selectedLoan.returned_at ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Waktu Kembali Aktual
                  </dt>
                  <dd className="mt-0.5 font-semibold text-emerald-800 dark:text-emerald-300">
                    {formatWibDateTime(selectedLoan.returned_at)}
                    {selectedLoan.received_by_staff
                      ? ` (Diterima oleh ${selectedLoan.received_by_staff})`
                      : ""}
                  </dd>
                </div>
              ) : null}
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
                  isSafePreviewImageAttachment(a)
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

      {/* Drawer Detail Tiket Peminjaman Ruangan & Alat Portabel */}
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
              <div className="flex flex-wrap items-center gap-2">
                {selectedBooking.status === "Menunggu Persetujuan" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        updateBookingStatus(selectedBooking.id, "Ditolak");
                        markBookingRecentlyFinished(selectedBooking.id);
                      }}
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>Tolak Pengajuan</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() =>
                        updateBookingStatus(
                          selectedBooking.id,
                          "Disetujui",
                          undefined,
                          authUser?.fullName || "Kepala Biro Sarpras"
                        )
                      }
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Setujui Peminjaman</span>
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
                    <CalendarClock className="w-4 h-4" aria-hidden="true" />
                    <span>Serah Terima Kunci / Alat</span>
                  </Button>
                ) : null}
                {selectedBooking.status === "Sedang Dipinjam" ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setReturningBooking(selectedBooking);
                      setBookingReturnNotes("");
                    }}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>Catat Pengembalian Selesai</span>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {selectedBooking && selectedBookingProgress ? (
          <div className="space-y-5">
            {selectedBooking.status === "Menunggu Persetujuan" ? (
              <div className="p-3.5 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200">
                <strong>Menunggu Persetujuan Sarpras:</strong> Tinjau jadwal{" "}
                <span className="font-mono font-bold">
                  {selectedBooking.booking_date} ({selectedBooking.start_time}-
                  {selectedBooking.end_time} WIB)
                </span>{" "}
                sebelum menyetujui agar fasilitas siap digunakan.
              </div>
            ) : null}

            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center gap-4">
              <ProgressRing
                percent={selectedBookingProgress.percent}
                tone={selectedBookingProgress.tone}
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

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Peminjam &amp; Peran
                </dt>
                <dd className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                  {selectedBooking.borrower_name} (
                  {selectedBooking.borrower_role})
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
              {selectedBookingRoom ? (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">
                    Ruangan Kampus
                  </dt>
                  <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {selectedBookingRoom.code} ({selectedBookingRoom.name})
                  </dd>
                </div>
              ) : null}
              {selectedBookingAsset ? (
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">
                    Alat Portabel
                  </dt>
                  <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {selectedBookingAsset.inventory_code} (
                    {selectedBookingAsset.name})
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

            {(() => {
              const bookingPhotos = attachments.filter(
                (a) =>
                  a.entity_type === "booking" &&
                  a.entity_id === selectedBooking.id &&
                  isSafePreviewImageAttachment(a)
              );
              if (bookingPhotos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Foto Bukti Peminjaman ({bookingPhotos.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {bookingPhotos.map((photo) => (
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
                          alt={`Foto bukti ${selectedBooking.booking_code}`}
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
              entityType="booking"
              entityId={selectedBooking.id}
              baseEventDates={[selectedBooking.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Terima Pengembalian (Cek Rusak) Alat Kantor Staf */}
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

      {/* Modal Pengembalian Ruangan & Alat Portabel */}
      <Modal
        isOpen={Boolean(returningBooking)}
        onClose={() => setReturningBooking(null)}
        title={`Pengembalian Fasilitas: ${returningBooking?.booking_code || ""}`}
        description="Catat kondisi ruangan atau alat saat dikembalikan oleh peminjam."
      >
        <form onSubmit={handleBookingReturnSubmit} className="space-y-4">
          <Input
            label="Catatan Kondisi Barang / Ruangan Saat Dikembalikan *"
            placeholder="Contoh: Kunci ruang & proyektor dikembalikan lengkap, kondisi baik."
            value={bookingReturnNotes}
            onChange={(e) => setBookingReturnNotes(e.target.value)}
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

      {/* Modal Konfirmasi Hapus Tiket Sirkulasi Alat Kantor Staf */}
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

      {/* Modal Konfirmasi Hapus Tiket Peminjaman Ruangan & Alat */}
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
