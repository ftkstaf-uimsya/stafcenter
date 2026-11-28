"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  getHolidayOnDate,
  getNextUpcomingHoliday,
} from "@/lib/workspace/holidays";
import {
  WorkspaceEventCategory,
  WorkspaceEventColorTag,
  WorkspacePersonalEvent,
} from "@/types/sarpras";

interface CalendarWidgetProps {
  todayIso: string;
  personalEvents: WorkspacePersonalEvent[];
  onAddEvent: (payload: {
    title: string;
    event_date: string;
    start_time: string;
    category: WorkspaceEventCategory;
    color_tag: WorkspaceEventColorTag;
  }) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

const MONTH_NAMES_ID = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];

const DAY_HEADERS = ["SN", "SL", "RB", "KM", "JM", "SB", "MG"];

interface MergedAgendaItem {
  id: string;
  time: string;
  title: string;
  sourceLabel: string;
  tone: "amber" | "emerald" | "sky" | "rose";
  deletableEventId?: string;
}

export function CalendarWidget({
  todayIso,
  personalEvents,
  onAddEvent,
  onDeleteEvent,
}: CalendarWidgetProps) {
  const { bookings, officeKitLoans, thesisWorkflows, rooms } = useSarpras();

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewYear, setViewYear] = useState(() => Number(todayIso.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(
    () => Number(todayIso.slice(5, 7)) - 1
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [eventCategory, setEventCategory] =
    useState<WorkspaceEventCategory>("pribadi");

  const roomNameById = useMemo(
    () => new Map(rooms.map((r) => [r.id, r.code])),
    [rooms]
  );

  const upcomingHoliday = useMemo(
    () => getNextUpcomingHoliday(todayIso),
    [todayIso]
  );

  // Hitung tanggal yang punya aktivitas agar muncul titik indikator di grid kalender
  const busyDates = useMemo(() => {
    const map = new Set<string>();
    for (const e of personalEvents) map.add(e.event_date);
    for (const b of bookings) {
      if (b.status !== "Ditolak") map.add(b.booking_date);
    }
    for (const tw of thesisWorkflows) {
      if (tw.schedule_date && tw.board_column !== "selesai_arsip") {
        map.add(tw.schedule_date);
      }
    }
    for (const l of officeKitLoans) {
      if (l.status === "Dipinjam") map.add(todayIso);
    }
    return map;
  }, [bookings, officeKitLoans, personalEvents, thesisWorkflows, todayIso]);

  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    // Konversi Sunday=0..Saturday=6 ke Monday=0..Sunday=6
    const startOffset = (firstDayUtc.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ iso: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      cells.push({ iso, dayNum: d });
    }
    return cells;
  }, [viewMonth, viewYear]);

  const selectedAgenda = useMemo<MergedAgendaItem[]>(() => {
    const items: MergedAgendaItem[] = [];
    const holiday = getHolidayOnDate(selectedDate);
    if (holiday) {
      items.push({
        id: `hol-${holiday.date}`,
        time: "SEHARIAN",
        title: holiday.name,
        sourceLabel: holiday.type === "cuti" ? "CUTI" : "LIBUR",
        tone: "rose",
      });
    }

    for (const b of bookings) {
      if (b.booking_date === selectedDate && b.status !== "Ditolak") {
        const roomCode = b.room_id ? roomNameById.get(b.room_id) : "";
        items.push({
          id: `bk-${b.id}`,
          time: b.start_time,
          title: `${b.activity_name}${roomCode ? ` (${roomCode})` : ""}`,
          sourceLabel: "SAPRAS",
          tone: "sky",
        });
      }
    }

    for (const tw of thesisWorkflows) {
      if (
        tw.schedule_date === selectedDate &&
        tw.board_column !== "selesai_arsip"
      ) {
        const roomCode = tw.room_id ? roomNameById.get(tw.room_id) : "";
        items.push({
          id: `ta-${tw.id}`,
          time: tw.schedule_start_time || "08:00",
          title: `${tw.stage === "proposal" ? "Prop." : "Sidang"} ${
            tw.student_name
          }${roomCode ? ` (${roomCode})` : ""}`,
          sourceLabel: "TA",
          tone: "emerald",
        });
      }
    }

    if (selectedDate === todayIso) {
      for (const l of officeKitLoans) {
        if (l.status === "Dipinjam") {
          items.push({
            id: `loan-${l.id}`,
            time: l.expected_return_time || "12:00",
            title: `Kembali alat ${l.class_code}: ${l.kit_items_label}`,
            sourceLabel: "LOKET",
            tone: "amber",
          });
        }
      }
    }

    for (const ev of personalEvents) {
      if (ev.event_date === selectedDate) {
        items.push({
          id: `ev-${ev.id}`,
          time: ev.start_time,
          title: ev.title,
          sourceLabel: ev.category.toUpperCase(),
          tone: ev.color_tag,
          deletableEventId: ev.id,
        });
      }
    }

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [
    bookings,
    officeKitLoans,
    personalEvents,
    roomNameById,
    selectedDate,
    thesisWorkflows,
    todayIso,
  ]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    const toneByCat: Record<WorkspaceEventCategory, WorkspaceEventColorTag> = {
      pribadi: "amber",
      rapat: "sky",
      kuliah: "emerald",
      deadline: "rose",
      cuti: "rose",
    };
    await onAddEvent({
      title: eventTitle.trim(),
      event_date: selectedDate,
      start_time: eventTime || "09:00",
      category: eventCategory,
      color_tag: toneByCat[eventCategory],
    });
    setEventTitle("");
    setShowAddForm(false);
  };

  const toneBadgeClass: Record<MergedAgendaItem["tone"], string> = {
    amber: "bg-amber-200 text-slate-950 border-amber-700",
    emerald: "bg-emerald-200 text-slate-950 border-emerald-700",
    sky: "bg-sky-200 text-slate-950 border-sky-700",
    rose: "bg-rose-200 text-slate-950 border-rose-700",
  };

  return (
    <section
      aria-label="Kalender dan Agenda Harian"
      className="rounded-md border-2 border-slate-900 bg-[#FFFDF7] text-slate-900 pixel-card-shadow overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1E3A5F] text-white border-b-2 border-slate-900">
        <h2 className="font-pixel text-xs font-bold tracking-wide">KALENDER</h2>
        <button
          type="button"
          onClick={() => {
            setSelectedDate(todayIso);
            setViewYear(Number(todayIso.slice(0, 4)));
            setViewMonth(Number(todayIso.slice(5, 7)) - 1);
          }}
          className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-mono font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          HARI INI
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Kontrol Bulan */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="p-1.5 rounded border border-slate-400 bg-white hover:bg-slate-100 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="font-pixel text-xs font-bold text-slate-950">
            {MONTH_NAMES_ID[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Bulan berikutnya"
            className="p-1.5 rounded border border-slate-400 bg-white hover:bg-slate-100 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Grid Hari */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAY_HEADERS.map((d, idx) => (
            <div
              key={d}
              className={`text-[10px] font-mono font-bold py-0.5 ${
                idx === 6 ? "text-red-700" : "text-slate-700"
              }`}
            >
              {d}
            </div>
          ))}
          {calendarCells.map((cell, idx) => {
            if (!cell.iso || !cell.dayNum) {
              return <div key={`empty-${idx}`} className="h-8" />;
            }
            const holiday = getHolidayOnDate(cell.iso);
            const isSunday = idx % 7 === 6;
            const isSelected = cell.iso === selectedDate;
            const isToday = cell.iso === todayIso;
            const hasEvents = busyDates.has(cell.iso);

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDate(cell.iso!)}
                aria-label={`${cell.iso}${holiday ? ` (${holiday.name})` : ""}`}
                className={`relative h-8 rounded text-xs font-mono font-bold flex flex-col items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                  isSelected
                    ? "bg-[#1E3A5F] text-white border-slate-950"
                    : isToday
                    ? "bg-amber-200 text-slate-950 border-amber-700"
                    : holiday || isSunday
                    ? "bg-rose-50 text-red-800 border-transparent hover:border-red-300"
                    : "bg-white text-slate-900 border-transparent hover:border-slate-300"
                }`}
              >
                <span>{cell.dayNum}</span>
                <span className="flex gap-0.5 h-1">
                  {holiday ? (
                    <span
                      className={`w-1.5 h-1 rounded-full ${
                        holiday.type === "cuti" ? "bg-amber-600" : "bg-red-600"
                      }`}
                    />
                  ) : null}
                  {hasEvents ? (
                    <span
                      className={`w-1.5 h-1 rounded-full ${
                        isSelected ? "bg-amber-300" : "bg-sky-700"
                      }`}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Countdown Hari Libur Nasional */}
        {upcomingHoliday ? (
          <div className="px-2 py-1.5 rounded bg-amber-100 border border-amber-700 text-[10px] font-mono font-bold text-slate-950 flex items-center justify-between gap-2">
            <span className="truncate">
              {upcomingHoliday.holiday.name.toUpperCase()} (
              {upcomingHoliday.holiday.date.slice(5)})
            </span>
            <span className="shrink-0 text-amber-900">
              {upcomingHoliday.daysAway === 0
                ? "HARI INI"
                : `${upcomingHoliday.daysAway} HARI LAGI`}
            </span>
          </div>
        ) : null}

        {/* Panel Agenda Tanggal Terpilih */}
        <div className="pt-2 border-t border-slate-300 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono font-bold text-slate-900">
              AGENDA {selectedDate === todayIso ? "HARI INI" : selectedDate}
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="px-2 py-1 rounded border border-slate-900 bg-amber-300 hover:bg-amber-200 text-slate-950 text-[10px] font-bold inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              <span>Agenda Pribadi</span>
            </button>
          </div>

          {showAddForm ? (
            <form
              onSubmit={handleCreateEvent}
              className="p-2 rounded border border-slate-400 bg-slate-50 space-y-2"
            >
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Nama agenda pribadi..."
                required
                className="w-full px-2 py-1.5 text-xs rounded border border-slate-400 bg-white text-slate-900"
              />
              <div className="flex gap-1.5">
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  aria-label="Jam agenda"
                  className="px-2 py-1 text-xs rounded border border-slate-400 bg-white text-slate-900"
                />
                <select
                  value={eventCategory}
                  onChange={(e) =>
                    setEventCategory(e.target.value as WorkspaceEventCategory)
                  }
                  aria-label="Kategori agenda"
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-400 bg-white text-slate-900"
                >
                  <option value="pribadi">Pribadi</option>
                  <option value="rapat">Rapat</option>
                  <option value="kuliah">Kuliah / Pelatihan</option>
                  <option value="deadline">Deadline</option>
                  <option value="cuti">Cuti / Izin</option>
                </select>
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#152943]"
                >
                  Simpan
                </button>
              </div>
            </form>
          ) : null}

          {selectedAgenda.length === 0 ? (
            <p className="text-xs text-slate-600 py-1">
              Tidak ada agenda kampus maupun pribadi pada tanggal ini.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto" role="list">
              {selectedAgenda.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 text-xs p-1.5 rounded border border-slate-300 bg-white"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-800">
                        {item.time}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border ${toneBadgeClass[item.tone]}`}
                      >
                        {item.sourceLabel}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-900 break-words">
                      {item.title}
                    </p>
                  </div>
                  {item.deletableEventId ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteEvent(item.deletableEventId!)}
                      aria-label={`Hapus agenda ${item.title}`}
                      className="p-1 rounded text-slate-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
