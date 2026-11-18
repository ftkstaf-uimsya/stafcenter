"use client";

import React, { useEffect, useRef, useState } from "react";
import { Columns3, Filter, RotateCcw } from "lucide-react";

export interface FilterGroupOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: FilterGroupOption[];
}

interface FilterPopoverProps {
  groups: FilterGroup[];
  activeCount: number;
  onResetAll: () => void;
  title?: string;
}

export function FilterPopover({
  groups,
  activeCount,
  onResetAll,
  title = "Filter Data",
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-md border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
          activeCount > 0
            ? "border-[#1E3A5F] bg-[#1E3A5F]/10 text-[#1E3A5F] dark:border-sky-400 dark:bg-sky-950/60 dark:text-sky-300"
            : "border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
        }`}
      >
        <Filter className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Filter</span>
        {activeCount > 0 ? (
          <span className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="region"
          aria-label={title}
          className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 sm:w-80 z-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <button
              type="button"
              onClick={() => {
                onResetAll();
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-1.5 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.options.map((opt) => {
                    const checked = group.value === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                          checked
                            ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-950 dark:text-white"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`filter-${group.key}`}
                          checked={checked}
                          onChange={() => group.onChange(opt.value)}
                          className="w-4 h-4 text-[#1E3A5F] focus:ring-[#1E3A5F] border-slate-400"
                        />
                        <span className="truncate">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[40px] px-4 py-1.5 rounded-md bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-sky-400 dark:hover:bg-sky-300 text-xs font-bold text-white dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ColumnsTogglePopoverProps {
  columns: { key: string; label: string }[];
  hiddenKeys: string[];
  onToggleKey: (key: string) => void;
}

export function ColumnsTogglePopover({
  columns,
  hiddenKeys,
  onToggleKey,
}: ColumnsTogglePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
      >
        <Columns3 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Kolom</span>
      </button>

      {open ? (
        <div
          role="region"
          aria-label="Atur visibilitas kolom tabel"
          className="absolute right-0 mt-2 w-60 z-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2"
        >
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
            Tampilkan Kolom Tabel
          </p>
          <div className="space-y-1">
            {columns.map((col) => {
              const visible = !hiddenKeys.includes(col.key);
              return (
                <label
                  key={col.key}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggleKey(col.key)}
                    className="w-4 h-4 rounded border-slate-400 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
