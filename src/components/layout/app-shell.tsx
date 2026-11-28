"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LoadingStateView } from "@/components/ui/data-states";
import { CommandSearch } from "@/components/ui/command-search";
import { MasterAdminGuard } from "@/components/sarpras/master-admin-guard";
import { getPageKeyFromPathname, getPageMeta } from "@/lib/auth/permissions";
import { useSarpras } from "@/lib/supabase/sarpras-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    isLiveSupabase,
    authUser,
    authLoading,
    canAccessPage,
    defaultHomeHref,
    toasts,
    dismissToast,
    theme,
    toggleTheme,
  } = useSarpras();

  const isAuthPage = pathname === "/login" || pathname?.startsWith("/login/");
  const isPublicScanPage =
    pathname === "/scan" || pathname?.startsWith("/scan/");
  const isMejaKerjaPage =
    pathname === "/sarpras/meja-kerja" ||
    pathname?.startsWith("/sarpras/meja-kerja/");
  const requiresAuth = isLiveSupabase && !isAuthPage && !isPublicScanPage;
  const pageKey = getPageKeyFromPathname(pathname);
  const isPinjamCepatRoute =
    pathname === "/sarpras/sirkulasi-invent/pinjam-cepat";
  const hasPinjamCepatAccess =
    canAccessPage("sirkulasi-invent") || canAccessPage("peminjaman");
  const pageBlocked =
    !isMejaKerjaPage &&
    Boolean(isLiveSupabase && authUser && pageKey) &&
    (isPinjamCepatRoute
      ? !hasPinjamCepatAccess
      : !canAccessPage(pageKey as NonNullable<typeof pageKey>));
  const blockedPageLabel =
    pageKey === "akun"
      ? "Manajemen Akun Staf"
      : pageKey
      ? getPageMeta(pageKey)?.label || pageKey
      : "halaman ini";

  useEffect(() => {
    if (requiresAuth && !authLoading && !authUser) {
      router.replace("/login");
    }
  }, [requiresAuth, authLoading, authUser, router]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  const toastPortal = (
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
  );

  if (isPublicScanPage) {
    return (
      <div className="min-h-dvh bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {children}
      </div>
    );
  }

  // Blokir akses ke rute operasional sampai sesi autentikasi Staf terverifikasi
  if (requiresAuth && (authLoading || !authUser)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md">
          <LoadingStateView
            message={
              authLoading
                ? "Memeriksa sesi autentikasi StafCenter..."
                : "Mengalihkan ke halaman masuk akun staf..."
            }
          />
        </div>
        {toastPortal}
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[#1E3A5F] focus:text-white focus:font-bold focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {isAuthPage ? (
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 h-16 flex items-center justify-between shrink-0">
            <Link
              href="/login"
              className="flex items-center gap-2.5 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <span className="px-2 py-1 text-xs font-mono font-bold tracking-wider bg-[#1E3A5F] text-amber-400 dark:bg-amber-400 dark:text-slate-950 rounded">
                [LOGO]
              </span>
              <div>
                <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  STAFCENTER
                </span>
                <span className="block text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Administrasi & Sarana Prasarana Kampus
                </span>
              </div>
            </Link>

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
                  <span className="hidden sm:inline">Gelap</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-300" aria-hidden="true" />
                  <span className="hidden sm:inline">Terang</span>
                </>
              )}
            </button>
          </header>

          <main
            id="main-workspace"
            className="flex-1 flex items-center justify-center p-4 sm:p-6"
          >
            {children}
          </main>
        </div>
      ) : (
        <>
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
              className={
                isMejaKerjaPage
                  ? "flex-1 p-2 sm:p-4 pb-24 lg:pb-4 w-full min-w-0"
                  : "flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto"
              }
            >
              {pageBlocked ? (
                <MasterAdminGuard
                  title={
                    pageKey === "akun"
                      ? "Akses Terbatas: Khusus Master Admin"
                      : "Akses Halaman Tidak Diizinkan"
                  }
                  sectionLabel={blockedPageLabel}
                  description={
                    pageKey === "akun"
                      ? "Hanya akun Master Admin yang berhak mengakses dan mengelola Manajemen Akun Staf."
                      : `Akun Anda belum diberi otoritas untuk mengakses halaman ${blockedPageLabel}. Hubungi Master Admin bila Anda memerlukan akses.`
                  }
                  backHref={defaultHomeHref}
                  backLabel="Kembali ke Halaman Utama Anda"
                />
              ) : (
                children
              )}
            </main>
          </div>

          <CommandSearch />
        </>
      )}

      {toastPortal}
    </div>
  );
}
