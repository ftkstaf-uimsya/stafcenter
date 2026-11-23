"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Printer, QrCode, ScanBarcode, Trash2 } from "lucide-react";
import {
  generateCode128DataUrl,
  generateQrDataUrl,
  LabelCodeFormat,
  LabelPrintLayout,
  PrintableBarcodeItem,
  printBarcodeLabelsIsolated,
} from "@/lib/barcode/render-codes";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  items: PrintableBarcodeItem[];
  defaultFormat?: LabelCodeFormat;
}

export function BarcodeLabelModal({
  isOpen,
  onClose,
  title,
  description = "Stiker QR Code & Barcode 1D standar siap scan (kamera HP/laptop dan alat scanner) melalui lembar cetak terisolasi.",
  items,
  defaultFormat = "combo",
}: BarcodeLabelModalProps) {
  const [format, setFormat] = useState<LabelCodeFormat>(defaultFormat);
  const [layout, setLayout] = useState<LabelPrintLayout>("a4_small");
  const [queue, setQueue] = useState<
    Array<{ item: PrintableBarcodeItem; copies: number }>
  >([]);
  const [codeMap, setCodeMap] = useState<
    Record<string, { qr: string; barcode: string }>
  >({});

  useEffect(() => {
    if (!isOpen) return;
    setFormat(defaultFormat);
    setQueue(items.map((item) => ({ item, copies: 1 })));
  }, [defaultFormat, isOpen, items]);

  useEffect(() => {
    if (!isOpen || queue.length === 0) return;
    let active = true;

    const buildAllCodes = async () => {
      const nextEntries = await Promise.all(
        queue.map(async ({ item }) => {
          const [qr, barcode] = await Promise.all([
            generateQrDataUrl(item.code),
            Promise.resolve(generateCode128DataUrl(item.code)),
          ]);
          return [item.id, { qr, barcode }] as const;
        })
      );
      if (!active) return;
      const map: Record<string, { qr: string; barcode: string }> = {};
      for (const [id, data] of nextEntries) {
        map[id] = data;
      }
      setCodeMap(map);
    };

    void buildAllCodes();
    return () => {
      active = false;
    };
  }, [isOpen, queue]);

  const totalStickers = useMemo(
    () => queue.reduce((acc, q) => acc + q.copies, 0),
    [queue]
  );

  const updateCopies = (id: string, delta: number) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.item.id === id
          ? { ...q, copies: Math.max(1, Math.min(50, q.copies + delta)) }
          : q
      )
    );
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.item.id !== id));
  };

  const handlePrint = () => {
    if (queue.length === 0) return;
    printBarcodeLabelsIsolated(
      queue.map(({ item, copies }) => ({
        item,
        copies,
        qrDataUrl: codeMap[item.id]?.qr || "",
        barcodeDataUrl: codeMap[item.id]?.barcode || "",
      })),
      format,
      layout
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Pengaturan Format Kode & Ukuran Kertas */}
        <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-7 space-y-1.5">
            <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Format Kode Stiker
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {
                    id: "combo",
                    label: "Kombinasi (QR + Barcode)",
                    icon: QrCode,
                  },
                  {
                    id: "qr",
                    label: "QR Code Saja",
                    icon: QrCode,
                  },
                  {
                    id: "barcode",
                    label: "Barcode 1D Saja",
                    icon: ScanBarcode,
                  },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    aria-pressed={active}
                    className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5 border transition-colors ${
                      active
                        ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-1.5">
            <label
              htmlFor="barcode-print-layout"
              className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Ukuran Kertas / Layout
            </label>
            <select
              id="barcode-print-layout"
              value={layout}
              onChange={(e) => setLayout(e.target.value as LabelPrintLayout)}
              className="min-h-[38px] w-full px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              <option value="a4_small">
                Kertas A4 Stiker Kecil (3 Kolom x 8 Baris)
              </option>
              <option value="a4_medium">
                Kertas A4 Stiker Sedang (2 Kolom x 5 Baris)
              </option>
              <option value="thermal_50x30">
                Printer Thermal Label Roll (50 x 30 mm)
              </option>
            </select>
          </div>
        </div>

        {/* Antrean & Pratinjau Stiker */}
        {queue.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
            Tidak ada item dalam antrean cetak stiker.
          </div>
        ) : (
          <div className="space-y-3 max-h-[54vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span>
                Antrean Cetak: <strong>{queue.length}</strong> jenis barang (total{" "}
                <strong className="font-mono">{totalStickers}</strong> stiker siap cetak)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Atur jumlah salinan jika ingin mencetak lebih dari 1 stiker per barang.
              </span>
            </div>

            <div
              className={`grid gap-3 ${
                queue.length === 1
                  ? "grid-cols-1 max-w-md mx-auto"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {queue.map(({ item, copies }) => {
                const codes = codeMap[item.id];
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 p-3 space-y-2.5"
                  >
                    {/* Pratinjau Stiker Putih (Kontras Tinggi untuk Scanner) */}
                    <div className="rounded border-2 border-slate-900 bg-white text-slate-950 p-3 space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 truncate">
                        {item.headerTag || "BIRO SARPRAS • STAFCENTER"}
                      </p>

                      {format === "combo" || format === "qr" ? (
                        <div className="flex items-center gap-3">
                          <div className="p-1 border border-slate-300 rounded bg-white shrink-0">
                            {codes?.qr ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={codes.qr}
                                alt={`QR Code ${item.code}`}
                                className={
                                  format === "qr"
                                    ? "w-20 h-20 block"
                                    : "w-16 h-16 block"
                                }
                              />
                            ) : (
                              <div className="w-16 h-16 bg-slate-100" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm font-mono font-extrabold text-slate-950 break-all">
                              {item.code}
                            </p>
                            <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                              {item.title}
                            </p>
                            {item.subtitle ? (
                              <p className="text-[11px] text-slate-700 truncate">
                                {item.subtitle}
                              </p>
                            ) : null}
                            {item.meta ? (
                              <p className="text-[11px] font-mono text-slate-600 truncate">
                                {item.meta}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-sm font-mono font-extrabold text-slate-950 break-all">
                            {item.code}
                          </p>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1">
                            {item.title}
                          </p>
                          {item.subtitle ? (
                            <p className="text-[11px] text-slate-700 truncate">
                              {item.subtitle}
                            </p>
                          ) : null}
                        </div>
                      )}

                      {(format === "combo" || format === "barcode") &&
                      codes?.barcode ? (
                        <div className="pt-1.5 border-t border-slate-200 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={codes.barcode}
                            alt={`Barcode Code 128 ${item.code}`}
                            className="w-full h-10 object-contain mx-auto block"
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* Kontrol Salinan & Hapus */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Jumlah:
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCopies(item.id, -1)}
                          aria-label={`Kurangi jumlah stiker ${item.code}`}
                          className="w-7 h-7 inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                          {copies}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCopies(item.id, 1)}
                          aria-label={`Tambah jumlah stiker ${item.code}`}
                          className="w-7 h-7 inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      {queue.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeFromQueue(item.id)}
                          aria-label={`Keluarkan ${item.code} dari daftar cetak`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={queue.length === 0}
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Cetak Label ({totalStickers} stiker)</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
