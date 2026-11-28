"use client";

import React, { useEffect, useRef, useState } from "react";
import { GripHorizontal, Plus, X } from "lucide-react";
import { WorkspaceNoteColor, WorkspaceStickyNote } from "@/types/sarpras";

const NOTE_PALETTE: Record<
  WorkspaceNoteColor,
  { bg: string; header: string; border: string; label: string }
> = {
  yellow: {
    bg: "bg-[#FEF08A]",
    header: "bg-[#FACC15]",
    border: "border-slate-900",
    label: "Kuning",
  },
  pink: {
    bg: "bg-[#FBCFE8]",
    header: "bg-[#F472B6]",
    border: "border-slate-900",
    label: "Merah Muda",
  },
  mint: {
    bg: "bg-[#BBF7D0]",
    header: "bg-[#4ADE80]",
    border: "border-slate-900",
    label: "Hijau Mint",
  },
  sky: {
    bg: "bg-[#BAE6FD]",
    header: "bg-[#38BDF8]",
    border: "border-slate-900",
    label: "Biru Langit",
  },
};

const COLOR_ORDER: WorkspaceNoteColor[] = ["yellow", "pink", "mint", "sky"];

interface StickyNoteCardProps {
  note: WorkspaceStickyNote;
  floating: boolean;
  onUpdate: (id: string, patch: Partial<WorkspaceStickyNote>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function StickyNoteCard({
  note,
  floating,
  onUpdate,
  onDelete,
}: StickyNoteCardProps) {
  const [content, setContent] = useState(note.content);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  // Debounce penyimpanan isi sticky note
  useEffect(() => {
    if (content === note.content) return;
    const timer = setTimeout(() => {
      void onUpdate(note.id, { content });
    }, 500);
    return () => clearTimeout(timer);
  }, [content, note.content, note.id, onUpdate]);

  const palette = NOTE_PALETTE[note.color_variant] || NOTE_PALETTE.yellow;

  const cycleColor = () => {
    const idx = COLOR_ORDER.indexOf(note.color_variant);
    const next = COLOR_ORDER[(idx + 1) % COLOR_ORDER.length];
    void onUpdate(note.id, { color_variant: next });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!floating) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      origX: dragPos?.x ?? note.pos_x,
      origY: dragPos?.y ?? note.pos_y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    setDragPos({
      x: Math.max(8, Math.min(820, dragStartRef.current.origX + dx)),
      y: Math.max(8, Math.min(360, dragStartRef.current.origY + dy)),
    });
  };

  const handlePointerUp = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (dragPos) {
      void onUpdate(note.id, {
        pos_x: Math.round(dragPos.x),
        pos_y: Math.round(dragPos.y),
      });
    }
  };

  const posX = dragPos?.x ?? note.pos_x;
  const posY = dragPos?.y ?? note.pos_y;

  return (
    <article
      aria-label={`Catatan tempel ${palette.label}`}
      style={
        floating
          ? {
              position: "absolute",
              left: `${posX}px`,
              top: `${posY}px`,
              width: "220px",
              zIndex: 20,
            }
          : undefined
      }
      className={`rounded-sm border-2 ${palette.border} ${palette.bg} text-slate-950 pixel-card-shadow overflow-hidden`}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex items-center justify-between gap-1.5 px-2 py-1 ${palette.header} border-b-2 border-slate-900 ${
          floating ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {floating ? (
            <GripHorizontal className="w-3.5 h-3.5 text-slate-900 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="font-pixel text-[10px] font-bold text-slate-950 truncate">
            {note.title || "CATATAN"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={cycleColor}
            aria-label={`Ganti warna catatan (saat ini ${palette.label})`}
            title="Ganti warna kertas"
            className="w-5 h-5 rounded-sm border border-slate-900 bg-white/80 hover:bg-white text-[9px] font-mono font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            W
          </button>
          <button
            type="button"
            onClick={() => void onDelete(note.id)}
            aria-label="Hapus catatan"
            className="w-5 h-5 inline-flex items-center justify-center rounded-sm hover:bg-slate-950/15 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Tulis pengingat cepat..."
        aria-label="Isi catatan tempel"
        className="w-full p-2 text-xs font-mono leading-snug bg-transparent text-slate-950 placeholder:text-slate-700 resize-none focus:outline-none"
      />
    </article>
  );
}

interface StickyNotesLayerProps {
  notes: WorkspaceStickyNote[];
  mode: "floating" | "grid";
  onAddNote: (content?: string, color?: WorkspaceNoteColor) => Promise<void>;
  onUpdateNote: (
    id: string,
    patch: Partial<WorkspaceStickyNote>
  ) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

export function StickyNotesLayer({
  notes,
  mode,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: StickyNotesLayerProps) {
  if (mode === "floating") {
    return (
      <>
        {notes.map((note) => (
          <StickyNoteCard
            key={note.id}
            note={note}
            floating={true}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />
        ))}
      </>
    );
  }

  return (
    <section aria-label="Daftar Sticky Notes" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-pixel text-xs font-bold text-slate-900 dark:text-slate-100">
          CATATAN TEMPEL ({notes.length})
        </h2>
        <button
          type="button"
          onClick={() => void onAddNote("", "yellow")}
          className="min-h-[40px] px-3 py-1.5 rounded border-2 border-slate-900 bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Catatan</span>
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-400 p-4 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          Belum ada catatan tempel. Tekan &ldquo;Tambah Catatan&rdquo; untuk membuat pengingat cepat.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              floating={false}
              onUpdate={onUpdateNote}
              onDelete={onDeleteNote}
            />
          ))}
        </div>
      )}
    </section>
  );
}
