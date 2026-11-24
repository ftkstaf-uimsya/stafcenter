"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  GripVertical,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isLoanOverdueDay,
  splitLoanKitLabels,
} from "@/lib/sarpras/sirkulasi-utils";
import { OfficeKitLoan } from "@/types/sarpras";

interface LoanActionCallbacks {
  onOpenDetail: () => void;
  onQuickCheckin: () => void;
  onOpenCheckinModal: () => void;
  onReopen: () => void;
  onDelete: () => void;
}

interface LoanBoardCompactCardProps extends LoanActionCallbacks {
  loan: OfficeKitLoan;
  todayWibIso: string;
  isDraggable?: boolean;
}

/**
 * Compact Kanban card for Meja Sirkulasi Pinjam Kelas:
 * shows only Kelas Mahasiswa (+ borrower name), borrowed office-kit items, and actions.
 */
export function LoanBoardCompactCard({
  loan,
  todayWibIso,
  isDraggable = false,
  onOpenDetail,
  onQuickCheckin,
  onOpenCheckinModal,
  onReopen,
  onDelete,
}: LoanBoardCompactCardProps) {
  const itemLabels = splitLoanKitLabels(loan.kit_items_label);
  const overdueDay = isLoanOverdueDay(loan, todayWibIso);

  return (
    <div>
      <button
        type="button"
        onClick={onOpenDetail}
        className="w-full text-left p-3.5 space-y-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 rounded-lg"
      >
        {/* 1. Kelas Mahasiswa + Nama Pengambil */}
        <div className="flex flex-wrap items-center gap-2">
          {isDraggable ? (
            <GripVertical
              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
            {loan.class_code}
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {loan.borrower_name}
          </span>
          {overdueDay ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold rounded border border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Lewat hari ({loan.loan_date})</span>
            </span>
          ) : null}
        </div>

        {/* 2. Barang Kantor Staf yang Dipinjam */}
        <ul
          aria-label="Barang kantor staf yang dipinjam"
          className="space-y-1 text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed"
        >
          {itemLabels.length > 0 ? (
            itemLabels.map((itemLabel, idx) => (
              <li key={`${loan.id}-kit-${idx}`} className="flex items-start gap-1.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 shrink-0"
                />
                <span>{itemLabel}</span>
              </li>
            ))
          ) : (
            <li>{loan.kit_items_label}</li>
          )}
        </ul>
      </button>

      {/* 3. Tombol Aksi */}
      <div
        className="px-3.5 pb-3 pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        {loan.status === "Dipinjam" ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={onQuickCheckin}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tandai Dikembalikan</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onDelete}
                aria-label={`Hapus tiket ${loan.loan_code}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onOpenCheckinModal}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Terima Kembali (Cek Rusak)</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onReopen}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ubah ke Dipinjam</span>
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              aria-label={`Hapus tiket ${loan.loan_code}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface LoanQuickRowProps extends LoanActionCallbacks {
  loan: OfficeKitLoan;
  todayWibIso: string;
  isSelected?: boolean;
}

/**
 * Horizontal compact strip row for the Pinjam Cepat split workspace panels.
 */
export function LoanQuickRow({
  loan,
  todayWibIso,
  isSelected = false,
  onOpenDetail,
  onQuickCheckin,
  onOpenCheckinModal,
  onReopen,
  onDelete,
}: LoanQuickRowProps) {
  const itemLabels = splitLoanKitLabels(loan.kit_items_label);
  const overdueDay = isLoanOverdueDay(loan, todayWibIso);

  return (
    <li
      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
        isSelected
          ? "bg-sky-50/90 dark:bg-sky-950/40"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex-1 min-w-0 text-left rounded-md p-1 -m-1 space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
            {loan.class_code}
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {loan.borrower_name}
          </span>
          {overdueDay ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold rounded border border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Lewat hari ({loan.loan_date})</span>
            </span>
          ) : null}
        </div>

        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
          {itemLabels.join(" • ")}
        </p>
      </button>

      <div
        className="flex flex-wrap items-center gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {loan.status === "Dipinjam" ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onQuickCheckin}
              aria-label={`Tandai dikembalikan ${loan.class_code} ${loan.borrower_name}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Dikembalikan</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCheckinModal}
              aria-label={`Terima kembali cek rusak ${loan.class_code}`}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cek Rusak</span>
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              aria-label={`Hapus tiket ${loan.loan_code}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReopen}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ubah ke Dipinjam</span>
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              aria-label={`Hapus tiket ${loan.loan_code}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
