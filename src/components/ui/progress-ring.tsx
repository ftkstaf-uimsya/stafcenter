import React from "react";

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  tone?: "navy" | "emerald" | "amber" | "danger";
}

export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 6,
  tone = "navy",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  const strokeClasses: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
    navy: "stroke-[#1E3A5F] dark:stroke-sky-400",
    emerald: "stroke-emerald-600 dark:stroke-emerald-400",
    amber: "stroke-amber-600 dark:stroke-amber-400",
    danger: "stroke-red-600 dark:stroke-red-400",
  };

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Progres ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={`${strokeClasses[tone]} transition-all duration-150`}
        />
      </svg>
      <span className="absolute text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
        {clamped}%
      </span>
    </div>
  );
}

/**
 * Strip Aktivitas 14 Hari Terakhir berbasis stempel waktu catatan/event nyata.
 */
export function ActivityStrip({
  eventDatesIso,
}: {
  eventDatesIso: string[];
}) {
  const today = new Date();
  const countsByDay = new Map<string, number>();

  for (const iso of eventDatesIso) {
    if (!iso) continue;
    const key = iso.slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
  }

  const days: { dateKey: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ dateKey: key, count: countsByDay.get(key) || 0 });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
        <span className="font-semibold">Aktivitas 14 Hari Terakhir</span>
        <span className="font-mono">{eventDatesIso.length} catatan/kejadian</span>
      </div>
      <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {days.map((d) => (
          <div
            key={d.dateKey}
            title={`${d.dateKey}: ${d.count} aktivitas`}
            className={`h-2.5 rounded-sm ${
              d.count >= 2
                ? "bg-[#1E3A5F] dark:bg-sky-400"
                : d.count === 1
                ? "bg-emerald-600 dark:bg-emerald-400"
                : "bg-slate-200 dark:bg-slate-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
