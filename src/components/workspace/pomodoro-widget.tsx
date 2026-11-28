"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { playPixelChime } from "@/components/workspace/pixel-room-scene";
import { WorkspacePomodoroMode } from "@/types/sarpras";

interface PomodoroWidgetProps {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  soundEnabled: boolean;
  activeFocusTitle: string | null;
  todayFocusCount: number;
  onRunningChange: (running: boolean) => void;
  onSessionComplete: (
    mode: WorkspacePomodoroMode,
    durationMinutes: number,
    taskLabel: string | null
  ) => Promise<void>;
}

export function PomodoroWidget({
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  soundEnabled,
  activeFocusTitle,
  todayFocusCount,
  onRunningChange,
  onSessionComplete,
}: PomodoroWidgetProps) {
  const [mode, setMode] = useState<WorkspacePomodoroMode>("focus");
  const [testMode, setTestMode] = useState(false);
  const [running, setRunning] = useState(false);

  const durationSeconds = testMode
    ? 10
    : mode === "focus"
    ? focusMinutes * 60
    : mode === "short_break"
    ? shortBreakMinutes * 60
    : longBreakMinutes * 60;

  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const endAtRef = useRef<number | null>(null);
  const completedLockRef = useRef(false);

  useEffect(() => {
    onRunningChange(running && mode === "focus");
  }, [mode, onRunningChange, running]);

  // Reset saat user mengganti mode atau durasi di pengaturan (ketika timer berhenti)
  useEffect(() => {
    if (!running) {
      setSecondsLeft(durationSeconds);
      endAtRef.current = null;
      completedLockRef.current = false;
    }
  }, [durationSeconds, running]);

  useEffect(() => {
    if (!running) return;
    endAtRef.current = Date.now() + secondsLeft * 1000;
    completedLockRef.current = false;

    const timer = setInterval(() => {
      if (!endAtRef.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0 && !completedLockRef.current) {
        completedLockRef.current = true;
        clearInterval(timer);
        setRunning(false);
        endAtRef.current = null;
        if (soundEnabled) {
          playPixelChime("pomodoro");
        }
        const recordedMins = testMode
          ? 0
          : mode === "focus"
          ? focusMinutes
          : mode === "short_break"
          ? shortBreakMinutes
          : longBreakMinutes;
        void onSessionComplete(mode, recordedMins, activeFocusTitle);
      }
    }, 250);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const switchMode = (nextMode: WorkspacePomodoroMode) => {
    setRunning(false);
    setTestMode(false);
    setMode(nextMode);
  };

  const resetTimer = () => {
    setRunning(false);
    endAtRef.current = null;
    setSecondsLeft(durationSeconds);
  };

  const toggleTestMode = () => {
    setRunning(false);
    setTestMode((prev) => !prev);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <section
      aria-label="Pomodoro Timer"
      className="rounded-md border-2 border-slate-900 bg-[#FFFDF7] text-slate-900 pixel-card-shadow overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1E3A5F] text-white border-b-2 border-slate-900">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
          <h2 className="font-pixel text-xs font-bold tracking-wide">
            POMODORO
          </h2>
        </div>
        <span className="text-[10px] font-mono font-bold text-amber-300">
          {todayFocusCount} sesi hari ini
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Pilihan Mode */}
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: "focus", label: "FOKUS" },
              { id: "short_break", label: "ISTIRAHAT" },
              { id: "long_break", label: "PANJANG" },
            ] as const
          ).map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchMode(item.id)}
                className={`py-1.5 px-1 rounded border text-[10px] font-mono font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                  active
                    ? "bg-[#B45309] text-white border-slate-950"
                    : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Angka Countdown Pixel */}
        <div className="py-2 rounded border-2 border-slate-900 bg-slate-950 text-white text-center">
          <p
            aria-live="off"
            className="font-pixel text-3xl font-bold tracking-widest tabular-nums text-amber-300"
          >
            {mm}:{ss}
          </p>
        </div>

        {/* Tombol Mulai / Jeda / Ulang */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (!running && soundEnabled) {
                playPixelChime("tick");
              }
              setRunning((prev) => !prev);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded border-2 border-slate-900 font-pixel text-xs font-bold inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
              running
                ? "bg-amber-300 hover:bg-amber-200 text-slate-950"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {running ? (
              <>
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                <span>JEDA</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>MULAI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetTimer}
            className="min-h-[38px] px-3 py-1.5 rounded border-2 border-slate-900 bg-slate-100 hover:bg-slate-200 text-slate-900 font-pixel text-xs font-bold inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ULANG</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-800 space-y-1">
          <p className="truncate">
            <span className="font-bold">Fokus:</span>{" "}
            {activeFocusTitle || "Pilih tugas atau kerja bebas"}
          </p>
          <button
            type="button"
            onClick={toggleTestMode}
            className="text-[10px] font-mono underline text-slate-700 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded"
          >
            {testMode
              ? "Kembali ke durasi normal"
              : "Coba mode uji (10 detik)"}
          </button>
        </div>
      </div>
    </section>
  );
}
