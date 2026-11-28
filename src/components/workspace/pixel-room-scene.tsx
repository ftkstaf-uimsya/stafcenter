"use client";

import React, { useState } from "react";
import { CloudRain, Moon, Sun } from "lucide-react";
import { WeatherSnapshot } from "@/lib/workspace/holidays";
import { WorkspaceRoomTheme } from "@/types/sarpras";

export function playPixelChime(kind: "meow" | "pomodoro" | "tick"): void {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (kind === "meow") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (kind === "pomodoro") {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.04, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.18);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Abaikan jika autoplay audio diblokir browser
  }
}

interface PixelRoomSceneProps {
  weather: WeatherSnapshot | null;
  roomTheme: WorkspaceRoomTheme;
  reduceMotion: boolean;
  petEnabled: boolean;
  petName: string;
  soundEnabled: boolean;
  pomodoroRunning: boolean;
  currentTimeLabel: string;
  onOpenWeatherSettings: () => void;
  onOpenJournal: () => void;
  compact?: boolean;
}

const CAT_PHRASES = ["MEONG~", "MIAW!", "SEMANGAT!", "PURR~"];

export function PixelRoomScene({
  weather,
  roomTheme,
  reduceMotion,
  petEnabled,
  petName,
  soundEnabled,
  pomodoroRunning,
  currentTimeLabel,
  onOpenWeatherSettings,
  onOpenJournal,
  compact = false,
}: PixelRoomSceneProps) {
  const [catBubble, setCatBubble] = useState<string | null>(null);
  const [catHeartsKey, setCatHeartsKey] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);

  const isNight =
    roomTheme === "night"
      ? true
      : roomTheme === "day"
      ? false
      : weather
      ? !weather.isDay
      : false;

  const condition = weather?.condition || "partly_cloudy";
  const isRaining = condition === "rain" || condition === "storm";
  const isCloudy =
    condition === "cloudy" ||
    condition === "partly_cloudy" ||
    condition === "rain" ||
    condition === "storm";

  const handlePetCat = () => {
    const nextPhrase = CAT_PHRASES[phraseIdx % CAT_PHRASES.length];
    setPhraseIdx((p) => p + 1);
    setCatBubble(nextPhrase);
    setCatHeartsKey((k) => k + 1);
    if (soundEnabled) {
      playPixelChime("meow");
    }
    setTimeout(() => {
      setCatBubble((current) => (current === nextPhrase ? null : current));
    }, 2200);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border-2 border-slate-900 dark:border-slate-700 select-none ${
        compact ? "h-56 sm:h-64" : "h-full min-h-[520px]"
      } ${isNight ? "bg-[#2C2029]" : "bg-[#EBD8C3]"}`}
    >
      {/* Adegan Ruangan Pixel SVG Crisp */}
      <svg
        viewBox="0 0 640 360"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block pixel-crisp"
        role="img"
        aria-label={`Ilustrasi ruang kerja pixel ${isNight ? "malam" : "siang"} dengan cuaca ${
          weather?.label || "cerah berawan"
        }`}
      >
        {/* Dinding */}
        <rect
          x="0"
          y="0"
          width="640"
          height="268"
          fill={isNight ? "#33252F" : "#F3E3D0"}
        />
        {/* Garis wallpaper vertikal halus */}
        <rect x="0" y="260" width="640" height="8" fill={isNight ? "#241921" : "#D6BD9E"} />

        {/* Lantai kayu/terakota */}
        <rect
          x="0"
          y="268"
          width="640"
          height="92"
          fill={isNight ? "#4E272A" : "#B4654A"}
        />
        <rect x="0" y="294" width="640" height="2" fill={isNight ? "#3C1D20" : "#975038"} />
        <rect x="0" y="324" width="640" height="2" fill={isNight ? "#3C1D20" : "#975038"} />

        {/* Karpet Tengah */}
        <rect
          x="190"
          y="286"
          width="260"
          height="58"
          fill={isNight ? "#2D3A54" : "#3E5C76"}
        />
        <rect
          x="198"
          y="292"
          width="244"
          height="46"
          fill={isNight ? "#3A4B6E" : "#547694"}
        />
        {/* Pola pinggir karpet */}
        <rect x="206" y="298" width="228" height="4" fill="#E9C46A" opacity="0.65" />
        <rect x="206" y="328" width="228" height="4" fill="#E9C46A" opacity="0.65" />

        {/* JENDELA BESAR (Cuaca Real-Time) */}
        <g>
          {/* Bingkai luar kayu */}
          <rect x="172" y="34" width="240" height="148" fill="#5C3A21" />
          {/* Langit di dalam jendela */}
          <rect
            x="182"
            y="44"
            width="220"
            height="128"
            fill={
              isNight
                ? isRaining
                  ? "#111827"
                  : "#16213E"
                : isRaining
                ? "#64748B"
                : isCloudy
                ? "#94A3B8"
                : "#7DD3FC"
            }
          />

          {/* Bintang & Bulan saat malam, atau Matahari saat siang */}
          {isNight ? (
            <g>
              {!isRaining ? (
                <>
                  <rect x="198" y="56" width="4" height="4" fill="#FEF08A" />
                  <rect x="234" y="68" width="3" height="3" fill="#FEF08A" />
                  <rect x="276" y="54" width="4" height="4" fill="#FDE047" />
                  <rect x="318" y="62" width="3" height="3" fill="#FEF08A" />
                  <rect x="348" y="76" width="4" height="4" fill="#FEF08A" />
                </>
              ) : null}
              {/* Bulan pixel */}
              <rect x="362" y="52" width="22" height="22" fill="#FDE68A" />
              <rect x="368" y="56" width="12" height="14" fill={isRaining ? "#111827" : "#16213E"} />
            </g>
          ) : (
            <g>
              {!isRaining ? (
                <rect x="358" y="52" width="22" height="22" fill="#FACC15" />
              ) : null}
            </g>
          )}

          {/* Awan Pixel */}
          {isCloudy ? (
            <g fill={isNight ? "#334155" : "#E2E8F0"} opacity="0.9">
              <rect x="200" y="60" width="46" height="12" />
              <rect x="210" y="52" width="24" height="10" />
              <rect x="284" y="68" width="54" height="12" />
              <rect x="296" y="60" width="28" height="10" />
            </g>
          ) : null}

          {/* Siluet Gedung Kampus & Kota di luar jendela */}
          <g fill={isNight ? "#0F172A" : "#475569"}>
            <rect x="182" y="122" width="26" height="50" />
            <rect x="210" y="108" width="30" height="64" />
            <rect x="242" y="130" width="24" height="42" />
            <rect x="268" y="102" width="34" height="70" />
            <rect x="304" y="118" width="28" height="54" />
            <rect x="334" y="126" width="30" height="46" />
            <rect x="366" y="112" width="36" height="60" />
          </g>

          {/* Lampu jendela gedung malam */}
          {isNight ? (
            <g fill="#FBBF24">
              <rect x="188" y="130" width="4" height="6" />
              <rect x="196" y="142" width="4" height="6" />
              <rect x="216" y="116" width="5" height="6" />
              <rect x="226" y="128" width="5" height="6" />
              <rect x="276" y="112" width="5" height="6" />
              <rect x="288" y="126" width="5" height="6" />
              <rect x="312" y="128" width="4" height="6" />
              <rect x="374" y="122" width="5" height="6" />
              <rect x="386" y="136" width="5" height="6" />
            </g>
          ) : null}

          {/* Efek Hujan / Badai di dalam kaca jendela */}
          {isRaining ? (
            <g className={reduceMotion ? "" : "animate-pixel-rain"}>
              <rect x="196" y="54" width="2" height="10" fill="#93C5FD" />
              <rect x="218" y="76" width="2" height="12" fill="#BAE6FD" />
              <rect x="244" y="58" width="2" height="10" fill="#93C5FD" />
              <rect x="270" y="82" width="2" height="12" fill="#BAE6FD" />
              <rect x="296" y="62" width="2" height="10" fill="#93C5FD" />
              <rect x="322" y="78" width="2" height="12" fill="#BAE6FD" />
              <rect x="348" y="56" width="2" height="10" fill="#93C5FD" />
              <rect x="374" y="80" width="2" height="12" fill="#BAE6FD" />
              <rect x="392" y="64" width="2" height="10" fill="#93C5FD" />
              {condition === "storm" ? (
                <polygon
                  points="312,50 304,68 312,68 306,86 320,64 312,64"
                  fill="#FDE047"
                />
              ) : null}
            </g>
          ) : null}

          {/* Kabut */}
          {condition === "fog" ? (
            <g fill="#E2E8F0" opacity="0.45">
              <rect x="182" y="110" width="220" height="8" />
              <rect x="182" y="132" width="220" height="10" />
            </g>
          ) : null}

          {/* Palang Jendela */}
          <rect x="290" y="44" width="6" height="128" fill="#5C3A21" />
          <rect x="182" y="106" width="220" height="6" fill="#5C3A21" />
          {/* Tirai kiri & kanan */}
          <rect x="166" y="34" width="22" height="154" fill="#7F1D1D" />
          <rect x="186" y="34" width="4" height="154" fill="#991B1B" />
          <rect x="396" y="34" width="22" height="154" fill="#7F1D1D" />
          <rect x="394" y="34" width="4" height="154" fill="#991B1B" />
          {/* Ambang jendela & pot tanaman */}
          <rect x="164" y="182" width="256" height="10" fill="#78350F" />
          <rect x="192" y="166" width="16" height="16" fill="#B45309" />
          <rect x="190" y="162" width="20" height="5" fill="#92400E" />
          <rect x="196" y="148" width="4" height="14" fill="#15803D" />
          <rect x="202" y="152" width="4" height="10" fill="#16A34A" />
          <rect x="192" y="154" width="4" height="8" fill="#22C55E" />
        </g>

        {/* MEJA KERJA & MONITOR */}
        <g>
          {/* Kaki meja */}
          <rect x="210" y="218" width="12" height="62" fill="#451A03" />
          <rect x="398" y="218" width="12" height="62" fill="#451A03" />
          {/* Permukaan meja */}
          <rect x="196" y="208" width="228" height="14" fill="#92400E" />
          <rect x="196" y="206" width="228" height="4" fill="#B45309" />

          {/* Lampu meja (kiri meja) */}
          <rect x="218" y="198" width="18" height="8" fill="#334155" />
          <rect x="224" y="176" width="4" height="22" fill="#475569" />
          <rect x="220" y="166" width="20" height="12" fill="#EAB308" />
          {/* Cahaya lampu hangat saat malam / fokus */}
          {isNight || pomodoroRunning ? (
            <polygon
              points="220,178 240,178 258,206 206,206"
              fill="#FEF08A"
              opacity={pomodoroRunning ? "0.32" : "0.2"}
            />
          ) : null}

          {/* Monitor Pixel */}
          <rect x="268" y="154" width="84" height="44" fill="#1E293B" />
          <rect
            x="273"
            y="159"
            width="74"
            height="34"
            fill={pomodoroRunning ? "#064E3B" : "#0F172A"}
          />
          {/* Tampilan mini kode/jam di monitor */}
          <rect x="278" y="164" width="26" height="4" fill="#38BDF8" />
          <rect x="278" y="172" width="42" height="4" fill="#34D399" />
          <rect x="278" y="180" width="32" height="4" fill="#FBBF24" />
          <text
            x="342"
            y="188"
            textAnchor="end"
            fill="#F8FAFC"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {currentTimeLabel}
          </text>
          {/* Stand monitor */}
          <rect x="304" y="198" width="12" height="8" fill="#334155" />
          <rect x="296" y="204" width="28" height="3" fill="#475569" />

          {/* Mug kopi di kanan meja */}
          <rect x="372" y="194" width="12" height="12" fill="#F8FAFC" />
          <rect x="384" y="197" width="4" height="6" fill="#E2E8F0" />
          <rect x="374" y="192" width="8" height="3" fill="#78350F" />

          {/* Karakter duduk membelakangi kamera */}
          <g>
            {/* Kepala & Rambut */}
            <rect x="298" y="172" width="24" height="22" fill="#1E293B" />
            <rect x="294" y="178" width="6" height="12" fill="#EF4444" />
            <rect x="320" y="178" width="6" height="12" fill="#EF4444" />
            <rect x="296" y="170" width="28" height="5" fill="#DC2626" />
            {/* Baju */}
            <rect x="292" y="196" width="36" height="28" fill="#1D4ED8" />
            {/* Kursi kerja */}
            <rect x="288" y="214" width="44" height="32" fill="#334155" />
            <rect x="306" y="246" width="8" height="18" fill="#1E293B" />
            <rect x="294" y="262" width="32" height="6" fill="#0F172A" />
          </g>
        </g>

        {/* LEMARI KANAN + BUKU JURNAL */}
        <g>
          <rect x="488" y="166" width="82" height="114" fill="#6D3B1A" />
          <rect x="494" y="172" width="70" height="46" fill="#4A260F" />
          <rect x="494" y="224" width="70" height="48" fill="#5A2F14" />
          {/* Tanaman kecil di atas lemari */}
          <rect x="502" y="148" width="18" height="18" fill="#B45309" />
          <rect x="500" y="144" width="22" height="5" fill="#92400E" />
          <rect x="506" y="130" width="5" height="14" fill="#16A34A" />
          <rect x="513" y="134" width="5" height="10" fill="#22C55E" />

          {/* Buku JURNAL di rak/atas lemari */}
          <rect x="526" y="180" width="34" height="38" fill="#FEF3C7" />
          <rect x="526" y="180" width="6" height="38" fill="#B45309" />
          <rect x="536" y="188" width="18" height="4" fill="#92400E" />
          <rect x="536" y="196" width="14" height="3" fill="#B45309" />
          <rect x="546" y="212" width="6" height="10" fill="#DC2626" />
        </g>

        {/* DIGITAL PET: KUCING PIXEL DI KARPET */}
        {petEnabled ? (
          <g
            transform="translate(296, 286)"
            className={reduceMotion ? "" : "animate-pixel-cat"}
          >
            {/* Bayangan kucing */}
            <rect x="4" y="28" width="32" height="5" fill="#0F172A" opacity="0.35" />
            {/* Ekor */}
            <rect x="0" y="12" width="6" height="14" fill="#EA580C" />
            <rect x="0" y="10" width="4" height="4" fill="#FED7AA" />
            {/* Badan */}
            <rect x="6" y="14" width="26" height="14" fill="#F97316" />
            <rect x="10" y="18" width="12" height="8" fill="#FFEDD5" />
            {/* Kaki */}
            <rect x="8" y="26" width="5" height="5" fill="#FFEDD5" />
            <rect x="25" y="26" width="5" height="5" fill="#FFEDD5" />
            {/* Kepala */}
            <rect x="22" y="4" width="18" height="14" fill="#F97316" />
            {/* Telinga */}
            <rect x="22" y="0" width="5" height="5" fill="#EA580C" />
            <rect x="35" y="0" width="5" height="5" fill="#EA580C" />
            {/* Mata & Hidung */}
            <rect x="26" y="9" width="3" height="3" fill="#0F172A" />
            <rect x="34" y="9" width="3" height="3" fill="#0F172A" />
            <rect x="30" y="12" width="3" height="2" fill="#FB7185" />
          </g>
        ) : null}
      </svg>

      {/* Hotspot Interaktif: Jendela Cuaca */}
      <button
        type="button"
        onClick={onOpenWeatherSettings}
        aria-label={`Ubah lokasi cuaca (saat ini ${weather?.city || "Jakarta"}, ${
          weather?.label || "Cerah Berawan"
        })`}
        className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded bg-slate-950/85 hover:bg-slate-900 text-white border border-amber-300/70 text-[11px] font-mono font-bold inline-flex items-center gap-1.5 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {isRaining ? (
          <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
        ) : isNight ? (
          <Moon className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        )}
        <span>
          {weather
            ? `${weather.city} ${weather.temperatureC}°C • ${weather.label}`
            : "Memuat cuaca..."}
        </span>
      </button>

      {/* Hotspot Interaktif: Buku Jurnal di Lemari */}
      <button
        type="button"
        onClick={onOpenJournal}
        aria-label="Buka buku jurnal harian"
        className="absolute right-4 sm:right-8 bottom-16 sm:bottom-24 px-3 py-2 rounded bg-[#FEF3C7] hover:bg-amber-200 text-slate-950 border-2 border-slate-900 font-pixel text-[11px] font-bold pixel-card-shadow transition-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        BUKA JURNAL
      </button>

      {/* Hotspot Interaktif: Digital Pet Kucing */}
      {petEnabled ? (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex flex-col items-center">
          {catBubble ? (
            <div
              key={catHeartsKey}
              role="status"
              className="mb-1 px-2.5 py-1 rounded bg-white text-slate-950 border-2 border-slate-900 text-[11px] font-pixel font-bold shadow flex items-center gap-1"
            >
              <span className="text-rose-600" aria-hidden="true">
                ♥
              </span>
              <span>{catBubble}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handlePetCat}
            aria-label={`Elus ${petName} si kucing meja kerja`}
            className="min-h-[36px] px-2.5 py-1 rounded bg-slate-950/80 hover:bg-slate-900 text-amber-200 border border-amber-300/60 text-[11px] font-mono font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Elus {petName}
          </button>
        </div>
      ) : null}
    </div>
  );
}
