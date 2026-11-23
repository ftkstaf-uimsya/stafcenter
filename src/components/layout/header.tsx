"use client";

import React from "react";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useSarpras } from "@/lib/supabase/sarpras-context";

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { authUser, signOut, setCommandSearchOpen, theme, toggleTheme } =
    useSarpras();

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

          {/* Tombol Keluar Sesi Staf */}
          {authUser ? (
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
          ) : null}

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
