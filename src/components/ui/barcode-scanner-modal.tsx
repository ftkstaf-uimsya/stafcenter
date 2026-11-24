"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  RefreshCw,
  ScanLine,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface ScanCodeOutcome {
  status: "added" | "duplicate" | "unavailable" | "not_found";
  message: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onScanCode: (rawCode: string) => ScanCodeOutcome;
  selectedCount?: number;
}

interface CameraOption {
  id: string;
  label: string;
}

interface ScanLogItem {
  id: string;
  code: string;
  status: ScanCodeOutcome["status"];
  message: string;
  time: string;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  title = "Scan QR Code Barang Kantor Staf",
  onScanCode,
  selectedCount = 0,
}: BarcodeScannerModalProps) {
  const reactId = useId();
  const readerElementId = `stafcenter-scanner-${reactId.replace(/:/g, "")}`;
  const scanImageInputRef = useRef<HTMLInputElement>(null);

  const onScanCodeRef = useRef(onScanCode);
  onScanCodeRef.current = onScanCode;

  const scannerInstanceRef = useRef<{
    isScanning: boolean;
    stop: () => Promise<void>;
    clear: () => void;
    scanFile: (file: File, showImage?: boolean) => Promise<string>;
  } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [feedback, setFeedback] = useState<ScanCodeOutcome | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);

  const pushDecodedResult = (decodedText: string) => {
    const clean = decodedText.trim();
    if (!clean) return;
    const normalized = clean.toUpperCase();
    const now = Date.now();
    if (
      lastScanRef.current.code === normalized &&
      now - lastScanRef.current.at < 1500
    ) {
      return;
    }
    lastScanRef.current = { code: normalized, at: now };

    const outcome = onScanCodeRef.current(clean);
    setFeedback(outcome);
    const timeStr = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setScanLogs((prev) =>
      [
        {
          id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
          code: normalized,
          status: outcome.status,
          message: outcome.message,
          time: timeStr,
        },
        ...prev,
      ].slice(0, 6)
    );
  };

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setScanLogs([]);
      setCameraError("");
      setSelectedCameraId("");
      lastScanRef.current = { code: "", at: 0 };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const startScanner = async () => {
      setInitializing(true);
      setCameraError("");

      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;

        const instance = new Html5Qrcode(readerElementId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerInstanceRef.current = instance;

        const scanConfig = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
        };

        const handleDecoded = (decodedText: string) => {
          pushDecodedResult(decodedText);
        };

        let started = false;

        if (selectedCameraId) {
          await instance.start(
            selectedCameraId,
            scanConfig,
            handleDecoded,
            () => {}
          );
          started = true;
        } else {
          try {
            await instance.start(
              { facingMode: "environment" },
              scanConfig,
              handleDecoded,
              () => {}
            );
            started = true;
          } catch (envErr) {
            const envName = envErr instanceof Error ? envErr.name : "";
            const envMsg =
              envErr instanceof Error
                ? envErr.message.toLowerCase()
                : String(envErr || "").toLowerCase();
            if (
              envName === "NotAllowedError" ||
              envName === "PermissionDeniedError" ||
              envName === "SecurityError" ||
              envMsg.includes("permission") ||
              envMsg.includes("notallowed")
            ) {
              throw envErr;
            }
            try {
              await instance.start(
                { facingMode: "user" },
                scanConfig,
                handleDecoded,
                () => {}
              );
              started = true;
            } catch {
              const list = await Html5Qrcode.getCameras().catch(() => []);
              if (cancelled) return;
              if (list.length > 0) {
                setCameras(
                  list.map((c, idx) => ({
                    id: c.id,
                    label: c.label || `Kamera ${idx + 1}`,
                  }))
                );
                await instance.start(
                  list[0].id,
                  scanConfig,
                  handleDecoded,
                  () => {}
                );
                started = true;
              }
            }
          }
        }

        if (started && !cancelled) {
          const list = await Html5Qrcode.getCameras().catch(() => []);
          if (!cancelled && list.length > 0) {
            setCameras(
              list.map((c, idx) => ({
                id: c.id,
                label: c.label || `Kamera ${idx + 1}`,
              }))
            );
          }
        } else if (!started && !cancelled) {
          throw new Error("Perangkat kamera tidak ditemukan.");
        }
      } catch (err) {
        if (!cancelled) {
          const errName = err instanceof Error ? err.name : "";
          const rawMsg = err instanceof Error ? err.message : String(err || "");
          const rawLower = rawMsg.toLowerCase();
          const isHttpsIssue =
            typeof window !== "undefined" &&
            !window.isSecureContext &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1";
          if (isHttpsIssue) {
            setCameraError(
              "Akses kamera membutuhkan koneksi HTTPS yang aman (atau localhost). Gunakan tombol Scan dari Gambar atau kotak pencarian kode barang."
            );
          } else if (
            errName === "NotAllowedError" ||
            errName === "PermissionDeniedError" ||
            errName === "SecurityError" ||
            rawLower.includes("permission") ||
            rawLower.includes("notallowed")
          ) {
            setCameraError(
              "Izin kamera ditolak oleh browser/aplikasi. Klik ikon pengaturan situs di bilah alamat (atau menu tiga titik pada jendela aplikasi) > Izin Situs > Kamera > Izinkan, serta cek Privasi Kamera perangkat, lalu tekan Muat Ulang Kamera."
            );
          } else if (
            errName === "NotFoundError" ||
            errName === "DevicesNotFoundError" ||
            rawLower.includes("tidak ditemukan")
          ) {
            setCameraError(
              "Perangkat kamera tidak ditemukan. Pastikan webcam/kamera aktif atau gunakan Scan dari Gambar."
            );
          } else if (
            errName === "NotReadableError" ||
            errName === "TrackStartError"
          ) {
            setCameraError(
              "Kamera sedang dipakai oleh aplikasi atau tab lain. Tutup aplikasi lain lalu tekan Muat Ulang Kamera."
            );
          } else {
            setCameraError(
              `Kamera tidak dapat dibuka (${rawMsg || "terjadi kendala perangkat kamera"}). Coba Muat Ulang Kamera atau gunakan Scan dari Gambar.`
            );
          }
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      const instance = scannerInstanceRef.current;
      scannerInstanceRef.current = null;
      if (instance) {
        void (async () => {
          try {
            if (instance.isScanning) {
              await instance.stop();
            }
          } catch {
            // Abaikan bila kamera sudah berhenti
          }
          try {
            instance.clear();
          } catch {
            // Abaikan pembersihan DOM saat unmount
          }
        })();
      }
    };
  }, [isOpen, readerElementId, retryNonce, selectedCameraId]);

  const handleScanImageFile = async (file: File | null) => {
    if (!file) return;
    try {
      const mod = await import("html5-qrcode");
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
      const tempId = `${readerElementId}-file`;
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement("div");
        tempEl.id = tempId;
        tempEl.style.display = "none";
        document.body.appendChild(tempEl);
      }
      const fileScanner = new Html5Qrcode(tempId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      try {
        const decoded = await fileScanner.scanFile(file, false);
        pushDecodedResult(decoded);
      } finally {
        try {
          fileScanner.clear();
        } catch {
          // ignore
        }
        if (tempEl.parentNode) {
          tempEl.parentNode.removeChild(tempEl);
        }
      }
    } catch {
      setFeedback({
        status: "not_found",
        message: "QR Code tidak terbaca dari gambar tersebut. Pastikan gambar jelas.",
      });
    }
  };

  const feedbackStyle =
    feedback?.status === "added"
      ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:border-emerald-500 dark:text-emerald-100"
      : feedback?.status === "duplicate"
      ? "border-sky-600 bg-sky-50 text-sky-950 dark:bg-sky-950/60 dark:border-sky-500 dark:text-sky-100"
      : "border-amber-600 bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:border-amber-500 dark:text-amber-100";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Arahkan kamera HP atau laptop ke stiker QR Code barang. Anda dapat memindai beberapa barang berurutan tanpa menutup kamera."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {cameras.length > 1 ? (
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <label
                htmlFor={`${readerElementId}-cam`}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0"
              >
                Kamera:
              </label>
              <select
                id={`${readerElementId}-cam`}
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="flex-1 min-h-[38px] px-2.5 py-1 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Otomatis</option>
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Posisikan QR Code di dalam kotak bidik kamera.
            </span>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={scanImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleScanImageFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scanImageInputRef.current?.click()}
            >
              <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Scan Gambar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetryNonce((n) => n + 1)}
              aria-label="Muat ulang kamera"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Viewport Kamera Scanner */}
        <div className="relative rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-slate-950 overflow-hidden min-h-[260px] flex items-center justify-center">
          <div id={readerElementId} className="w-full" />

          {initializing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 text-white text-xs p-4 text-center">
              <RefreshCw
                className="w-5 h-5 animate-spin text-sky-400"
                aria-hidden="true"
              />
              <span>Menyalakan kamera pemindai QR Code...</span>
            </div>
          ) : null}

          {cameraError ? (
            <div className="p-5 text-center space-y-3 text-xs text-slate-100 max-w-sm">
              <Camera
                className="w-8 h-8 mx-auto text-amber-400"
                aria-hidden="true"
              />
              <p className="font-bold text-amber-300">
                Kamera Tidak Dapat Dibuka
              </p>
              <p className="text-slate-300 leading-relaxed">{cameraError}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRetryNonce((n) => n + 1)}
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Coba Lagi</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => scanImageInputRef.current?.click()}
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Scan dari Gambar</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {feedback ? (
          <div
            role="status"
            className={`p-3 rounded-md border text-xs font-semibold flex items-center gap-2 ${feedbackStyle}`}
          >
            {feedback.status === "added" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : feedback.status === "duplicate" ? (
              <ScanLine className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        ) : null}

        {scanLogs.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Riwayat Scan Sesi Ini
            </p>
            <ul className="space-y-1 max-h-28 overflow-y-auto text-xs">
              {scanLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200"
                >
                  <span className="truncate">
                    <strong className="font-mono">{log.code}</strong>: {log.message}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {log.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Terpilih saat ini:{" "}
            <strong className="font-mono text-[#1E3A5F] dark:text-sky-400">
              {selectedCount} barang
            </strong>
          </span>
          <Button type="button" variant="primary" onClick={onClose}>
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Selesai Scan ({selectedCount} dipilih)</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
