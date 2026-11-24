"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  Building2,
  Cable,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  FileText,
  GraduationCap,
  HardHat,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Newspaper,
  Package,
  Presentation,
  School,
  ScrollText,
  Tags,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { SarprasPageKey } from "@/types/sarpras";

export interface NavSubItem {
  pageKey: SarprasPageKey;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  exactMatch?: boolean;
  badgeCount?: number;
  badgeTone?: "warning" | "danger" | "info";
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const {
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    lecturers,
    courses,
    campusOfficials,
    campusUnits,
    maintenanceVendors,
    academicClasses,
    officeKitLoans,
    thesisWorkflows,
    canAccessPage,
    defaultHomeHref,
    authUser,
    setCommandSearchOpen,
  } = useSarpras();
  const [sarprasExpanded, setSarprasExpanded] = useState(true);
  const [sirkulasiExpanded, setSirkulasiExpanded] = useState(true);
  const [tugasAkhirExpanded, setTugasAkhirExpanded] = useState(true);
  const [skripsiExpanded, setSkripsiExpanded] = useState(true);
  const [artikelExpanded, setArtikelExpanded] = useState(true);
  const [dataMasterExpanded, setDataMasterExpanded] = useState(true);

  const activeOfficeLoans = officeKitLoans.filter(
    (l) => l.status === "Dipinjam"
  ).length;
  const pendingBookings = bookings.filter(
    (b) => b.status === "Menunggu Persetujuan"
  ).length;
  const openMaintenance = maintenanceLogs.filter(
    (m) => m.status !== "Selesai Diperbaiki"
  ).length;
  const lowStockCount = consumables.filter(
    (c) => c.current_stock < c.min_stock
  ).length;
  const damagedAssets = assets.filter(
    (a) => a.condition === "Rusak Berat" || a.condition === "Rusak Ringan"
  ).length;

  const allSaprasNavItems: NavSubItem[] = [
    {
      pageKey: "dashboard",
      href: "/sarpras/dashboard",
      label: "Dashboard Ringkasan",
      shortLabel: "Ringkasan",
      icon: LayoutDashboard,
    },
    {
      pageKey: "sirkulasi-invent",
      href: "/sarpras/sirkulasi-invent",
      label: "Sirkulasi Invent",
      shortLabel: "Sirkulasi",
      icon: Cable,
      badgeCount: activeOfficeLoans > 0 ? activeOfficeLoans : undefined,
      badgeTone: "warning",
    },
    {
      pageKey: "inventaris",
      href: "/sarpras/inventaris",
      label: "Inventaris Aset & Barang",
      shortLabel: "Inventaris",
      icon: Package,
      badgeCount: damagedAssets > 0 ? damagedAssets : undefined,
      badgeTone: "warning",
    },
    {
      pageKey: "peminjaman",
      href: "/sarpras/peminjaman",
      label: "Peminjaman & Reservasi",
      shortLabel: "Peminjaman",
      icon: CalendarClock,
      badgeCount: pendingBookings > 0 ? pendingBookings : undefined,
      badgeTone: "warning",
    },
    {
      pageKey: "pemeliharaan",
      href: "/sarpras/pemeliharaan",
      label: "Pemeliharaan & Kerusakan",
      shortLabel: "Perbaikan",
      icon: Wrench,
      badgeCount: openMaintenance > 0 ? openMaintenance : undefined,
      badgeTone: "danger",
    },
    {
      pageKey: "bhp",
      href: "/sarpras/bhp",
      label: "Barang Habis Pakai / ATK",
      shortLabel: "Stok BHP",
      icon: Boxes,
      badgeCount: lowStockCount > 0 ? lowStockCount : undefined,
      badgeTone: "danger",
    },
  ];

  const allDataMasterNavItems: NavSubItem[] = [
    {
      pageKey: "ruangan",
      href: "/sarpras/ruangan",
      label: "Gedung & Ruangan",
      shortLabel: "Ruangan",
      icon: Building2,
      badgeCount: rooms.length,
      badgeTone: "info",
    },
    {
      pageKey: "kelas",
      href: "/sarpras/kelas",
      label: "Kelas & DPM",
      shortLabel: "Kelas",
      icon: School,
      badgeCount:
        academicClasses.length > 0 ? academicClasses.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "dosen",
      href: "/sarpras/dosen",
      label: "Dosen",
      shortLabel: "Dosen",
      icon: GraduationCap,
      badgeCount: lecturers.length > 0 ? lecturers.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "makul",
      href: "/sarpras/makul",
      label: "Mata Kuliah (Makul)",
      shortLabel: "Makul",
      icon: BookOpen,
      badgeCount: courses.length > 0 ? courses.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "pengurus",
      href: "/sarpras/pengurus",
      label: "Pengurus Kampus",
      shortLabel: "Pengurus",
      icon: UserCog,
      badgeCount:
        campusOfficials.length > 0 ? campusOfficials.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "unit",
      href: "/sarpras/unit",
      label: "Unit, Prodi & Ormawa",
      shortLabel: "Unit Kerja",
      icon: Landmark,
      badgeCount: campusUnits.length > 0 ? campusUnits.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "vendor",
      href: "/sarpras/vendor",
      label: "Teknisi & Vendor",
      shortLabel: "Vendor",
      icon: HardHat,
      badgeCount:
        maintenanceVendors.length > 0 ? maintenanceVendors.length : undefined,
      badgeTone: "info",
    },
    {
      pageKey: "referensi",
      href: "/sarpras/referensi",
      label: "Master Referensi",
      shortLabel: "Referensi",
      icon: Tags,
    },
  ];

  const saprasNavItems = allSaprasNavItems.filter((item) =>
    canAccessPage(item.pageKey)
  );

  const sirkulasiSubItems: NavSubItem[] = canAccessPage("sirkulasi-invent")
    ? [
        {
          pageKey: "sirkulasi-invent",
          href: "/sarpras/sirkulasi-invent/pinjam-cepat",
          label: "Pinjam Cepat",
          shortLabel: "Pinjam Cepat",
          icon: ClipboardPlus,
        },
        {
          pageKey: "sirkulasi-invent",
          href: "/sarpras/sirkulasi-invent",
          label: "Meja & Katalog",
          shortLabel: "Sirkulasi",
          icon: Cable,
          exactMatch: true,
        },
      ]
    : [];

  const countActiveThesis = (
    track: "skripsi" | "artikel_jurnal",
    stage: "proposal" | "sidang"
  ) =>
    thesisWorkflows.filter(
      (w) =>
        w.track === track &&
        w.stage === stage &&
        w.board_column !== "selesai_arsip"
    ).length;

  const skripsiProposalCount = countActiveThesis("skripsi", "proposal");
  const skripsiSidangCount = countActiveThesis("skripsi", "sidang");
  const artikelProposalCount = countActiveThesis("artikel_jurnal", "proposal");
  const artikelSidangCount = countActiveThesis("artikel_jurnal", "sidang");

  const allSkripsiSubItems: Array<NavSubItem & { fullLabel: string }> = [
    {
      pageKey: "ta-skripsi-proposal",
      href: "/tugas-akhir/skripsi/proposal",
      label: "Proposal",
      fullLabel: "Skripsi: Proposal",
      shortLabel: "Prop. Skripsi",
      icon: FileText,
      badgeCount: skripsiProposalCount > 0 ? skripsiProposalCount : undefined,
      badgeTone: "warning",
    },
    {
      pageKey: "ta-skripsi-sidang",
      href: "/tugas-akhir/skripsi/sidang",
      label: "Sidang",
      fullLabel: "Skripsi: Sidang",
      shortLabel: "Sidang Skripsi",
      icon: Presentation,
      badgeCount: skripsiSidangCount > 0 ? skripsiSidangCount : undefined,
      badgeTone: "info",
    },
  ];

  const allArtikelSubItems: Array<NavSubItem & { fullLabel: string }> = [
    {
      pageKey: "ta-artikel-proposal",
      href: "/tugas-akhir/artikel-jurnal/proposal",
      label: "Proposal",
      fullLabel: "Artikel Jurnal: Proposal",
      shortLabel: "Prop. Artikel",
      icon: FileText,
      badgeCount: artikelProposalCount > 0 ? artikelProposalCount : undefined,
      badgeTone: "warning",
    },
    {
      pageKey: "ta-artikel-sidang",
      href: "/tugas-akhir/artikel-jurnal/sidang",
      label: "Sidang",
      fullLabel: "Artikel Jurnal: Sidang",
      shortLabel: "Sidang Artikel",
      icon: Presentation,
      badgeCount: artikelSidangCount > 0 ? artikelSidangCount : undefined,
      badgeTone: "info",
    },
  ];

  const skripsiSubItems = allSkripsiSubItems.filter((item) =>
    canAccessPage(item.pageKey)
  );
  const artikelSubItems = allArtikelSubItems.filter((item) =>
    canAccessPage(item.pageKey)
  );
  const taCollapsedItems: NavSubItem[] = [
    ...skripsiSubItems.map((i) => ({ ...i, label: i.fullLabel })),
    ...artikelSubItems.map((i) => ({ ...i, label: i.fullLabel })),
  ];

  const dataMasterNavItems = allDataMasterNavItems.filter((item) =>
    canAccessPage(item.pageKey)
  );
  const mobileBottomItems = [
    ...saprasNavItems,
    ...taCollapsedItems,
    ...dataMasterNavItems,
  ].slice(0, 6);
  const mobileGridColsClass =
    mobileBottomItems.length <= 1
      ? "grid-cols-1"
      : mobileBottomItems.length === 2
      ? "grid-cols-2"
      : mobileBottomItems.length === 3
      ? "grid-cols-3"
      : mobileBottomItems.length === 4
      ? "grid-cols-4"
      : mobileBottomItems.length === 5
      ? "grid-cols-5"
      : "grid-cols-6";

  const badgeToneClasses: Record<
    NonNullable<NavSubItem["badgeTone"]>,
    string
  > = {
    info: "bg-sky-900 text-sky-100 border-sky-400/50",
    warning: "bg-amber-900 text-amber-100 border-amber-400/60",
    danger: "bg-red-900 text-red-100 border-red-400/60",
  };

  const renderNavItemList = (items: NavSubItem[], isCollapsedView: boolean) => (
    <ul className="mt-1 space-y-1" role="list">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.exactMatch
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onCloseMobile}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsedView ? item.label : undefined}
              className={`min-h-[44px] lg:min-h-[38px] flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isActive
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? "text-slate-950" : "text-slate-200"
                  }`}
                  aria-hidden={true}
                />
                {!isCollapsedView ? (
                  <span className="truncate">{item.label}</span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </span>
              {!isCollapsedView &&
              item.badgeCount !== undefined &&
              item.badgeCount > 0 ? (
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${
                    isActive
                      ? "bg-slate-950 text-amber-300 border-slate-800"
                      : badgeToneClasses[item.badgeTone || "info"]
                  }`}
                >
                  {item.badgeCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const renderSaprasNavList = (isCollapsedView: boolean) => {
    if (isCollapsedView) {
      const collapsedItems = saprasNavItems.flatMap((item) =>
        item.pageKey === "sirkulasi-invent"
          ? sirkulasiSubItems.map((sub) => ({
              ...sub,
              label: `Sirkulasi: ${sub.label}`,
            }))
          : [item]
      );
      return renderNavItemList(collapsedItems, true);
    }

    return (
      <ul className="mt-1 space-y-1" role="list">
        {saprasNavItems.map((item) => {
          if (item.pageKey === "sirkulasi-invent") {
            const isSirkulasiParentActive = pathname.startsWith(
              "/sarpras/sirkulasi-invent"
            );
            const isOpen = sirkulasiExpanded || isSirkulasiParentActive;
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => setSirkulasiExpanded((prev) => !prev)}
                  aria-expanded={isOpen}
                  className={`w-full min-h-[44px] lg:min-h-[38px] flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isSirkulasiParentActive
                      ? "bg-white/15 text-amber-300 font-bold"
                      : "text-slate-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Cable
                      className={`w-5 h-5 shrink-0 ${
                        isSirkulasiParentActive
                          ? "text-amber-300"
                          : "text-slate-200"
                      }`}
                      aria-hidden={true}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {activeOfficeLoans > 0 ? (
                      <span
                        className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${badgeToneClasses.warning}`}
                      >
                        {activeOfficeLoans}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {isOpen ? (
                  <div className="pl-4 border-l border-white/15 ml-4 mt-1">
                    {renderNavItemList(sirkulasiSubItems, false)}
                  </div>
                ) : null}
              </li>
            );
          }

          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onCloseMobile}
                aria-current={isActive ? "page" : undefined}
                className={`min-h-[44px] lg:min-h-[38px] flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-slate-950" : "text-slate-200"
                    }`}
                    aria-hidden={true}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badgeCount !== undefined && item.badgeCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${
                      isActive
                        ? "bg-slate-950 text-amber-300 border-slate-800"
                        : badgeToneClasses[item.badgeTone || "info"]
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderNavLinks = (
    isCollapsedView: boolean,
    isMobileDrawer = false
  ) => (
    <div className="space-y-2.5">
      {!isCollapsedView && isMobileDrawer ? (
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            setCommandSearchOpen(true);
          }}
          className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span>Cari ruang, kelas, aset...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/30 text-slate-200">
            Ctrl+K
          </kbd>
        </button>
      ) : null}

      {saprasNavItems.length > 0 ? (
        <div>
          {!isCollapsedView ? (
            <button
              type="button"
              onClick={() => setSarprasExpanded((prev) => !prev)}
              aria-expanded={sarprasExpanded}
              className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white hover:bg-white/10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span>SAPRAS</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  sarprasExpanded ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              />
            </button>
          ) : null}

          {sarprasExpanded || isCollapsedView
            ? renderSaprasNavList(isCollapsedView)
            : null}
        </div>
      ) : null}

      {taCollapsedItems.length > 0 ? (
        <div
          className={
            saprasNavItems.length > 0
              ? "pt-2.5 mt-2.5 border-t border-white/15"
              : ""
          }
        >
          {!isCollapsedView ? (
            <>
              <button
                type="button"
                onClick={() => setTugasAkhirExpanded((prev) => !prev)}
                aria-expanded={
                  tugasAkhirExpanded || pathname.startsWith("/tugas-akhir")
                }
                className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white hover:bg-white/10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span>TUGAS AKHIR</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    tugasAkhirExpanded || pathname.startsWith("/tugas-akhir")
                      ? "rotate-0"
                      : "-rotate-90"
                  }`}
                  aria-hidden="true"
                />
              </button>

              {tugasAkhirExpanded || pathname.startsWith("/tugas-akhir") ? (
                <div className="mt-1 space-y-1.5">
                  {skripsiSubItems.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setSkripsiExpanded((prev) => !prev)}
                        aria-expanded={
                          skripsiExpanded ||
                          pathname.startsWith("/tugas-akhir/skripsi")
                        }
                        className={`w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          pathname.startsWith("/tugas-akhir/skripsi")
                            ? "bg-white/15 text-amber-300"
                            : "text-slate-100 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <ScrollText
                            className="w-4 h-4 shrink-0 text-slate-200"
                            aria-hidden="true"
                          />
                          <span className="truncate">SKRIPSI</span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            skripsiExpanded ||
                            pathname.startsWith("/tugas-akhir/skripsi")
                              ? "rotate-0"
                              : "-rotate-90"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {skripsiExpanded ||
                      pathname.startsWith("/tugas-akhir/skripsi") ? (
                        <div className="pl-4 border-l border-white/15 ml-4 mt-1">
                          {renderNavItemList(skripsiSubItems, false)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {artikelSubItems.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setArtikelExpanded((prev) => !prev)}
                        aria-expanded={
                          artikelExpanded ||
                          pathname.startsWith("/tugas-akhir/artikel-jurnal")
                        }
                        className={`w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          pathname.startsWith("/tugas-akhir/artikel-jurnal")
                            ? "bg-white/15 text-amber-300"
                            : "text-slate-100 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Newspaper
                            className="w-4 h-4 shrink-0 text-slate-200"
                            aria-hidden="true"
                          />
                          <span className="truncate">ARTIKEL JURNAL</span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            artikelExpanded ||
                            pathname.startsWith("/tugas-akhir/artikel-jurnal")
                              ? "rotate-0"
                              : "-rotate-90"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {artikelExpanded ||
                      pathname.startsWith("/tugas-akhir/artikel-jurnal") ? (
                        <div className="pl-4 border-l border-white/15 ml-4 mt-1">
                          {renderNavItemList(artikelSubItems, false)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            renderNavItemList(taCollapsedItems, true)
          )}
        </div>
      ) : null}

      {dataMasterNavItems.length > 0 ? (
        <div
          className={
            saprasNavItems.length > 0 || taCollapsedItems.length > 0
              ? "pt-2.5 mt-2.5 border-t border-white/15"
              : ""
          }
        >
          {!isCollapsedView ? (
            <button
              type="button"
              onClick={() => setDataMasterExpanded((prev) => !prev)}
              aria-expanded={dataMasterExpanded}
              className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white hover:bg-white/10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span>DATA MASTER</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  dataMasterExpanded ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              />
            </button>
          ) : null}

          {dataMasterExpanded || isCollapsedView
            ? renderNavItemList(dataMasterNavItems, isCollapsedView)
            : null}
        </div>
      ) : null}

      {authUser?.role === "master_admin" ? (
        <div className="pt-3 mt-3 border-t border-white/15">
          {!isCollapsedView ? (
            <p className="px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
              Master Admin
            </p>
          ) : null}
          <ul className="mt-1 space-y-1" role="list">
            <li>
              <Link
                href="/sarpras/akun"
                onClick={onCloseMobile}
                aria-current={
                  pathname === "/sarpras/akun" ? "page" : undefined
                }
                title={isCollapsedView ? "Kelola Akun Staf" : undefined}
                className={`min-h-[44px] lg:min-h-[38px] flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  pathname === "/sarpras/akun"
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Users
                    className={`w-5 h-5 shrink-0 ${
                      pathname === "/sarpras/akun"
                        ? "text-slate-950"
                        : "text-slate-200"
                    }`}
                    aria-hidden={true}
                  />
                  {!isCollapsedView ? (
                    <span className="truncate">Kelola Akun Staf</span>
                  ) : (
                    <span className="sr-only">Kelola Akun Staf</span>
                  )}
                </span>
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop */}
      <aside
        aria-label="Navigasi Utama StafCenter"
        className={`hidden lg:flex lg:flex-col lg:shrink-0 bg-[#1E3A5F] dark:bg-slate-950 text-white border-r border-slate-800 transition-all duration-150 ${
          collapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/15">
          {!collapsed ? (
            <Link
              href={defaultHomeHref}
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-1 py-0.5"
            >
              <span className="px-2 py-1 text-xs font-mono font-bold tracking-wider bg-amber-400 text-slate-950 rounded">
                [LOGO]
              </span>
              <div>
                <span className="block text-base font-bold tracking-tight text-white leading-none">
                  STAFCENTER
                </span>
                <span className="block text-[11px] text-slate-200 mt-0.5">
                  Administrasi Kampus
                </span>
              </div>
            </Link>
          ) : (
            <Link
              href={defaultHomeHref}
              aria-label="Beranda StafCenter"
              className="mx-auto px-2 py-1 text-xs font-mono font-bold bg-amber-400 text-slate-950 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              SC
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={
              collapsed ? "Perluas sidebar navigasi" : "Ciutkan sidebar navigasi"
            }
            aria-expanded={!collapsed}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {renderNavLinks(collapsed)}
        </nav>

        <div className="p-3 border-t border-white/15 bg-black/20">
          {!collapsed ? (
            <div className="text-xs text-slate-200 space-y-1">
              <p className="font-semibold text-white">
                {authUser ? authUser.fullName : "Biro Umum & Sarpras"}
              </p>
              <p className="font-mono text-[11px] text-slate-300 truncate">
                {authUser
                  ? `${authUser.username} (${
                      authUser.role === "master_admin" ? "Master Admin" : "Staf"
                    })`
                  : "Mode Seed Lokal"}
              </p>
              {authUser ? (
                <Link
                  href="/login"
                  className="inline-block text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                >
                  Kelola Sesi Staf
                </Link>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="block text-center font-mono text-xs font-bold text-amber-300 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded py-1"
              title={
                authUser
                  ? `${authUser.fullName} (@${authUser.username})`
                  : "Akun Staf"
              }
            >
              [PIC]
            </Link>
          )}
        </div>
      </aside>

      {/* Drawer Navigasi Mobile */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi Mobile"
        >
          <div
            className="fixed inset-0 bg-slate-950/75"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-80 max-w-[85vw] bg-[#1E3A5F] dark:bg-slate-950 text-white flex flex-col h-full shadow-2xl">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/15">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs font-mono font-bold bg-amber-400 text-slate-950 rounded">
                  [LOGO]
                </span>
                <span className="text-base font-bold text-white">
                  STAFCENTER
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup menu navigasi"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              {renderNavLinks(false, true)}
            </nav>
            <div className="p-4 border-t border-white/15 text-xs text-slate-200 space-y-1">
              <p className="font-semibold text-white">
                {authUser ? authUser.fullName : "Biro Umum & Sarpras"}
              </p>
              <p className="font-mono text-[11px] text-slate-300 truncate">
                {authUser
                  ? `${authUser.username} (${
                      authUser.role === "master_admin" ? "Master Admin" : "Staf"
                    })`
                  : "Mode Seed Lokal"}
              </p>
              {authUser ? (
                <Link
                  href="/login"
                  onClick={onCloseMobile}
                  className="inline-block text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                >
                  Kelola Sesi Staf
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom Navigation Bar untuk Mobile (Reflow Navigasi Mobile R-03) */}
      {mobileBottomItems.length > 0 ? (
        <nav
          aria-label="Navigasi Cepat Mobile"
          className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#1E3A5F] dark:bg-slate-950 text-white border-t border-white/15 px-1 py-1"
        >
          <ul className={`grid ${mobileGridColsClass} gap-0.5`} role="list">
            {mobileBottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exactMatch
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`min-h-[48px] flex flex-col items-center justify-center rounded px-1 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      isActive
                        ? "bg-amber-400 text-slate-950 font-bold"
                        : "text-slate-200 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden={true} />
                    <span className="mt-0.5 truncate max-w-full">
                      {item.shortLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
