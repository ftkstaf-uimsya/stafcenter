"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSarpras } from "@/lib/supabase/sarpras-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, dismissToast } = useSarpras();

  return (
    <div className="min-h-dvh flex bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[#1E3A5F] focus:text-white focus:font-bold focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main
          id="main-workspace"
          className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto"
        >
          {children}
        </main>
      </div>

      {/* Live Region Notifikasi Aksi (Aksesibilitas Umpan Balik Form) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-20 lg:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-lg border shadow-lg ${
              toast.type === "error"
                ? "bg-red-50 border-red-700 text-red-950 dark:bg-red-950 dark:border-red-500 dark:text-red-100"
                : toast.type === "info"
                ? "bg-sky-50 border-sky-700 text-sky-950 dark:bg-sky-950 dark:border-sky-500 dark:text-sky-100"
                : "bg-emerald-50 border-emerald-700 text-emerald-950 dark:bg-emerald-950 dark:border-emerald-500 dark:text-emerald-100"
            }`}
          >
            <div className="text-xs space-y-0.5">
              <p className="font-bold">{toast.title}</p>
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Tutup notifikasi"
              className="min-w-[36px] min-h-[36px] -mr-1 -mt-1 inline-flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
