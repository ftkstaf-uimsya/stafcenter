"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { getPromptForDate } from "@/lib/workspace/use-workspace";
import { WorkspaceJournalEntry, WorkspaceJournalMood } from "@/types/sarpras";

interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayIso: string;
  journals: WorkspaceJournalEntry[];
  streakDays: number;
  onSaveEntry: (payload: {
    entry_date: string;
    mood: WorkspaceJournalMood;
    prompt_question: string;
    prompt_answer: string;
    content: string;
  }) => Promise<boolean>;
}

const MOOD_CHOICES: Array<{
  id: WorkspaceJournalMood;
  face: string;
  label: string;
}> = [
  { id: "great", face: "^‿^", label: "Sangat Baik" },
  { id: "good", face: "•‿•", label: "Baik" },
  { id: "neutral", face: "•_•", label: "Biasa Saja" },
  { id: "sad", face: "T_T", label: "Lelah / Sedih" },
  { id: "stressed", face: ">_<", label: "Tertekan" },
];

function formatIndonesianDateHeading(dateIso: string): string {
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(parsed)
    .toUpperCase();
}

function shiftIsoDay(dateIso: string, delta: number): string {
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

export function JournalModal({
  isOpen,
  onClose,
  todayIso,
  journals,
  streakDays,
  onSaveEntry,
}: JournalModalProps) {
  const [activeDate, setActiveDate] = useState(todayIso);
  const existingEntry = useMemo(
    () => journals.find((j) => j.entry_date === activeDate) || null,
    [activeDate, journals]
  );

  const prevDateIso = useMemo(() => shiftIsoDay(activeDate, -1), [activeDate]);
  const prevEntry = useMemo(
    () => journals.find((j) => j.entry_date === prevDateIso) || null,
    [journals, prevDateIso]
  );

  const promptQuestion =
    existingEntry?.prompt_question || getPromptForDate(activeDate);

  const [mood, setMood] = useState<WorkspaceJournalMood>(
    existingEntry?.mood || "good"
  );
  const [promptAnswer, setPromptAnswer] = useState(
    existingEntry?.prompt_answer || ""
  );
  const [content, setContent] = useState(existingEntry?.content || "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    if (isOpen) {
      setActiveDate(todayIso);
    }
  }, [isOpen, todayIso]);

  useEffect(() => {
    setMood(existingEntry?.mood || "good");
    setPromptAnswer(existingEntry?.prompt_answer || "");
    setContent(existingEntry?.content || "");
    setSaveState("idle");
  }, [activeDate, existingEntry]);

  const dirty =
    mood !== (existingEntry?.mood || "good") ||
    promptAnswer !== (existingEntry?.prompt_answer || "") ||
    content !== (existingEntry?.content || "");

  // Auto-save terdebounce saat user mengetik
  useEffect(() => {
    if (!isOpen || !dirty) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const ok = await onSaveEntry({
        entry_date: activeDate,
        mood,
        prompt_question: promptQuestion,
        prompt_answer: promptAnswer,
        content,
      });
      setSaveState(ok ? "saved" : "idle");
    }, 650);
    return () => clearTimeout(timer);
  }, [
    activeDate,
    content,
    dirty,
    isOpen,
    mood,
    onSaveEntry,
    promptAnswer,
    promptQuestion,
  ]);

  const handleCloseBook = async () => {
    if (dirty) {
      await onSaveEntry({
        entry_date: activeDate,
        mood,
        prompt_question: promptQuestion,
        prompt_answer: promptAnswer,
        content,
      });
    }
    onClose();
  };

  const dayNumberOfYear = useMemo(() => {
    const d = new Date(`${activeDate}T00:00:00Z`);
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
    return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  }, [activeDate]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void handleCloseBook()}
      title="JURNAL HARIAN STAF (DEAR DIARY)"
      description="Catatan refleksi harian pribadi. Tersimpan otomatis per akun staf."
      maxWidthClass="max-w-4xl"
    >
      <div className="rounded-md border-4 border-[#5C3A21] bg-[#FEF9EC] text-slate-950 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-[#D6B88C]">
          {/* Halaman Kiri: Tanggal, Refleksi, Mood, Riwayat Sebelumnya, Streak */}
          <div className="p-4 sm:p-5 flex flex-col justify-between gap-4 bg-[#FDF4DC]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-[#D6B88C]">
                <button
                  type="button"
                  onClick={() => setActiveDate(shiftIsoDay(activeDate, -1))}
                  aria-label="Halaman hari sebelumnya"
                  className="p-1.5 rounded border border-[#92400E] bg-white hover:bg-amber-100 text-slate-950"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="font-pixel text-xs font-bold text-[#78350F] text-center">
                  {formatIndonesianDateHeading(activeDate)}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDate(shiftIsoDay(activeDate, 1))}
                  disabled={activeDate >= todayIso}
                  aria-label="Halaman hari berikutnya"
                  className="p-1.5 rounded border border-[#92400E] bg-white hover:bg-amber-100 text-slate-950 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="journal-prompt-answer"
                  className="block text-sm font-bold text-slate-950"
                >
                  {promptQuestion}
                </label>
                <input
                  id="journal-prompt-answer"
                  type="text"
                  value={promptAnswer}
                  onChange={(e) => setPromptAnswer(e.target.value)}
                  placeholder="Tulis jawaban singkatmu..."
                  className="w-full px-3 py-2 text-xs rounded border border-[#B45309]/50 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                  PERASAANMU HARI INI?
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {MOOD_CHOICES.map((choice) => {
                    const active = mood === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setMood(choice.id)}
                        title={choice.label}
                        aria-label={`Suasana hati: ${choice.label}`}
                        aria-pressed={active}
                        className={`min-h-[40px] rounded border-2 font-mono text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                          active
                            ? "bg-amber-400 border-slate-950 text-slate-950"
                            : "bg-white border-[#D6B88C] text-slate-800 hover:bg-amber-50"
                        }`}
                      >
                        {choice.face}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#D6B88C]">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1">
                  HALAMAN SEBELUMNYA ({prevDateIso}):
                </p>
                <p className="text-xs italic text-slate-700 line-clamp-3">
                  {prevEntry && (prevEntry.content || prevEntry.prompt_answer)
                    ? prevEntry.content || prevEntry.prompt_answer
                    : "Belum ada catatan pada hari sebelumnya."}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-[#D6B88C] flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-[#92400E]">
                Beruntun: {streakDays} hari
              </span>
              <button
                type="button"
                onClick={() => void handleCloseBook()}
                className="px-3 py-1.5 rounded border-2 border-slate-950 bg-[#B45309] hover:bg-[#92400E] text-white font-pixel text-xs font-bold"
              >
                TUTUP BUKU
              </button>
            </div>
          </div>

          {/* Halaman Kanan: Area Tulis Cerita Harian */}
          <div className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-[#FFFDF7]">
            <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-[#D6B88C]">
              <span className="font-pixel text-xs font-bold text-slate-900">
                {activeDate === todayIso ? "HARI INI" : activeDate}
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-800">
                {saveState === "saving"
                  ? "MENYIMPAN..."
                  : saveState === "saved"
                  ? "TERSIMPAN"
                  : existingEntry
                  ? "TERSIMPAN"
                  : "SIAP MENULIS"}
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={11}
              placeholder="Tulis ceritamu atau catatan kerja hari ini..."
              aria-label="Isi jurnal harian"
              className="w-full flex-1 p-3 text-sm leading-relaxed rounded border border-[#D6B88C] bg-[repeating-linear-gradient(transparent,transparent_27px,#E2E8F0_28px)] text-slate-950 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />

            <p className="text-center font-mono text-[11px] text-slate-600">
              - {dayNumberOfYear} -
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
