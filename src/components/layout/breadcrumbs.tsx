"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const ROUTE_META: Record<string, { group: string; label: string }> = {
  "/sarpras/dashboard": { group: "SAPRAS", label: "Ringkasan Operasional" },
  "/sarpras/inventaris": {
    group: "SAPRAS",
    label: "Inventaris Aset & Barang",
  },
  "/sarpras/peminjaman": { group: "SAPRAS", label: "Peminjaman & Reservasi" },
  "/sarpras/pemeliharaan": {
    group: "SAPRAS",
    label: "Pemeliharaan & Laporan Kerusakan",
  },
  "/sarpras/bhp": { group: "SAPRAS", label: "Barang Habis Pakai (ATK)" },
  "/sarpras/ruangan": {
    group: "Data Master",
    label: "Master Gedung & Ruangan Kampus",
  },
  "/sarpras/dosen": { group: "Data Master", label: "Dosen" },
  "/sarpras/makul": { group: "Data Master", label: "Makul (Mata Kuliah)" },
  "/sarpras/pengurus": { group: "Data Master", label: "Pengurus Kampus" },
  "/sarpras/unit": {
    group: "Data Master",
    label: "Unit, Prodi & Ormawa",
  },
  "/sarpras/vendor": {
    group: "Data Master",
    label: "Teknisi & Vendor Pemeliharaan",
  },
  "/sarpras/referensi": {
    group: "Data Master",
    label: "Master Referensi & Klasifikasi",
  },
  "/sarpras/akun": { group: "Master Admin", label: "Manajemen Akun Staf" },
  "/login": { group: "", label: "Autentikasi & Sesi Staf" },
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const meta = ROUTE_META[pathname] || {
    group: "SAPRAS",
    label: "Ringkasan Operasional",
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs">
      <ol className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-400">
        <li>
          <Link
            href="/sarpras/dashboard"
            className="font-medium text-slate-700 hover:text-[#1E3A5F] dark:text-slate-300 dark:hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 rounded px-1 py-0.5"
          >
            StafCenter
          </Link>
        </li>
        {!isLoginRoute && meta.group ? (
          <>
            <li aria-hidden="true">
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </li>
            <li className="font-medium text-slate-700 dark:text-slate-300">
              {meta.group}
            </li>
          </>
        ) : null}
        <li aria-hidden="true">
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </li>
        <li
          aria-current="page"
          className="font-bold text-slate-900 dark:text-slate-100"
        >
          {meta.label}
        </li>
      </ol>
    </nav>
  );
}
