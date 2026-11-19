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

export type StaffRole = "master_admin" | "staff";

export interface StaffAccount {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SarprasEntityType =
  | "booking"
  | "maintenance"
  | "asset"
  | "room"
  | "consumable"
  | "lecturer"
  | "course"
  | "official";

export type LecturerEmploymentStatus =
  | "Dosen Tetap"
  | "Dosen Tidak Tetap"
  | "Dosen Tamu";

export type LecturerAcademicRank =
  | "-"
  | "Tenaga Pengajar"
  | "Asisten Ahli"
  | "Lektor"
  | "Lektor Kepala"
  | "Guru Besar";

export interface Lecturer {
  id: string;
  nidn_nip: string;
  full_name: string;
  homebase_prodi: string;
  employment_status: LecturerEmploymentStatus;
  academic_rank: LecturerAcademicRank;
  email: string;
  phone: string;
  office_room_id: string | null;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type CourseType =
  | "Wajib Prodi"
  | "Wajib Universitas"
  | "Pilihan"
  | "Praktikum"
  | "Tugas Akhir";

export interface Course {
  id: string;
  code: string;
  name: string;
  prodi: string;
  semester: number;
  curriculum_year: number;
  sks_theory: number;
  sks_practice: number;
  course_type: CourseType;
  lecturer_id: string | null;
  preferred_room_id: string | null;
  is_active: boolean;
  description?: string;
  created_at: string;
}

export type CampusOfficialCategory =
  | "Pimpinan Kampus"
  | "Dekanat & Prodi"
  | "Biro & Unit Administrasi"
  | "Koordinator Sarpras & Lab";

export interface CampusOfficial {
  id: string;
  official_code: string;
  full_name: string;
  position_title: string;
  unit_name: string;
  category: CampusOfficialCategory;
  email: string;
  phone: string;
  period_label: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface SarprasNote {
  id: string;
  entity_type: SarprasEntityType;
  entity_id: string;
  author_id?: string | null;
  author_name: string;
  note_text: string;
  created_at: string;
}

export interface SarprasAttachment {
  id: string;
  entity_type: SarprasEntityType;
  entity_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export type UISimulationState = "normal" | "loading" | "empty" | "error";

export type DeleteStrategyMode = "archive" | "cascade";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

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
  deleted_target_label?: string | null;
  return_condition_notes?: string;
  approved_by?: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  ticket_code: string;
  asset_id: string | null;
  room_id: string | null;
  deleted_target_label?: string | null;
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
