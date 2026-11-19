import React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Penjaga akses tampilan untuk seluruh modul Data Master dan Master Admin.
 */
export function MasterAdminGuard({
  sectionLabel = "halaman Data Master",
}: {
  sectionLabel?: string;
}) {
  return (
    <div className="max-w-lg mx-auto py-8">
      <div
        role="alert"
        className="p-6 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-center space-y-4"
      >
        <ShieldAlert
          className="w-10 h-10 text-red-700 dark:text-red-400 mx-auto"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-red-950 dark:text-red-100">
            Akses Terbatas: Khusus Master Admin
          </h1>
          <p className="text-xs text-red-900 dark:text-red-200">
            Hanya akun Master Admin yang berhak mengakses dan mengelola {sectionLabel}.
          </p>
        </div>
        <Link
          href="/sarpras/dashboard"
          className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center rounded-md bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#162C49] dark:bg-sky-400 dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
