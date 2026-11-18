"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DeleteStrategyMode } from "@/types/sarpras";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  targetBadge?: string;
  targetName: string;
  impactNotes?: string[];
  activeBlockers?: string[];
  hardBlockers?: string[];
  showStrategySelector?: boolean;
  defaultStrategy?: DeleteStrategyMode;
  errorMessage?: string;
  isSubmitting?: boolean;
  confirmLabel?: string;
  onConfirm: (options: {
    mode: DeleteStrategyMode;
    forceActive: boolean;
  }) => Promise<void> | void;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  title,
  description = "Periksa ringkasan dampak penghapusan sebelum melanjutkan.",
  targetBadge,
  targetName,
  impactNotes = [],
  activeBlockers = [],
  hardBlockers = [],
  showStrategySelector = false,
  defaultStrategy = "archive",
  errorMessage = "",
  isSubmitting = false,
  confirmLabel = "Ya, Hapus Permanen",
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [mode, setMode] = useState<DeleteStrategyMode>(defaultStrategy);
  const [forceActive, setForceActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultStrategy);
      setForceActive(false);
    }
  }, [isOpen, defaultStrategy]);

  const hasHardBlockers = hardBlockers.length > 0;
  const hasActiveBlockers = activeBlockers.length > 0;
  const isConfirmDisabled =
    isSubmitting || hasHardBlockers || (hasActiveBlockers && !forceActive);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 space-y-1">
          {targetBadge ? (
            <span className="inline-block px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {targetBadge}
            </span>
          ) : null}
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {targetName}
          </p>
        </div>

        {impactNotes.length > 0 ? (
          <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Dampak Relasi Data
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {impactNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasHardBlockers ? (
          <div
            role="alert"
            className="p-3.5 rounded-md border border-red-600/70 bg-red-50 dark:bg-red-950/60 space-y-1.5 text-xs text-red-950 dark:text-red-200"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5 text-red-700 dark:text-red-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-bold">Penghapusan Diblokir</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {hardBlockers.map((blocker, idx) => (
                    <li key={idx}>{blocker}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {hasActiveBlockers ? (
          <div
            role="alert"
            className="p-3.5 rounded-md border border-amber-600/60 bg-amber-50 dark:bg-amber-950/50 space-y-2.5"
          >
            <div className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200">
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-bold">
                  Terdeteksi Transaksi Aktif / Terbuka
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {activeBlockers.map((blocker, idx) => (
                    <li key={idx}>{blocker}</li>
                  ))}
                </ul>
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={forceActive}
                onChange={(e) => setForceActive(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-amber-700 text-red-700 focus:ring-red-700 shrink-0"
              />
              <span className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                Saya mengerti risikonya dan tetap ingin memaksa penghapusan
                data ini beserta transaksi aktif di atas.
              </span>
            </label>
          </div>
        ) : null}

        {showStrategySelector ? (
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Penanganan Riwayat Peminjaman & Kerusakan Terkait
            </legend>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`p-3 rounded-md border cursor-pointer flex items-start gap-2.5 min-h-[44px] ${
                  mode === "archive"
                    ? "border-[#1E3A5F] bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/30"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="delete-strategy-mode"
                  value="archive"
                  checked={mode === "archive"}
                  onChange={() => setMode("archive")}
                  className="mt-0.5 w-4 h-4 text-[#1E3A5F] focus:ring-[#1E3A5F] shrink-0"
                />
                <span className="text-xs space-y-0.5">
                  <strong className="block text-slate-900 dark:text-slate-100">
                    Pertahankan Arsip Histori Tiket (Rekomendasi Audit)
                  </strong>
                  <span className="block text-slate-600 dark:text-slate-400">
                    Unit dihapus dari daftar aktif, sementara riwayat
                    peminjaman & biaya perbaikan tetap disimpan dengan label
                    arsip [Dihapus].
                  </span>
                </span>
              </label>

              <label
                className={`p-3 rounded-md border cursor-pointer flex items-start gap-2.5 min-h-[44px] ${
                  mode === "cascade"
                    ? "border-red-600 bg-red-50/70 dark:border-red-500 dark:bg-red-950/30"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="delete-strategy-mode"
                  value="cascade"
                  checked={mode === "cascade"}
                  onChange={() => setMode("cascade")}
                  className="mt-0.5 w-4 h-4 text-red-700 focus:ring-red-700 shrink-0"
                />
                <span className="text-xs space-y-0.5">
                  <strong className="block text-slate-900 dark:text-slate-100">
                    Hapus Bersih Beserta Tiket Terkait
                  </strong>
                  <span className="block text-slate-600 dark:text-slate-400">
                    Menghapus permanen unit ini sekaligus tiket peminjaman /
                    kerusakan yang merujuk khusus padanya beserta seluruh catatan
                    & berkas lampiran.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isConfirmDisabled}
            onClick={() => void onConfirm({ mode, forceActive })}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>{isSubmitting ? "Menghapus..." : confirmLabel}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
