"use client";

import React from "react";
import { Menu, Moon, RotateCcw, Sun } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { UISimulationState } from "@/types/sarpras";

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const {
    isLiveSupabase,
    uiSimState,
    setUiSimState,
    theme,
    toggleTheme,
    resetToSeedData,
  } = useSarpras();

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="lg:hidden min-h-[44px] px-3 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
            <span>Menu</span>
          </button>
          <Breadcrumbs />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Indikator Jujur Sumber Data (R-17, R-23, R-38) */}
          <span
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border ${
              isLiveSupabase
                ? "bg-emerald-50 text-emerald-900 border-emerald-700/60 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-500"
                : "bg-amber-50 text-amber-900 border-amber-700/60 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-500"
            }`}
            title={
              isLiveSupabase
                ? "Terhubung ke database produksi Supabase"
                : "Menggunakan data simulasi awal kampus (Seed Data)"
            }
          >
            {isLiveSupabase
              ? "[SUPABASE TERHUBUNG]"
              : "[REAL DATA: MODE SEED KAMPUS]"}
          </span>

          {/* Pengalih State UI untuk Verifikasi Ketahanan (R-27: Empty, Loading, Error) */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="ui-sim-state-select"
              className="sr-only"
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
              className="min-h-[44px] px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <option value="normal">State: Data Aktif</option>
              <option value="empty">State: Kosong (Empty)</option>
              <option value="loading">State: Memuat (Loading)</option>
              <option value="error">State: Gangguan (Error)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resetToSeedData}
            title="Kembalikan data ke seed awal kampus"
            className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>

          {/* Toggle Tema Terang / Gelap (R-21, R-34) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "light"
                ? "Aktifkan tema gelap"
                : "Aktifkan tema terang"
            }
            aria-pressed={theme === "dark"}
            className="min-w-[44px] min-h-[44px] px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 text-slate-800" aria-hidden="true" />
                <span className="hidden md:inline">Gelap</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span className="hidden md:inline">Terang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
