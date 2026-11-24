"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface CameraPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

interface VideoDeviceOption {
  deviceId: string;
  label: string;
}

export function CameraPhotoModal({
  isOpen,
  onClose,
  onCapture,
  title = "Ambil Foto Bukti Peminjaman",
}: CameraPhotoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [devices, setDevices] = useState<VideoDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const stopActiveStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopActiveStream();
      if (capturedUrl) {
        URL.revokeObjectURL(capturedUrl);
      }
      setCapturedUrl(null);
      setCapturedBlob(null);
      setErrorMsg("");
      setSelectedDeviceId("");
    }
  }, [capturedUrl, isOpen, stopActiveStream]);

  useEffect(() => {
    if (!isOpen || capturedUrl) return;
    let cancelled = false;

    const openCamera = async () => {
      setLoading(true);
      setErrorMsg("");
      stopActiveStream();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setLoading(false);
        setErrorMsg(
          "Browser tidak mendukung kamera langsung di halaman ini. Gunakan tombol Unggah / Kamera Perangkat di bawah."
        );
        return;
      }

      try {
        let stream: MediaStream;
        if (selectedDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          });
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 960 },
              },
              audio: false,
            });
          } catch (envErr) {
            const errName =
              envErr instanceof Error ? envErr.name : "";
            if (
              errName === "NotAllowedError" ||
              errName === "PermissionDeniedError" ||
              errName === "SecurityError"
            ) {
              throw envErr;
            }
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const allDevices = await navigator.mediaDevices
          .enumerateDevices()
          .catch(() => []);
        if (!cancelled) {
          const videoDevs = allDevices
            .filter((d) => d.kind === "videoinput")
            .map((d, idx) => ({
              deviceId: d.deviceId,
              label: d.label || `Kamera ${idx + 1}`,
            }));
          setDevices(videoDevs);
        }
      } catch (err) {
        if (!cancelled) {
          const errName = err instanceof Error ? err.name : "";
          const raw = err instanceof Error ? err.message : String(err || "");
          const rawLower = raw.toLowerCase();
          const isHttpsIssue =
            typeof window !== "undefined" &&
            !window.isSecureContext &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1";
          if (isHttpsIssue) {
            setErrorMsg(
              "Akses kamera membutuhkan koneksi HTTPS yang aman (atau localhost). Gunakan tombol fallback di bawah untuk mengambil foto."
            );
          } else if (
            errName === "NotAllowedError" ||
            errName === "PermissionDeniedError" ||
            errName === "SecurityError" ||
            rawLower.includes("permission") ||
            rawLower.includes("notallowed")
          ) {
            setErrorMsg(
              "Izin kamera ditolak oleh browser/aplikasi. Klik ikon pengaturan situs di bilah alamat (atau menu tiga titik pada jendela aplikasi) > Izin Situs > Kamera > Izinkan, serta pastikan izin Kamera aktif di Pengaturan Privasi perangkat, lalu tekan Coba Lagi."
            );
          } else if (
            errName === "NotFoundError" ||
            errName === "DevicesNotFoundError"
          ) {
            setErrorMsg(
              "Perangkat kamera tidak ditemukan pada laptop/HP ini. Gunakan tombol Buka Kamera / Galeri Perangkat di bawah."
            );
          } else if (
            errName === "NotReadableError" ||
            errName === "TrackStartError"
          ) {
            setErrorMsg(
              "Kamera sedang dipakai oleh aplikasi atau tab lain. Tutup aplikasi lain yang memakai kamera lalu tekan Coba Lagi."
            );
          } else {
            setErrorMsg(
              `Kamera tidak dapat dinyalakan (${raw || "terjadi kendala perangkat kamera"}).`
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void openCamera();

    return () => {
      cancelled = true;
      stopActiveStream();
    };
  }, [capturedUrl, isOpen, retryNonce, selectedDeviceId, stopActiveStream]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const maxDim = 1600;
    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopActiveStream();
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
      },
      "image/jpeg",
      0.85
    );
  };

  const handleRetake = () => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    setCapturedUrl(null);
    setCapturedBlob(null);
    setRetryNonce((n) => n + 1);
  };

  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = new File([capturedBlob], `foto-pinjam-${stamp}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    onCapture(file);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Ambil foto langsung dari kamera laptop atau HP sebagai bukti serah terima barang."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {devices.length > 1 && !capturedUrl ? (
          <div className="flex items-center gap-2">
            <label
              htmlFor="camera-photo-device"
              className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0"
            >
              Pilih Kamera:
            </label>
            <select
              id="camera-photo-device"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="flex-1 min-h-[38px] px-2.5 py-1 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Otomatis</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="relative rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-slate-950 overflow-hidden min-h-[260px] flex items-center justify-center">
          {capturedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedUrl}
              alt="Hasil jepretan kamera"
              className="w-full max-h-[360px] object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[360px] object-contain"
            />
          )}

          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 text-white text-xs p-4">
              <RefreshCw
                className="w-5 h-5 animate-spin text-sky-400"
                aria-hidden="true"
              />
              <span>Menyalakan kamera...</span>
            </div>
          ) : null}

          {errorMsg && !capturedUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-slate-100 text-xs p-5 text-center">
              <Camera className="w-8 h-8 text-amber-400" aria-hidden="true" />
              <p className="font-bold text-amber-300">Kamera Tidak Aktif</p>
              <p className="text-slate-300 leading-relaxed max-w-sm">
                {errorMsg}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
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
                  onClick={() => fallbackInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Buka Kamera / Galeri Perangkat</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onCapture(file);
              onClose();
            }
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>

          {capturedUrl ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleRetake}>
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Foto Ulang</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmPhoto}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Gunakan Foto Ini</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={loading || Boolean(errorMsg)}
              onClick={handleSnap}
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>Jepret Foto</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
