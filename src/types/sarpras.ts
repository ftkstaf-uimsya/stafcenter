export type RoomCategory =
  | "Ruang Kelas"
  | "Laboratorium"
  | "Aula"
  | "Ruang Staf/Dosen";

export type RoomStatus = "Tersedia" | "Digunakan" | "Perbaikan";

export type AssetCategoryCode = string;

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

export type DamageSeverity = "Rusak Ringan" | "Rusak Berat" | "Hilang";

export type ConsumableUnit = string;

export type ConsumableCategory = string;

export type TransactionType = "Masuk" | "Keluar";

export type StaffRole = "master_admin" | "staff";

export type SarprasPageKey =
  | "dashboard"
  | "sirkulasi-invent"
  | "inventaris"
  | "peminjaman"
  | "pemeliharaan"
  | "bhp"
  | "ta-skripsi-proposal"
  | "ta-skripsi-sidang"
  | "ta-artikel-proposal"
  | "ta-artikel-sidang"
  | "ruangan"
  | "kelas"
  | "dosen"
  | "makul"
  | "pengurus"
  | "unit"
  | "vendor"
  | "referensi";

export interface StaffAccount {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: StaffRole;
  is_active: boolean;
  allowed_pages?: SarprasPageKey[] | null;
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
  | "official"
  | "unit"
  | "vendor"
  | "class"
  | "office_kit"
  | "office_loan"
  | "ta_skripsi_proposal"
  | "ta_skripsi_sidang"
  | "ta_artikel_proposal"
  | "ta_artikel_sidang";

export type ProdiCode =
  | "MPI"
  | "PBA"
  | "TBIG"
  | "TBIN"
  | "TMTK"
  | "TIPA"
  | "PAI";

export type ClassSectionCode = "A" | "B" | "C" | "D";

export interface AcademicClass {
  id: string;
  class_code: string;
  prodi: ProdiCode;
  unit_id?: string | null;
  angkatan_year: string;
  class_section: ClassSectionCode;
  dpm_name: string;
  dpm_phone: string;
  students_count: number;
  default_room_id?: string | null;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type OfficeKitCategory =
  | "Kabel HDMI"
  | "Stop Kontak"
  | "Remote TV"
  | "Kunci & Akses"
  | "Adapter & Converter"
  | "Lainnya";

export type OfficeKitStatus = "Tersedia" | "Dipinjam" | "Perbaikan";

export interface OfficeKitItem {
  id: string;
  kit_code: string;
  name: string;
  category: OfficeKitCategory;
  brand_spec: string;
  storage_tray: string;
  linked_room_id?: string | null;
  procurement_year?: number | null;
  acquisition_cost?: number;
  condition: AssetCondition;
  status: OfficeKitStatus;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type OfficeKitLoanStatus = "Dipinjam" | "Dikembalikan";

export interface OfficeKitLoan {
  id: string;
  loan_code: string;
  class_id?: string | null;
  class_code: string;
  prodi: ProdiCode;
  dpm_name: string;
  borrower_name: string;
  borrower_phone: string;
  room_id?: string | null;
  course_name?: string;
  kit_item_ids: string[];
  kit_items_label: string;
  loan_date: string;
  borrow_time: string;
  expected_return_time: string;
  returned_at?: string | null;
  status: OfficeKitLoanStatus;
  handed_by_staff?: string;
  received_by_staff?: string;
  return_condition_notes?: string;
  created_at: string;
}

export type CampusUnitType =
  | "Fakultas"
  | "Program Studi"
  | "Biro & Unit Kerja"
  | "Ormawa / UKM";

export interface CampusUnit {
  id: string;
  code: string;
  name: string;
  unit_type: CampusUnitType;
  parent_unit_id?: string | null;
  leader_name?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type MaintenanceVendorType = "Teknisi Internal" | "Vendor Eksternal";

export interface MaintenanceVendor {
  id: string;
  vendor_code: string;
  name: string;
  vendor_type: MaintenanceVendorType;
  specialty: string;
  pic_name: string;
  phone: string;
  email?: string;
  address?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  useful_life_years: number;
  is_active: boolean;
  created_at: string;
}

export type FundingSourceType =
  | "Internal Kampus"
  | "Yayasan"
  | "Hibah Pemerintah"
  | "Kerjasama / CSR"
  | "Lainnya";

export interface FundingSource {
  id: string;
  code: string;
  name: string;
  source_type: FundingSourceType;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface ConsumableCategoryMaster {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface ConsumableUnitMaster {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

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
  unit_id?: string | null;
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
  unit_id?: string | null;
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
  unit_id?: string | null;
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
  id?: string;
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
  pic_official_id?: string | null;
  pic_lecturer_id?: string | null;
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
  funding_source_id?: string | null;
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
  unit_id?: string | null;
  class_id?: string | null;
  class_code?: string | null;
  borrower_lecturer_id?: string | null;
  borrower_official_id?: string | null;
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
  approved_by_official_id?: string | null;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  ticket_code: string;
  asset_id: string | null;
  room_id: string | null;
  office_kit_item_id?: string | null;
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
  vendor_id?: string | null;
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
  unit_id?: string | null;
  purpose_notes: string;
  transaction_date: string;
}

export type ThesisTrack = "skripsi" | "artikel_jurnal";

export type ThesisStage = "proposal" | "sidang";

export type ThesisBoardColumn =
  | "berkas_daftar"
  | "bikin_jadwal"
  | "bikin_surat"
  | "selesai_arsip";

export type ThesisLetterStatus =
  | "Belum Dibuat"
  | "Draft"
  | "Siap TTD"
  | "Terbit";

export interface ThesisWorkflow {
  id: string;
  ticket_code: string;
  track: ThesisTrack;
  stage: ThesisStage;
  board_column: ThesisBoardColumn;
  student_name: string;
  student_nim: string;
  student_phone: string;
  prodi: ProdiCode;
  class_id?: string | null;
  class_code?: string | null;
  title: string;
  journal_name?: string | null;
  journal_url?: string | null;
  supervisor_1_id?: string | null;
  supervisor_2_id?: string | null;
  examiner_1_id?: string | null;
  examiner_2_id?: string | null;
  registered_at: string;
  document_notes?: string | null;
  schedule_date?: string | null;
  schedule_start_time?: string | null;
  schedule_end_time?: string | null;
  room_id?: string | null;
  letter_number?: string | null;
  letter_date?: string | null;
  letter_signer_official_id?: string | null;
  letter_status: ThesisLetterStatus;
  archived_at?: string | null;
  archive_notes?: string | null;
  source_workflow_id?: string | null;
  created_by_staff?: string | null;
  created_at: string;
  updated_at?: string;
}

export type WorkspaceRoomTheme = "auto" | "day" | "night";

export type WorkspaceNoteColor = "yellow" | "pink" | "mint" | "sky";

export type WorkspaceJournalMood =
  | "great"
  | "good"
  | "neutral"
  | "sad"
  | "stressed";

export type WorkspaceEventCategory =
  | "pribadi"
  | "rapat"
  | "kuliah"
  | "deadline"
  | "cuti";

export type WorkspaceEventColorTag = "amber" | "emerald" | "sky" | "rose";

export type WorkspacePomodoroMode = "focus" | "short_break" | "long_break";

export interface WorkspacePreferences {
  staff_id: string;
  weather_city: string;
  weather_lat: number;
  weather_lon: number;
  room_theme: WorkspaceRoomTheme;
  reduce_motion: boolean;
  pet_enabled: boolean;
  pet_name: string;
  sound_enabled: boolean;
  pomodoro_focus_min: number;
  pomodoro_short_min: number;
  pomodoro_long_min: number;
  widget_layout: Record<string, { x?: number; y?: number; visible?: boolean }>;
  updated_at?: string;
}

export interface WorkspaceTodo {
  id: string;
  staff_id: string;
  title: string;
  is_done: boolean;
  done_at?: string | null;
  todo_date: string;
  linked_source?: string | null;
  linked_ref_id?: string | null;
  sort_order: number;
  created_at: string;
}

export interface WorkspaceStickyNote {
  id: string;
  staff_id: string;
  title: string;
  content: string;
  color_variant: WorkspaceNoteColor;
  pos_x: number;
  pos_y: number;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WorkspaceJournalEntry {
  id: string;
  staff_id: string;
  entry_date: string;
  mood: WorkspaceJournalMood;
  prompt_question: string;
  prompt_answer: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkspacePersonalEvent {
  id: string;
  staff_id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  category: WorkspaceEventCategory;
  color_tag: WorkspaceEventColorTag;
  notes?: string | null;
  created_at: string;
}

export interface WorkspacePomodoroSession {
  id: string;
  staff_id: string;
  session_date: string;
  mode: WorkspacePomodoroMode;
  duration_minutes: number;
  task_label?: string | null;
  completed_at: string;
}
