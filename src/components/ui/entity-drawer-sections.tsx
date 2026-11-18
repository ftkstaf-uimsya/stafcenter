"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageSquarePlus,
  Trash2,
  Upload,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { SarprasEntityType } from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { ActivityStrip } from "@/components/ui/progress-ring";

interface EntityDrawerSectionsProps {
  entityType: SarprasEntityType;
  entityId: string;
  baseEventDates?: string[];
  allowUpload?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EntityDrawerSections({
  entityType,
  entityId,
  baseEventDates = [],
  allowUpload = true,
}: EntityDrawerSectionsProps) {
  const {
    notes,
    attachments,
    addEntityNote,
    uploadEntityFile,
    deleteEntityAttachment,
  } = useSarpras();

  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);

  const entityNotes = notes.filter(
    (n) => n.entity_type === entityType && n.entity_id === entityId
  );
  const entityAttachments = attachments.filter(
    (a) => a.entity_type === entityType && a.entity_id === entityId
  );

  const allDates = [
    ...baseEventDates,
    ...entityNotes.map((n) => n.created_at),
    ...entityAttachments.map((a) => a.created_at),
  ];

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await addEntityNote(entityType, entityId, noteInput);
      if (res.ok) setNoteInput("");
    } finally {
      setSavingNote(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadEntityFile(entityType, entityId, file);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-5 pt-2 border-t border-slate-200 dark:border-slate-800">
      {/* Strip Aktivitas 14 Hari */}
      <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
        <ActivityStrip eventDatesIso={allDates} />
      </div>

      {/* Dokumen & Foto Lampiran */}
      {allowUpload ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Dokumen & Foto Terkait ({entityAttachments.length})
            </h3>
            <label className="min-h-[36px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer focus-within:ring-2 focus-within:ring-[#1E3A5F]">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{uploading ? "Mengunggah..." : "Unggah Berkas"}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          </div>

          {entityAttachments.length === 0 ? (
            <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-center">
              Belum ada foto kondisi atau dokumen PDF terlampir (maks. 5 MB).
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entityAttachments.map((att) => {
                const isImage = att.mime_type.startsWith("image/");
                return (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 text-xs"
                  >
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-w-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded"
                    >
                      <span className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-[#1E3A5F] dark:text-sky-400 shrink-0">
                        {isImage ? (
                          <ImageIcon className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <FileText className="w-4 h-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {att.file_name}
                        </span>
                        <span className="block text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          {formatBytes(att.file_size_bytes)}
                        </span>
                      </span>
                      <ExternalLink
                        className="w-3 h-3 text-slate-500 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void deleteEntityAttachment(att.id, att.file_path)
                      }
                      aria-label={`Hapus lampiran ${att.file_name}`}
                      className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Catatan Progres Operator / Teknisi */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Catatan Operasional ({entityNotes.length})
        </h3>

        <form onSubmit={handleNoteSubmit} className="flex gap-2">
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Tulis catatan progres atau tindak lanjut..."
            aria-label="Tulis catatan progres"
            className="flex-1 min-h-[44px] px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={savingNote || !noteInput.trim()}
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            <span>{savingNote ? "Menyimpan..." : "Catat"}</span>
          </Button>
        </form>

        {entityNotes.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Belum ada catatan tambahan dari staf atau teknisi.
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {entityNotes.map((note) => (
              <li
                key={note.id}
                className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {note.author_name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {note.created_at.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {note.note_text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
