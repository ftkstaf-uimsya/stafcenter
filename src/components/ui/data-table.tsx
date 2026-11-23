"use client";

import React, { useEffect, useRef } from "react";
import { EmptyStateView } from "@/components/ui/data-states";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (row: T) => void;
  hiddenColumnKeys?: string[];
  activeRowKey?: string | null;
  selectable?: boolean;
  selectedRowKeys?: string[];
  onToggleRowKey?: (key: string) => void;
  onToggleAllVisible?: (visibleKeys: string[], nextChecked: boolean) => void;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
  hiddenColumnKeys = [],
  activeRowKey = null,
  selectable = false,
  selectedRowKeys = [],
  onToggleRowKey,
  onToggleAllVisible,
}: DataTableProps<T>) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const visibleColumns = columns.filter(
    (col) => !hiddenColumnKeys.includes(col.key)
  );
  const visibleKeys = data.map(rowKey);
  const selectedSet = new Set(selectedRowKeys);
  const allVisibleSelected =
    selectable &&
    visibleKeys.length > 0 &&
    visibleKeys.every((k) => selectedSet.has(k));
  const someVisibleSelected =
    selectable &&
    visibleKeys.some((k) => selectedSet.has(k)) &&
    !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  if (data.length === 0) {
    return (
      <EmptyStateView
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90">
            {selectable ? (
              <th scope="col" className="w-11 px-3 py-3 text-center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() =>
                    onToggleAllVisible?.(visibleKeys, !allVisibleSelected)
                  }
                  aria-label="Pilih semua baris yang tampil"
                  className="w-4 h-4 rounded accent-[#1E3A5F] cursor-pointer"
                />
              </th>
            ) : null}
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm text-slate-900 dark:text-slate-100">
          {data.map((row) => {
            const key = rowKey(row);
            const isSelected = activeRowKey === key;
            const isChecked = selectedSet.has(key);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={`transition-colors ${
                  isSelected
                    ? "bg-sky-50/90 dark:bg-sky-950/40"
                    : onRowClick
                    ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/70 focus-visible:outline-none focus-visible:bg-sky-50 dark:focus-visible:bg-slate-800"
                    : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                }`}
              >
                {selectable ? (
                  <td
                    className="w-11 px-3 py-3.5 align-top text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleRowKey?.(key)}
                      aria-label={`Pilih baris ${key}`}
                      className="w-4 h-4 mt-0.5 rounded accent-[#1E3A5F] cursor-pointer"
                    />
                  </td>
                ) : null}
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 align-top ${col.className || ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
