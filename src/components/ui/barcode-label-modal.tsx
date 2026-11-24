"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import {
  generateQrDataUrl,
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
}

export function BarcodeLabelModal({
  isOpen,
  onClose,
  title,
  description = "Stiker QR Code standar siap scan melalui kamera HP atau laptop pada lembar cetak terisolasi.",
  items,
}: BarcodeLabelModalProps) {
  const [layout, setLayout] = useState<LabelPrintLayout>("a4_small");
  const [queue, setQueue] = useState<
    Array<{ item: PrintableBarcodeItem; copies: number }>
  >([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setQueue(items.map((item) => ({ item, copies: 1 })));
  }, [isOpen, items]);

  useEffect(() => {
    if (!isOpen || queue.length === 0) return;
    let active = true;

    const buildAllQrs = async () => {
      const nextEntries = await Promise.all(
        queue.map(async ({ item }) => {
          const qr = await generateQrDataUrl(item.code);
          return [item.id, qr] as const;
        })
      );
      if (!active) return;
      const map: Record<string, string> = {};
      for (const [id, data] of nextEntries) {
        map[id] = data;
      }
      setQrMap(map);
    };

    void buildAllQrs();
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
        qrDataUrl: qrMap[item.id] || "",
      })),
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
        {/* Pengaturan Ukuran Kertas / Layout Cetak QR */}
        <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-[#1E3A5F] dark:bg-sky-500 text-white dark:text-slate-950 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Stiker QR Code Standar (ISO/IEC 18004)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Dioptimalkan agar cepat terbaca oleh pemindai kamera HP dan webcam laptop.
              </p>
            </div>
          </div>

          <div className="sm:w-72 space-y-1">
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

        {/* Antrean & Pratinjau Stiker QR */}
        {queue.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
            Tidak ada item dalam antrean cetak stiker QR.
          </div>
        ) : (
          <div className="space-y-3 max-h-[54vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span>
                Antrean Cetak: <strong>{queue.length}</strong> jenis barang (total{" "}
                <strong className="font-mono">{totalStickers}</strong> stiker QR siap cetak)
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
                const qrUrl = qrMap[item.id];
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 p-3 space-y-2.5"
                  >
                    <div className="rounded border-2 border-slate-900 bg-white text-slate-950 p-3 space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 truncate">
                        {item.headerTag || "BIRO SARPRAS • STAFCENTER"}
                      </p>

                      <div className="flex items-center gap-3">
                        <div className="p-1 border border-slate-300 rounded bg-white shrink-0">
                          {qrUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrUrl}
                              alt={`QR Code ${item.code}`}
                              className="w-20 h-20 block"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-slate-100" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-base font-mono font-extrabold text-slate-950 break-all">
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
                    </div>

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
            <span>Cetak Label QR ({totalStickers} stiker)</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
