import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AssetCategoryCode, Booking } from "@/types/sarpras";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes("your-project") &&
    !supabaseAnonKey.includes("your-")
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategoryCode, string> = {
  ELK: "Elektronik & Visual",
  MBL: "Meubelair & Furnitur",
  KOM: "Komputer & Jaringan",
  AUD: "Audio & Pengeras Suara",
  KLM: "Pendingin Udara",
  LNY: "Fasilitas Lainnya",
};

export function generateInventoryCode(
  category: AssetCategoryCode,
  year: number,
  sequenceNumber: number
): string {
  const paddedSeq = String(sequenceNumber).padStart(4, "0");
  return `INV-${category}-${year}-${paddedSeq}`;
}

export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Memeriksa apakah jadwal peminjaman baru berbenturan pada tanggal dan rentang jam yang sama
 * untuk ruangan atau aset yang sama (mengabaikan tiket berstatus Ditolak atau Selesai / Dikembalikan).
 */
export function findBookingConflict(
  existingBookings: Booking[],
  candidate: {
    id?: string;
    room_id: string | null;
    asset_id: string | null;
    booking_date: string;
    start_time: string;
    end_time: string;
  }
): Booking | null {
  for (const item of existingBookings) {
    if (candidate.id && item.id === candidate.id) continue;
    if (
      item.status === "Ditolak" ||
      item.status === "Selesai / Dikembalikan"
    ) {
      continue;
    }
    if (item.booking_date !== candidate.booking_date) continue;

    const sameRoom =
      Boolean(candidate.room_id) && item.room_id === candidate.room_id;
    const sameAsset =
      Boolean(candidate.asset_id) && item.asset_id === candidate.asset_id;

    if (!sameRoom && !sameAsset) continue;

    // Rentang jam bertabrakan jika startA < endB dan endA > startB
    if (
      candidate.start_time < item.end_time &&
      candidate.end_time > item.start_time
    ) {
      return item;
    }
  }
  return null;
}
