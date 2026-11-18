"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerBadge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  headerBadge,
  children,
  footer,
  widthClass = "max-w-xl",
}: DrawerProps) {
  const titleId = React.useId();
  const subtitleId = React.useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Over Panel */}
      <div
        className={`relative z-10 w-full ${widthClass} h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-800 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
          <div className="min-w-0 space-y-1">
            {headerBadge ? (
              <div className="flex flex-wrap items-center gap-2">
                {headerBadge}
              </div>
            ) : null}
            <h2
              id={titleId}
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug break-words"
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                id={subtitleId}
                className="text-xs text-slate-600 dark:text-slate-400"
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel detail"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {footer ? (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
