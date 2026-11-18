"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sun,
  UserCheck,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { UISimulationState } from "@/types/sarpras";

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const {
    isLiveSupabase,
    authUser,
    isSyncingDb,
    signOut,
    uiSimState,
    setUiSimState,
    setCommandSearchOpen,
    theme,
    toggleTheme,
    resetToSeedData,
  } = useSarpras();

  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [toolsOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="lg:hidden min-h-[44px] px-3 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 shrink-0"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
            <span>Menu</span>
          </button>
          <div className="min-w-0 truncate">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Pemicu Pencarian Cepat Lintas Modul (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setCommandSearchOpen(true)}
            aria-label="Buka pencarian cepat lintas modul"
            className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden md:inline">Cari Cepat...</span>
            <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              Ctrl K
            </kbd>
          </button>

          {/* Indikator Jujur Sumber Data */}
          <span
            className={`hidden sm:inline-flex px-2.5 py-1 text-[11px] font-mono font-semibold rounded border ${
              isLiveSupabase
                ? "bg-emerald-50 text-emerald-900 border-emerald-700/50 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-500"
                : "bg-amber-50 text-amber-900 border-amber-700/50 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-500"
            }`}
            title={
              isLiveSupabase
                ? "Terhubung langsung ke database PostgreSQL Supabase"
                : "Menggunakan data simulasi awal kampus (Seed Data)"
            }
          >
            {isLiveSupabase
              ? "[SUPABASE TERHUBUNG]"
              : "[REAL DATA: MODE SEED KAMPUS]"}
          </span>

          {/* Info Sesi Staf & Tombol Keluar */}
          {authUser ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-700/40 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                title={`Sesi aktif: ${authUser.fullName} (${authUser.username})`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden xl:inline max-w-[160px] truncate">
                  {authUser.username} (
                  {authUser.role === "master_admin" ? "Master Admin" : "Staf"})
                </span>
                <span className="xl:hidden">{authUser.username}</span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Keluar dari sesi staf"
                title="Keluar dari sesi staf"
                className="min-h-[44px] px-2.5 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            </div>
          ) : null}

          {/* Menu Utilitas Ringkas (Sinkron DB & Uji State UI) */}
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen((prev) => !prev)}
              aria-expanded={toolsOpen}
              aria-label="Menu utilitas dan sinkronisasi"
              title="Utilitas & Sinkronisasi Data"
              className="min-w-[44px] min-h-[44px] px-2.5 inline-flex items-center justify-center rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <SlidersHorizontal
                className={`w-4 h-4 ${isSyncingDb ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>

            {toolsOpen ? (
              <div
                role="region"
                aria-label="Panel utilitas operasional"
                className="absolute right-0 mt-2 w-64 z-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    resetToSeedData();
                    setToolsOpen(false);
                  }}
                  disabled={isSyncingDb}
                  className="w-full min-h-[44px] px-3 py-2 inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${isSyncingDb ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span>
                    {isLiveSupabase
                      ? "Sinkron Ulang Database"
                      : "Reset Data Seed"}
                  </span>
                </button>

                <div className="space-y-1">
                  <label
                    htmlFor="ui-sim-state-select"
                    className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                  >
                    Mode Tampilan Data (Uji State UI)
                  </label>
                  <select
                    id="ui-sim-state-select"
                    value={uiSimState}
                    onChange={(e) =>
                      setUiSimState(e.target.value as UISimulationState)
                    }
                    aria-label="Mode Tampilan Data (Uji State UI)"
                    className="w-full min-h-[44px] px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                  >
                    <option value="normal">State: Data Aktif</option>
                    <option value="empty">State: Kosong (Empty)</option>
                    <option value="loading">State: Memuat (Loading)</option>
                    <option value="error">State: Gangguan (Error)</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          {/* Toggle Tema Terang / Gelap */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "light"
                ? "Aktifkan tema gelap"
                : "Aktifkan tema terang"
            }
            aria-pressed={theme === "dark"}
            className="min-w-[44px] min-h-[44px] px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 text-slate-800" aria-hidden="true" />
                <span className="hidden lg:inline">Gelap</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span className="hidden lg:inline">Terang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
