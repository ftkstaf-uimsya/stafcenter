"use client";

import React from "react";
import Link from "next/link";
import { LogIn, LogOut, Menu, Moon, RotateCcw, Sun, UserCheck } from "lucide-react";
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
          {/* Indikator Jujur Sumber Data & Mode Sinkronisasi */}
          <span
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border ${
              isLiveSupabase && authUser
                ? "bg-emerald-50 text-emerald-900 border-emerald-700/60 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-500"
                : isLiveSupabase
                ? "bg-sky-50 text-sky-900 border-sky-700/60 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-500"
                : "bg-amber-50 text-amber-900 border-amber-700/60 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-500"
            }`}
            title={
              isLiveSupabase && authUser
                ? "Terhubung ke Supabase PostgreSQL dengan sesi Staf aktif (simpan permanen)"
                : isLiveSupabase
                ? "Terhubung ke Supabase (Mode Baca). Masuk sebagai Staf untuk menyimpan perubahan ke database."
                : "Menggunakan data simulasi awal kampus (Seed Data)"
            }
          >
            {isLiveSupabase
              ? authUser
                ? "[SUPABASE TERHUBUNG • TULIS AKTIF]"
                : "[SUPABASE TERHUBUNG • MODE BACA]"
              : "[REAL DATA: MODE SEED KAMPUS]"}
          </span>

          {/* Kontrol Autentikasi Staf */}
          {authUser ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-700/50 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                title={`Sesi aktif: ${authUser.email}`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden xl:inline max-w-[160px] truncate">
                  {authUser.email}
                </span>
                <span className="xl:hidden">Sesi Staf</span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Keluar dari sesi staf"
                title="Keluar dari sesi staf"
                className="min-h-[44px] px-2.5 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-sky-400 dark:hover:bg-sky-300 text-xs font-bold text-white dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Masuk Staf</span>
            </Link>
          )}

          {/* Pengalih State UI untuk Verifikasi Ketahanan (Empty, Loading, Error) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="ui-sim-state-select" className="sr-only">
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
            disabled={isSyncingDb}
            title={
              isLiveSupabase
                ? "Muat ulang seluruh data terbaru dari database Supabase"
                : "Kembalikan data ke seed awal kampus"
            }
            className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isSyncingDb ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isLiveSupabase ? "Sinkron DB" : "Reset Seed"}
            </span>
          </button>

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
