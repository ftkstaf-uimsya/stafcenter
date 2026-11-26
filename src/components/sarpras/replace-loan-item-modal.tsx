"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Search, Wrench } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { OfficeKitLoan } from "@/types/sarpras";
import { matchesFlexibleQuery } from "@/lib/search-normalize";
import { extractScannedItemCode } from "@/lib/barcode/render-codes";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReplaceLoanItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: OfficeKitLoan | null;
}

export function ReplaceLoanItemModal({
  isOpen,
  onClose,
  loan,
}: ReplaceLoanItemModalProps) {
  const { officeKitItems, replaceOfficeKitLoanItem } = useSarpras();

  const [selectedOldId, setSelectedOldId] = useState("");
  const [selectedNewId, setSelectedNewId] = useState("");
  const [oldCondition, setOldCondition] = useState<
    "Rusak Ringan" | "Rusak Berat"
  >("Rusak Ringan");
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !loan) return;
    setSelectedOldId(loan.kit_item_ids[0] || "");
    setSelectedNewId("");
    setOldCondition("Rusak Ringan");
    setSearchQuery("");
    setNotes("");
    setErrorMsg("");
  }, [isOpen, loan]);

  const currentLoanItems = useMemo(() => {
    if (!loan) return [];
    return loan.kit_item_ids.map((id) => {
      const found = officeKitItems.find((k) => k.id === id);
      return {
        id,
        kitCode: found?.kit_code || id,
        name: found?.name || "Barang Tercatat",
        category: found?.category || null,
        brandSpec: found?.brand_spec || "-",
      };
    });
  }, [loan, officeKitItems]);

  const selectedOldItem = useMemo(
    () => currentLoanItems.find((i) => i.id === selectedOldId) || null,
    [currentLoanItems, selectedOldId]
  );

  // Tampilkan semua kategori barang yang tersedia, urutkan kategori yang sama paling atas
  const availableReplacements = useMemo(() => {
    const rawQ = searchQuery.trim();
    const extracted = extractScannedItemCode(rawQ);
    const sameCat = selectedOldItem?.category;

    return officeKitItems
      .filter((item) => {
        if (!item.is_active || item.status !== "Tersedia") return false;
        if (item.id === selectedOldId) return false;
        if (!rawQ) return true;
        return matchesFlexibleQuery(
          `${item.kit_code} ${item.name} ${item.category} ${item.brand_spec} ${item.storage_tray}`,
          extracted || rawQ
        );
      })
      .sort((a, b) => {
        const aSame = sameCat && a.category === sameCat ? 0 : 1;
        const bSame = sameCat && b.category === sameCat ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        const catCmp = a.category.localeCompare(b.category);
        if (catCmp !== 0) return catCmp;
        return a.kit_code.localeCompare(b.kit_code, undefined, {
          numeric: true,
        });
      });
  }, [officeKitItems, searchQuery, selectedOldId, selectedOldItem?.category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    if (!selectedOldId) {
      setErrorMsg("Pilih barang dipinjam yang rusak terlebih dahulu.");
      return;
    }
    if (!selectedNewId) {
      setErrorMsg("Pilih barang pengganti yang tersedia terlebih dahulu.");
      return;
    }

    const res = replaceOfficeKitLoanItem({
      loanId: loan.id,
      oldItemId: selectedOldId,
      newItemId: selectedNewId,
      oldCondition,
      notes,
    });
    if (!res.ok) {
      setErrorMsg(res.error || "Gagal mengganti barang dipinjam.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen && Boolean(loan)}
      onClose={onClose}
      title="Ganti Barang Dipinjam"
      description={
        loan
          ? `Tiket ${loan.loan_code} (${loan.class_code}) • Tukar barang rusak dengan unit tersedia di kantor staf.`
          : undefined
      }
      maxWidthClass="max-w-2xl"
    >
      {loan ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
              1. Pilih Barang yang Rusak / Akan Diganti *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentLoanItems.map((item) => {
                const active = selectedOldId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedOldId(item.id);
                      setErrorMsg("");
                    }}
                    aria-pressed={active}
                    className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                      active
                        ? "border-amber-600 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {item.kitCode}
                      </span>
                      {item.category ? (
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                      {item.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                2. Pilih Barang Pengganti yang Tersedia * (
                {availableReplacements.length} siap)
              </span>
              {selectedOldItem?.category ? (
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Prioritas kategori: <strong>{selectedOldItem.category}</strong>
                </span>
              ) : null}
            </div>

            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode/nama barang pengganti atau scan QR..."
                aria-label="Cari barang pengganti yang tersedia"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              />
            </div>

            {availableReplacements.length === 0 ? (
              <p className="p-3 rounded-md border border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
                Tidak ada barang tersedia yang cocok untuk mengganti unit ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                {availableReplacements.map((item) => {
                  const chosen = selectedNewId === item.id;
                  const isSameCategory =
                    selectedOldItem?.category &&
                    item.category === selectedOldItem.category;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedNewId(item.id);
                        setErrorMsg("");
                      }}
                      aria-pressed={chosen}
                      className={`min-h-[44px] p-2.5 rounded-md border text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                        chosen
                          ? "border-[#1E3A5F] bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {item.kit_code}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isSameCategory
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {item.storage_tray}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                3. Kondisi Barang Lama *
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["Rusak Ringan", "Rusak Berat"] as const).map((cond) => {
                  const active = oldCondition === cond;
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setOldCondition(cond)}
                      aria-pressed={active}
                      className={`min-h-[44px] px-3 py-2 rounded-md border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                        active
                          ? "border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Alasan / Catatan Penggantian (Opsional)"
              placeholder="Contoh: Kabel putus / tidak tampil, ditukar unit cadangan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
            <Wrench
              className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>
              Barang lama otomatis berstatus <strong>Perbaikan</strong> dan
              dibuatkan tiket di menu{" "}
              <strong>Pemeliharaan &amp; Kerusakan</strong>, sedangkan barang
              pengganti langsung berstatus <strong>Dipinjam</strong>.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!selectedOldId || !selectedNewId}
            >
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
              <span>Konfirmasi Ganti Barang</span>
              <CheckCircle2 className="w-4 h-4 hidden sm:inline" aria-hidden="true" />
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
