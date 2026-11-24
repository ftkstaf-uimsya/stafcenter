"use client";

import React from "react";
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/sarpras/status-badges";
import { isBookingOverdueDay } from "@/lib/sarpras/sirkulasi-utils";
import { Asset, Booking, Room } from "@/types/sarpras";

interface BookingQuickRowProps {
  booking: Booking;
  room?: Room;
  asset?: Asset;
  photoCount?: number;
  todayWibIso: string;
  isSelected?: boolean;
  onOpenDetail: () => void;
  onApprove: () => void;
  onReject: () => void;
  onHandover: () => void;
  onOpenReturnModal: () => void;
  onDelete: () => void;
}

/**
 * Horizontal compact strip row for the Pinjam Cepat facility booking panels.
 */
export function BookingQuickRow({
  booking,
  room,
  asset,
  photoCount = 0,
  todayWibIso,
  isSelected = false,
  onOpenDetail,
  onApprove,
  onReject,
  onHandover,
  onOpenReturnModal,
  onDelete,
}: BookingQuickRowProps) {
  const overdueDay = isBookingOverdueDay(booking, todayWibIso);

  const facilityLabel =
    [
      room ? `Ruang ${room.code}` : "",
      asset ? `${asset.inventory_code} (${asset.name})` : "",
    ]
      .filter(Boolean)
      .join(" + ") ||
    booking.deleted_target_label ||
    booking.target_type;

  return (
    <li
      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
        isSelected
          ? "bg-sky-50/90 dark:bg-sky-950/40"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex-1 min-w-0 text-left rounded-md p-1 -m-1 space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <BookingStatusBadge status={booking.status} />
          <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
            {facilityLabel}
          </span>
          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {booking.booking_date} • {booking.start_time}-{booking.end_time}
          </span>
          {overdueDay ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold rounded border border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Lewat hari</span>
            </span>
          ) : null}
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              <Camera className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{photoCount}</span>
            </span>
          ) : null}
        </div>

        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {booking.activity_name}
        </p>

        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
          {booking.borrower_name} • {booking.borrower_unit}
        </p>
      </button>

      <div
        className="flex flex-wrap items-center gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {booking.status === "Menunggu Persetujuan" ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onApprove}
              aria-label={`Setujui ${booking.booking_code}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Setujui</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReject}
              aria-label={`Tolak ${booking.booking_code}`}
            >
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tolak</span>
            </Button>
          </>
        ) : null}

        {booking.status === "Disetujui" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onHandover}
            aria-label={`Serah Terima ${booking.booking_code}`}
          >
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Serah Terima</span>
          </Button>
        ) : null}

        {booking.status === "Sedang Dipinjam" ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenReturnModal}
            aria-label={`Kembalikan ${booking.booking_code}`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Kembalikan</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={onDelete}
          aria-label={`Hapus tiket ${booking.booking_code}`}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
