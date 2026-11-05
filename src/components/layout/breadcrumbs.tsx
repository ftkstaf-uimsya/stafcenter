"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/sarpras/dashboard": "Ringkasan Operasional",
  "/sarpras/ruangan": "Master Gedung & Ruangan",
  "/sarpras/inventaris": "Inventaris Aset & Barang",
  "/sarpras/peminjaman": "Peminjaman & Reservasi",
  "/sarpras/pemeliharaan": "Pemeliharaan & Laporan Kerusakan",
  "/sarpras/bhp": "Barang Habis Pakai (ATK)",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const currentLabel = ROUTE_LABELS[pathname] || "Sarana Prasarana";

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
        <li aria-hidden="true">
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </li>
        <li className="font-medium text-slate-700 dark:text-slate-300">
          Sarana Prasarana
        </li>
        <li aria-hidden="true">
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </li>
        <li
          aria-current="page"
          className="font-bold text-slate-900 dark:text-slate-100"
        >
          {currentLabel}
        </li>
      </ol>
    </nav>
  );
}
