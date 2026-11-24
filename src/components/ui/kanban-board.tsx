"use client";

import React, { useState } from "react";
import { GripVertical, MessageSquare, Paperclip, Plus } from "lucide-react";

export interface KanbanColumnDef<T> {
  id: string;
  title: string;
  dotColorClass: string;
  items: T[];
  onQuickAdd?: () => void;
}

export interface KanbanCardRenderProps {
  code: string;
  title: string;
  subtitle?: string;
  description?: string;
  valueBadge?: string;
  priorityBadge?: React.ReactNode;
  thumbnailUrl?: string | null;
  assigneeName?: string;
  progressPercent?: number;
  progressColorClass?: string;
  attachmentsCount?: number;
  notesCount?: number;
  ageLabel?: string;
  footerAction?: React.ReactNode;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumnDef<T>[];
  rowKey: (item: T) => string;
  renderCard?: (item: T) => KanbanCardRenderProps;
  renderCustomCard?: (
    item: T,
    meta: { isSelected: boolean; isDraggable: boolean; onClick: () => void }
  ) => React.ReactNode;
  onCardClick: (item: T) => void;
  activeItemId?: string | null;
  onCardDrop?: (
    item: T,
    sourceColumnId: string,
    targetColumnId: string
  ) => void;
  canDragCard?: (item: T) => boolean;
  columnEmptyMessage?: string;
}

export function KanbanBoard<T>({
  columns,
  rowKey,
  renderCard,
  renderCustomCard,
  onCardClick,
  activeItemId,
  onCardDrop,
  canDragCard,
  columnEmptyMessage = "Tidak ada antrean di tahap ini",
}: KanbanBoardProps<T>) {
  const [draggingMeta, setDraggingMeta] = useState<{
    key: string;
    item: T;
    sourceColumnId: string;
  } | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const dndEnabled = Boolean(onCardDrop);

  return (
    <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
      {columns.map((col) => {
        const isDropTarget =
          dndEnabled &&
          draggingMeta !== null &&
          draggingMeta.sourceColumnId !== col.id &&
          dragOverColumnId === col.id;

        return (
          <section
            key={col.id}
            aria-label={`Kolom ${col.title}`}
            onDragOver={(e) => {
              if (!dndEnabled || !draggingMeta) return;
              if (draggingMeta.sourceColumnId === col.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverColumnId !== col.id) {
                setDragOverColumnId(col.id);
              }
            }}
            onDragLeave={(e) => {
              if (!dndEnabled) return;
              const related = e.relatedTarget as Node | null;
              if (related && e.currentTarget.contains(related)) return;
              if (dragOverColumnId === col.id) {
                setDragOverColumnId(null);
              }
            }}
            onDrop={(e) => {
              if (!dndEnabled || !draggingMeta || !onCardDrop) return;
              e.preventDefault();
              const { item, sourceColumnId } = draggingMeta;
              setDraggingMeta(null);
              setDragOverColumnId(null);
              if (sourceColumnId !== col.id) {
                onCardDrop(item, sourceColumnId, col.id);
              }
            }}
            className={`w-[300px] sm:w-[320px] shrink-0 snap-start rounded-lg border flex flex-col max-h-[72vh] transition-colors ${
              isDropTarget
                ? "border-2 border-dashed border-[#1E3A5F] dark:border-sky-400 bg-sky-50/80 dark:bg-sky-950/40"
                : "border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60"
            }`}
          >
            {/* Header Kolom */}
            <div className="px-3.5 py-3 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-t-lg shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotColorClass}`}
                  aria-hidden="true"
                />
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {col.title}
                </h2>
                <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {col.items.length}
                </span>
              </div>

              {col.onQuickAdd ? (
                <button
                  type="button"
                  onClick={col.onQuickAdd}
                  aria-label={`Tambah item ke ${col.title}`}
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* Daftar Kartu */}
            <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              {col.items.length === 0 ? (
                <div
                  className={`p-6 text-center rounded-md border border-dashed ${
                    isDropTarget
                      ? "border-[#1E3A5F] dark:border-sky-400 bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-300 font-semibold"
                      : "border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <p className="text-xs">
                    {isDropTarget
                      ? `Lepaskan kartu di sini untuk memindahkan ke ${col.title}`
                      : columnEmptyMessage}
                  </p>
                </div>
              ) : (
                col.items.map((item) => {
                  const key = rowKey(item);
                  const isSelected = activeItemId === key;
                  const itemDraggable =
                    dndEnabled && (canDragCard ? canDragCard(item) : true);
                  const isDragging = draggingMeta?.key === key;
                  const cardArticleClass = `rounded-lg border bg-white dark:bg-slate-900 transition-all ${
                    itemDraggable ? "cursor-grab active:cursor-grabbing" : ""
                  } ${isDragging ? "opacity-55 ring-2 ring-[#1E3A5F]/40" : ""} ${
                    isSelected
                      ? "border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 dark:border-sky-400 dark:ring-sky-400/20"
                      : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700"
                  }`;

                  if (renderCustomCard) {
                    return (
                      <article
                        key={key}
                        draggable={itemDraggable}
                        onDragStart={(e) => {
                          if (!itemDraggable) return;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                          setDraggingMeta({ key, item, sourceColumnId: col.id });
                        }}
                        onDragEnd={() => {
                          setDraggingMeta(null);
                          setDragOverColumnId(null);
                        }}
                        className={cardArticleClass}
                      >
                        {renderCustomCard(item, {
                          isSelected,
                          isDraggable: itemDraggable,
                          onClick: () => onCardClick(item),
                        })}
                      </article>
                    );
                  }

                  if (!renderCard) return null;
                  const card = renderCard(item);

                  return (
                    <article
                      key={key}
                      draggable={itemDraggable}
                      onDragStart={(e) => {
                        if (!itemDraggable) return;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", key);
                        setDraggingMeta({ key, item, sourceColumnId: col.id });
                      }}
                      onDragEnd={() => {
                        setDraggingMeta(null);
                        setDragOverColumnId(null);
                      }}
                      className={cardArticleClass}
                    >
                      <button
                        type="button"
                        onClick={() => onCardClick(item)}
                        className="w-full text-left p-3.5 space-y-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 rounded-lg"
                      >
                        {/* Baris Identitas + Nilai + Prioritas */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
                            {itemDraggable ? (
                              <GripVertical
                                className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0"
                                aria-hidden="true"
                              />
                            ) : null}
                            <span>{card.code}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {card.valueBadge ? (
                              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                {card.valueBadge}
                              </span>
                            ) : null}
                            {card.priorityBadge}
                          </div>
                        </div>

                        {/* Judul & Ringkasan */}
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                            {card.title}
                          </h3>
                          {card.subtitle ? (
                            <p className="text-xs font-medium text-[#1E3A5F] dark:text-sky-400 truncate">
                              {card.subtitle}
                            </p>
                          ) : null}
                          {card.description ? (
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                              {card.description}
                            </p>
                          ) : null}
                        </div>

                        {/* Thumbnail Foto (bila ada lampiran gambar) */}
                        {card.thumbnailUrl ? (
                          <div className="rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 h-24">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={card.thumbnailUrl}
                              alt={`Dokumentasi ${card.code}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : null}

                        {/* PIC & Progress Bar */}
                        {card.assigneeName ? (
                          <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                            PIC: <strong>{card.assigneeName}</strong>
                          </p>
                        ) : null}

                        {card.progressPercent !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  card.progressColorClass ||
                                  "bg-[#1E3A5F] dark:bg-sky-400"
                                }`}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, card.progressPercent)
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                              {card.progressPercent}%
                            </span>
                          </div>
                        ) : null}

                        {/* Footer Metrik Mikro */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Paperclip
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                              <span>{card.attachmentsCount ?? 0}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                              <span>{card.notesCount ?? 0}</span>
                            </span>
                          </div>
                          {card.ageLabel ? <span>{card.ageLabel}</span> : null}
                        </div>
                      </button>

                      {card.footerAction ? (
                        <div
                          className="px-3.5 pb-3 pt-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {card.footerAction}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
