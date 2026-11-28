"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  StickyNote,
  Timer,
} from "lucide-react";
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import { getCurrentWibTimeHHMM } from "@/lib/sarpras/sirkulasi-utils";
import { useWorkspace } from "@/lib/workspace/use-workspace";
import { PixelRoomScene } from "@/components/workspace/pixel-room-scene";
import { TodoWidget } from "@/components/workspace/todo-widget";
import { CalendarWidget } from "@/components/workspace/calendar-widget";
import { PomodoroWidget } from "@/components/workspace/pomodoro-widget";
import { StickyNotesLayer } from "@/components/workspace/sticky-notes-layer";
import { JournalModal } from "@/components/workspace/journal-modal";
import { WorkspaceSettingsModal } from "@/components/workspace/workspace-settings-modal";

type MobileTabKey = "todo" | "calendar" | "pomodoro" | "notes";

export function MejaKerjaView() {
  const {
    loading,
    loadError,
    migrationMissing,
    reload,
    todayIso,
    staffName,
    preferences,
    updatePreferences,
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearDoneTodos,
    notes,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    journals,
    saveJournalEntry,
    journalStreakDays,
    events,
    addPersonalEvent,
    deletePersonalEvent,
    todayFocusSessionsCount,
    recordPomodoroSession,
    weather,
    refreshWeather,
  } = useWorkspace();

  const [fullscreen, setFullscreen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeFocusTitle, setActiveFocusTitle] = useState<string | null>(null);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTabKey>("todo");
  const [currentWibClock, setCurrentWibClock] = useState(() =>
    getCurrentWibTimeHHMM()
  );

  // Toggle visibilitas panel widget di kanvas desktop
  const [showTodoPanel, setShowTodoPanel] = useState(true);
  const [showCalendarPanel, setShowCalendarPanel] = useState(true);
  const [showPomodoroPanel, setShowPomodoroPanel] = useState(true);
  const [showNotesLayer, setShowNotesLayer] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentWibClock(getCurrentWibTimeHHMM());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !journalOpen && !settingsOpen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [fullscreen, journalOpen, settingsOpen]);

  if (loading) {
    return <LoadingStateView message="Menyiapkan Meja Kerja Pixel Anda..." />;
  }

  if (loadError) {
    return (
      <ErrorStateView
        title="Gagal Memuat Meja Kerja Pixel"
        description={loadError}
        onRetry={() => void reload()}
      />
    );
  }

  const handleResetNotePositions = async () => {
    for (let i = 0; i < notes.length; i += 1) {
      await updateStickyNote(notes[i].id, {
        pos_x: 240 + (i % 3) * 36,
        pos_y: 28 + i * 32,
      });
    }
  };

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-40 bg-[#1B1521] p-3 sm:p-4 overflow-y-auto flex flex-col gap-3"
          : "space-y-3"
      }
    >
      {/* Bar Kontrol Atas Meja Kerja */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-lg border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-pixel text-sm sm:text-base font-bold text-slate-950 dark:text-white">
              MEJA KERJA PIXEL
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-200 text-slate-950 border border-slate-900 text-[11px] font-mono font-bold">
              {staffName}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ruang produktivitas personal &amp; sinkronisasi agenda harian StafCenter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle widget desktop */}
          <div className="hidden lg:flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={() => setShowCalendarPanel((v) => !v)}
              aria-pressed={showCalendarPanel}
              className={`min-h-[36px] px-2.5 rounded border text-xs font-bold inline-flex items-center gap-1 ${
                showCalendarPanel
                  ? "bg-[#1E3A5F] text-white border-slate-900"
                  : "bg-slate-100 text-slate-800 border-slate-400"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Kalender</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTodoPanel((v) => !v)}
              aria-pressed={showTodoPanel}
              className={`min-h-[36px] px-2.5 rounded border text-xs font-bold inline-flex items-center gap-1 ${
                showTodoPanel
                  ? "bg-[#1E3A5F] text-white border-slate-900"
                  : "bg-slate-100 text-slate-800 border-slate-400"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tugas</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPomodoroPanel((v) => !v)}
              aria-pressed={showPomodoroPanel}
              className={`min-h-[36px] px-2.5 rounded border text-xs font-bold inline-flex items-center gap-1 ${
                showPomodoroPanel
                  ? "bg-[#1E3A5F] text-white border-slate-900"
                  : "bg-slate-100 text-slate-800 border-slate-400"
              }`}
            >
              <Timer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pomodoro</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNotesLayer((v) => !v)}
              aria-pressed={showNotesLayer}
              className={`min-h-[36px] px-2.5 rounded border text-xs font-bold inline-flex items-center gap-1 ${
                showNotesLayer
                  ? "bg-[#1E3A5F] text-white border-slate-900"
                  : "bg-slate-100 text-slate-800 border-slate-400"
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Catatan ({notes.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void addStickyNote("", "yellow")}
            className="min-h-[38px] px-2.5 rounded border-2 border-slate-900 bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-bold inline-flex items-center gap-1"
          >
            <StickyNote className="w-3.5 h-3.5" aria-hidden="true" />
            <span>+ Catatan</span>
          </button>

          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            className="min-h-[38px] px-2.5 rounded border-2 border-slate-900 bg-[#FEF3C7] hover:bg-amber-200 text-slate-950 text-xs font-bold inline-flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Jurnal</span>
          </button>

          <button
            type="button"
            onClick={() => void refreshWeather()}
            aria-label="Muat ulang data cuaca"
            title="Muat ulang cuaca"
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded border border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Buka pengaturan meja kerja"
            className="min-h-[38px] px-2.5 rounded border border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Atur</span>
          </button>

          <button
            type="button"
            onClick={() => setFullscreen((prev) => !prev)}
            aria-label={
              fullscreen ? "Keluar mode layar penuh" : "Masuk mode layar penuh"
            }
            className="hidden lg:inline-flex min-h-[38px] px-2.5 rounded border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold items-center gap-1"
          >
            {fullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Keluar Fokus</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Layar Penuh</span>
              </>
            )}
          </button>
        </div>
      </header>

      {migrationMissing ? (
        <div
          role="status"
          className="px-3 py-2 rounded-md border border-amber-700 bg-amber-50 text-amber-950 text-xs"
        >
          <strong>Info Sinkronisasi:</strong> Tabel{" "}
          <code className="font-mono">staff_workspace_*</code> belum dijalankan di
          Supabase (jalankan{" "}
          <code className="font-mono">
            supabase/migrations/013_staff_pixel_workspace.sql
          </code>
          ). Untuk sementara data meja kerja disimpan secara lokal di browser per akun.
        </div>
      ) : null}

      {/* KANVAS DESKTOP (>= 1024px): Adegan Ruangan Pixel + Panel & Sticky Notes */}
      <div className="hidden lg:block relative flex-1 min-h-[640px]">
        <div className="relative w-full h-full min-h-[640px]">
          <PixelRoomScene
            weather={weather}
            roomTheme={preferences.room_theme}
            reduceMotion={preferences.reduce_motion}
            petEnabled={preferences.pet_enabled}
            petName={preferences.pet_name}
            soundEnabled={preferences.sound_enabled}
            pomodoroRunning={pomodoroRunning}
            currentTimeLabel={currentWibClock}
            onOpenWeatherSettings={() => setSettingsOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
          />

          {/* Overlay Grid 3-Kolom agar panel kiri/kanan rapi & area tengah (jendela + meja + kucing) tetap terbuka */}
          <div className="pointer-events-none absolute inset-0 p-3 grid grid-cols-12 gap-3 items-start">
            {/* Kolom Kiri: Kalender + Tugas */}
            <div className="col-span-4 xl:col-span-3 space-y-3 max-h-full overflow-y-auto pointer-events-auto pr-0.5">
              {showCalendarPanel ? (
                <CalendarWidget
                  todayIso={todayIso}
                  personalEvents={events}
                  onAddEvent={addPersonalEvent}
                  onDeleteEvent={deletePersonalEvent}
                />
              ) : null}
              {showTodoPanel ? (
                <TodoWidget
                  todos={todos}
                  todayIso={todayIso}
                  activeFocusTitle={activeFocusTitle}
                  onAddTodo={addTodo}
                  onToggleTodo={toggleTodo}
                  onDeleteTodo={deleteTodo}
                  onClearDone={clearDoneTodos}
                  onSetFocusTask={setActiveFocusTitle}
                />
              ) : null}
            </div>

            {/* Area Tengah: Bebas untuk Jendela Cuaca, Karakter Meja, & Kucing + Sticky Notes */}
            <div className="col-span-4 xl:col-span-6 h-full relative" />

            {/* Kolom Kanan: Pomodoro */}
            <div className="col-span-4 xl:col-span-3 space-y-3 pointer-events-auto">
              {showPomodoroPanel ? (
                <PomodoroWidget
                  focusMinutes={preferences.pomodoro_focus_min}
                  shortBreakMinutes={preferences.pomodoro_short_min}
                  longBreakMinutes={preferences.pomodoro_long_min}
                  soundEnabled={preferences.sound_enabled}
                  activeFocusTitle={activeFocusTitle}
                  todayFocusCount={todayFocusSessionsCount}
                  onRunningChange={setPomodoroRunning}
                  onSessionComplete={recordPomodoroSession}
                />
              ) : null}
            </div>
          </div>

          {/* Sticky Notes Layer (Draggable di atas kanvas desktop) */}
          {showNotesLayer ? (
            <StickyNotesLayer
              notes={notes}
              mode="floating"
              onAddNote={addStickyNote}
              onUpdateNote={updateStickyNote}
              onDeleteNote={deleteStickyNote}
            />
          ) : null}
        </div>
      </div>

      {/* REFLOW TABLET & MOBILE (< 1024px): Kanvas Ringkas + Tab Panel 44px+ */}
      <div className="lg:hidden space-y-3">
        <PixelRoomScene
          weather={weather}
          roomTheme={preferences.room_theme}
          reduceMotion={preferences.reduce_motion}
          petEnabled={preferences.pet_enabled}
          petName={preferences.pet_name}
          soundEnabled={preferences.sound_enabled}
          pomodoroRunning={pomodoroRunning}
          currentTimeLabel={currentWibClock}
          onOpenWeatherSettings={() => setSettingsOpen(true)}
          onOpenJournal={() => setJournalOpen(true)}
          compact={true}
        />

        <div
          role="tablist"
          aria-label="Panel Meja Kerja Mobile"
          className="grid grid-cols-4 gap-1.5"
        >
          {(
            [
              { id: "todo", label: "Tugas", icon: CheckSquare },
              { id: "calendar", label: "Kalender", icon: CalendarDays },
              { id: "pomodoro", label: "Fokus", icon: Timer },
              { id: "notes", label: "Catatan", icon: StickyNote },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMobileTab(tab.id)}
                className={`min-h-[44px] px-2 py-2 rounded-md border-2 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 ${
                  active
                    ? "bg-[#1E3A5F] text-white border-slate-950"
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-400 dark:border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div>
          {mobileTab === "todo" ? (
            <TodoWidget
              todos={todos}
              todayIso={todayIso}
              activeFocusTitle={activeFocusTitle}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
              onClearDone={clearDoneTodos}
              onSetFocusTask={setActiveFocusTitle}
            />
          ) : null}
          {mobileTab === "calendar" ? (
            <CalendarWidget
              todayIso={todayIso}
              personalEvents={events}
              onAddEvent={addPersonalEvent}
              onDeleteEvent={deletePersonalEvent}
            />
          ) : null}
          {mobileTab === "pomodoro" ? (
            <PomodoroWidget
              focusMinutes={preferences.pomodoro_focus_min}
              shortBreakMinutes={preferences.pomodoro_short_min}
              longBreakMinutes={preferences.pomodoro_long_min}
              soundEnabled={preferences.sound_enabled}
              activeFocusTitle={activeFocusTitle}
              todayFocusCount={todayFocusSessionsCount}
              onRunningChange={setPomodoroRunning}
              onSessionComplete={recordPomodoroSession}
            />
          ) : null}
          {mobileTab === "notes" ? (
            <StickyNotesLayer
              notes={notes}
              mode="grid"
              onAddNote={addStickyNote}
              onUpdateNote={updateStickyNote}
              onDeleteNote={deleteStickyNote}
            />
          ) : null}
        </div>
      </div>

      {/* Modal Buku Jurnal 2 Halaman */}
      <JournalModal
        isOpen={journalOpen}
        onClose={() => setJournalOpen(false)}
        todayIso={todayIso}
        journals={journals}
        streakDays={journalStreakDays}
        onSaveEntry={saveJournalEntry}
      />

      {/* Modal Pengaturan Personal per Akun */}
      <WorkspaceSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onSave={updatePreferences}
        onResetNotePositions={handleResetNotePositions}
      />
    </div>
  );
}
