"use client";

import { useEffect, useState } from "react";
import { Booking, BookingStatus, OfficeKitLoan } from "@/types/sarpras";

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the current operational reference date (YYYY-MM-DD) in Asia/Jakarta (WIB).
 */
export function getTodayWibIso(): string {
  return WIB_DATE_FORMATTER.format(new Date());
}

/**
 * Converts an ISO timestamp or date string into its YYYY-MM-DD representation in WIB.
 */
export function toWibDateIso(isoTimestamp?: string | null): string | null {
  if (!isoTimestamp) return null;
  const trimmed = isoTimestamp.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return WIB_DATE_FORMATTER.format(parsed);
}

/**
 * Daily desk visibility rule:
 * - "Dipinjam" tickets always stay visible regardless of date until returned.
 * - "Dikembalikan" tickets remain visible only on the WIB calendar day they were returned.
 */
export function isLoanVisibleOnDailyDesk(
  loan: OfficeKitLoan,
  todayWibIso: string
): boolean {
  if (loan.status === "Dipinjam") {
    return true;
  }
  const returnDayIso = toWibDateIso(loan.returned_at) || loan.loan_date;
  return returnDayIso === todayWibIso;
}

/**
 * Flags unreturned loans whose borrow date is earlier than today (WIB).
 */
export function isLoanOverdueDay(
  loan: OfficeKitLoan,
  todayWibIso: string
): boolean {
  return (
    loan.status === "Dipinjam" &&
    Boolean(loan.loan_date) &&
    loan.loan_date < todayWibIso
  );
}

/**
 * Returns true if a facility booking has reached a finished terminal status.
 */
export function isBookingFinishedStatus(status: BookingStatus): boolean {
  return status === "Selesai / Dikembalikan" || status === "Ditolak";
}

/**
 * Quick desk daily rollover rule for facility bookings:
 * - Active bookings ("Menunggu Persetujuan", "Disetujui", "Sedang Dipinjam") always stay visible.
 * - Finished bookings ("Selesai / Dikembalikan", "Ditolak") appear on the quick desk only for today (WIB)
 *   or when transitioned during the current desk shift.
 */
export function isBookingVisibleOnQuickDesk(
  booking: Booking,
  todayWibIso: string,
  recentlyFinishedIds?: Set<string>
): boolean {
  if (!isBookingFinishedStatus(booking.status)) {
    return true;
  }
  if (recentlyFinishedIds?.has(booking.id)) {
    return true;
  }
  const createdDayIso = toWibDateIso(booking.created_at);
  return booking.booking_date === todayWibIso || createdDayIso === todayWibIso;
}

/**
 * Flags unfinished facility bookings whose booking date is earlier than today (WIB).
 */
export function isBookingOverdueDay(
  booking: Booking,
  todayWibIso: string
): boolean {
  return (
    !isBookingFinishedStatus(booking.status) &&
    Boolean(booking.booking_date) &&
    booking.booking_date < todayWibIso
  );
}

/**
 * Splits a comma-separated kit_items_label into individual trimmed item labels.
 */
export function splitLoanKitLabels(label: string): string[] {
  return label
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Tracks the current operational WIB date and checks every 60 seconds so an open
 * loket tab rolls over automatically at 00:00 WIB without requiring a manual reload.
 */
export function useTodayWibIso(): string {
  const [todayIso, setTodayIso] = useState(() => getTodayWibIso());

  useEffect(() => {
    setTodayIso(getTodayWibIso());

    const timer = window.setInterval(() => {
      const next = getTodayWibIso();
      setTodayIso((prev) => (prev === next ? prev : next));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  return todayIso;
}
