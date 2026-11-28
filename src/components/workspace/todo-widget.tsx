"use client";

import React, { useMemo, useState } from "react";
import { Check, DownloadCloud, Plus, Target, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { WorkspaceTodo } from "@/types/sarpras";

interface TodoWidgetProps {
  todos: WorkspaceTodo[];
  todayIso: string;
  activeFocusTitle: string | null;
  onAddTodo: (
    title: string,
    options?: { linkedSource?: string; linkedRefId?: string }
  ) => Promise<void>;
  onToggleTodo: (id: string) => Promise<void>;
  onDeleteTodo: (id: string) => Promise<void>;
  onClearDone: (todayIso: string) => Promise<void>;
  onSetFocusTask: (title: string) => void;
}

function formatDoneTimeWib(iso?: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function TodoWidget({
  todos,
  todayIso,
  activeFocusTitle,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onClearDone,
  onSetFocusTask,
}: TodoWidgetProps) {
  const { officeKitLoans, bookings, maintenanceLogs, thesisWorkflows } =
    useSarpras();
  const [draft, setDraft] = useState("");
  const [showCampusQueue, setShowCampusQueue] = useState(false);

  const todayTodos = useMemo(
    () =>
      todos.filter(
        (t) => !t.is_done || t.todo_date === todayIso
      ),
    [todos, todayIso]
  );

  const pendingTodos = useMemo(
    () => todayTodos.filter((t) => !t.is_done),
    [todayTodos]
  );
  const doneTodos = useMemo(
    () => todayTodos.filter((t) => t.is_done),
    [todayTodos]
  );

  const totalCount = pendingTodos.length + doneTodos.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneTodos.length / totalCount) * 100) : 0;

  // Saran tugas nyata dari antrean operasional StafCenter
  const campusSuggestions = useMemo(() => {
    const existingRefs = new Set(
      todos.map((t) => t.linked_ref_id).filter(Boolean)
    );
    const items: Array<{
      refId: string;
      source: string;
      label: string;
      badge: string;
    }> = [];

    for (const loan of officeKitLoans) {
      if (loan.status === "Dipinjam" && !existingRefs.has(`loan:${loan.id}`)) {
        items.push({
          refId: `loan:${loan.id}`,
          source: "office_loan",
          label: `Follow up kembali alat ${loan.class_code} (${loan.expected_return_time} WIB)`,
          badge: "Sirkulasi",
        });
      }
      if (items.length >= 6) break;
    }

    for (const bk of bookings) {
      if (
        bk.status === "Menunggu Persetujuan" &&
        !existingRefs.has(`booking:${bk.id}`)
      ) {
        items.push({
          refId: `booking:${bk.id}`,
          source: "booking",
          label: `Proses izin pinjam ${bk.booking_code}: ${bk.activity_name}`,
          badge: "Reservasi",
        });
      }
      if (items.length >= 8) break;
    }

    for (const m of maintenanceLogs) {
      if (
        m.status !== "Selesai Diperbaiki" &&
        m.priority === "Tinggi/Darurat" &&
        !existingRefs.has(`maint:${m.id}`)
      ) {
        items.push({
          refId: `maint:${m.id}`,
          source: "maintenance",
          label: `Tangani darurat ${m.ticket_code}: ${m.issue_title}`,
          badge: "Perbaikan",
        });
      }
      if (items.length >= 10) break;
    }

    for (const tw of thesisWorkflows) {
      if (
        tw.schedule_date === todayIso &&
        tw.board_column !== "selesai_arsip" &&
        !existingRefs.has(`ta:${tw.id}`)
      ) {
        items.push({
          refId: `ta:${tw.id}`,
          source: "thesis",
          label: `Siapkan ${tw.stage} ${tw.student_name} (${tw.schedule_start_time || "hari ini"})`,
          badge: "Tugas Akhir",
        });
      }
      if (items.length >= 12) break;
    }

    return items;
  }, [bookings, maintenanceLogs, officeKitLoans, thesisWorkflows, todayIso, todos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await onAddTodo(text);
  };

  return (
    <div className="space-y-3">
      {/* Kartu TUGAS HARI INI */}
      <section
        aria-label="Tugas Hari Ini"
        className="rounded-md border-2 border-slate-900 bg-[#FFFDF7] text-slate-900 pixel-card-shadow overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1E3A5F] text-white border-b-2 border-slate-900">
          <h2 className="font-pixel text-xs font-bold tracking-wide">
            TUGAS HARI INI
          </h2>
          <button
            type="button"
            onClick={() => setShowCampusQueue((prev) => !prev)}
            className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title="Tarik tugas dari antrean aktif StafCenter"
          >
            <DownloadCloud className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Antrean ({campusSuggestions.length})</span>
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Input cepat + tulis tugas lalu Enter */}
          <form onSubmit={handleSubmit} className="flex gap-1.5">
            <label htmlFor="todo-quick-input" className="sr-only">
              Tulis tugas hari ini lalu tekan Enter
            </label>
            <input
              id="todo-quick-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="+ tulis tugas, lalu Enter"
              className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 text-xs rounded border border-slate-400 bg-white text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
            />
            <button
              type="submit"
              aria-label="Tambah tugas"
              className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded border border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          {/* Drawer saran tugas dari StafCenter */}
          {showCampusQueue ? (
            <div className="p-2 rounded border border-slate-300 bg-slate-100 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-700">
                Antrean Operasional Kampus:
              </p>
              {campusSuggestions.length === 0 ? (
                <p className="text-[11px] text-slate-600">
                  Tidak ada antrean mendesak baru yang belum masuk daftar tugas.
                </p>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto" role="list">
                  {campusSuggestions.map((item) => (
                    <li
                      key={item.refId}
                      className="flex items-center justify-between gap-2 text-[11px] bg-white px-2 py-1 rounded border border-slate-300"
                    >
                      <span className="truncate text-slate-900">
                        <strong className="text-[#1E3A5F]">[{item.badge}]</strong>{" "}
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void onAddTodo(item.label, {
                            linkedSource: item.source,
                            linkedRefId: item.refId,
                          })
                        }
                        className="shrink-0 px-2 py-0.5 rounded bg-[#1E3A5F] text-white font-bold hover:bg-[#152943]"
                      >
                        + Ambil
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* Daftar BELUM MULAI */}
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 mb-1">
              BELUM MULAI ({pendingTodos.length})
            </p>
            {pendingTodos.length === 0 ? (
              <p className="text-xs text-slate-600 py-2">
                Semua tugas selesai atau belum ada tugas baru.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5" role="list">
                {pendingTodos.map((todo) => {
                  const isFocused = activeFocusTitle === todo.title;
                  return (
                    <li
                      key={todo.id}
                      className={`flex items-start justify-between gap-2 p-2 rounded border ${
                        isFocused
                          ? "border-amber-700 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => void onToggleTodo(todo.id)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-500 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                        />
                        <span className="text-xs font-medium text-slate-900 break-words">
                          {todo.title}
                        </span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSetFocusTask(todo.title)}
                          aria-label={`Jadikan "${todo.title}" fokus Pomodoro`}
                          title="Fokuskan di Pomodoro"
                          className={`p-1 rounded border text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                            isFocused
                              ? "bg-amber-400 border-slate-900 text-slate-950"
                              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <Target className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteTodo(todo.id)}
                          aria-label={`Hapus tugas "${todo.title}"`}
                          className="p-1 rounded text-slate-600 hover:text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Progress bar */}
          <div className="pt-1 border-t border-slate-200 flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-sm bg-slate-200 border border-slate-400 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-800 shrink-0">
              {doneTodos.length}/{totalCount} beres
            </span>
          </div>
        </div>
      </section>

      {/* Kartu SELESAI HARI INI (hijau kontras tinggi seperti di video) */}
      <section
        aria-label="Selesai Hari Ini"
        className="rounded-md border-2 border-slate-900 bg-[#DCFCE7] text-slate-950 pixel-card-shadow overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#15803D] text-white border-b-2 border-slate-900">
          <h3 className="font-pixel text-[11px] font-bold">
            SELESAI HARI INI ({doneTodos.length})
          </h3>
          {doneTodos.length > 0 ? (
            <button
              type="button"
              onClick={() => void onClearDone(todayIso)}
              className="text-[10px] font-mono font-bold underline hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
            >
              HAPUS SEMUA
            </button>
          ) : null}
        </div>
        <div className="p-2.5">
          {doneTodos.length === 0 ? (
            <p className="text-[11px] text-emerald-950/80">
              Belum ada tugas yang diselesaikan hari ini.
            </p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto" role="list">
              {doneTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-emerald-900/15 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => void onToggleTodo(todo.id)}
                    className="flex items-center gap-1.5 text-left min-w-0 flex-1 text-emerald-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-900 rounded"
                    title="Klik untuk batalkan status selesai"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" aria-hidden="true" />
                    <span className="line-through truncate">{todo.title}</span>
                  </button>
                  <span className="text-[10px] font-mono font-bold text-emerald-900 shrink-0">
                    {formatDoneTimeWib(todo.done_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
