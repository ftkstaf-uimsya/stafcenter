"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AcademicClass,
  ActionResult,
  Asset,
  AssetCategory,
  AssetCategoryCode,
  Booking,
  BookingStatus,
  Building,
  CampusOfficial,
  CampusUnit,
  ClassSectionCode,
  Consumable,
  ConsumableCategoryMaster,
  ConsumableTransaction,
  ConsumableUnitMaster,
  Course,
  DeleteStrategyMode,
  FundingSource,
  Lecturer,
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceVendor,
  OfficeKitItem,
  OfficeKitLoan,
  ProdiCode,
  Room,
  SarprasAttachment,
  SarprasEntityType,
  SarprasNote,
  SarprasPageKey,
  StaffRole,
  ThesisBoardColumn,
  ThesisStage,
  ThesisTrack,
  ThesisWorkflow,
  UISimulationState,
} from "@/types/sarpras";
import {
  canAccessPage as canAccessPageHelper,
  DATA_MASTER_PAGE_KEYS,
  ENTITY_TYPE_TO_PAGE_KEY,
  getFirstAllowedHref,
  getPageMeta,
  getThesisEntityType,
  getThesisPageKey,
} from "@/lib/auth/permissions";
import {
  findBookingConflict,
  generateInventoryCode,
  generateUuid,
  isSupabaseConfigured,
  normalizeTimeHHMM,
  resolveAssetCategoryLabel,
} from "@/lib/supabase/client";
import {
  NormalizedImportAssetPayload,
  normalizeSerialKey,
} from "@/lib/sarpras/asset-import-shared";
import {
  INITIAL_ACADEMIC_CLASSES,
  INITIAL_ASSETS,
  INITIAL_ASSET_CATEGORIES,
  INITIAL_BOOKINGS,
  INITIAL_BUILDINGS,
  INITIAL_CAMPUS_OFFICIALS,
  INITIAL_CAMPUS_UNITS,
  INITIAL_CONSUMABLES,
  INITIAL_CONSUMABLE_CATEGORIES,
  INITIAL_CONSUMABLE_TRANSACTIONS,
  INITIAL_CONSUMABLE_UNITS,
  INITIAL_COURSES,
  INITIAL_FUNDING_SOURCES,
  INITIAL_LECTURERS,
  INITIAL_MAINTENANCE_LOGS,
  INITIAL_MAINTENANCE_VENDORS,
  INITIAL_OFFICE_KIT_ITEMS,
  INITIAL_OFFICE_KIT_LOANS,
  INITIAL_ROOMS,
  INITIAL_THESIS_WORKFLOWS,
  TODAY_ISO,
} from "@/lib/supabase/seed-data";

const STORAGE_KEY = "stafcenter_sarpras_v2";
const THEME_KEY = "stafcenter_theme_v1";

export function normalizeAngkatanYear(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 4) return digits.slice(-2);
  if (digits.length === 1) return `0${digits}`;
  return digits.slice(-2);
}

export function buildAcademicClassCode(
  prodi: ProdiCode,
  angkatanYear: string,
  section: ClassSectionCode
): string {
  const yr = normalizeAngkatanYear(angkatanYear);
  return `${prodi}-${yr}${section}`;
}

export interface AuthStaffUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
  allowedPages?: SarprasPageKey[];
}

export interface ToastNotice {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

interface SarprasContextValue {
  buildings: Building[];
  rooms: Room[];
  assets: Asset[];
  bookings: Booking[];
  maintenanceLogs: MaintenanceLog[];
  consumables: Consumable[];
  consumableTransactions: ConsumableTransaction[];
  notes: SarprasNote[];
  attachments: SarprasAttachment[];
  lecturers: Lecturer[];
  courses: Course[];
  campusOfficials: CampusOfficial[];
  campusUnits: CampusUnit[];
  maintenanceVendors: MaintenanceVendor[];
  assetCategories: AssetCategory[];
  fundingSources: FundingSource[];
  consumableCategories: ConsumableCategoryMaster[];
  consumableUnits: ConsumableUnitMaster[];
  academicClasses: AcademicClass[];
  officeKitItems: OfficeKitItem[];
  officeKitLoans: OfficeKitLoan[];
  thesisWorkflows: ThesisWorkflow[];
  thesisWorkflowsAvailable: boolean;
  extendedMasterReady: boolean;
  canManageDataMaster: boolean;
  canAccessPage: (pageKey: SarprasPageKey | "akun") => boolean;
  defaultHomeHref: string;
  isLiveSupabase: boolean;
  serverConfigured: boolean;
  authUser: AuthStaffUser | null;
  authLoading: boolean;
  isSyncingDb: boolean;
  uiSimState: UISimulationState;
  setUiSimState: (state: UISimulationState) => void;
  commandSearchOpen: boolean;
  setCommandSearchOpen: (open: boolean) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  notify: (type: ToastNotice["type"], title: string, message: string) => void;
  resetToSeedData: () => void;
  refreshFromSupabase: () => Promise<void>;

  // Autentikasi Staf (Master Admin & Staf via Server Session)
  signInWithUsername: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; defaultHref?: string }>;
  signOut: () => Promise<void>;

  // Gedung & Ruangan CRUD
  addBuilding: (payload: Omit<Building, "id" | "created_at">) => void;
  updateBuilding: (
    id: string,
    payload: Partial<Omit<Building, "id" | "created_at">>
  ) => void;
  deleteBuilding: (id: string) => Promise<ActionResult>;
  addRoom: (payload: Omit<Room, "id" | "created_at">) => void;
  updateRoom: (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => void;
  deleteRoom: (
    id: string,
    options?: { mode?: DeleteStrategyMode; forceActive?: boolean }
  ) => Promise<ActionResult>;

  // Inventaris Aset CRUD
  addAsset: (
    payload: Omit<
      Asset,
      "id" | "inventory_code" | "category_label" | "created_at"
    >
  ) => Asset;
  importAssets: (items: NormalizedImportAssetPayload[]) => Promise<ActionResult>;
  updateAsset: (
    id: string,
    payload: Partial<Omit<Asset, "id" | "created_at">>
  ) => void;
  deleteAsset: (
    id: string,
    options?: { mode?: DeleteStrategyMode; forceActive?: boolean }
  ) => Promise<ActionResult>;
  previewNextInventoryCode: (category: AssetCategoryCode, year: number) => string;

  // Peminjaman & Reservasi
  addBooking: (
    payload: Omit<Booking, "id" | "booking_code" | "status" | "created_at">
  ) => ActionResult;
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    returnNotes?: string,
    approvedBy?: string,
    approvedByOfficialId?: string | null
  ) => void;
  deleteBooking: (id: string) => Promise<ActionResult>;

  // Pemeliharaan & Laporan Kerusakan
  addMaintenanceLog: (
    payload: Omit<
      MaintenanceLog,
      "id" | "ticket_code" | "status" | "reported_at"
    >
  ) => MaintenanceLog;
  updateMaintenanceStatus: (
    id: string,
    update: {
      status: MaintenanceStatus;
      technician_vendor?: string;
      vendor_id?: string | null;
      repair_cost?: number;
      resolution_notes?: string;
    }
  ) => void;
  deleteMaintenanceLog: (id: string) => Promise<ActionResult>;

  // Barang Habis Pakai (BHP)
  addConsumable: (
    payload: Omit<Consumable, "id" | "last_restocked_at">
  ) => void;
  updateConsumable: (
    id: string,
    payload: Partial<Omit<Consumable, "id" | "last_restocked_at">>
  ) => void;
  deleteConsumable: (id: string) => Promise<ActionResult>;
  recordConsumableMutation: (
    payload: Omit<ConsumableTransaction, "id" | "transaction_date">
  ) => ActionResult;

  // Catatan Aktivitas & Lampiran Berkas (Drawer & Storage)
  addEntityNote: (
    entityType: SarprasEntityType,
    entityId: string,
    noteText: string
  ) => Promise<{ ok: boolean; error?: string }>;
  uploadEntityFile: (
    entityType: SarprasEntityType,
    entityId: string,
    file: File
  ) => Promise<{ ok: boolean; attachment?: SarprasAttachment; error?: string }>;
  deleteEntityAttachment: (
    id: string,
    filePath?: string
  ) => Promise<void>;

  // Data Master: Dosen, Mata Kuliah (Makul), dan Pengurus Kampus (Khusus Master Admin)
  addLecturer: (payload: Omit<Lecturer, "id" | "created_at">) => void;
  updateLecturer: (
    id: string,
    payload: Partial<Omit<Lecturer, "id" | "created_at">>
  ) => void;
  deleteLecturer: (id: string) => Promise<ActionResult>;
  addCourse: (payload: Omit<Course, "id" | "created_at">) => void;
  updateCourse: (
    id: string,
    payload: Partial<Omit<Course, "id" | "created_at">>
  ) => void;
  deleteCourse: (id: string) => Promise<ActionResult>;
  addCampusOfficial: (
    payload: Omit<CampusOfficial, "id" | "created_at">
  ) => void;
  updateCampusOfficial: (
    id: string,
    payload: Partial<Omit<CampusOfficial, "id" | "created_at">>
  ) => void;
  deleteCampusOfficial: (id: string) => Promise<ActionResult>;

  // Data Master Prioritas 1: Unit/Prodi/Ormawa, Teknisi & Vendor, dan Referensi (Khusus Master Admin)
  addCampusUnit: (payload: Omit<CampusUnit, "id" | "created_at">) => void;
  updateCampusUnit: (
    id: string,
    payload: Partial<Omit<CampusUnit, "id" | "created_at">>
  ) => void;
  deleteCampusUnit: (id: string) => Promise<ActionResult>;
  addMaintenanceVendor: (
    payload: Omit<MaintenanceVendor, "id" | "created_at">
  ) => void;
  updateMaintenanceVendor: (
    id: string,
    payload: Partial<Omit<MaintenanceVendor, "id" | "created_at">>
  ) => void;
  deleteMaintenanceVendor: (id: string) => Promise<ActionResult>;
  addAssetCategory: (payload: Omit<AssetCategory, "id" | "created_at">) => void;
  updateAssetCategory: (
    id: string,
    payload: Partial<Omit<AssetCategory, "id" | "created_at">>
  ) => void;
  deleteAssetCategory: (id: string) => Promise<ActionResult>;
  addFundingSource: (payload: Omit<FundingSource, "id" | "created_at">) => void;
  updateFundingSource: (
    id: string,
    payload: Partial<Omit<FundingSource, "id" | "created_at">>
  ) => void;
  deleteFundingSource: (id: string) => Promise<ActionResult>;
  addConsumableCategory: (
    payload: Omit<ConsumableCategoryMaster, "id" | "created_at">
  ) => void;
  updateConsumableCategory: (
    id: string,
    payload: Partial<Omit<ConsumableCategoryMaster, "id" | "created_at">>
  ) => void;
  deleteConsumableCategory: (id: string) => Promise<ActionResult>;
  addConsumableUnit: (
    payload: Omit<ConsumableUnitMaster, "id" | "created_at">
  ) => void;
  updateConsumableUnit: (
    id: string,
    payload: Partial<Omit<ConsumableUnitMaster, "id" | "created_at">>
  ) => void;
  deleteConsumableUnit: (id: string) => Promise<ActionResult>;

  // Data Master Kelas & DPM (Khusus Master Admin)
  addAcademicClass: (
    payload: Omit<AcademicClass, "id" | "class_code" | "created_at">
  ) => ActionResult;
  updateAcademicClass: (
    id: string,
    payload: Partial<Omit<AcademicClass, "id" | "class_code" | "created_at">>
  ) => ActionResult;
  deleteAcademicClass: (id: string) => Promise<ActionResult>;

  // Sirkulasi Invent: Barang Kantor Staf & Peminjaman Cepat Kelas
  addOfficeKitItem: (
    payload: Omit<OfficeKitItem, "id" | "created_at">
  ) => ActionResult;
  updateOfficeKitItem: (
    id: string,
    payload: Partial<Omit<OfficeKitItem, "id" | "created_at">>
  ) => void;
  deleteOfficeKitItem: (id: string) => Promise<ActionResult>;
  checkoutOfficeKitLoan: (payload: {
    class_id?: string | null;
    class_code: string;
    prodi: ProdiCode;
    dpm_name: string;
    borrower_name: string;
    borrower_phone: string;
    room_id?: string | null;
    course_name?: string;
    kit_item_ids: string[];
    loan_date: string;
    borrow_time: string;
    expected_return_time: string;
  }) => ActionResult;
  checkinOfficeKitLoan: (
    id: string,
    options?: {
      returnConditionNotes?: string;
      damagedItemIds?: string[];
    }
  ) => ActionResult;
  reopenOfficeKitLoan: (id: string) => ActionResult;
  deleteOfficeKitLoan: (id: string) => Promise<ActionResult>;

  // Tugas Akhir (Skripsi & Artikel Jurnal - Proposal & Sidang)
  addThesisWorkflow: (
    payload: Omit<ThesisWorkflow, "id" | "ticket_code" | "created_at">
  ) => ActionResult;
  updateThesisWorkflow: (
    id: string,
    patch: Partial<
      Omit<
        ThesisWorkflow,
        "id" | "ticket_code" | "track" | "stage" | "source_workflow_id" | "created_at"
      >
    >
  ) => ActionResult;
  moveThesisWorkflow: (
    id: string,
    targetColumn: ThesisBoardColumn
  ) => ActionResult;
  deleteThesisWorkflow: (id: string) => Promise<ActionResult>;
  copyThesisToSidang: (id: string) => ActionResult;
}

const SarprasContext = createContext<SarprasContextValue | null>(null);

function extractMaxSequence(codes: string[]): number {
  let maxSeq = codes.length;
  for (const code of codes) {
    const parts = code.split("-");
    const last = Number(parts[parts.length - 1]);
    if (!Number.isNaN(last) && last > maxSeq) {
      maxSeq = last;
    }
  }
  return maxSeq;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function getThesisTicketPrefix(track: ThesisTrack, stage: ThesisStage): string {
  if (track === "skripsi") {
    return stage === "proposal" ? "SKP-PRP" : "SKP-SDG";
  }
  return stage === "proposal" ? "ART-PRP" : "ART-SDG";
}

const THESIS_COLUMN_LABELS: Record<ThesisBoardColumn, string> = {
  berkas_daftar: "Berkas Daftar",
  bikin_jadwal: "Bikin Jadwal",
  bikin_surat: "Bikin Surat",
  selesai_arsip: "Selesai / Arsip",
};

export function SarprasProvider({ children }: { children: React.ReactNode }) {
  const isLiveSupabase = isSupabaseConfigured();

  const [buildings, setBuildings] = useState<Building[]>(() =>
    isLiveSupabase ? [] : INITIAL_BUILDINGS
  );
  const [rooms, setRooms] = useState<Room[]>(() =>
    isLiveSupabase ? [] : INITIAL_ROOMS
  );
  const [assets, setAssets] = useState<Asset[]>(() =>
    isLiveSupabase ? [] : INITIAL_ASSETS
  );
  const [bookings, setBookings] = useState<Booking[]>(() =>
    isLiveSupabase ? [] : INITIAL_BOOKINGS
  );
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(
    () => (isLiveSupabase ? [] : INITIAL_MAINTENANCE_LOGS)
  );
  const [consumables, setConsumables] = useState<Consumable[]>(() =>
    isLiveSupabase ? [] : INITIAL_CONSUMABLES
  );
  const [consumableTransactions, setConsumableTransactions] = useState<
    ConsumableTransaction[]
  >(() => (isLiveSupabase ? [] : INITIAL_CONSUMABLE_TRANSACTIONS));
  const [notes, setNotes] = useState<SarprasNote[]>([]);
  const [attachments, setAttachments] = useState<SarprasAttachment[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>(() =>
    isLiveSupabase ? [] : INITIAL_LECTURERS
  );
  const [courses, setCourses] = useState<Course[]>(() =>
    isLiveSupabase ? [] : INITIAL_COURSES
  );
  const [campusOfficials, setCampusOfficials] = useState<CampusOfficial[]>(() =>
    isLiveSupabase ? [] : INITIAL_CAMPUS_OFFICIALS
  );
  const [campusUnits, setCampusUnits] = useState<CampusUnit[]>(() =>
    isLiveSupabase ? [] : INITIAL_CAMPUS_UNITS
  );
  const [maintenanceVendors, setMaintenanceVendors] = useState<
    MaintenanceVendor[]
  >(() => (isLiveSupabase ? [] : INITIAL_MAINTENANCE_VENDORS));
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>(() =>
    isLiveSupabase ? [] : INITIAL_ASSET_CATEGORIES
  );
  const [fundingSources, setFundingSources] = useState<FundingSource[]>(() =>
    isLiveSupabase ? [] : INITIAL_FUNDING_SOURCES
  );
  const [consumableCategories, setConsumableCategories] = useState<
    ConsumableCategoryMaster[]
  >(() => (isLiveSupabase ? [] : INITIAL_CONSUMABLE_CATEGORIES));
  const [consumableUnits, setConsumableUnits] = useState<
    ConsumableUnitMaster[]
  >(() => (isLiveSupabase ? [] : INITIAL_CONSUMABLE_UNITS));
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>(() =>
    isLiveSupabase ? [] : INITIAL_ACADEMIC_CLASSES
  );
  const [officeKitItems, setOfficeKitItems] = useState<OfficeKitItem[]>(() =>
    isLiveSupabase ? [] : INITIAL_OFFICE_KIT_ITEMS
  );
  const [officeKitLoans, setOfficeKitLoans] = useState<OfficeKitLoan[]>(() =>
    isLiveSupabase ? [] : INITIAL_OFFICE_KIT_LOANS
  );
  const [thesisWorkflows, setThesisWorkflows] = useState<ThesisWorkflow[]>(() =>
    isLiveSupabase ? [] : INITIAL_THESIS_WORKFLOWS
  );
  const [thesisWorkflowsAvailable, setThesisWorkflowsAvailable] =
    useState<boolean>(!isLiveSupabase);
  const [extendedMasterReady, setExtendedMasterReady] = useState<boolean>(
    !isLiveSupabase
  );

  const [serverConfigured, setServerConfigured] = useState<boolean>(true);
  const [authUser, setAuthUser] = useState<AuthStaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isLiveSupabase);
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);

  const [uiSimState, setUiSimState] = useState<UISimulationState>("normal");
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const clearOperationalData = useCallback(() => {
    setBuildings([]);
    setRooms([]);
    setAssets([]);
    setBookings([]);
    setMaintenanceLogs([]);
    setConsumables([]);
    setConsumableTransactions([]);
    setNotes([]);
    setAttachments([]);
    setLecturers([]);
    setCourses([]);
    setCampusOfficials([]);
    setCampusUnits([]);
    setMaintenanceVendors([]);
    setAssetCategories([]);
    setFundingSources([]);
    setConsumableCategories([]);
    setConsumableUnits([]);
    setAcademicClasses([]);
    setOfficeKitItems([]);
    setOfficeKitLoans([]);
    setThesisWorkflows([]);
  }, []);

  const notify = useCallback(
    (type: ToastNotice["type"], title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4800);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const refreshFromSupabase = useCallback(async () => {
    if (!isLiveSupabase) return;

    setIsSyncingDb(true);
    try {
      const res = await fetch("/api/sarpras/bootstrap", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setAuthUser(null);
          clearOperationalData();
        }
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.buildings)) setBuildings(data.buildings as Building[]);
      if (Array.isArray(data.rooms)) setRooms(data.rooms as Room[]);
      if (Array.isArray(data.assets)) {
        setAssets(
          (data.assets as Asset[]).map((item) => ({
            ...item,
            acquisition_cost: Number(item.acquisition_cost) || 0,
            procurement_year: Number(item.procurement_year) || 2026,
            is_portable: Boolean(item.is_portable),
            serial_number: item.serial_number || "-",
            notes: item.notes || "",
          }))
        );
      }
      if (Array.isArray(data.bookings)) {
        setBookings(
          (data.bookings as Booking[]).map((item) => ({
            ...item,
            attendees_count: Number(item.attendees_count) || 1,
            start_time: normalizeTimeHHMM(item.start_time),
            end_time: normalizeTimeHHMM(item.end_time),
          }))
        );
      }
      if (Array.isArray(data.maintenanceLogs)) {
        setMaintenanceLogs(
          (data.maintenanceLogs as MaintenanceLog[]).map((item) => ({
            ...item,
            repair_cost: Number(item.repair_cost) || 0,
          }))
        );
      }
      if (Array.isArray(data.consumables)) {
        setConsumables(
          (data.consumables as Consumable[]).map((item) => ({
            ...item,
            current_stock: Number(item.current_stock) || 0,
            min_stock: Number(item.min_stock) || 0,
          }))
        );
      }
      if (Array.isArray(data.consumableTransactions)) {
        setConsumableTransactions(
          (data.consumableTransactions as ConsumableTransaction[]).map(
            (item) => ({
              ...item,
              quantity: Number(item.quantity) || 0,
            })
          )
        );
      }
      if (Array.isArray(data.notes)) {
        setNotes(data.notes as SarprasNote[]);
      }
      if (Array.isArray(data.attachments)) {
        setAttachments(data.attachments as SarprasAttachment[]);
      }
      if (Array.isArray(data.lecturers)) {
        setLecturers(
          (data.lecturers as Lecturer[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            email: item.email || "",
            phone: item.phone || "",
            notes: item.notes || "",
          }))
        );
      }
      if (Array.isArray(data.courses)) {
        setCourses(
          (data.courses as Course[]).map((item) => ({
            ...item,
            semester: Number(item.semester) || 1,
            curriculum_year: Number(item.curriculum_year) || 2024,
            sks_theory: Number(item.sks_theory) || 0,
            sks_practice: Number(item.sks_practice) || 0,
            is_active: item.is_active !== false,
            description: item.description || "",
          }))
        );
      }
      if (Array.isArray(data.campusOfficials)) {
        setCampusOfficials(
          (data.campusOfficials as CampusOfficial[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            email: item.email || "",
            phone: item.phone || "",
            notes: item.notes || "",
          }))
        );
      }

      const hasExtended =
        Array.isArray(data.campusUnits) &&
        Array.isArray(data.maintenanceVendors) &&
        Array.isArray(data.assetCategories) &&
        Array.isArray(data.fundingSources) &&
        Array.isArray(data.consumableCategories) &&
        Array.isArray(data.consumableUnits);
      setExtendedMasterReady(hasExtended);

      if (Array.isArray(data.campusUnits)) {
        setCampusUnits(
          (data.campusUnits as CampusUnit[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            leader_name: item.leader_name || "",
            phone: item.phone || "",
            email: item.email || "",
            notes: item.notes || "",
          }))
        );
      } else {
        setCampusUnits(INITIAL_CAMPUS_UNITS);
      }

      if (Array.isArray(data.maintenanceVendors)) {
        setMaintenanceVendors(
          (data.maintenanceVendors as MaintenanceVendor[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            email: item.email || "",
            address: item.address || "",
            notes: item.notes || "",
          }))
        );
      } else {
        setMaintenanceVendors(INITIAL_MAINTENANCE_VENDORS);
      }

      if (Array.isArray(data.assetCategories)) {
        setAssetCategories(
          (data.assetCategories as AssetCategory[]).map((item) => ({
            ...item,
            useful_life_years: Number(item.useful_life_years) || 5,
            is_active: item.is_active !== false,
            description: item.description || "",
          }))
        );
      } else {
        setAssetCategories(INITIAL_ASSET_CATEGORIES);
      }

      if (Array.isArray(data.fundingSources)) {
        setFundingSources(
          (data.fundingSources as FundingSource[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            notes: item.notes || "",
          }))
        );
      } else {
        setFundingSources(INITIAL_FUNDING_SOURCES);
      }

      if (Array.isArray(data.consumableCategories)) {
        setConsumableCategories(
          (data.consumableCategories as ConsumableCategoryMaster[]).map(
            (item) => ({
              ...item,
              is_active: item.is_active !== false,
              description: item.description || "",
            })
          )
        );
      } else {
        setConsumableCategories(INITIAL_CONSUMABLE_CATEGORIES);
      }

      if (Array.isArray(data.consumableUnits)) {
        setConsumableUnits(
          (data.consumableUnits as ConsumableUnitMaster[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            description: item.description || "",
          }))
        );
      } else {
        setConsumableUnits(INITIAL_CONSUMABLE_UNITS);
      }

      if (Array.isArray(data.academicClasses)) {
        setAcademicClasses(
          (data.academicClasses as AcademicClass[]).map((item) => ({
            ...item,
            students_count: Number(item.students_count) || 30,
            dpm_phone: item.dpm_phone || "-",
            is_active: item.is_active !== false,
            notes: item.notes || "",
          }))
        );
      } else {
        setAcademicClasses(INITIAL_ACADEMIC_CLASSES);
      }

      if (Array.isArray(data.officeKitItems)) {
        setOfficeKitItems(
          (data.officeKitItems as OfficeKitItem[]).map((item) => ({
            ...item,
            is_active: item.is_active !== false,
            notes: item.notes || "",
          }))
        );
      } else {
        setOfficeKitItems(INITIAL_OFFICE_KIT_ITEMS);
      }

      if (Array.isArray(data.officeKitLoans)) {
        setOfficeKitLoans(
          (data.officeKitLoans as OfficeKitLoan[]).map((item) => ({
            ...item,
            kit_item_ids: Array.isArray(item.kit_item_ids)
              ? item.kit_item_ids
              : [],
            borrow_time: normalizeTimeHHMM(item.borrow_time),
            expected_return_time: normalizeTimeHHMM(item.expected_return_time),
            return_condition_notes: item.return_condition_notes || "",
          }))
        );
      } else {
        setOfficeKitLoans(INITIAL_OFFICE_KIT_LOANS);
      }

      if (Array.isArray(data.thesisWorkflows)) {
        setThesisWorkflowsAvailable(true);
        setThesisWorkflows(
          (data.thesisWorkflows as ThesisWorkflow[]).map((item) => ({
            ...item,
            student_phone: item.student_phone || "-",
            schedule_start_time: item.schedule_start_time
              ? normalizeTimeHHMM(item.schedule_start_time)
              : null,
            schedule_end_time: item.schedule_end_time
              ? normalizeTimeHHMM(item.schedule_end_time)
              : null,
            letter_status: item.letter_status || "Belum Dibuat",
          }))
        );
      } else {
        setThesisWorkflowsAvailable(false);
        setThesisWorkflows([]);
      }
    } catch {
      // Tetap gunakan state sebelumnya bila koneksi terputus
    } finally {
      setIsSyncingDb(false);
    }
  }, [clearOperationalData, isLiveSupabase]);

  // Hydrate theme & verify server session
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      }

      if (!isLiveSupabase) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.buildings) setBuildings(parsed.buildings);
          if (parsed.rooms) setRooms(parsed.rooms);
          if (parsed.assets) setAssets(parsed.assets);
          if (parsed.bookings) setBookings(parsed.bookings);
          if (parsed.maintenanceLogs) setMaintenanceLogs(parsed.maintenanceLogs);
          if (parsed.consumables) setConsumables(parsed.consumables);
          if (parsed.consumableTransactions)
            setConsumableTransactions(parsed.consumableTransactions);
          if (parsed.lecturers) setLecturers(parsed.lecturers);
          if (parsed.courses) setCourses(parsed.courses);
          if (parsed.campusOfficials) setCampusOfficials(parsed.campusOfficials);
          if (parsed.campusUnits) setCampusUnits(parsed.campusUnits);
          if (parsed.maintenanceVendors)
            setMaintenanceVendors(parsed.maintenanceVendors);
          if (parsed.assetCategories) setAssetCategories(parsed.assetCategories);
          if (parsed.fundingSources) setFundingSources(parsed.fundingSources);
          if (parsed.consumableCategories)
            setConsumableCategories(parsed.consumableCategories);
          if (parsed.consumableUnits) setConsumableUnits(parsed.consumableUnits);
          if (parsed.academicClasses) setAcademicClasses(parsed.academicClasses);
          if (parsed.officeKitItems) setOfficeKitItems(parsed.officeKitItems);
          if (parsed.officeKitLoans) setOfficeKitLoans(parsed.officeKitLoans);
          if (parsed.thesisWorkflows)
            setThesisWorkflows(parsed.thesisWorkflows);
        }
        setAuthLoading(false);
        setHydrated(true);
        return;
      }
    } catch {
      // Abaikan fallback localStorage
    }

    let active = true;

    fetch("/api/auth/session", { method: "GET", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setServerConfigured(Boolean(data.serverConfigured));
        if (data.user) {
          setAuthUser(data.user as AuthStaffUser);
          void refreshFromSupabase();
        } else {
          setAuthUser(null);
          clearOperationalData();
        }
      })
      .catch(() => {
        if (active) {
          setAuthUser(null);
          clearOperationalData();
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [clearOperationalData, isLiveSupabase, refreshFromSupabase]);

  // Persist perubahan ke localStorage hanya saat mode offline non-Supabase
  useEffect(() => {
    if (!hydrated || isLiveSupabase) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          buildings,
          rooms,
          assets,
          bookings,
          maintenanceLogs,
          consumables,
          consumableTransactions,
          lecturers,
          courses,
          campusOfficials,
          campusUnits,
          maintenanceVendors,
          assetCategories,
          fundingSources,
          consumableCategories,
          consumableUnits,
          academicClasses,
          officeKitItems,
          officeKitLoans,
          thesisWorkflows,
        })
      );
    } catch {
      // Abaikan kuota penyimpanan penuh
    }
  }, [
    hydrated,
    isLiveSupabase,
    buildings,
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    consumableTransactions,
    lecturers,
    courses,
    campusOfficials,
    campusUnits,
    maintenanceVendors,
    assetCategories,
    fundingSources,
    consumableCategories,
    consumableUnits,
    academicClasses,
    officeKitItems,
    officeKitLoans,
    thesisWorkflows,
  ]);

  const signInWithUsername = useCallback(
    async (
      username: string,
      password: string
    ): Promise<{ ok: boolean; error?: string; defaultHref?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok || !data.user) {
          return {
            ok: false,
            error: data.error || "Username atau kata sandi salah.",
          };
        }

        const user = data.user as AuthStaffUser;
        setAuthUser(user);
        setServerConfigured(true);
        await refreshFromSupabase();

        notify(
          "success",
          "Berhasil Masuk Staf",
          `Selamat datang, ${user.fullName} (${
            user.role === "master_admin" ? "Master Admin" : "Staf"
          }).`
        );
        return { ok: true, defaultHref: getFirstAllowedHref(user) };
      } catch {
        return {
          ok: false,
          error: "Terjadi gangguan jaringan saat menghubungi server autentikasi.",
        };
      }
    },
    [notify, refreshFromSupabase]
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Abaikan kegagalan jaringan saat logout
    }
    setAuthUser(null);
    clearOperationalData();
    notify(
      "info",
      "Keluar dari Sesi Staf",
      "Sesi telah diakhiri. Masuk kembali untuk mengakses modul StafCenter."
    );
  }, [clearOperationalData, notify]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Abaikan jika penyimpanan dibatasi
      }
      return next;
    });
  }, []);

  const resetToSeedData = useCallback(() => {
    if (isLiveSupabase) {
      setUiSimState("normal");
      void refreshFromSupabase();
      notify(
        "info",
        "Data Disinkronkan Ulang",
        "Seluruh tabel telah dimuat ulang langsung dari database Supabase."
      );
      return;
    }

    setBuildings(INITIAL_BUILDINGS);
    setRooms(INITIAL_ROOMS);
    setAssets(INITIAL_ASSETS);
    setBookings(INITIAL_BOOKINGS);
    setMaintenanceLogs(INITIAL_MAINTENANCE_LOGS);
    setConsumables(INITIAL_CONSUMABLES);
    setConsumableTransactions(INITIAL_CONSUMABLE_TRANSACTIONS);
    setLecturers(INITIAL_LECTURERS);
    setCourses(INITIAL_COURSES);
    setCampusOfficials(INITIAL_CAMPUS_OFFICIALS);
    setCampusUnits(INITIAL_CAMPUS_UNITS);
    setMaintenanceVendors(INITIAL_MAINTENANCE_VENDORS);
    setAssetCategories(INITIAL_ASSET_CATEGORIES);
    setFundingSources(INITIAL_FUNDING_SOURCES);
    setConsumableCategories(INITIAL_CONSUMABLE_CATEGORIES);
    setConsumableUnits(INITIAL_CONSUMABLE_UNITS);
    setAcademicClasses(INITIAL_ACADEMIC_CLASSES);
    setOfficeKitItems(INITIAL_OFFICE_KIT_ITEMS);
    setOfficeKitLoans(INITIAL_OFFICE_KIT_LOANS);
    setThesisWorkflows(INITIAL_THESIS_WORKFLOWS);
    setUiSimState("normal");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Abaikan
    }
    notify(
      "info",
      "Data Seed Dipulihkan",
      "Seluruh data modul Sarana Prasarana telah dikembalikan ke kondisi awal kampus."
    );
  }, [isLiveSupabase, notify, refreshFromSupabase]);

  const canAccessPage = useCallback(
    (pageKey: SarprasPageKey | "akun"): boolean => {
      if (!isLiveSupabase) return true;
      return canAccessPageHelper(authUser, pageKey);
    },
    [authUser, isLiveSupabase]
  );

  const defaultHomeHref = useMemo(
    () =>
      !isLiveSupabase ? "/sarpras/dashboard" : getFirstAllowedHref(authUser),
    [authUser, isLiveSupabase]
  );

  const canManageDataMaster =
    !isLiveSupabase ||
    authUser?.role === "master_admin" ||
    DATA_MASTER_PAGE_KEYS.some((key) => canAccessPageHelper(authUser, key));

  const requireStaffForLiveWrite = useCallback(
    (pageKey?: SarprasPageKey): boolean => {
      if (isLiveSupabase && !authUser) {
        notify(
          "error",
          "Autentikasi Staf Diperlukan",
          "Silakan masuk terlebih dahulu sebelum mengubah data operasional."
        );
        return false;
      }
      if (isLiveSupabase && pageKey && !canAccessPageHelper(authUser, pageKey)) {
        const label = getPageMeta(pageKey)?.label || pageKey;
        notify(
          "error",
          "Otoritas Halaman Ditolak",
          `Akun Anda tidak memiliki izin untuk mengubah data pada halaman ${label}.`
        );
        return false;
      }
      return true;
    },
    [authUser, isLiveSupabase, notify]
  );

  const requireMasterAdminForDataMaster = useCallback(
    (pageKey?: SarprasPageKey): boolean => {
      if (!requireStaffForLiveWrite(pageKey)) return false;
      if (!pageKey && isLiveSupabase && !canManageDataMaster) {
        notify(
          "error",
          "Akses Master Admin Diperlukan",
          "Hanya akun yang diberi otoritas yang berhak mengubah Data Master."
        );
        return false;
      }
      return true;
    },
    [canManageDataMaster, isLiveSupabase, notify, requireStaffForLiveWrite]
  );

  const sendMutation = useCallback(
    async (
      payload: Record<string, unknown>,
      actionLabel: string,
      successTitle: string,
      successMessage: string,
      shouldRefreshAfter = false,
      noticeType: ToastNotice["type"] = "success"
    ) => {
      if (!shouldRefreshAfter) {
        notify(noticeType, successTitle, successMessage);
      }
      try {
        const res = await fetch("/api/sarpras/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          notify(
            "error",
            `Gagal ${actionLabel}`,
            result.error || "Terjadi kesalahan saat menyimpan ke Supabase."
          );
          await refreshFromSupabase();
          return;
        }
        if (shouldRefreshAfter) {
          await refreshFromSupabase();
          notify(noticeType, successTitle, successMessage);
        }
      } catch {
        notify(
          "error",
          `Gagal ${actionLabel}`,
          "Koneksi ke server terputus saat menyimpan perubahan."
        );
        await refreshFromSupabase();
      }
    },
    [notify, refreshFromSupabase]
  );

  // Mutasi terkonfirmasi: tunggu respon database terlebih dahulu sebelum ubah UI state
  const sendConfirmedMutation = useCallback(
    async (
      payload: Record<string, unknown>,
      actionLabel: string,
      successTitle: string,
      successMessage: string,
      onSuccess?: () => void
    ): Promise<ActionResult> => {
      try {
        const res = await fetch("/api/sarpras/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg =
            result.error || "Terjadi kesalahan saat memproses ke Supabase.";
          notify("error", `Gagal ${actionLabel}`, errMsg);
          return { ok: false, error: errMsg };
        }
        if (onSuccess) {
          onSuccess();
        } else {
          await refreshFromSupabase();
        }
        notify("info", successTitle, successMessage);
        return { ok: true };
      } catch {
        const errMsg = "Koneksi ke server terputus saat menghapus data.";
        notify("error", `Gagal ${actionLabel}`, errMsg);
        return { ok: false, error: errMsg };
      }
    },
    [notify, refreshFromSupabase]
  );

  const removeEntityArtifactsLocal = useCallback(
    (entityType: SarprasEntityType, entityId: string) => {
      setNotes((prev) =>
        prev.filter(
          (n) => !(n.entity_type === entityType && n.entity_id === entityId)
        )
      );
      setAttachments((prev) =>
        prev.filter(
          (a) => !(a.entity_type === entityType && a.entity_id === entityId)
        )
      );
    },
    []
  );

  const addBuilding = useCallback(
    (payload: Omit<Building, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("ruangan")) return;
      const id = generateUuid();
      const createdAt = new Date().toISOString();
      const newBuilding: Building = {
        ...payload,
        id,
        created_at: createdAt,
      };
      setBuildings((prev) => [...prev, newBuilding]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_building",
            data: {
              id,
              code: payload.code,
              name: payload.name,
              floors_count: payload.floors_count,
              zone: payload.zone,
              description: payload.description || null,
            },
          },
          "Menyimpan Gedung",
          "Gedung Tersimpan di Supabase",
          `${newBuilding.code} (${newBuilding.name}) berhasil disimpan ke database.`
        );
        return;
      }

      notify(
        "success",
        "Gedung Ditambahkan",
        `${newBuilding.code} (${newBuilding.name}) berhasil dicatat.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateBuilding = useCallback(
    (id: string, payload: Partial<Omit<Building, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("ruangan")) return;
      setBuildings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_building", id, data: payload },
          "Memperbarui Gedung",
          "Data Gedung Diperbarui",
          "Perubahan atribut gedung telah tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Data Gedung Diperbarui",
        "Perubahan atribut gedung telah disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteBuilding = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("ruangan")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = buildings.find((b) => b.id === id);
      const applyLocalDelete = () => {
        setBuildings((prev) => prev.filter((b) => b.id !== id));
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_building", id },
          "Menghapus Gedung",
          "Gedung Dihapus dari Supabase",
          `Gedung ${target?.code || ""} telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      const linkedRooms = rooms.filter((r) => r.building_id === id);
      if (linkedRooms.length > 0) {
        const errMsg = `Gedung tidak dapat dihapus karena masih memiliki ${linkedRooms.length} ruangan terdaftar.`;
        notify("error", "Gagal Menghapus Gedung", errMsg);
        return { ok: false, error: errMsg };
      }

      applyLocalDelete();
      notify(
        "info",
        "Gedung Dihapus",
        `Gedung ${target?.code || ""} telah dihapus dari daftar master.`
      );
      return { ok: true };
    },
    [
      authUser,
      buildings,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      rooms,
      sendConfirmedMutation,
    ]
  );

  const addRoom = useCallback(
    (payload: Omit<Room, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("ruangan")) return;
      const id = generateUuid();
      const createdAt = new Date().toISOString();
      const newRoom: Room = {
        ...payload,
        id,
        created_at: createdAt,
      };
      setRooms((prev) => [newRoom, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_room",
            data: {
              id,
              code: payload.code,
              name: payload.name,
              building_id: payload.building_id,
              floor: payload.floor,
              category: payload.category,
              capacity: payload.capacity,
              pic_name: payload.pic_name,
              pic_contact: payload.pic_contact || null,
              ...(extendedMasterReady
                ? {
                    pic_official_id: payload.pic_official_id || null,
                    pic_lecturer_id: payload.pic_lecturer_id || null,
                  }
                : {}),
              status: payload.status,
              facilities_notes: payload.facilities_notes || null,
            },
          },
          "Menyimpan Ruangan",
          "Ruangan Tersimpan di Supabase",
          `Ruang ${newRoom.code} (${newRoom.name}) berhasil disimpan ke database.`
        );
        return;
      }

      notify(
        "success",
        "Ruangan Ditambahkan",
        `Ruang ${newRoom.code} (${newRoom.name}) berhasil didaftarkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateRoom = useCallback(
    (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("ruangan")) return;
      setRooms((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        const cleanRoomPayload = { ...payload };
        if (!extendedMasterReady) {
          delete cleanRoomPayload.pic_official_id;
          delete cleanRoomPayload.pic_lecturer_id;
        }
        void sendMutation(
          { action: "update_room", id, data: cleanRoomPayload },
          "Memperbarui Ruangan",
          "Data Ruangan Diperbarui",
          "Perubahan atribut ruangan telah tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Data Ruangan Diperbarui",
        "Perubahan atribut ruangan telah disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteRoom = useCallback(
    async (
      id: string,
      options?: { mode?: DeleteStrategyMode; forceActive?: boolean }
    ): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("ruangan")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const mode = options?.mode || "archive";
      const forceActive = Boolean(options?.forceActive);
      const target = rooms.find((r) => r.id === id);
      const label = target
        ? `Ruang ${target.code} (${target.name}) [Dihapus]`
        : "Ruangan [Dihapus]";

      const applyLocalDelete = () => {
        setRooms((prev) => prev.filter((item) => item.id !== id));
        setAssets((prev) =>
          prev.map((a) => (a.room_id === id ? { ...a, room_id: null } : a))
        );
        if (mode === "cascade") {
          setBookings((prev) =>
            prev
              .filter((b) => !(b.room_id === id && !b.asset_id))
              .map((b) =>
                b.room_id === id && b.asset_id
                  ? { ...b, room_id: null, target_type: "Alat" }
                  : b
              )
          );
          setMaintenanceLogs((prev) => prev.filter((m) => m.room_id !== id));
        } else {
          setBookings((prev) =>
            prev.map((b) =>
              b.room_id === id
                ? {
                    ...b,
                    room_id: null,
                    target_type: b.asset_id ? "Alat" : b.target_type,
                    deleted_target_label: label,
                  }
                : b
            )
          );
          setMaintenanceLogs((prev) =>
            prev.map((m) =>
              m.room_id === id
                ? { ...m, room_id: null, deleted_target_label: label }
                : m
            )
          );
        }
        removeEntityArtifactsLocal("room", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_room", id, mode, forceActive },
          "Menghapus Ruangan",
          "Ruangan Dihapus dari Supabase",
          `Ruang ${target?.code || ""} telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();

      notify(
        "info",
        "Ruangan Dihapus",
        `Ruang ${target?.code || ""} telah dihapus dari daftar master.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      rooms,
      sendConfirmedMutation,
    ]
  );

  const previewNextInventoryCode = useCallback(
    (category: AssetCategoryCode, year: number) => {
      const nextSequence =
        extractMaxSequence(assets.map((a) => a.inventory_code)) + 1;
      return generateInventoryCode(category, year, nextSequence);
    },
    [assets]
  );

  const addAsset = useCallback(
    (
      payload: Omit<
        Asset,
        "id" | "inventory_code" | "category_label" | "created_at"
      >
    ): Asset => {
      const seq = extractMaxSequence(assets.map((a) => a.inventory_code)) + 1;
      const inventory_code = generateInventoryCode(
        payload.category,
        payload.procurement_year,
        seq
      );
      const id = generateUuid();
      const category_label = resolveAssetCategoryLabel(
        payload.category,
        assetCategories
      );
      const newAsset: Asset = {
        ...payload,
        id,
        inventory_code,
        category_label,
        created_at: new Date().toISOString(),
      };
      if (!requireStaffForLiveWrite("inventaris")) return newAsset;
      setAssets((prev) => [newAsset, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_asset",
            data: {
              id,
              inventory_code,
              name: payload.name,
              brand_model: payload.brand_model,
              category: payload.category,
              category_label,
              room_id: payload.room_id || null,
              procurement_year: payload.procurement_year,
              funding_source: payload.funding_source,
              ...(extendedMasterReady
                ? { funding_source_id: payload.funding_source_id || null }
                : {}),
              acquisition_cost: payload.acquisition_cost,
              condition: payload.condition,
              is_portable: payload.is_portable,
              serial_number: payload.serial_number || null,
              photo_url: payload.photo_url || null,
              notes: payload.notes || null,
            },
          },
          "Mendaftarkan Aset",
          "Aset Tersimpan di Supabase",
          `${newAsset.inventory_code} (${newAsset.name}) berhasil dicatat ke database.`
        );
        return newAsset;
      }

      notify(
        "success",
        "Aset Terdaftar",
        `${newAsset.inventory_code} (${newAsset.name}) berhasil dicatat ke inventaris.`
      );
      return newAsset;
    },
    [
      assets,
      authUser,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const importAssets = useCallback(
    async (items: NormalizedImportAssetPayload[]): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("inventaris")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      if (items.length === 0) {
        return { ok: false, error: "Tidak ada data aset untuk diimport." };
      }

      if (isLiveSupabase && authUser) {
        try {
          const res = await fetch("/api/sarpras/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "bulk_insert_assets",
              items,
            }),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errMsg =
              result.error || "Terjadi kesalahan saat mengimport aset ke Supabase.";
            notify("error", "Gagal Mengimport Aset", errMsg);
            return { ok: false, error: errMsg };
          }
          await refreshFromSupabase();
          notify(
            "success",
            "Import Inventaris Berhasil",
            `${items.length} unit aset berhasil didaftarkan ke database.`
          );
          return { ok: true };
        } catch {
          const errMsg =
            "Koneksi ke server terputus saat mengimport data inventaris.";
          notify("error", "Gagal Mengimport Aset", errMsg);
          return { ok: false, error: errMsg };
        }
      }

      // Mode offline / seed: cek duplikat serial & generate nomor urut berantai
      const existingSerials = new Map<string, string>();
      for (const a of assets) {
        const key = normalizeSerialKey(a.serial_number);
        if (key && !existingSerials.has(key)) {
          existingSerials.set(key, a.inventory_code);
        }
      }

      const batchSerials = new Set<string>();
      let seq = extractMaxSequence(assets.map((a) => a.inventory_code));
      const nowIso = new Date().toISOString();
      const createdAssets: Asset[] = [];

      for (const item of items) {
        const serialKey = normalizeSerialKey(item.serial_number);
        if (serialKey) {
          const existingCode = existingSerials.get(serialKey);
          if (existingCode) {
            return {
              ok: false,
              error: `Nomor seri "${item.serial_number}" sudah terdaftar pada aset ${existingCode}.`,
            };
          }
          if (batchSerials.has(serialKey)) {
            return {
              ok: false,
              error: `Nomor seri "${item.serial_number}" duplikat di dalam batch import.`,
            };
          }
          batchSerials.add(serialKey);
        }

        seq += 1;
        createdAssets.push({
          id: generateUuid(),
          inventory_code: generateInventoryCode(
            item.category,
            item.procurement_year,
            seq
          ),
          name: item.name,
          brand_model: item.brand_model,
          category: item.category,
          category_label: resolveAssetCategoryLabel(
            item.category,
            assetCategories
          ),
          room_id: item.room_id,
          procurement_year: item.procurement_year,
          funding_source: item.funding_source,
          funding_source_id: item.funding_source_id || null,
          acquisition_cost: item.acquisition_cost,
          condition: item.condition,
          is_portable: item.is_portable,
          serial_number: item.serial_number || "-",
          notes: item.notes,
          created_at: nowIso,
        });
      }

      setAssets((prev) => [...createdAssets.reverse(), ...prev]);
      notify(
        "success",
        "Import Inventaris Berhasil",
        `${createdAssets.length} unit aset berhasil ditambahkan ke inventaris.`
      );
      return { ok: true };
    },
    [
      assets,
      authUser,
      isLiveSupabase,
      notify,
      refreshFromSupabase,
      requireStaffForLiveWrite,
    ]
  );

  const updateAsset = useCallback(
    (id: string, payload: Partial<Omit<Asset, "id" | "created_at">>) => {
      if (!requireStaffForLiveWrite("inventaris")) return;
      const nextLabel = payload.category
        ? resolveAssetCategoryLabel(payload.category, assetCategories)
        : undefined;

      setAssets((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...payload,
                category_label: nextLabel || item.category_label,
              }
            : item
        )
      );

      if (isLiveSupabase && authUser) {
        const cleanAssetPayload = {
          ...payload,
          ...(nextLabel ? { category_label: nextLabel } : {}),
        };
        if (!extendedMasterReady) {
          delete cleanAssetPayload.funding_source_id;
        }
        void sendMutation(
          {
            action: "update_asset",
            id,
            data: cleanAssetPayload,
          },
          "Memperbarui Aset",
          "Inventaris Diperbarui",
          "Perubahan data aset telah tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Inventaris Diperbarui",
        "Perubahan data aset telah disimpan."
      );
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const deleteAsset = useCallback(
    async (
      id: string,
      options?: { mode?: DeleteStrategyMode; forceActive?: boolean }
    ): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("inventaris")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const mode = options?.mode || "archive";
      const forceActive = Boolean(options?.forceActive);
      const target = assets.find((a) => a.id === id);
      const label = target
        ? `Aset ${target.inventory_code} (${target.name}) [Dihapus]`
        : "Aset [Dihapus]";

      const applyLocalDelete = () => {
        setAssets((prev) => prev.filter((item) => item.id !== id));
        if (mode === "cascade") {
          setBookings((prev) =>
            prev
              .filter((b) => !(b.asset_id === id && !b.room_id))
              .map((b) =>
                b.asset_id === id && b.room_id
                  ? { ...b, asset_id: null, target_type: "Ruangan" }
                  : b
              )
          );
          setMaintenanceLogs((prev) =>
            prev
              .filter((m) => !(m.asset_id === id && !m.room_id))
              .map((m) => (m.asset_id === id ? { ...m, asset_id: null } : m))
          );
        } else {
          setBookings((prev) =>
            prev.map((b) =>
              b.asset_id === id
                ? {
                    ...b,
                    asset_id: null,
                    target_type: b.room_id ? "Ruangan" : b.target_type,
                    deleted_target_label: label,
                  }
                : b
            )
          );
          setMaintenanceLogs((prev) =>
            prev.map((m) =>
              m.asset_id === id
                ? { ...m, asset_id: null, deleted_target_label: label }
                : m
            )
          );
        }
        removeEntityArtifactsLocal("asset", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_asset", id, mode, forceActive },
          "Menghapus Aset",
          "Aset Dihapus dari Supabase",
          `Aset ${target?.inventory_code || ""} dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();

      notify(
        "info",
        "Aset Dihapus",
        `Aset ${target?.inventory_code || ""} dihapus dari daftar inventaris.`
      );
      return { ok: true };
    },
    [
      assets,
      authUser,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const addBooking = useCallback(
    (
      payload: Omit<Booking, "id" | "booking_code" | "status" | "created_at">
    ): { ok: boolean; error?: string } => {
      if (!requireStaffForLiveWrite("peminjaman")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      if (payload.end_time <= payload.start_time) {
        return {
          ok: false,
          error: "Jam selesai harus lebih besar daripada jam mulai peminjaman.",
        };
      }

      const conflict = findBookingConflict(bookings, {
        room_id: payload.room_id,
        asset_id: payload.asset_id,
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
      });

      if (conflict) {
        return {
          ok: false,
          error: `Jadwal bentrok dengan peminjaman ${conflict.booking_code} (${conflict.activity_name}) oleh ${conflict.borrower_name} pada pukul ${conflict.start_time}-${conflict.end_time}.`,
        };
      }

      const seq = String(
        extractMaxSequence(bookings.map((b) => b.booking_code)) + 1
      ).padStart(3, "0");
      const id = generateUuid();
      const booking_code = `PJM-${getCurrentYearMonth()}-${seq}`;
      const newBooking: Booking = {
        ...payload,
        id,
        booking_code,
        status: "Menunggu Persetujuan",
        created_at: new Date().toISOString(),
      };

      setBookings((prev) => [newBooking, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_booking",
            data: {
              id,
              booking_code,
              borrower_name: payload.borrower_name,
              borrower_role: payload.borrower_role,
              borrower_unit: payload.borrower_unit,
              ...(extendedMasterReady
                ? {
                    unit_id: payload.unit_id || null,
                    class_id: payload.class_id || null,
                    class_code: payload.class_code || null,
                    borrower_lecturer_id: payload.borrower_lecturer_id || null,
                    borrower_official_id: payload.borrower_official_id || null,
                  }
                : {}),
              borrower_phone: payload.borrower_phone,
              target_type: payload.target_type,
              room_id: payload.room_id || null,
              asset_id: payload.asset_id || null,
              activity_name: payload.activity_name,
              attendees_count: payload.attendees_count,
              booking_date: payload.booking_date,
              start_time: payload.start_time,
              end_time: payload.end_time,
              status: "Menunggu Persetujuan",
              approved_by: null,
              return_condition_notes: null,
            },
          },
          "Menyimpan Reservasi",
          "Reservasi Tersimpan di Supabase",
          `Tiket ${booking_code} berhasil dicatat dan menunggu persetujuan sarpras.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Reservasi Diajukan",
        `Tiket ${newBooking.booking_code} berhasil dibuat dan menunggu persetujuan sarpras.`
      );
      return { ok: true };
    },
    [
      authUser,
      bookings,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const updateBookingStatus = useCallback(
    (
      id: string,
      status: BookingStatus,
      returnNotes?: string,
      approvedBy?: string,
      approvedByOfficialId?: string | null
    ) => {
      if (!requireStaffForLiveWrite("peminjaman")) return;
      const target = bookings.find((b) => b.id === id);
      setBookings((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                return_condition_notes:
                  returnNotes !== undefined
                    ? returnNotes
                    : item.return_condition_notes,
                approved_by: approvedBy || item.approved_by,
                approved_by_official_id:
                  approvedByOfficialId !== undefined
                    ? approvedByOfficialId
                    : item.approved_by_official_id,
              }
            : item
        )
      );

      let nextRoomStatus: Room["status"] | null = null;
      if (target?.room_id) {
        if (status === "Sedang Dipinjam") {
          nextRoomStatus = "Digunakan";
          setRooms((prev) =>
            prev.map((r) =>
              r.id === target.room_id ? { ...r, status: "Digunakan" } : r
            )
          );
        } else if (
          status === "Selesai / Dikembalikan" ||
          status === "Ditolak"
        ) {
          const targetRoom = rooms.find((r) => r.id === target.room_id);
          if (targetRoom?.status === "Digunakan") {
            nextRoomStatus = "Tersedia";
            setRooms((prev) =>
              prev.map((r) =>
                r.id === target.room_id && r.status === "Digunakan"
                  ? { ...r, status: "Tersedia" }
                  : r
              )
            );
          }
        }
      }

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "update_booking_status",
            id,
            data: {
              status,
              ...(returnNotes !== undefined
                ? { return_condition_notes: returnNotes }
                : {}),
              ...(approvedBy ? { approved_by: approvedBy } : {}),
              ...(extendedMasterReady && approvedByOfficialId !== undefined
                ? { approved_by_official_id: approvedByOfficialId || null }
                : {}),
            },
            roomId: target?.room_id || null,
            nextRoomStatus,
          },
          "Memperbarui Status Peminjaman",
          "Status Peminjaman Diperbarui di Supabase",
          `Tiket ${target?.booking_code || ""} kini berstatus "${status}".`
        );
        return;
      }

      notify(
        "success",
        "Status Peminjaman Diperbarui",
        `Tiket ${target?.booking_code || ""} kini berstatus "${status}".`
      );
    },
    [
      authUser,
      bookings,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      rooms,
      sendMutation,
    ]
  );

  const deleteBooking = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("peminjaman")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = bookings.find((b) => b.id === id);
      const applyLocalDelete = () => {
        setBookings((prev) => prev.filter((item) => item.id !== id));
        if (target?.status === "Sedang Dipinjam" && target.room_id) {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === target.room_id && r.status === "Digunakan"
                ? { ...r, status: "Tersedia" }
                : r
            )
          );
        }
        removeEntityArtifactsLocal("booking", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_booking", id },
          "Menghapus Peminjaman",
          "Tiket Peminjaman Dihapus",
          `Tiket ${target?.booking_code || ""} telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Tiket Peminjaman Dihapus",
        `Tiket ${target?.booking_code || ""} telah dihapus dari daftar.`
      );
      return { ok: true };
    },
    [
      authUser,
      bookings,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const addMaintenanceLog = useCallback(
    (
      payload: Omit<
        MaintenanceLog,
        "id" | "ticket_code" | "status" | "reported_at"
      >
    ): MaintenanceLog => {
      const seq = String(
        extractMaxSequence(maintenanceLogs.map((m) => m.ticket_code)) + 1
      ).padStart(3, "0");
      const id = generateUuid();
      const ticket_code = `MNT-${getCurrentYearMonth()}-${seq}`;
      const newTicket: MaintenanceLog = {
        ...payload,
        id,
        ticket_code,
        status: "Dilaporkan",
        reported_at: new Date().toISOString(),
      };
      if (!requireStaffForLiveWrite("pemeliharaan")) return newTicket;

      setMaintenanceLogs((prev) => [newTicket, ...prev]);

      if (payload.asset_id) {
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id !== payload.asset_id) return a;
            if (payload.damage_severity === "Rusak Berat") {
              return { ...a, condition: "Rusak Berat" };
            }
            if (
              payload.damage_severity === "Rusak Ringan" &&
              a.condition === "Baik"
            ) {
              return { ...a, condition: "Rusak Ringan" };
            }
            return a;
          })
        );
      }

      const setRoomRepair = Boolean(
        payload.room_id && payload.priority === "Tinggi/Darurat"
      );
      if (setRoomRepair && payload.room_id) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === payload.room_id ? { ...r, status: "Perbaikan" } : r
          )
        );
      }

      if (payload.office_kit_item_id) {
        setOfficeKitItems((prev) =>
          prev.map((kit) => {
            if (kit.id !== payload.office_kit_item_id) return kit;
            const nextCondition =
              payload.damage_severity === "Rusak Berat"
                ? "Rusak Berat"
                : kit.condition === "Baik"
                ? "Rusak Ringan"
                : kit.condition;
            return {
              ...kit,
              condition: nextCondition,
              status: kit.status === "Tersedia" ? "Perbaikan" : kit.status,
            };
          })
        );
      }

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_maintenance",
            data: {
              id,
              ticket_code,
              asset_id: payload.asset_id || null,
              room_id: payload.room_id || null,
              office_kit_item_id: payload.office_kit_item_id || null,
              reporter_name: payload.reporter_name,
              reporter_role: payload.reporter_role,
              issue_title: payload.issue_title,
              issue_description: payload.issue_description,
              damage_severity: payload.damage_severity,
              priority: payload.priority,
              photo_url: payload.photo_url || null,
              status: "Dilaporkan",
              technician_vendor: null,
              repair_cost: payload.repair_cost || 0,
              resolution_notes: null,
            },
            assetId: payload.asset_id || null,
            roomId: payload.room_id || null,
            officeKitItemId: payload.office_kit_item_id || null,
            damageSeverity: payload.damage_severity,
            setRoomRepair,
          },
          "Membuat Tiket Kerusakan",
          "Laporan Kerusakan Tersimpan di Supabase",
          `Tiket ${ticket_code} berhasil dibuat dan disinkronkan ke database.`,
          false
        );
        return newTicket;
      }

      notify(
        "success",
        "Laporan Kerusakan Dicatat",
        `Tiket ${newTicket.ticket_code} berhasil dibuat${
          payload.damage_severity === "Rusak Berat"
            ? " dan kondisi item otomatis diperbarui menjadi Rusak Berat."
            : "."
        }`
      );
      return newTicket;
    },
    [
      authUser,
      isLiveSupabase,
      maintenanceLogs,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const updateMaintenanceStatus = useCallback(
    (
      id: string,
      update: {
        status: MaintenanceStatus;
        technician_vendor?: string;
        vendor_id?: string | null;
        repair_cost?: number;
        resolution_notes?: string;
      }
    ) => {
      if (!requireStaffForLiveWrite("pemeliharaan")) return;
      const target = maintenanceLogs.find((m) => m.id === id);
      const isDone = update.status === "Selesai Diperbaiki";
      const completedAt = isDone
        ? target?.completed_at || new Date().toISOString()
        : undefined;

      const nextLogs = maintenanceLogs.map((item) =>
        item.id === id
          ? {
              ...item,
              status: update.status,
              technician_vendor:
                update.technician_vendor !== undefined
                  ? update.technician_vendor
                  : item.technician_vendor,
              vendor_id:
                update.vendor_id !== undefined
                  ? update.vendor_id
                  : item.vendor_id,
              repair_cost:
                update.repair_cost !== undefined
                  ? update.repair_cost
                  : item.repair_cost,
              resolution_notes:
                update.resolution_notes !== undefined
                  ? update.resolution_notes
                  : item.resolution_notes,
              completed_at: completedAt,
            }
          : item
      );
      setMaintenanceLogs(nextLogs);

      if (target?.asset_id) {
        const openForAsset = nextLogs.filter(
          (m) =>
            m.asset_id === target.asset_id && m.status !== "Selesai Diperbaiki"
        );
        const hasHeavy = openForAsset.some(
          (m) => m.damage_severity === "Rusak Berat"
        );
        const hasLight = openForAsset.some(
          (m) => m.damage_severity === "Rusak Ringan"
        );
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id !== target.asset_id) return a;
            if (hasHeavy) return { ...a, condition: "Rusak Berat" };
            if (hasLight) return { ...a, condition: "Rusak Ringan" };
            if (
              a.condition === "Rusak Berat" ||
              a.condition === "Rusak Ringan"
            ) {
              return { ...a, condition: "Baik" };
            }
            return a;
          })
        );
      }

      if (target?.office_kit_item_id) {
        const openForKit = nextLogs.filter(
          (m) =>
            m.office_kit_item_id === target.office_kit_item_id &&
            m.status !== "Selesai Diperbaiki"
        );
        const hasHeavy = openForKit.some(
          (m) => m.damage_severity === "Rusak Berat"
        );
        const hasLight = openForKit.some(
          (m) => m.damage_severity === "Rusak Ringan"
        );
        setOfficeKitItems((prev) =>
          prev.map((kit) => {
            if (kit.id !== target.office_kit_item_id) return kit;
            let nextCondition = kit.condition;
            let nextStatus = kit.status;
            if (hasHeavy) {
              nextCondition = "Rusak Berat";
              if (nextStatus === "Tersedia") nextStatus = "Perbaikan";
            } else if (hasLight) {
              if (nextCondition === "Baik" || nextCondition === "Rusak Berat") {
                nextCondition = "Rusak Ringan";
              }
              if (nextStatus === "Tersedia") nextStatus = "Perbaikan";
            } else {
              if (
                nextCondition === "Rusak Berat" ||
                nextCondition === "Rusak Ringan"
              ) {
                nextCondition = "Baik";
              }
              if (nextStatus === "Perbaikan") nextStatus = "Tersedia";
            }
            return { ...kit, condition: nextCondition, status: nextStatus };
          })
        );
      }

      if (target?.room_id) {
        const hasUrgent = nextLogs.some(
          (m) =>
            m.room_id === target.room_id &&
            m.status !== "Selesai Diperbaiki" &&
            m.priority === "Tinggi/Darurat"
        );
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== target.room_id) return r;
            if (hasUrgent && r.status === "Tersedia") {
              return { ...r, status: "Perbaikan" };
            }
            if (!hasUrgent && r.status === "Perbaikan") {
              return { ...r, status: "Tersedia" };
            }
            return r;
          })
        );
      }

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "update_maintenance",
            id,
            data: {
              status: update.status,
              ...(update.technician_vendor !== undefined
                ? { technician_vendor: update.technician_vendor }
                : {}),
              ...(extendedMasterReady && update.vendor_id !== undefined
                ? { vendor_id: update.vendor_id || null }
                : {}),
              ...(update.repair_cost !== undefined
                ? { repair_cost: update.repair_cost }
                : {}),
              ...(update.resolution_notes !== undefined
                ? { resolution_notes: update.resolution_notes }
                : {}),
              completed_at: isDone ? completedAt : null,
            },
            roomId: target?.room_id || null,
            assetId: target?.asset_id || null,
            officeKitItemId: target?.office_kit_item_id || null,
            status: update.status,
            damageSeverity: target?.damage_severity,
            setRoomAvailable: isDone,
          },
          "Memperbarui Perbaikan",
          "Status Pemeliharaan Diperbarui di Supabase",
          `Tiket ${target?.ticket_code || ""} diperbarui ke "${update.status}".`,
          false
        );
        return;
      }

      notify(
        "success",
        "Status Pemeliharaan Diperbarui",
        `Tiket ${target?.ticket_code || ""} diperbarui ke "${update.status}".`
      );
    },
    [
      authUser,
      extendedMasterReady,
      isLiveSupabase,
      maintenanceLogs,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const deleteMaintenanceLog = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("pemeliharaan")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = maintenanceLogs.find((m) => m.id === id);
      const applyLocalDelete = () => {
        const remaining = maintenanceLogs.filter((m) => m.id !== id);
        setMaintenanceLogs(remaining);
        if (target?.asset_id) {
          const openForAsset = remaining.filter(
            (m) =>
              m.asset_id === target.asset_id && m.status !== "Selesai Diperbaiki"
          );
          const hasHeavy = openForAsset.some(
            (m) => m.damage_severity === "Rusak Berat"
          );
          const hasLight = openForAsset.some(
            (m) => m.damage_severity === "Rusak Ringan"
          );
          setAssets((prev) =>
            prev.map((a) => {
              if (a.id !== target.asset_id) return a;
              if (hasHeavy) return { ...a, condition: "Rusak Berat" };
              if (hasLight) return { ...a, condition: "Rusak Ringan" };
              if (
                a.condition === "Rusak Berat" ||
                a.condition === "Rusak Ringan"
              ) {
                return { ...a, condition: "Baik" };
              }
              return a;
            })
          );
        }
        if (target?.office_kit_item_id) {
          const openForKit = remaining.filter(
            (m) =>
              m.office_kit_item_id === target.office_kit_item_id &&
              m.status !== "Selesai Diperbaiki"
          );
          const hasHeavy = openForKit.some(
            (m) => m.damage_severity === "Rusak Berat"
          );
          const hasLight = openForKit.some(
            (m) => m.damage_severity === "Rusak Ringan"
          );
          setOfficeKitItems((prev) =>
            prev.map((kit) => {
              if (kit.id !== target.office_kit_item_id) return kit;
              let nextCondition = kit.condition;
              let nextStatus = kit.status;
              if (hasHeavy) {
                nextCondition = "Rusak Berat";
                if (nextStatus === "Tersedia") nextStatus = "Perbaikan";
              } else if (hasLight) {
                if (
                  nextCondition === "Baik" ||
                  nextCondition === "Rusak Berat"
                ) {
                  nextCondition = "Rusak Ringan";
                }
                if (nextStatus === "Tersedia") nextStatus = "Perbaikan";
              } else {
                if (
                  nextCondition === "Rusak Berat" ||
                  nextCondition === "Rusak Ringan"
                ) {
                  nextCondition = "Baik";
                }
                if (nextStatus === "Perbaikan") nextStatus = "Tersedia";
              }
              return { ...kit, condition: nextCondition, status: nextStatus };
            })
          );
        }
        if (target?.room_id) {
          const hasUrgent = remaining.some(
            (m) =>
              m.room_id === target.room_id &&
              m.status !== "Selesai Diperbaiki" &&
              m.priority === "Tinggi/Darurat"
          );
          if (!hasUrgent) {
            setRooms((prev) =>
              prev.map((r) =>
                r.id === target.room_id && r.status === "Perbaikan"
                  ? { ...r, status: "Tersedia" }
                  : r
              )
            );
          }
        }
        removeEntityArtifactsLocal("maintenance", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_maintenance", id },
          "Menghapus Tiket Kerusakan",
          "Tiket Kerusakan Dihapus",
          `Tiket ${target?.ticket_code || ""} telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Tiket Kerusakan Dihapus",
        `Tiket ${target?.ticket_code || ""} telah dihapus dari daftar.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      maintenanceLogs,
      notify,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const addConsumable = useCallback(
    (payload: Omit<Consumable, "id" | "last_restocked_at">) => {
      if (!requireStaffForLiveWrite("bhp")) return;
      const id = generateUuid();
      const nowIso = new Date().toISOString();
      const newItem: Consumable = {
        ...payload,
        id,
        last_restocked_at: nowIso,
      };
      setConsumables((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_consumable",
            data: {
              id,
              code: payload.code,
              name: payload.name,
              category: payload.category,
              unit: payload.unit,
              current_stock: payload.current_stock,
              min_stock: payload.min_stock,
              storage_location: payload.storage_location,
              last_restocked_at: nowIso,
            },
          },
          "Menambah Item BHP",
          "Item BHP Tersimpan di Supabase",
          `${newItem.code} (${newItem.name}) berhasil ditambahkan ke database.`
        );
        return;
      }

      notify(
        "success",
        "Item BHP Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil ditambahkan ke katalog stok.`
      );
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const updateConsumable = useCallback(
    (
      id: string,
      payload: Partial<Omit<Consumable, "id" | "last_restocked_at">>
    ) => {
      if (!requireStaffForLiveWrite("bhp")) return;
      setConsumables((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_consumable", id, data: payload },
          "Memperbarui Item BHP",
          "Item BHP Diperbarui",
          "Perubahan data barang habis pakai tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Item BHP Diperbarui",
        "Perubahan data barang habis pakai berhasil disimpan."
      );
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const deleteConsumable = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("bhp")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = consumables.find((c) => c.id === id);
      const applyLocalDelete = () => {
        setConsumables((prev) => prev.filter((item) => item.id !== id));
        setConsumableTransactions((prev) =>
          prev.filter((tx) => tx.consumable_id !== id)
        );
        removeEntityArtifactsLocal("consumable", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_consumable", id },
          "Menghapus Item BHP",
          "Item BHP Dihapus dari Supabase",
          `${target?.code || ""} (${target?.name || ""}) telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Item BHP Dihapus",
        `${target?.code || ""} telah dihapus beserta histori mutasinya.`
      );
      return { ok: true };
    },
    [
      authUser,
      consumables,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const recordConsumableMutation = useCallback(
    (
      payload: Omit<ConsumableTransaction, "id" | "transaction_date">
    ): { ok: boolean; error?: string } => {
      if (!requireStaffForLiveWrite("bhp")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = consumables.find((c) => c.id === payload.consumable_id);
      if (!target) {
        return { ok: false, error: "Barang habis pakai tidak ditemukan." };
      }

      if (
        payload.transaction_type === "Keluar" &&
        target.current_stock < payload.quantity
      ) {
        return {
          ok: false,
          error: `Stok ${target.name} saat ini hanya ${target.current_stock} ${target.unit}, tidak mencukupi untuk pengeluaran ${payload.quantity} ${target.unit}.`,
        };
      }

      const id = generateUuid();
      const txDate = new Date().toISOString();
      const newTx: ConsumableTransaction = {
        ...payload,
        id,
        transaction_date: txDate,
      };

      setConsumables((prev) =>
        prev.map((item) => {
          if (item.id !== payload.consumable_id) return item;
          const nextStock =
            payload.transaction_type === "Masuk"
              ? item.current_stock + payload.quantity
              : item.current_stock - payload.quantity;
          return {
            ...item,
            current_stock: nextStock,
            last_restocked_at:
              payload.transaction_type === "Masuk"
                ? txDate
                : item.last_restocked_at,
          };
        })
      );

      setConsumableTransactions((prev) => [newTx, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_consumable_tx",
            data: {
              id,
              consumable_id: payload.consumable_id,
              transaction_type: payload.transaction_type,
              quantity: payload.quantity,
              actor_name: payload.actor_name,
              actor_unit: payload.actor_unit,
              ...(extendedMasterReady ? { unit_id: payload.unit_id || null } : {}),
              purpose_notes: payload.purpose_notes || null,
            },
          },
          "Mencatat Mutasi Stok",
          `Mutasi Stok (${payload.transaction_type}) Tersimpan`,
          `${payload.quantity} ${target.unit} ${target.name} berhasil dicatat ke database.`,
          false
        );
        return { ok: true };
      }

      notify(
        "success",
        `Mutasi Stok (${payload.transaction_type}) Dicatat`,
        `${payload.quantity} ${target.unit} ${target.name} berhasil dicatat atas nama ${payload.actor_name}.`
      );
      return { ok: true };
    },
    [
      authUser,
      consumables,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const addEntityNote = useCallback(
    async (
      entityType: SarprasEntityType,
      entityId: string,
      noteText: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!requireStaffForLiveWrite(ENTITY_TYPE_TO_PAGE_KEY[entityType])) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const cleanText = noteText.trim();
      if (!cleanText) {
        return { ok: false, error: "Isi catatan tidak boleh kosong." };
      }
      const id = generateUuid();
      const newNote: SarprasNote = {
        id,
        entity_type: entityType,
        entity_id: entityId,
        author_id: authUser?.id || null,
        author_name: authUser?.fullName || authUser?.username || "Staf Kampus",
        note_text: cleanText,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [newNote, ...prev]);

      if (isLiveSupabase && authUser) {
        try {
          const res = await fetch("/api/sarpras/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "insert_note",
              data: {
                id,
                entity_type: entityType,
                entity_id: entityId,
                note_text: cleanText,
              },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setNotes((prev) => prev.filter((n) => n.id !== id));
            notify("error", "Gagal Menyimpan Catatan", data.error || "Error database");
            return { ok: false, error: data.error };
          }
          notify("success", "Catatan Ditambahkan", "Catatan progres tersimpan.");
          return { ok: true };
        } catch {
          setNotes((prev) => prev.filter((n) => n.id !== id));
          return { ok: false, error: "Koneksi server terputus." };
        }
      }

      notify("success", "Catatan Ditambahkan", "Catatan progres tersimpan.");
      return { ok: true };
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite]
  );

  const uploadEntityFile = useCallback(
    async (
      entityType: SarprasEntityType,
      entityId: string,
      file: File
    ): Promise<{
      ok: boolean;
      attachment?: SarprasAttachment;
      error?: string;
    }> => {
      if (!requireStaffForLiveWrite(ENTITY_TYPE_TO_PAGE_KEY[entityType])) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }

      if (isLiveSupabase && authUser) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entityType", entityType);
          formData.append("entityId", entityId);

          const res = await fetch("/api/sarpras/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.attachment) {
            const errMsg = data.error || "Gagal mengunggah berkas.";
            notify("error", "Gagal Mengunggah Berkas", errMsg);
            return { ok: false, error: errMsg };
          }
          const uploaded = data.attachment as SarprasAttachment;
          setAttachments((prev) => [uploaded, ...prev]);
          if (
            entityType === "maintenance" &&
            uploaded.mime_type.startsWith("image/")
          ) {
            setMaintenanceLogs((prev) =>
              prev.map((m) =>
                m.id === entityId && !m.photo_url
                  ? { ...m, photo_url: uploaded.file_url }
                  : m
              )
            );
          }
          notify(
            "success",
            "Berkas Terunggah",
            `${uploaded.file_name} berhasil disimpan ke Supabase Storage.`
          );
          return { ok: true, attachment: uploaded };
        } catch {
          notify("error", "Gagal Mengunggah Berkas", "Koneksi server terputus.");
          return { ok: false, error: "Koneksi server terputus." };
        }
      }

      const fallbackAtt: SarprasAttachment = {
        id: generateUuid(),
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_path: file.name,
        file_url: URL.createObjectURL(file),
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        uploaded_by: "Staf Lokal",
        created_at: new Date().toISOString(),
      };
      setAttachments((prev) => [fallbackAtt, ...prev]);
      return { ok: true, attachment: fallbackAtt };
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite]
  );

  const deleteEntityAttachment = useCallback(
    async (id: string, filePath?: string) => {
      const targetAtt = attachments.find((a) => a.id === id);
      if (
        !requireStaffForLiveWrite(
          targetAtt ? ENTITY_TYPE_TO_PAGE_KEY[targetAtt.entity_type] : undefined
        )
      ) {
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (isLiveSupabase && authUser) {
        await sendMutation(
          { action: "delete_attachment", id, filePath },
          "Menghapus Lampiran",
          "Lampiran Dihapus",
          "Berkas lampiran telah dihapus.",
          false,
          "info"
        );
      }
    },
    [attachments, authUser, isLiveSupabase, requireStaffForLiveWrite, sendMutation]
  );

  const addLecturer = useCallback(
    (payload: Omit<Lecturer, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("dosen")) return;
      const id = generateUuid();
      const newItem: Lecturer = {
        ...payload,
        id,
        created_at: new Date().toISOString(),
      };
      setLecturers((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_lecturer",
            data: {
              id,
              nidn_nip: payload.nidn_nip,
              full_name: payload.full_name,
              homebase_prodi: payload.homebase_prodi,
              ...(extendedMasterReady ? { unit_id: payload.unit_id || null } : {}),
              employment_status: payload.employment_status,
              academic_rank: payload.academic_rank || "-",
              email: payload.email || null,
              phone: payload.phone || null,
              office_room_id: payload.office_room_id || null,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Data Dosen",
          "Dosen Tersimpan di Supabase",
          `${newItem.nidn_nip} (${newItem.full_name}) berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Data Dosen Ditambahkan",
        `${newItem.nidn_nip} (${newItem.full_name}) berhasil dicatat.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateLecturer = useCallback(
    (id: string, payload: Partial<Omit<Lecturer, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("dosen")) return;
      setLecturers((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        const cleanPayload = { ...payload };
        if (!extendedMasterReady) delete cleanPayload.unit_id;
        void sendMutation(
          { action: "update_lecturer", id, data: cleanPayload },
          "Memperbarui Data Dosen",
          "Data Dosen Diperbarui",
          "Perubahan data dosen tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Data Dosen Diperbarui",
        "Perubahan profil dosen berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteLecturer = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("dosen")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = lecturers.find((l) => l.id === id);
      const applyLocalDelete = () => {
        setLecturers((prev) => prev.filter((item) => item.id !== id));
        setCourses((prev) =>
          prev.map((c) => (c.lecturer_id === id ? { ...c, lecturer_id: null } : c))
        );
        removeEntityArtifactsLocal("lecturer", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_lecturer", id },
          "Menghapus Data Dosen",
          "Data Dosen Dihapus",
          `Dosen ${target?.full_name || ""} telah dihapus dari database.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Data Dosen Dihapus",
        `Dosen ${target?.full_name || ""} telah dihapus dari Data Master.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      lecturers,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addCourse = useCallback(
    (payload: Omit<Course, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("makul")) return;
      const id = generateUuid();
      const newItem: Course = {
        ...payload,
        id,
        created_at: new Date().toISOString(),
      };
      setCourses((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_course",
            data: {
              id,
              code: payload.code,
              name: payload.name,
              prodi: payload.prodi,
              ...(extendedMasterReady ? { unit_id: payload.unit_id || null } : {}),
              semester: payload.semester,
              curriculum_year: payload.curriculum_year,
              sks_theory: payload.sks_theory,
              sks_practice: payload.sks_practice,
              course_type: payload.course_type,
              lecturer_id: payload.lecturer_id || null,
              preferred_room_id: payload.preferred_room_id || null,
              is_active: payload.is_active,
              description: payload.description || null,
            },
          },
          "Menambah Mata Kuliah",
          "Mata Kuliah Tersimpan",
          `${newItem.code} (${newItem.name}) berhasil disimpan ke database.`
        );
        return;
      }

      notify(
        "success",
        "Mata Kuliah Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil didaftarkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateCourse = useCallback(
    (id: string, payload: Partial<Omit<Course, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("makul")) return;
      setCourses((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        const cleanPayload = { ...payload };
        if (!extendedMasterReady) delete cleanPayload.unit_id;
        void sendMutation(
          { action: "update_course", id, data: cleanPayload },
          "Memperbarui Mata Kuliah",
          "Mata Kuliah Diperbarui",
          "Perubahan data mata kuliah tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Mata Kuliah Diperbarui",
        "Perubahan data mata kuliah berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteCourse = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("makul")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = courses.find((c) => c.id === id);
      const applyLocalDelete = () => {
        setCourses((prev) => prev.filter((item) => item.id !== id));
        removeEntityArtifactsLocal("course", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_course", id },
          "Menghapus Mata Kuliah",
          "Mata Kuliah Dihapus",
          `${target?.code || ""} (${target?.name || ""}) telah dihapus.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Mata Kuliah Dihapus",
        `${target?.code || ""} telah dihapus dari daftar Makul.`
      );
      return { ok: true };
    },
    [
      authUser,
      courses,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addCampusOfficial = useCallback(
    (payload: Omit<CampusOfficial, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("pengurus")) return;
      const id = generateUuid();
      const newItem: CampusOfficial = {
        ...payload,
        id,
        created_at: new Date().toISOString(),
      };
      setCampusOfficials((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_official",
            data: {
              id,
              official_code: payload.official_code,
              full_name: payload.full_name,
              position_title: payload.position_title,
              unit_name: payload.unit_name,
              ...(extendedMasterReady ? { unit_id: payload.unit_id || null } : {}),
              category: payload.category,
              email: payload.email || null,
              phone: payload.phone || null,
              period_label: payload.period_label,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Pengurus Kampus",
          "Pengurus Kampus Tersimpan",
          `${newItem.official_code} (${newItem.full_name}) berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Pengurus Kampus Ditambahkan",
        `${newItem.full_name} (${newItem.position_title}) berhasil dicatat.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateCampusOfficial = useCallback(
    (
      id: string,
      payload: Partial<Omit<CampusOfficial, "id" | "created_at">>
    ) => {
      if (!requireMasterAdminForDataMaster("pengurus")) return;
      setCampusOfficials((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        const cleanPayload = { ...payload };
        if (!extendedMasterReady) delete cleanPayload.unit_id;
        void sendMutation(
          { action: "update_official", id, data: cleanPayload },
          "Memperbarui Pengurus Kampus",
          "Data Pengurus Diperbarui",
          "Perubahan data pengurus kampus tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Data Pengurus Diperbarui",
        "Perubahan data pengurus kampus berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteCampusOfficial = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("pengurus")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = campusOfficials.find((o) => o.id === id);
      const applyLocalDelete = () => {
        setCampusOfficials((prev) => prev.filter((item) => item.id !== id));
        removeEntityArtifactsLocal("official", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_official", id },
          "Menghapus Pengurus Kampus",
          "Pengurus Kampus Dihapus",
          `${target?.full_name || ""} telah dihapus dari Data Master.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Pengurus Kampus Dihapus",
        `${target?.full_name || ""} telah dihapus dari daftar pengurus.`
      );
      return { ok: true };
    },
    [
      authUser,
      campusOfficials,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  // ============================================================================
  // DATA MASTER PRIORITAS 1: UNIT/PRODI/ORMAWA, TEKNISI & VENDOR, DAN REFERENSI
  // ============================================================================

  const addCampusUnit = useCallback(
    (payload: Omit<CampusUnit, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("unit")) return;
      const id = generateUuid();
      const newItem: CampusUnit = {
        ...payload,
        id,
        created_at: new Date().toISOString(),
      };
      setCampusUnits((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_campus_unit",
            data: {
              id,
              code: payload.code,
              name: payload.name,
              unit_type: payload.unit_type,
              parent_unit_id: payload.parent_unit_id || null,
              leader_name: payload.leader_name || null,
              phone: payload.phone || null,
              email: payload.email || null,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Unit Kampus",
          "Unit Kampus Tersimpan",
          `${newItem.code} (${newItem.name}) berhasil disimpan ke database.`
        );
        return;
      }

      notify(
        "success",
        "Unit Kampus Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil dicatat.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateCampusUnit = useCallback(
    (id: string, payload: Partial<Omit<CampusUnit, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("unit")) return;
      setCampusUnits((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_campus_unit", id, data: payload },
          "Memperbarui Unit Kampus",
          "Unit Kampus Diperbarui",
          "Perubahan data unit/prodi/ormawa tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Unit Kampus Diperbarui",
        "Perubahan data unit/prodi/ormawa berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteCampusUnit = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("unit")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = campusUnits.find((u) => u.id === id);
      const applyLocalDelete = () => {
        setCampusUnits((prev) =>
          prev
            .filter((item) => item.id !== id)
            .map((item) =>
              item.parent_unit_id === id ? { ...item, parent_unit_id: null } : item
            )
        );
        setLecturers((prev) =>
          prev.map((l) => (l.unit_id === id ? { ...l, unit_id: null } : l))
        );
        setCourses((prev) =>
          prev.map((c) => (c.unit_id === id ? { ...c, unit_id: null } : c))
        );
        setCampusOfficials((prev) =>
          prev.map((o) => (o.unit_id === id ? { ...o, unit_id: null } : o))
        );
        setBookings((prev) =>
          prev.map((b) => (b.unit_id === id ? { ...b, unit_id: null } : b))
        );
        setConsumableTransactions((prev) =>
          prev.map((t) => (t.unit_id === id ? { ...t, unit_id: null } : t))
        );
        removeEntityArtifactsLocal("unit", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_campus_unit", id },
          "Menghapus Unit Kampus",
          "Unit Kampus Dihapus",
          `${target?.name || ""} telah dihapus dari Data Master.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Unit Kampus Dihapus",
        `${target?.name || ""} telah dihapus dari Data Master.`
      );
      return { ok: true };
    },
    [
      authUser,
      campusUnits,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addMaintenanceVendor = useCallback(
    (payload: Omit<MaintenanceVendor, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("vendor")) return;
      const id = generateUuid();
      const newItem: MaintenanceVendor = {
        ...payload,
        id,
        created_at: new Date().toISOString(),
      };
      setMaintenanceVendors((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_vendor",
            data: {
              id,
              vendor_code: payload.vendor_code,
              name: payload.name,
              vendor_type: payload.vendor_type,
              specialty: payload.specialty,
              pic_name: payload.pic_name,
              phone: payload.phone,
              email: payload.email || null,
              address: payload.address || null,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Teknisi / Vendor",
          "Teknisi / Vendor Tersimpan",
          `${newItem.vendor_code} (${newItem.name}) berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Teknisi / Vendor Ditambahkan",
        `${newItem.vendor_code} (${newItem.name}) berhasil dicatat.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateMaintenanceVendor = useCallback(
    (
      id: string,
      payload: Partial<Omit<MaintenanceVendor, "id" | "created_at">>
    ) => {
      if (!requireMasterAdminForDataMaster("vendor")) return;
      setMaintenanceVendors((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_vendor", id, data: payload },
          "Memperbarui Teknisi / Vendor",
          "Teknisi / Vendor Diperbarui",
          "Perubahan data teknisi/vendor tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Teknisi / Vendor Diperbarui",
        "Perubahan data teknisi/vendor berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteMaintenanceVendor = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("vendor")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = maintenanceVendors.find((v) => v.id === id);
      const applyLocalDelete = () => {
        setMaintenanceVendors((prev) => prev.filter((item) => item.id !== id));
        setMaintenanceLogs((prev) =>
          prev.map((m) => (m.vendor_id === id ? { ...m, vendor_id: null } : m))
        );
        removeEntityArtifactsLocal("vendor", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_vendor", id },
          "Menghapus Teknisi / Vendor",
          "Teknisi / Vendor Dihapus",
          `${target?.name || ""} telah dihapus dari Data Master.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Teknisi / Vendor Dihapus",
        `${target?.name || ""} telah dihapus dari daftar vendor.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      maintenanceVendors,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addAssetCategory = useCallback(
    (payload: Omit<AssetCategory, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      const id = generateUuid();
      const newItem: AssetCategory = {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        id,
        created_at: new Date().toISOString(),
      };
      setAssetCategories((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_asset_category",
            data: {
              id,
              code: newItem.code,
              name: payload.name,
              description: payload.description || null,
              useful_life_years: payload.useful_life_years,
              is_active: payload.is_active,
            },
          },
          "Menambah Kategori Aset",
          "Kategori Aset Tersimpan",
          `${newItem.code} (${newItem.name}) berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Kategori Aset Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil ditambahkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateAssetCategory = useCallback(
    (id: string, payload: Partial<Omit<AssetCategory, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      setAssetCategories((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_asset_category", id, data: payload },
          "Memperbarui Kategori Aset",
          "Kategori Aset Diperbarui",
          "Perubahan kategori aset tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Kategori Aset Diperbarui",
        "Perubahan kategori aset berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteAssetCategory = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("referensi")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = assetCategories.find((c) => c.id === id);
      const applyLocalDelete = () => {
        setAssetCategories((prev) => prev.filter((item) => item.id !== id));
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_asset_category", id },
          "Menghapus Kategori Aset",
          "Kategori Aset Dihapus",
          `Kategori ${target?.code || ""} telah dihapus.`,
          applyLocalDelete
        );
      }

      const usedCount = target
        ? assets.filter((a) => a.category === target.code).length
        : 0;
      if (usedCount > 0) {
        const err = `Kategori "${target?.code}" masih digunakan oleh ${usedCount} unit aset.`;
        notify("error", "Gagal Menghapus Kategori", err);
        return { ok: false, error: err };
      }

      applyLocalDelete();
      notify(
        "info",
        "Kategori Aset Dihapus",
        `Kategori ${target?.code || ""} telah dihapus.`
      );
      return { ok: true };
    },
    [
      assetCategories,
      assets,
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addFundingSource = useCallback(
    (payload: Omit<FundingSource, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      const id = generateUuid();
      const newItem: FundingSource = {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        id,
        created_at: new Date().toISOString(),
      };
      setFundingSources((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_funding_source",
            data: {
              id,
              code: newItem.code,
              name: payload.name,
              source_type: payload.source_type,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Sumber Dana",
          "Sumber Dana Tersimpan",
          `${newItem.code} (${newItem.name}) berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Sumber Dana Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil ditambahkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateFundingSource = useCallback(
    (id: string, payload: Partial<Omit<FundingSource, "id" | "created_at">>) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      setFundingSources((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_funding_source", id, data: payload },
          "Memperbarui Sumber Dana",
          "Sumber Dana Diperbarui",
          "Perubahan sumber dana tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Sumber Dana Diperbarui",
        "Perubahan sumber dana berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteFundingSource = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("referensi")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = fundingSources.find((f) => f.id === id);
      const applyLocalDelete = () => {
        setFundingSources((prev) => prev.filter((item) => item.id !== id));
        setAssets((prev) =>
          prev.map((a) =>
            a.funding_source_id === id ? { ...a, funding_source_id: null } : a
          )
        );
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_funding_source", id },
          "Menghapus Sumber Dana",
          "Sumber Dana Dihapus",
          `Sumber dana ${target?.name || ""} telah dihapus.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Sumber Dana Dihapus",
        `Sumber dana ${target?.name || ""} telah dihapus.`
      );
      return { ok: true };
    },
    [
      authUser,
      fundingSources,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addConsumableCategory = useCallback(
    (payload: Omit<ConsumableCategoryMaster, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      const id = generateUuid();
      const newItem: ConsumableCategoryMaster = {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        id,
        created_at: new Date().toISOString(),
      };
      setConsumableCategories((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_consumable_category",
            data: {
              id,
              code: newItem.code,
              name: payload.name,
              description: payload.description || null,
              is_active: payload.is_active,
            },
          },
          "Menambah Kategori BHP",
          "Kategori BHP Tersimpan",
          `${newItem.name} berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Kategori BHP Ditambahkan",
        `${newItem.name} berhasil ditambahkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateConsumableCategory = useCallback(
    (
      id: string,
      payload: Partial<Omit<ConsumableCategoryMaster, "id" | "created_at">>
    ) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      setConsumableCategories((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_consumable_category", id, data: payload },
          "Memperbarui Kategori BHP",
          "Kategori BHP Diperbarui",
          "Perubahan kategori BHP tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Kategori BHP Diperbarui",
        "Perubahan kategori BHP berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteConsumableCategory = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("referensi")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = consumableCategories.find((c) => c.id === id);
      const applyLocalDelete = () => {
        setConsumableCategories((prev) => prev.filter((item) => item.id !== id));
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_consumable_category", id },
          "Menghapus Kategori BHP",
          "Kategori BHP Dihapus",
          `Kategori BHP ${target?.name || ""} telah dihapus.`,
          applyLocalDelete
        );
      }

      const usedCount = target
        ? consumables.filter((c) => c.category === target.name).length
        : 0;
      if (usedCount > 0) {
        const err = `Kategori BHP "${target?.name}" masih digunakan oleh ${usedCount} item BHP.`;
        notify("error", "Gagal Menghapus Kategori BHP", err);
        return { ok: false, error: err };
      }

      applyLocalDelete();
      notify(
        "info",
        "Kategori BHP Dihapus",
        `Kategori BHP ${target?.name || ""} telah dihapus.`
      );
      return { ok: true };
    },
    [
      authUser,
      consumableCategories,
      consumables,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  const addConsumableUnit = useCallback(
    (payload: Omit<ConsumableUnitMaster, "id" | "created_at">) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      const id = generateUuid();
      const newItem: ConsumableUnitMaster = {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        id,
        created_at: new Date().toISOString(),
      };
      setConsumableUnits((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_consumable_unit",
            data: {
              id,
              code: newItem.code,
              name: payload.name,
              description: payload.description || null,
              is_active: payload.is_active,
            },
          },
          "Menambah Satuan BHP",
          "Satuan BHP Tersimpan",
          `Satuan ${newItem.name} berhasil disimpan.`
        );
        return;
      }

      notify(
        "success",
        "Satuan BHP Ditambahkan",
        `Satuan ${newItem.name} berhasil ditambahkan.`
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateConsumableUnit = useCallback(
    (
      id: string,
      payload: Partial<Omit<ConsumableUnitMaster, "id" | "created_at">>
    ) => {
      if (!requireMasterAdminForDataMaster("referensi")) return;
      setConsumableUnits((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_consumable_unit", id, data: payload },
          "Memperbarui Satuan BHP",
          "Satuan BHP Diperbarui",
          "Perubahan satuan BHP tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Satuan BHP Diperbarui",
        "Perubahan satuan BHP berhasil disimpan."
      );
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteConsumableUnit = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("referensi")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = consumableUnits.find((u) => u.id === id);
      const applyLocalDelete = () => {
        setConsumableUnits((prev) => prev.filter((item) => item.id !== id));
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_consumable_unit", id },
          "Menghapus Satuan BHP",
          "Satuan BHP Dihapus",
          `Satuan ${target?.name || ""} telah dihapus.`,
          applyLocalDelete
        );
      }

      const usedCount = target
        ? consumables.filter((c) => c.unit === target.name).length
        : 0;
      if (usedCount > 0) {
        const err = `Satuan "${target?.name}" masih digunakan oleh ${usedCount} item BHP.`;
        notify("error", "Gagal Menghapus Satuan BHP", err);
        return { ok: false, error: err };
      }

      applyLocalDelete();
      notify(
        "info",
        "Satuan BHP Dihapus",
        `Satuan ${target?.name || ""} telah dihapus.`
      );
      return { ok: true };
    },
    [
      authUser,
      consumableUnits,
      consumables,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  // ============================================================================
  // DATA MASTER KELAS & DPM
  // ============================================================================

  const addAcademicClass = useCallback(
    (
      payload: Omit<AcademicClass, "id" | "class_code" | "created_at">
    ): ActionResult => {
      if (!requireMasterAdminForDataMaster("kelas")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const normYear = normalizeAngkatanYear(payload.angkatan_year);
      if (!/^\d{2}$/.test(normYear)) {
        return {
          ok: false,
          error:
            "Tahun angkatan harus diisi 2 angka belakang tahun (contoh: 24 untuk 2024).",
        };
      }
      const classCode = buildAcademicClassCode(
        payload.prodi,
        normYear,
        payload.class_section
      );
      const dup = academicClasses.some(
        (c) => c.class_code.toUpperCase() === classCode.toUpperCase()
      );
      if (dup) {
        return {
          ok: false,
          error: `Kelas ${classCode} sudah terdaftar di Data Master Kelas.`,
        };
      }

      const id = generateUuid();
      const matchedUnit = campusUnits.find(
        (u) => u.code.toUpperCase() === payload.prodi.toUpperCase()
      );
      const newItem: AcademicClass = {
        ...payload,
        id,
        class_code: classCode,
        angkatan_year: normYear,
        unit_id: payload.unit_id ?? matchedUnit?.id ?? null,
        dpm_phone: payload.dpm_phone.trim() || "-",
        created_at: new Date().toISOString(),
      };
      setAcademicClasses((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_academic_class",
            data: {
              id,
              class_code: classCode,
              prodi: payload.prodi,
              unit_id: newItem.unit_id,
              angkatan_year: normYear,
              class_section: payload.class_section,
              dpm_name: payload.dpm_name.trim(),
              dpm_phone: newItem.dpm_phone,
              students_count: newItem.students_count,
              default_room_id: payload.default_room_id || null,
              is_active: payload.is_active,
              notes: payload.notes || null,
            },
          },
          "Menambah Kelas & DPM",
          "Kelas Tersimpan di Supabase",
          `Kelas ${classCode} (DPM: ${newItem.dpm_name}) berhasil disimpan.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Kelas Ditambahkan",
        `Kelas ${classCode} (DPM: ${newItem.dpm_name}) berhasil ditambahkan.`
      );
      return { ok: true };
    },
    [
      academicClasses,
      authUser,
      campusUnits,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const updateAcademicClass = useCallback(
    (
      id: string,
      payload: Partial<Omit<AcademicClass, "id" | "class_code" | "created_at">>
    ): ActionResult => {
      if (!requireMasterAdminForDataMaster("kelas")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const existing = academicClasses.find((c) => c.id === id);
      if (!existing) {
        return { ok: false, error: "Data kelas tidak ditemukan." };
      }

      const nextProdi = payload.prodi ?? existing.prodi;
      const nextYear = normalizeAngkatanYear(
        payload.angkatan_year ?? existing.angkatan_year
      );
      if (!/^\d{2}$/.test(nextYear)) {
        return {
          ok: false,
          error:
            "Tahun angkatan harus diisi 2 angka belakang tahun (contoh: 24 untuk 2024).",
        };
      }
      const nextSection = payload.class_section ?? existing.class_section;
      const nextCode = buildAcademicClassCode(nextProdi, nextYear, nextSection);

      const dup = academicClasses.some(
        (c) =>
          c.id !== id && c.class_code.toUpperCase() === nextCode.toUpperCase()
      );
      if (dup) {
        return {
          ok: false,
          error: `Kombinasi kelas ${nextCode} sudah digunakan kelas lain.`,
        };
      }

      const matchedUnit = campusUnits.find(
        (u) => u.code.toUpperCase() === nextProdi.toUpperCase()
      );
      const nextUnitId =
        payload.unit_id !== undefined
          ? payload.unit_id
          : matchedUnit?.id ?? existing.unit_id ?? null;

      const updatedFields: Partial<AcademicClass> = {
        ...payload,
        prodi: nextProdi,
        angkatan_year: nextYear,
        class_section: nextSection,
        class_code: nextCode,
        unit_id: nextUnitId,
      };

      setAcademicClasses((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updatedFields } : item
        )
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "update_academic_class",
            id,
            data: updatedFields,
          },
          "Memperbarui Data Kelas",
          "Data Kelas Diperbarui",
          `Perubahan kelas ${nextCode} tersimpan di Supabase.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Data Kelas Diperbarui",
        `Perubahan kelas ${nextCode} berhasil disimpan.`
      );
      return { ok: true };
    },
    [
      academicClasses,
      authUser,
      campusUnits,
      isLiveSupabase,
      notify,
      requireMasterAdminForDataMaster,
      sendMutation,
    ]
  );

  const deleteAcademicClass = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireMasterAdminForDataMaster("kelas")) {
        return { ok: false, error: "Akses Master Admin diperlukan." };
      }
      const target = academicClasses.find((c) => c.id === id);
      const applyLocalDelete = () => {
        setAcademicClasses((prev) => prev.filter((item) => item.id !== id));
        setOfficeKitLoans((prev) =>
          prev.map((l) => (l.class_id === id ? { ...l, class_id: null } : l))
        );
        setBookings((prev) =>
          prev.map((b) => (b.class_id === id ? { ...b, class_id: null } : b))
        );
        removeEntityArtifactsLocal("class", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_academic_class", id },
          "Menghapus Data Kelas",
          "Data Kelas Dihapus",
          `Kelas ${target?.class_code || ""} telah dihapus dari Data Master.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Data Kelas Dihapus",
        `Kelas ${target?.class_code || ""} telah dihapus dari Data Master.`
      );
      return { ok: true };
    },
    [
      academicClasses,
      authUser,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireMasterAdminForDataMaster,
      sendConfirmedMutation,
    ]
  );

  // ============================================================================
  // SIRKULASI INVENT: BARANG KANTOR STAF & PEMINJAMAN CEPAT KELAS
  // ============================================================================

  const addOfficeKitItem = useCallback(
    (payload: Omit<OfficeKitItem, "id" | "created_at">): ActionResult => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const cleanCode = payload.kit_code.trim().toUpperCase();
      if (!cleanCode || !payload.name.trim()) {
        return {
          ok: false,
          error: "Kode Barang dan Nama Barang Kantor Staf wajib diisi.",
        };
      }
      const dup = officeKitItems.some(
        (item) => item.kit_code.toUpperCase() === cleanCode
      );
      if (dup) {
        return {
          ok: false,
          error: `Kode barang "${cleanCode}" sudah terdaftar di Katalog Kantor Staf.`,
        };
      }

      const id = generateUuid();
      const newItem: OfficeKitItem = {
        ...payload,
        id,
        kit_code: cleanCode,
        name: payload.name.trim(),
        created_at: new Date().toISOString(),
      };
      setOfficeKitItems((prev) => [newItem, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_office_kit_item",
            data: {
              id,
              kit_code: newItem.kit_code,
              name: newItem.name,
              category: newItem.category,
              brand_spec: newItem.brand_spec || "-",
              storage_tray: newItem.storage_tray || "Loker Kantor Staf",
              linked_room_id: newItem.linked_room_id || null,
              condition: newItem.condition,
              status: newItem.status,
              is_active: newItem.is_active,
              notes: newItem.notes || null,
            },
          },
          "Menambah Barang Kantor Staf",
          "Barang Kantor Staf Tersimpan",
          `${newItem.kit_code} (${newItem.name}) berhasil disimpan.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Barang Kantor Staf Ditambahkan",
        `${newItem.kit_code} (${newItem.name}) siap dipinjamkan.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitItems,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const updateOfficeKitItem = useCallback(
    (
      id: string,
      payload: Partial<Omit<OfficeKitItem, "id" | "created_at">>
    ) => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) return;
      setOfficeKitItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_office_kit_item", id, data: payload },
          "Memperbarui Barang Kantor Staf",
          "Barang Kantor Staf Diperbarui",
          "Perubahan data barang kantor staf tersimpan di Supabase."
        );
        return;
      }

      notify(
        "success",
        "Barang Kantor Staf Diperbarui",
        "Perubahan data barang kantor staf berhasil disimpan."
      );
    },
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const deleteOfficeKitItem = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = officeKitItems.find((item) => item.id === id);
      if (target?.status === "Dipinjam") {
        return {
          ok: false,
          error: `Barang ${target.kit_code} sedang dipinjam kelas. Catat pengembalian terlebih dahulu.`,
        };
      }

      const applyLocalDelete = () => {
        setOfficeKitItems((prev) => prev.filter((item) => item.id !== id));
        removeEntityArtifactsLocal("office_kit", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_office_kit_item", id },
          "Menghapus Barang Kantor Staf",
          "Barang Kantor Staf Dihapus",
          `${target?.kit_code || ""} telah dihapus dari katalog.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Barang Kantor Staf Dihapus",
        `${target?.kit_code || ""} telah dihapus dari katalog kantor staf.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitItems,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const checkoutOfficeKitLoan = useCallback(
    (payload: {
      class_id?: string | null;
      class_code: string;
      prodi: ProdiCode;
      dpm_name: string;
      borrower_name: string;
      borrower_phone: string;
      room_id?: string | null;
      course_name?: string;
      kit_item_ids: string[];
      loan_date: string;
      borrow_time: string;
      expected_return_time: string;
    }): ActionResult => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      if (!payload.kit_item_ids || payload.kit_item_ids.length === 0) {
        return {
          ok: false,
          error:
            "Pilih minimal 1 barang (Kabel HDMI, Stop Kontak, atau Remote TV) untuk dipinjamkan.",
        };
      }
      if (payload.expected_return_time <= payload.borrow_time) {
        return {
          ok: false,
          error: "Estimasi jam kembali harus lebih besar daripada jam pinjam.",
        };
      }

      const selectedItems = officeKitItems.filter((item) =>
        payload.kit_item_ids.includes(item.id)
      );
      if (selectedItems.length === 0) {
        return { ok: false, error: "Barang yang dipilih tidak ditemukan." };
      }

      const busyItem = selectedItems.find((item) => item.status !== "Tersedia");
      if (busyItem) {
        return {
          ok: false,
          error: `Barang ${busyItem.kit_code} (${busyItem.name}) saat ini berstatus "${busyItem.status}" dan tidak tersedia.`,
        };
      }

      const seq = String(
        extractMaxSequence(officeKitLoans.map((l) => l.loan_code)) + 1
      ).padStart(3, "0");
      const id = generateUuid();
      const loan_code = `SRK-${getCurrentYearMonth()}-${seq}`;
      const kit_items_label = selectedItems
        .map((item) => `${item.kit_code} (${item.name})`)
        .join(", ");
      const staffName = authUser?.fullName || "Staf Piket Kantor";

      const newLoan: OfficeKitLoan = {
        id,
        loan_code,
        class_id: payload.class_id || null,
        class_code: payload.class_code,
        prodi: payload.prodi,
        dpm_name: payload.dpm_name,
        borrower_name: payload.borrower_name.trim(),
        borrower_phone: payload.borrower_phone.trim() || "-",
        room_id: payload.room_id || null,
        course_name: payload.course_name?.trim() || "",
        kit_item_ids: selectedItems.map((i) => i.id),
        kit_items_label,
        loan_date: payload.loan_date,
        borrow_time: payload.borrow_time,
        expected_return_time: payload.expected_return_time,
        returned_at: null,
        status: "Dipinjam",
        handed_by_staff: staffName,
        created_at: new Date().toISOString(),
      };

      setOfficeKitLoans((prev) => [newLoan, ...prev]);
      const idSet = new Set(selectedItems.map((i) => i.id));
      setOfficeKitItems((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, status: "Dipinjam" } : item
        )
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "checkout_office_kit_loan",
            itemIds: newLoan.kit_item_ids,
            data: {
              id,
              loan_code,
              class_id: newLoan.class_id,
              class_code: newLoan.class_code,
              prodi: newLoan.prodi,
              dpm_name: newLoan.dpm_name,
              borrower_name: newLoan.borrower_name,
              borrower_phone: newLoan.borrower_phone,
              room_id: newLoan.room_id,
              course_name: newLoan.course_name || null,
              kit_item_ids: newLoan.kit_item_ids,
              kit_items_label: newLoan.kit_items_label,
              loan_date: newLoan.loan_date,
              borrow_time: newLoan.borrow_time,
              expected_return_time: newLoan.expected_return_time,
              status: "Dipinjam",
              handed_by_staff: staffName,
            },
          },
          "Mencatat Sirkulasi Alat Kantor Staf",
          "Alat Diserahkan ke Kelas",
          `${loan_code}: ${selectedItems.length} barang dipinjamkan ke kelas ${newLoan.class_code}.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Alat Diserahkan ke Kelas",
        `${loan_code}: ${selectedItems.length} barang dicatat dipinjam kelas ${newLoan.class_code}.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitItems,
      officeKitLoans,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const checkinOfficeKitLoan = useCallback(
    (
      id: string,
      options?: {
        returnConditionNotes?: string;
        damagedItemIds?: string[];
      }
    ): ActionResult => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = officeKitLoans.find((l) => l.id === id);
      if (!target) {
        return { ok: false, error: "Tiket sirkulasi tidak ditemukan." };
      }

      const returnedAt = new Date().toISOString();
      const staffName = authUser?.fullName || "Staf Piket Kantor";
      const notesText =
        options?.returnConditionNotes?.trim() ||
        "Seluruh peralatan dikembalikan lengkap ke kantor staf dalam kondisi baik.";
      const damagedSet = new Set(options?.damagedItemIds || []);
      const loanItemSet = new Set(target.kit_item_ids);

      setOfficeKitLoans((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "Dikembalikan",
                returned_at: returnedAt,
                received_by_staff: staffName,
                return_condition_notes: notesText,
              }
            : item
        )
      );

      setOfficeKitItems((prev) =>
        prev.map((item) => {
          if (!loanItemSet.has(item.id)) return item;
          if (damagedSet.has(item.id)) {
            return {
              ...item,
              status: "Perbaikan",
              condition: "Rusak Ringan",
            };
          }
          return { ...item, status: "Tersedia" };
        })
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "checkin_office_kit_loan",
            id,
            itemIds: target.kit_item_ids,
            damagedItemIds: Array.from(damagedSet),
            data: {
              status: "Dikembalikan",
              returned_at: returnedAt,
              received_by_staff: staffName,
              return_condition_notes: notesText,
            },
          },
          "Mencatat Pengembalian Alat Staf",
          "Pengembalian Alat Diterima",
          `${target.loan_code} (${target.class_code}) telah selesai dikembalikan.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Pengembalian Alat Diterima",
        `${target.loan_code} (${target.class_code}) telah selesai dikembalikan ke kantor staf.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitLoans,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const reopenOfficeKitLoan = useCallback(
    (id: string): ActionResult => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = officeKitLoans.find((l) => l.id === id);
      if (!target) {
        return { ok: false, error: "Tiket sirkulasi tidak ditemukan." };
      }

      const idSet = new Set(target.kit_item_ids);
      const unavailable = officeKitItems.filter(
        (item) => idSet.has(item.id) && item.status !== "Tersedia"
      );
      if (unavailable.length > 0) {
        const msg = `Tidak dapat mengembalikan tiket ${target.loan_code} ke status Dipinjam karena ${unavailable
          .map((i) => `${i.kit_code} (${i.status})`)
          .join(", ")} sedang tidak tersedia.`;
        notify("error", "Gagal Mengubah Status Tiket", msg);
        return { ok: false, error: msg };
      }

      setOfficeKitLoans((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "Dipinjam",
                returned_at: null,
                received_by_staff: undefined,
              }
            : item
        )
      );
      setOfficeKitItems((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, status: "Dipinjam" } : item
        )
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "reopen_office_kit_loan",
            id,
            itemIds: target.kit_item_ids,
            data: {
              status: "Dipinjam",
              returned_at: null,
              received_by_staff: null,
            },
          },
          "Mengubah Status Sirkulasi",
          "Tiket Kembali ke Status Dipinjam",
          `${target.loan_code} (${target.class_code}) diaktifkan kembali menjadi Sedang Dipinjam.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Status Tiket Diubah",
        `${target.loan_code} (${target.class_code}) diaktifkan kembali menjadi Sedang Dipinjam.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitItems,
      officeKitLoans,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const deleteOfficeKitLoan = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite("sirkulasi-invent")) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = officeKitLoans.find((l) => l.id === id);
      const applyLocalDelete = () => {
        setOfficeKitLoans((prev) => prev.filter((item) => item.id !== id));
        if (target?.status === "Dipinjam" && target.kit_item_ids.length > 0) {
          const idSet = new Set(target.kit_item_ids);
          setOfficeKitItems((prev) =>
            prev.map((item) =>
              idSet.has(item.id) && item.status === "Dipinjam"
                ? { ...item, status: "Tersedia" }
                : item
            )
          );
        }
        removeEntityArtifactsLocal("office_loan", id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_office_kit_loan", id },
          "Menghapus Riwayat Sirkulasi",
          "Riwayat Sirkulasi Dihapus",
          `Tiket ${target?.loan_code || ""} telah dihapus dari daftar.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Riwayat Sirkulasi Dihapus",
        `Tiket ${target?.loan_code || ""} telah dihapus.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      officeKitLoans,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
    ]
  );

  const addThesisWorkflow = useCallback(
    (
      payload: Omit<ThesisWorkflow, "id" | "ticket_code" | "created_at">
    ): ActionResult => {
      const pageKey = getThesisPageKey(payload.track, payload.stage);
      if (!requireStaffForLiveWrite(pageKey)) {
        return { ok: false, error: "Otoritas halaman tidak mencukupi." };
      }
      if (
        !payload.student_name.trim() ||
        !payload.student_nim.trim() ||
        !payload.title.trim()
      ) {
        return {
          ok: false,
          error: "Nama mahasiswa, NIM, dan judul wajib diisi.",
        };
      }

      const prefix = getThesisTicketPrefix(payload.track, payload.stage);
      const samePrefixCodes = thesisWorkflows
        .filter((w) => w.ticket_code.startsWith(`${prefix}-`))
        .map((w) => w.ticket_code);
      const seq = String(extractMaxSequence(samePrefixCodes) + 1).padStart(
        3,
        "0"
      );
      const id = generateUuid();
      const ticket_code = `${prefix}-${getCurrentYearMonth()}-${seq}`;
      const staffName =
        authUser?.fullName || authUser?.username || "Staf Piket Kantor";
      const nowIso = new Date().toISOString();

      const newRow: ThesisWorkflow = {
        ...payload,
        id,
        ticket_code,
        board_column: payload.board_column || "berkas_daftar",
        student_name: payload.student_name.trim(),
        student_nim: payload.student_nim.trim(),
        student_phone: payload.student_phone?.trim() || "-",
        title: payload.title.trim(),
        journal_name: payload.journal_name?.trim() || null,
        journal_url: payload.journal_url?.trim() || null,
        document_notes: payload.document_notes?.trim() || null,
        letter_status: payload.letter_status || "Belum Dibuat",
        created_by_staff: staffName,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setThesisWorkflows((prev) => [newRow, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_thesis_workflow",
            data: {
              id: newRow.id,
              ticket_code: newRow.ticket_code,
              track: newRow.track,
              stage: newRow.stage,
              board_column: newRow.board_column,
              student_name: newRow.student_name,
              student_nim: newRow.student_nim,
              student_phone: newRow.student_phone,
              prodi: newRow.prodi,
              class_id: newRow.class_id || null,
              class_code: newRow.class_code || null,
              title: newRow.title,
              journal_name: newRow.journal_name,
              journal_url: newRow.journal_url,
              supervisor_1_id: newRow.supervisor_1_id || null,
              supervisor_2_id: newRow.supervisor_2_id || null,
              examiner_1_id: newRow.examiner_1_id || null,
              examiner_2_id: newRow.examiner_2_id || null,
              registered_at: newRow.registered_at,
              document_notes: newRow.document_notes,
              schedule_date: newRow.schedule_date || null,
              schedule_start_time: newRow.schedule_start_time || null,
              schedule_end_time: newRow.schedule_end_time || null,
              room_id: newRow.room_id || null,
              letter_number: newRow.letter_number || null,
              letter_date: newRow.letter_date || null,
              letter_signer_official_id:
                newRow.letter_signer_official_id || null,
              letter_status: newRow.letter_status,
              archived_at: newRow.archived_at || null,
              archive_notes: newRow.archive_notes || null,
              source_workflow_id: newRow.source_workflow_id || null,
              created_by_staff: staffName,
            },
          },
          "Menambahkan Berkas Tugas Akhir",
          "Berkas Mahasiswa Terdaftar",
          `${ticket_code}: ${newRow.student_name} masuk ke kolom Berkas Daftar.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Berkas Mahasiswa Terdaftar",
        `${ticket_code}: ${newRow.student_name} berhasil ditambahkan.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
      thesisWorkflows,
    ]
  );

  const updateThesisWorkflow = useCallback(
    (
      id: string,
      patch: Partial<
        Omit<
          ThesisWorkflow,
          "id" | "ticket_code" | "track" | "stage" | "source_workflow_id" | "created_at"
        >
      >
    ): ActionResult => {
      const targetRow = thesisWorkflows.find((w) => w.id === id);
      if (!targetRow) {
        return { ok: false, error: "Data Tugas Akhir tidak ditemukan." };
      }
      const pageKey = getThesisPageKey(targetRow.track, targetRow.stage);
      if (!requireStaffForLiveWrite(pageKey)) {
        return { ok: false, error: "Otoritas halaman tidak mencukupi." };
      }

      if (patch.student_name !== undefined && !patch.student_name.trim()) {
        return { ok: false, error: "Nama mahasiswa wajib diisi." };
      }
      if (patch.student_nim !== undefined && !patch.student_nim.trim()) {
        return { ok: false, error: "NIM mahasiswa wajib diisi." };
      }
      if (patch.title !== undefined && !patch.title.trim()) {
        return { ok: false, error: "Judul wajib diisi." };
      }

      const nextCol = patch.board_column || targetRow.board_column;
      const effectiveScheduleDate =
        patch.schedule_date !== undefined
          ? patch.schedule_date
          : targetRow.schedule_date;
      if (
        (nextCol === "bikin_surat" || nextCol === "selesai_arsip") &&
        !effectiveScheduleDate
      ) {
        notify(
          "error",
          "Jadwal Belum Lengkap",
          "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat."
        );
        return {
          ok: false,
          error:
            "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat.",
        };
      }

      const nowIso = new Date().toISOString();
      const nextPatch: Record<string, unknown> = { ...patch };
      if (patch.board_column === "selesai_arsip") {
        if (!targetRow.archived_at && patch.archived_at === undefined) {
          nextPatch.archived_at = nowIso;
        }
        if (
          patch.letter_status === undefined &&
          targetRow.letter_status !== "Terbit"
        ) {
          nextPatch.letter_status = "Terbit";
        }
      } else if (patch.board_column) {
        nextPatch.archived_at = null;
      }

      setThesisWorkflows((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(nextPatch as Partial<ThesisWorkflow>),
                updated_at: nowIso,
              }
            : item
        )
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_thesis_workflow", id, data: nextPatch },
          "Memperbarui Data Tugas Akhir",
          "Data Tugas Akhir Diperbarui",
          `Perubahan pada ${targetRow.ticket_code} (${targetRow.student_name}) tersimpan.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Data Tugas Akhir Diperbarui",
        `Perubahan pada ${targetRow.ticket_code} (${targetRow.student_name}) tersimpan.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
      thesisWorkflows,
    ]
  );

  const moveThesisWorkflow = useCallback(
    (id: string, targetColumn: ThesisBoardColumn): ActionResult => {
      const targetRow = thesisWorkflows.find((w) => w.id === id);
      if (!targetRow) {
        return { ok: false, error: "Data Tugas Akhir tidak ditemukan." };
      }
      const pageKey = getThesisPageKey(targetRow.track, targetRow.stage);
      if (!requireStaffForLiveWrite(pageKey)) {
        return { ok: false, error: "Otoritas halaman tidak mencukupi." };
      }
      if (targetRow.board_column === targetColumn) {
        return { ok: true };
      }

      if (
        (targetColumn === "bikin_surat" || targetColumn === "selesai_arsip") &&
        !targetRow.schedule_date
      ) {
        notify(
          "error",
          "Jadwal Belum Lengkap",
          "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat."
        );
        return {
          ok: false,
          error:
            "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat.",
        };
      }

      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        board_column: targetColumn,
      };
      if (targetColumn === "selesai_arsip") {
        patch.archived_at = nowIso;
        if (targetRow.letter_status !== "Terbit") {
          patch.letter_status = "Terbit";
        }
      } else if (
        targetRow.board_column === "selesai_arsip" ||
        targetRow.archived_at
      ) {
        patch.archived_at = null;
      }

      setThesisWorkflows((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(patch as Partial<ThesisWorkflow>),
                updated_at: nowIso,
              }
            : item
        )
      );

      const label = THESIS_COLUMN_LABELS[targetColumn];
      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_thesis_workflow", id, data: patch },
          "Memindahkan Tahap Tugas Akhir",
          "Tahap Papan Diperbarui",
          `${targetRow.ticket_code} dipindahkan ke kolom ${label}.`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Tahap Papan Diperbarui",
        `${targetRow.ticket_code} dipindahkan ke kolom ${label}.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
      thesisWorkflows,
    ]
  );

  const deleteThesisWorkflow = useCallback(
    async (id: string): Promise<ActionResult> => {
      const targetRow = thesisWorkflows.find((w) => w.id === id);
      if (!targetRow) {
        return { ok: false, error: "Data Tugas Akhir tidak ditemukan." };
      }
      const pageKey = getThesisPageKey(targetRow.track, targetRow.stage);
      if (!requireStaffForLiveWrite(pageKey)) {
        return { ok: false, error: "Otoritas halaman tidak mencukupi." };
      }

      const entityType = getThesisEntityType(targetRow.track, targetRow.stage);
      const applyLocalDelete = () => {
        setThesisWorkflows((prev) =>
          prev
            .filter((item) => item.id !== id)
            .map((item) =>
              item.source_workflow_id === id
                ? { ...item, source_workflow_id: null }
                : item
            )
        );
        removeEntityArtifactsLocal(entityType, id);
      };

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_thesis_workflow", id },
          "Menghapus Berkas Tugas Akhir",
          "Berkas Tugas Akhir Dihapus",
          `Tiket ${targetRow.ticket_code} (${targetRow.student_name}) telah dihapus.`,
          applyLocalDelete
        );
      }

      applyLocalDelete();
      notify(
        "info",
        "Berkas Tugas Akhir Dihapus",
        `Tiket ${targetRow.ticket_code} (${targetRow.student_name}) telah dihapus.`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      removeEntityArtifactsLocal,
      requireStaffForLiveWrite,
      sendConfirmedMutation,
      thesisWorkflows,
    ]
  );

  const copyThesisToSidang = useCallback(
    (id: string): ActionResult => {
      const sourceRow = thesisWorkflows.find((w) => w.id === id);
      if (!sourceRow) {
        return { ok: false, error: "Data Proposal tidak ditemukan." };
      }
      if (sourceRow.stage !== "proposal") {
        return { ok: false, error: "Hanya tahap Proposal yang dapat disalin." };
      }
      if (
        sourceRow.board_column !== "bikin_surat" &&
        sourceRow.board_column !== "selesai_arsip"
      ) {
        return {
          ok: false,
          error:
            "Proposal minimal harus berada di tahap Bikin Surat sebelum disalin ke Sidang.",
        };
      }
      if (thesisWorkflows.some((w) => w.source_workflow_id === id)) {
        notify(
          "error",
          "Sudah Disalin",
          "Data ini sudah disalin ke antrean Sidang."
        );
        return {
          ok: false,
          error: "Data ini sudah disalin ke antrean Sidang.",
        };
      }

      const sidangPageKey = getThesisPageKey(sourceRow.track, "sidang");
      if (!requireStaffForLiveWrite(sidangPageKey)) {
        return {
          ok: false,
          error: "Anda tidak memiliki otoritas pada halaman Sidang tujuan.",
        };
      }

      const prefix = getThesisTicketPrefix(sourceRow.track, "sidang");
      const samePrefixCodes = thesisWorkflows
        .filter((w) => w.ticket_code.startsWith(`${prefix}-`))
        .map((w) => w.ticket_code);
      const seq = String(extractMaxSequence(samePrefixCodes) + 1).padStart(
        3,
        "0"
      );
      const newId = generateUuid();
      const ticket_code = `${prefix}-${getCurrentYearMonth()}-${seq}`;
      const registeredAt = isLiveSupabase
        ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
        : TODAY_ISO;
      const staffName =
        authUser?.fullName || authUser?.username || "Staf Piket Kantor";
      const nowIso = new Date().toISOString();

      const newSidangRow: ThesisWorkflow = {
        id: newId,
        ticket_code,
        track: sourceRow.track,
        stage: "sidang",
        board_column: "berkas_daftar",
        student_name: sourceRow.student_name,
        student_nim: sourceRow.student_nim,
        student_phone: sourceRow.student_phone,
        prodi: sourceRow.prodi,
        class_id: sourceRow.class_id || null,
        class_code: sourceRow.class_code || null,
        title: sourceRow.title,
        journal_name: sourceRow.journal_name || null,
        journal_url: sourceRow.journal_url || null,
        supervisor_1_id: sourceRow.supervisor_1_id || null,
        supervisor_2_id: sourceRow.supervisor_2_id || null,
        examiner_1_id: null,
        examiner_2_id: null,
        registered_at: registeredAt,
        document_notes: sourceRow.document_notes || null,
        schedule_date: null,
        schedule_start_time: null,
        schedule_end_time: null,
        room_id: null,
        letter_number: null,
        letter_date: null,
        letter_signer_official_id: null,
        letter_status: "Belum Dibuat",
        archived_at: null,
        archive_notes: null,
        source_workflow_id: sourceRow.id,
        created_by_staff: staffName,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setThesisWorkflows((prev) => [newSidangRow, ...prev]);

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_thesis_workflow",
            data: {
              id: newSidangRow.id,
              ticket_code: newSidangRow.ticket_code,
              track: newSidangRow.track,
              stage: newSidangRow.stage,
              board_column: newSidangRow.board_column,
              student_name: newSidangRow.student_name,
              student_nim: newSidangRow.student_nim,
              student_phone: newSidangRow.student_phone,
              prodi: newSidangRow.prodi,
              class_id: newSidangRow.class_id,
              class_code: newSidangRow.class_code,
              title: newSidangRow.title,
              journal_name: newSidangRow.journal_name,
              journal_url: newSidangRow.journal_url,
              supervisor_1_id: newSidangRow.supervisor_1_id,
              supervisor_2_id: newSidangRow.supervisor_2_id,
              examiner_1_id: null,
              examiner_2_id: null,
              registered_at: newSidangRow.registered_at,
              document_notes: newSidangRow.document_notes,
              letter_status: "Belum Dibuat",
              source_workflow_id: newSidangRow.source_workflow_id,
              created_by_staff: staffName,
            },
          },
          "Menyalin ke Antrean Sidang",
          "Disalin ke Antrean Sidang",
          `${sourceRow.student_name} berhasil masuk antrean Sidang (${ticket_code}).`
        );
        return { ok: true };
      }

      notify(
        "success",
        "Disalin ke Antrean Sidang",
        `${sourceRow.student_name} berhasil masuk antrean Sidang (${ticket_code}).`
      );
      return { ok: true };
    },
    [
      authUser,
      isLiveSupabase,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
      thesisWorkflows,
    ]
  );

  const value = useMemo<SarprasContextValue>(
    () => ({
      buildings: uiSimState === "empty" ? [] : buildings,
      rooms: uiSimState === "empty" ? [] : rooms,
      assets: uiSimState === "empty" ? [] : assets,
      bookings: uiSimState === "empty" ? [] : bookings,
      maintenanceLogs: uiSimState === "empty" ? [] : maintenanceLogs,
      consumables: uiSimState === "empty" ? [] : consumables,
      consumableTransactions:
        uiSimState === "empty" ? [] : consumableTransactions,
      notes: uiSimState === "empty" ? [] : notes,
      attachments: uiSimState === "empty" ? [] : attachments,
      lecturers: uiSimState === "empty" ? [] : lecturers,
      courses: uiSimState === "empty" ? [] : courses,
      campusOfficials: uiSimState === "empty" ? [] : campusOfficials,
      campusUnits: uiSimState === "empty" ? [] : campusUnits,
      maintenanceVendors: uiSimState === "empty" ? [] : maintenanceVendors,
      assetCategories: uiSimState === "empty" ? [] : assetCategories,
      fundingSources: uiSimState === "empty" ? [] : fundingSources,
      consumableCategories:
        uiSimState === "empty" ? [] : consumableCategories,
      consumableUnits: uiSimState === "empty" ? [] : consumableUnits,
      academicClasses: uiSimState === "empty" ? [] : academicClasses,
      officeKitItems: uiSimState === "empty" ? [] : officeKitItems,
      officeKitLoans: uiSimState === "empty" ? [] : officeKitLoans,
      thesisWorkflows: uiSimState === "empty" ? [] : thesisWorkflows,
      thesisWorkflowsAvailable,
      extendedMasterReady,
      canManageDataMaster,
      canAccessPage,
      defaultHomeHref,
      isLiveSupabase,
      serverConfigured,
      authUser,
      authLoading,
      isSyncingDb,
      uiSimState,
      setUiSimState,
      commandSearchOpen,
      setCommandSearchOpen,
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
      refreshFromSupabase,
      signInWithUsername,
      signOut,
      addBuilding,
      updateBuilding,
      deleteBuilding,
      addRoom,
      updateRoom,
      deleteRoom,
      addAsset,
      importAssets,
      updateAsset,
      deleteAsset,
      previewNextInventoryCode,
      addBooking,
      updateBookingStatus,
      deleteBooking,
      addMaintenanceLog,
      updateMaintenanceStatus,
      deleteMaintenanceLog,
      addConsumable,
      updateConsumable,
      deleteConsumable,
      recordConsumableMutation,
      addEntityNote,
      uploadEntityFile,
      deleteEntityAttachment,
      addLecturer,
      updateLecturer,
      deleteLecturer,
      addCourse,
      updateCourse,
      deleteCourse,
      addCampusOfficial,
      updateCampusOfficial,
      deleteCampusOfficial,
      addCampusUnit,
      updateCampusUnit,
      deleteCampusUnit,
      addMaintenanceVendor,
      updateMaintenanceVendor,
      deleteMaintenanceVendor,
      addAssetCategory,
      updateAssetCategory,
      deleteAssetCategory,
      addFundingSource,
      updateFundingSource,
      deleteFundingSource,
      addConsumableCategory,
      updateConsumableCategory,
      deleteConsumableCategory,
      addConsumableUnit,
      updateConsumableUnit,
      deleteConsumableUnit,
      addAcademicClass,
      updateAcademicClass,
      deleteAcademicClass,
      addOfficeKitItem,
      updateOfficeKitItem,
      deleteOfficeKitItem,
      checkoutOfficeKitLoan,
      checkinOfficeKitLoan,
      reopenOfficeKitLoan,
      deleteOfficeKitLoan,
      addThesisWorkflow,
      updateThesisWorkflow,
      moveThesisWorkflow,
      deleteThesisWorkflow,
      copyThesisToSidang,
    }),
    [
      uiSimState,
      buildings,
      rooms,
      assets,
      bookings,
      maintenanceLogs,
      consumables,
      consumableTransactions,
      notes,
      attachments,
      lecturers,
      courses,
      campusOfficials,
      campusUnits,
      maintenanceVendors,
      assetCategories,
      fundingSources,
      consumableCategories,
      consumableUnits,
      academicClasses,
      officeKitItems,
      officeKitLoans,
      thesisWorkflows,
      thesisWorkflowsAvailable,
      extendedMasterReady,
      canManageDataMaster,
      canAccessPage,
      defaultHomeHref,
      isLiveSupabase,
      serverConfigured,
      authUser,
      authLoading,
      isSyncingDb,
      commandSearchOpen,
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
      refreshFromSupabase,
      signInWithUsername,
      signOut,
      addBuilding,
      updateBuilding,
      deleteBuilding,
      addRoom,
      updateRoom,
      deleteRoom,
      addAsset,
      importAssets,
      updateAsset,
      deleteAsset,
      previewNextInventoryCode,
      addBooking,
      updateBookingStatus,
      deleteBooking,
      addMaintenanceLog,
      updateMaintenanceStatus,
      deleteMaintenanceLog,
      addConsumable,
      updateConsumable,
      deleteConsumable,
      recordConsumableMutation,
      addEntityNote,
      uploadEntityFile,
      deleteEntityAttachment,
      addLecturer,
      updateLecturer,
      deleteLecturer,
      addCourse,
      updateCourse,
      deleteCourse,
      addCampusOfficial,
      updateCampusOfficial,
      deleteCampusOfficial,
      addCampusUnit,
      updateCampusUnit,
      deleteCampusUnit,
      addMaintenanceVendor,
      updateMaintenanceVendor,
      deleteMaintenanceVendor,
      addAssetCategory,
      updateAssetCategory,
      deleteAssetCategory,
      addFundingSource,
      updateFundingSource,
      deleteFundingSource,
      addConsumableCategory,
      updateConsumableCategory,
      deleteConsumableCategory,
      addConsumableUnit,
      updateConsumableUnit,
      deleteConsumableUnit,
      addAcademicClass,
      updateAcademicClass,
      deleteAcademicClass,
      addOfficeKitItem,
      updateOfficeKitItem,
      deleteOfficeKitItem,
      checkoutOfficeKitLoan,
      checkinOfficeKitLoan,
      reopenOfficeKitLoan,
      deleteOfficeKitLoan,
      addThesisWorkflow,
      updateThesisWorkflow,
      moveThesisWorkflow,
      deleteThesisWorkflow,
      copyThesisToSidang,
    ]
  );

  return (
    <SarprasContext.Provider value={value}>{children}</SarprasContext.Provider>
  );
}

export function useSarpras() {
  const ctx = useContext(SarprasContext);
  if (!ctx) {
    throw new Error("useSarpras harus digunakan di dalam SarprasProvider");
  }
  return ctx;
}
