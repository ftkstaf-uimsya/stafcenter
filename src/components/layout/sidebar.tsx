"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Wrench,
  X,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";

export interface NavSubItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
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
  const { rooms, assets, bookings, maintenanceLogs, consumables } =
    useSarpras();
  const [sarprasExpanded, setSarprasExpanded] = useState(true);

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

  const navItems: NavSubItem[] = [
    {
      href: "/sarpras/dashboard",
      label: "Dashboard Ringkasan",
      shortLabel: "Ringkasan",
      icon: LayoutDashboard,
    },
    {
      href: "/sarpras/ruangan",
      label: "Master Gedung & Ruangan",
      shortLabel: "Ruangan",
      icon: Building2,
      badgeCount: rooms.length,
      badgeTone: "info",
    },
    {
      href: "/sarpras/inventaris",
      label: "Inventaris Aset & Barang",
      shortLabel: "Inventaris",
      icon: Package,
      badgeCount: damagedAssets > 0 ? damagedAssets : undefined,
      badgeTone: "warning",
    },
    {
      href: "/sarpras/peminjaman",
      label: "Peminjaman & Reservasi",
      shortLabel: "Peminjaman",
      icon: CalendarClock,
      badgeCount: pendingBookings > 0 ? pendingBookings : undefined,
      badgeTone: "warning",
    },
    {
      href: "/sarpras/pemeliharaan",
      label: "Pemeliharaan & Kerusakan",
      shortLabel: "Perbaikan",
      icon: Wrench,
      badgeCount: openMaintenance > 0 ? openMaintenance : undefined,
      badgeTone: "danger",
    },
    {
      href: "/sarpras/bhp",
      label: "Barang Habis Pakai / ATK",
      shortLabel: "Stok BHP",
      icon: Boxes,
      badgeCount: lowStockCount > 0 ? lowStockCount : undefined,
      badgeTone: "danger",
    },
  ];

  const badgeToneClasses: Record<
    NonNullable<NavSubItem["badgeTone"]>,
    string
  > = {
    info: "bg-sky-900 text-sky-100 border-sky-400/50",
    warning: "bg-amber-900 text-amber-100 border-amber-400/60",
    danger: "bg-red-900 text-red-100 border-red-400/60",
  };

  const renderNavLinks = (isCollapsedView: boolean) => (
    <div className="space-y-2">
      <div>
        {!isCollapsedView ? (
          <button
            type="button"
            onClick={() => setSarprasExpanded((prev) => !prev)}
            aria-expanded={sarprasExpanded}
            className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white hover:bg-white/10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span>Modul 01: Sarana Prasarana</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                sarprasExpanded ? "rotate-0" : "-rotate-90"
              }`}
              aria-hidden="true"
            />
          </button>
        ) : null}

        {sarprasExpanded || isCollapsedView ? (
          <ul className="mt-1 space-y-1" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    aria-current={isActive ? "page" : undefined}
                    title={isCollapsedView ? item.label : undefined}
                    className={`min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
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
        ) : null}
      </div>
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
              href="/sarpras/dashboard"
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
              href="/sarpras/dashboard"
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
              <p className="font-semibold text-white">Biro Umum & Sarpras</p>
              <p className="font-mono text-[11px] text-slate-300">
                Akun: ftkstaf@gmail.com
              </p>
            </div>
          ) : (
            <div
              className="text-center font-mono text-xs font-bold text-amber-300"
              title="Biro Umum & Sarpras (ftkstaf@gmail.com)"
            >
              [PIC]
            </div>
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
              {renderNavLinks(false)}
            </nav>
            <div className="p-4 border-t border-white/15 text-xs text-slate-200">
              <p className="font-semibold text-white">Biro Umum & Sarpras</p>
              <p className="font-mono text-[11px] text-slate-300 mt-0.5">
                ftkstaf@gmail.com
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom Navigation Bar untuk Mobile (Reflow Navigasi Mobile R-03) */}
      <nav
        aria-label="Navigasi Cepat Mobile"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#1E3A5F] dark:bg-slate-950 text-white border-t border-white/15 px-1 py-1"
      >
        <ul className="grid grid-cols-6 gap-0.5" role="list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </>
  );
}
