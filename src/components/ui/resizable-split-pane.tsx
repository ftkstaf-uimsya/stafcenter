"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

interface SplitPreset {
  id: string;
  label: string;
  percent: number;
}

const DEFAULT_PRESETS: SplitPreset[] = [
  { id: "focus-form", label: "Fokus Form", percent: 55 },
  { id: "balanced", label: "Seimbang", percent: 42 },
  { id: "focus-queue", label: "Fokus Antrean", percent: 33 },
];

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftVisibleOnMobile: boolean;
  rightVisibleOnMobile: boolean;
  storageKey?: string;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  toolbarLeft?: React.ReactNode;
}

/**
 * Responsive 2-column desktop split container with drag-and-drop resizing,
 * width presets, keyboard navigation, double-click reset, and localStorage persistence.
 * Below 1024px it delegates visibility cleanly to parent tab controls at 100% width.
 */
export function ResizableSplitPane({
  left,
  right,
  leftVisibleOnMobile,
  rightVisibleOnMobile,
  storageKey = "stafcenter_pinjam_cepat_split_v1",
  defaultLeftPercent = 42,
  minLeftPercent = 30,
  maxLeftPercent = 65,
  toolbarLeft,
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestPercentRef = useRef<number>(defaultLeftPercent);
  const dragStartRef = useRef<{
    clientX: number;
    startPercent: number;
    moved: boolean;
  } | null>(null);
  const [leftPercent, setLeftPercent] = useState<number>(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);

  const clampPercent = useCallback(
    (val: number) =>
      Math.min(maxLeftPercent, Math.max(minLeftPercent, Math.round(val * 10) / 10)),
    [maxLeftPercent, minLeftPercent]
  );

  // Hydrate saved split ratio on mount without SSR mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        const clamped = clampPercent(parsed);
        latestPercentRef.current = clamped;
        setLeftPercent(clamped);
      }
    } catch {
      // Abaikan bila localStorage tidak tersedia
    }
  }, [clampPercent, storageKey]);

  const persistPercent = useCallback(
    (nextVal: number) => {
      const clamped = clampPercent(nextVal);
      latestPercentRef.current = clamped;
      setLeftPercent(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // Abaikan bila quota penuh
      }
    },
    [clampPercent, storageKey]
  );

  useEffect(() => {
    if (!isDragging) return;
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [isDragging]);

  const updateFromDeltaX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      const drag = dragStartRef.current;
      if (!el || !drag) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaPx = clientX - drag.clientX;
      if (Math.abs(deltaPx) >= 2) {
        drag.moved = true;
      }
      const deltaPct = (deltaPx / rect.width) * 100;
      const clamped = clampPercent(drag.startPercent + deltaPct);
      latestPercentRef.current = clamped;
      setLeftPercent(clamped);
    },
    [clampPercent]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback bila browser menolak capture
    }
    dragStartRef.current = {
      clientX: e.clientX,
      startPercent: leftPercent,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateFromDeltaX(e.clientX);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Abaikan
    }
    const didMove = Boolean(dragStartRef.current?.moved);
    dragStartRef.current = null;
    setIsDragging(false);
    if (didMove) {
      persistPercent(latestPercentRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 2;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      persistPercent(leftPercent - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      persistPercent(leftPercent + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      persistPercent(minLeftPercent);
    } else if (e.key === "End") {
      e.preventDefault();
      persistPercent(maxLeftPercent);
    } else if (e.key === "Enter") {
      e.preventDefault();
      persistPercent(defaultLeftPercent);
    }
  };

  const roundedLeft = Math.round(leftPercent);
  const roundedRight = Math.max(0, 100 - roundedLeft);

  const paneStyle = {
    "--split-left-pct": `${leftPercent}%`,
  } as React.CSSProperties;

  return (
    <div className="space-y-3">
      {/* Bar Preset Lebar Panel Desktop (>= 1024px) */}
      <div
        className={`hidden lg:flex flex-wrap items-center gap-2 ${
          toolbarLeft ? "justify-between" : "justify-end"
        }`}
      >
        {toolbarLeft ? <div>{toolbarLeft}</div> : null}
        <div
          role="group"
          aria-label="Preset proporsi lebar panel"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-1"
        >
          <span className="px-2 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400">
            Lebar ({roundedLeft}%/{roundedRight}%):
          </span>
          {DEFAULT_PRESETS.map((preset) => {
            const active = Math.abs(leftPercent - preset.percent) <= 1;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => persistPercent(preset.percent)}
                className={`min-h-[36px] px-2.5 py-1 rounded text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                  active
                    ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kontainer Split Desktop (lg:flex) & Tab Switcher Mobile/Tablet */}
      <div
        ref={containerRef}
        style={paneStyle}
        className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-0"
      >
        <div
          data-split-pane="left"
          className={`${
            leftVisibleOnMobile ? "block" : "hidden"
          } lg:block w-full lg:w-[var(--split-left-pct)] lg:shrink-0 min-w-0`}
        >
          {left}
        </div>

        {/* Garis Pemisah Drag & Drop (Desktop Only) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ubah lebar panel form dan daftar antrean"
          aria-valuemin={minLeftPercent}
          aria-valuemax={maxLeftPercent}
          aria-valuenow={roundedLeft}
          tabIndex={0}
          title="Tarik untuk mengubah lebar panel, atau klik 2x untuk reset"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onDoubleClick={() => persistPercent(defaultLeftPercent)}
          onKeyDown={handleKeyDown}
          className="hidden lg:flex lg:w-4 lg:shrink-0 self-stretch items-start justify-center pt-20 cursor-col-resize group select-none focus-visible:outline-none"
        >
          <div
            className={`relative w-1 h-full min-h-[320px] rounded-full transition-colors ${
              isDragging
                ? "bg-[#1E3A5F] dark:bg-sky-400"
                : "bg-slate-200 dark:bg-slate-800 group-hover:bg-[#1E3A5F]/60 dark:group-hover:bg-sky-400/60 group-focus-visible:bg-[#1E3A5F] dark:group-focus-visible:bg-sky-400"
            }`}
          >
            <span
              className={`sticky top-1/2 -translate-x-1/2 left-1/2 inline-flex items-center justify-center w-5 h-10 rounded-full border shadow-sm transition-colors ${
                isDragging
                  ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-400 dark:text-slate-950 dark:border-sky-400"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 group-hover:border-[#1E3A5F] group-hover:text-[#1E3A5F] dark:group-hover:border-sky-400 dark:group-hover:text-sky-400"
              }`}
            >
              <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
            </span>

            {isDragging ? (
              <span className="sticky top-1/2 -translate-y-12 -translate-x-1/2 left-1/2 px-2 py-1 rounded text-[11px] font-mono font-bold whitespace-nowrap bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950 shadow-md pointer-events-none">
                {roundedLeft}% / {roundedRight}%
              </span>
            ) : null}
          </div>
        </div>

        <div
          data-split-pane="right"
          className={`${
            rightVisibleOnMobile ? "block" : "hidden"
          } lg:block w-full lg:flex-1 min-w-0`}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
