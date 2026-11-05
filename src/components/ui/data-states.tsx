import React from "react";
import { AlertTriangle, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingStateView({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-10 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
    >
      <Loader2
        className="w-8 h-8 text-[#1E3A5F] dark:text-sky-400 animate-spin mb-3"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {message}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Sedang menyinkronkan data sarana prasarana kampus...
      </p>
    </div>
  );
}

export function ErrorStateView({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40"
    >
      <AlertTriangle
        className="w-8 h-8 text-red-700 dark:text-red-400 mb-3"
        aria-hidden="true"
      />
      <h3 className="text-base font-bold text-red-900 dark:text-red-200">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs text-red-800 dark:text-red-300">
        {description}
      </p>
      <div className="mt-4">
        <Button variant="danger" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Muat Ulang Data Operasional
        </Button>
      </div>
    </div>
  );
}

export function EmptyStateView({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-lg border border-dashed border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-900">
      <FolderOpen
        className="w-8 h-8 text-slate-600 dark:text-slate-400 mb-3"
        aria-hidden="true"
      />
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
