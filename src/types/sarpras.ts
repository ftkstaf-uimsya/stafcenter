export type RoomCategory =
  | "Ruang Kelas"
  | "Laboratorium"
  | "Aula"
  | "Ruang Staf/Dosen";

export type RoomStatus = "Tersedia" | "Digunakan" | "Perbaikan";

export type AssetCategoryCode = "ELK" | "MBL" | "KOM" | "AUD" | "KLM" | "LNY";

export type AssetCondition =
  | "Baik"
  | "Rusak Ringan"
  | "Rusak Berat"
  | "Hilang";

export type BorrowerRole = "Dosen" | "Staf" | "Mahasiswa/Ormawa";

export type BookingTargetType = "Ruangan" | "Alat" | "Ruangan & Alat";

export type BookingStatus =
  | "Menunggu Persetujuan"
  | "Disetujui"
  | "Sedang Dipinjam"
  | "Selesai / Dikembalikan"
  | "Ditolak";

export type MaintenancePriority = "Rendah" | "Sedang" | "Tinggi/Darurat";

export type MaintenanceStatus =
  | "Dilaporkan"
  | "Dalam Pengerjaan"
  | "Selesai Diperbaiki";

export type DamageSeverity = "Rusak Ringan" | "Rusak Berat";

export type ConsumableUnit = "Pcs" | "Box" | "Rim" | "Botol" | "Pack" | "Roll";

export type ConsumableCategory =
  | "ATK & Kelas"
  | "Cetakan & Kertas"
  | "Tinta & Toner"
  | "Kebersihan & Sanitasi"
  | "Kelistrikan Ringan";

export type TransactionType = "Masuk" | "Keluar";

export type UISimulationState = "normal" | "loading" | "empty" | "error";

export interface Building {
  id: string;
  code: string;
  name: string;
  floors_count: number;
  zone: string;
  description: string;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  building_id: string;
  floor: number;
  category: RoomCategory;
  capacity: number;
  pic_name: string;
  pic_contact: string;
  status: RoomStatus;
  facilities_notes: string;
  created_at: string;
}

export interface Asset {
  id: string;
  inventory_code: string;
  name: string;
  brand_model: string;
  category: AssetCategoryCode;
  category_label: string;
  room_id: string | null;
  procurement_year: number;
  funding_source: string;
  acquisition_cost: number;
  condition: AssetCondition;
  is_portable: boolean;
  serial_number: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  borrower_name: string;
  borrower_role: BorrowerRole;
  borrower_unit: string;
  borrower_phone: string;
  target_type: BookingTargetType;
  room_id: string | null;
  asset_id: string | null;
  activity_name: string;
  attendees_count: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  return_condition_notes?: string;
  approved_by?: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  ticket_code: string;
  asset_id: string | null;
  room_id: string | null;
  reporter_name: string;
  reporter_role: string;
  issue_title: string;
  issue_description: string;
  damage_severity: DamageSeverity;
  priority: MaintenancePriority;
  photo_url?: string;
  status: MaintenanceStatus;
  technician_vendor?: string;
  repair_cost: number;
  reported_at: string;
  completed_at?: string;
  resolution_notes?: string;
}

export interface Consumable {
  id: string;
  code: string;
  name: string;
  category: ConsumableCategory;
  unit: ConsumableUnit;
  current_stock: number;
  min_stock: number;
  storage_location: string;
  last_restocked_at: string;
}

export interface ConsumableTransaction {
  id: string;
  consumable_id: string;
  transaction_type: TransactionType;
  quantity: number;
  actor_name: string;
  actor_unit: string;
  purpose_notes: string;
  transaction_date: string;
}
