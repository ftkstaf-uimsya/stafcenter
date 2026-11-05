import React from "react";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success:
    "bg-emerald-50 text-emerald-900 border-emerald-700/60 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500/70",
  warning:
    "bg-amber-50 text-amber-900 border-amber-700/60 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-500/70",
  danger:
    "bg-red-50 text-red-900 border-red-700/60 dark:bg-red-950/80 dark:text-red-200 dark:border-red-500/70",
  info:
    "bg-sky-50 text-sky-900 border-sky-700/60 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-500/70",
  neutral:
    "bg-slate-100 text-slate-800 border-slate-500/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-500/70",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded border whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
