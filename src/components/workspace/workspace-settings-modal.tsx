"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { WEATHER_CITY_PRESETS } from "@/lib/workspace/holidays";
import { WorkspacePreferences, WorkspaceRoomTheme } from "@/types/sarpras";

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: WorkspacePreferences;
  onSave: (patch: Partial<WorkspacePreferences>) => Promise<void>;
  onResetNotePositions: () => Promise<void>;
}

export function WorkspaceSettingsModal({
  isOpen,
  onClose,
  preferences,
  onSave,
  onResetNotePositions,
}: WorkspaceSettingsModalProps) {
  const [city, setCity] = useState(preferences.weather_city);
  const [lat, setLat] = useState(String(preferences.weather_lat));
  const [lon, setLon] = useState(String(preferences.weather_lon));
  const [roomTheme, setRoomTheme] = useState<WorkspaceRoomTheme>(
    preferences.room_theme
  );
  const [reduceMotion, setReduceMotion] = useState(preferences.reduce_motion);
  const [petEnabled, setPetEnabled] = useState(preferences.pet_enabled);
  const [petName, setPetName] = useState(preferences.pet_name);
  const [soundEnabled, setSoundEnabled] = useState(preferences.sound_enabled);
  const [focusMin, setFocusMin] = useState(
    String(preferences.pomodoro_focus_min)
  );
  const [shortMin, setShortMin] = useState(
    String(preferences.pomodoro_short_min)
  );
  const [longMin, setLongMin] = useState(String(preferences.pomodoro_long_min));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCity(preferences.weather_city);
    setLat(String(preferences.weather_lat));
    setLon(String(preferences.weather_lon));
    setRoomTheme(preferences.room_theme);
    setReduceMotion(preferences.reduce_motion);
    setPetEnabled(preferences.pet_enabled);
    setPetName(preferences.pet_name);
    setSoundEnabled(preferences.sound_enabled);
    setFocusMin(String(preferences.pomodoro_focus_min));
    setShortMin(String(preferences.pomodoro_short_min));
    setLongMin(String(preferences.pomodoro_long_min));
  }, [isOpen, preferences]);

  const handleSelectPreset = (selectedCity: string) => {
    const preset = WEATHER_CITY_PRESETS.find((p) => p.city === selectedCity);
    if (!preset) return;
    setCity(preset.city);
    setLat(String(preset.lat));
    setLon(String(preset.lon));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    await onSave({
      weather_city: city.trim() || "Jakarta",
      weather_lat:
        Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90
          ? parsedLat
          : -6.2088,
      weather_lon:
        Number.isFinite(parsedLon) && parsedLon >= -180 && parsedLon <= 180
          ? parsedLon
          : 106.8456,
      room_theme: roomTheme,
      reduce_motion: reduceMotion,
      pet_enabled: petEnabled,
      pet_name: petName.trim().slice(0, 40) || "Oyen",
      sound_enabled: soundEnabled,
      pomodoro_focus_min: Math.max(1, Math.min(120, Number(focusMin) || 25)),
      pomodoro_short_min: Math.max(1, Math.min(60, Number(shortMin) || 5)),
      pomodoro_long_min: Math.max(1, Math.min(90, Number(longMin) || 15)),
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Meja Kerja Pixel"
      description="Tersimpan khusus untuk akun staf Anda (tidak memengaruhi akun staf lain)."
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Lokasi Cuaca */}
        <div className="p-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            Lokasi Cuaca Jendela (Tanpa Izin GPS Browser)
          </p>
          <div>
            <label
              htmlFor="ws-city-preset"
              className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Pilih Kota Kampus
            </label>
            <select
              id="ws-city-preset"
              value={
                WEATHER_CITY_PRESETS.some((p) => p.city === city) ? city : ""
              }
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="">-- Pilih Preset Kota atau Isi Manual --</option>
              {WEATHER_CITY_PRESETS.map((p) => (
                <option key={p.city} value={p.city}>
                  {p.city} ({p.lat}, {p.lon})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1">
                Label Kota
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Suasana Ruangan & Animasi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="ws-room-theme"
              className="block font-bold text-slate-900 dark:text-slate-100 mb-1"
            >
              Suasana Ruangan
            </label>
            <select
              id="ws-room-theme"
              value={roomTheme}
              onChange={(e) =>
                setRoomTheme(e.target.value as WorkspaceRoomTheme)
              }
              className="w-full min-h-[38px] px-2.5 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="auto">Otomatis (Ikut Siang/Malam)</option>
              <option value="day">Selalu Siang Hangat</option>
              <option value="night">Selalu Malam Cozy</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ws-pet-name"
              className="block font-bold text-slate-900 dark:text-slate-100 mb-1"
            >
              Nama Kucing Digital Pet
            </label>
            <input
              id="ws-pet-name"
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              disabled={!petEnabled}
              className="w-full min-h-[38px] px-2.5 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Durasi Pomodoro */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
              Fokus (mnt)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={focusMin}
              onChange={(e) => setFocusMin(e.target.value)}
              className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
              Istirahat (mnt)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={shortMin}
              onChange={(e) => setShortMin(e.target.value)}
              className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
              Panjang (mnt)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={longMin}
              onChange={(e) => setLongMin(e.target.value)}
              className="w-full min-h-[36px] px-2 rounded border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Toggle Opsi */}
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={petEnabled}
              onChange={(e) => setPetEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400"
            />
            <span className="text-slate-800 dark:text-slate-200">
              Tampilkan kucing pixel interaktif di meja kerja
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400"
            />
            <span className="text-slate-800 dark:text-slate-200">
              Aktifkan efek suara 8-bit ringan (Pomodoro &amp; elus kucing)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400"
            />
            <span className="text-slate-800 dark:text-slate-200">
              Mode Tenang (hentikan animasi hujan &amp; gerakan pet)
            </span>
          </label>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onResetNotePositions()}
          >
            Rapikan Posisi Catatan
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
