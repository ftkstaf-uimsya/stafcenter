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
  ActionResult,
  Asset,
  AssetCategoryCode,
  Booking,
  BookingStatus,
  Building,
  Consumable,
  ConsumableTransaction,
  DeleteStrategyMode,
  MaintenanceLog,
  MaintenanceStatus,
  Room,
  SarprasAttachment,
  SarprasEntityType,
  SarprasNote,
  StaffRole,
  UISimulationState,
} from "@/types/sarpras";
import {
  ASSET_CATEGORY_LABELS,
  findBookingConflict,
  generateInventoryCode,
  generateUuid,
  isSupabaseConfigured,
  normalizeTimeHHMM,
} from "@/lib/supabase/client";
import {
  NormalizedImportAssetPayload,
  normalizeSerialKey,
} from "@/lib/sarpras/asset-import-shared";
import {
  INITIAL_ASSETS,
  INITIAL_BOOKINGS,
  INITIAL_BUILDINGS,
  INITIAL_CONSUMABLES,
  INITIAL_CONSUMABLE_TRANSACTIONS,
  INITIAL_MAINTENANCE_LOGS,
  INITIAL_ROOMS,
} from "@/lib/supabase/seed-data";

const STORAGE_KEY = "stafcenter_sarpras_v1";
const THEME_KEY = "stafcenter_theme_v1";

export interface AuthStaffUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
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
  ) => Promise<{ ok: boolean; error?: string }>;
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
    approvedBy?: string
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
  ]);

  const signInWithUsername = useCallback(
    async (
      username: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
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
        return { ok: true };
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

  const requireStaffForLiveWrite = useCallback((): boolean => {
    if (isLiveSupabase && !authUser) {
      notify(
        "error",
        "Autentikasi Staf Diperlukan",
        "Silakan masuk terlebih dahulu sebelum mengubah data operasional."
      );
      return false;
    }
    return true;
  }, [authUser, isLiveSupabase, notify]);

  const sendMutation = useCallback(
    async (
      payload: Record<string, unknown>,
      actionLabel: string,
      successTitle: string,
      successMessage: string,
      shouldRefreshAfter = false,
      noticeType: ToastNotice["type"] = "success"
    ) => {
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
        }
        notify(noticeType, successTitle, successMessage);
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
      successMessage: string
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
        await refreshFromSupabase();
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
      if (!requireStaffForLiveWrite()) return;
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
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const updateBuilding = useCallback(
    (id: string, payload: Partial<Omit<Building, "id" | "created_at">>) => {
      if (!requireStaffForLiveWrite()) return;
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
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const deleteBuilding = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = buildings.find((b) => b.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_building", id },
          "Menghapus Gedung",
          "Gedung Dihapus dari Supabase",
          `Gedung ${target?.code || ""} telah dihapus dari database.`
        );
      }

      const linkedRooms = rooms.filter((r) => r.building_id === id);
      if (linkedRooms.length > 0) {
        const errMsg = `Gedung tidak dapat dihapus karena masih memiliki ${linkedRooms.length} ruangan terdaftar.`;
        notify("error", "Gagal Menghapus Gedung", errMsg);
        return { ok: false, error: errMsg };
      }

      setBuildings((prev) => prev.filter((b) => b.id !== id));
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
      requireStaffForLiveWrite,
      rooms,
      sendConfirmedMutation,
    ]
  );

  const addRoom = useCallback(
    (payload: Omit<Room, "id" | "created_at">) => {
      if (!requireStaffForLiveWrite()) return;
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
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const updateRoom = useCallback(
    (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => {
      if (!requireStaffForLiveWrite()) return;
      setRooms((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      if (isLiveSupabase && authUser) {
        void sendMutation(
          { action: "update_room", id, data: payload },
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
    [authUser, isLiveSupabase, notify, requireStaffForLiveWrite, sendMutation]
  );

  const deleteRoom = useCallback(
    async (
      id: string,
      options?: { mode?: DeleteStrategyMode; forceActive?: boolean }
    ): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const mode = options?.mode || "archive";
      const forceActive = Boolean(options?.forceActive);
      const target = rooms.find((r) => r.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_room", id, mode, forceActive },
          "Menghapus Ruangan",
          "Ruangan Dihapus dari Supabase",
          `Ruang ${target?.code || ""} telah dihapus dari database.`
        );
      }

      const label = target
        ? `Ruang ${target.code} (${target.name}) [Dihapus]`
        : "Ruangan [Dihapus]";
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
      requireStaffForLiveWrite,
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
      const category_label = ASSET_CATEGORY_LABELS[payload.category];
      const newAsset: Asset = {
        ...payload,
        id,
        inventory_code,
        category_label,
        created_at: new Date().toISOString(),
      };
      if (!requireStaffForLiveWrite()) return newAsset;
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
      if (!requireStaffForLiveWrite()) {
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
          category_label: ASSET_CATEGORY_LABELS[item.category],
          room_id: item.room_id,
          procurement_year: item.procurement_year,
          funding_source: item.funding_source,
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
      if (!requireStaffForLiveWrite()) return;
      const nextLabel = payload.category
        ? ASSET_CATEGORY_LABELS[payload.category]
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
        void sendMutation(
          {
            action: "update_asset",
            id,
            data: {
              ...payload,
              ...(nextLabel ? { category_label: nextLabel } : {}),
            },
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
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const mode = options?.mode || "archive";
      const forceActive = Boolean(options?.forceActive);
      const target = assets.find((a) => a.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_asset", id, mode, forceActive },
          "Menghapus Aset",
          "Aset Dihapus dari Supabase",
          `Aset ${target?.inventory_code || ""} dihapus dari database.`
        );
      }

      const label = target
        ? `Aset ${target.inventory_code} (${target.name}) [Dihapus]`
        : "Aset [Dihapus]";
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
      if (!requireStaffForLiveWrite()) {
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
      approvedBy?: string
    ) => {
      if (!requireStaffForLiveWrite()) return;
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
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = bookings.find((b) => b.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_booking", id },
          "Menghapus Peminjaman",
          "Tiket Peminjaman Dihapus",
          `Tiket ${target?.booking_code || ""} telah dihapus dari database.`
        );
      }

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
      if (!requireStaffForLiveWrite()) return newTicket;

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

      if (isLiveSupabase && authUser) {
        void sendMutation(
          {
            action: "insert_maintenance",
            data: {
              id,
              ticket_code,
              asset_id: payload.asset_id || null,
              room_id: payload.room_id || null,
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
            roomId: payload.room_id || null,
            setRoomRepair,
          },
          "Membuat Tiket Kerusakan",
          "Laporan Kerusakan Tersimpan di Supabase",
          `Tiket ${ticket_code} berhasil dibuat dan disinkronkan ke database.`,
          true
        );
        return newTicket;
      }

      notify(
        "success",
        "Laporan Kerusakan Dicatat",
        `Tiket ${newTicket.ticket_code} berhasil dibuat${
          payload.damage_severity === "Rusak Berat"
            ? " dan status aset otomatis diperbarui menjadi Rusak Berat."
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
        repair_cost?: number;
        resolution_notes?: string;
      }
    ) => {
      if (!requireStaffForLiveWrite()) return;
      const target = maintenanceLogs.find((m) => m.id === id);
      const completedAt =
        update.status === "Selesai Diperbaiki"
          ? new Date().toISOString()
          : target?.completed_at;

      setMaintenanceLogs((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: update.status,
                technician_vendor:
                  update.technician_vendor !== undefined
                    ? update.technician_vendor
                    : item.technician_vendor,
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
        )
      );

      const isDone = update.status === "Selesai Diperbaiki";
      if (isDone) {
        if (target?.asset_id) {
          setAssets((prev) =>
            prev.map((a) =>
              a.id === target.asset_id ? { ...a, condition: "Baik" } : a
            )
          );
        }
        if (target?.room_id) {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === target.room_id && r.status === "Perbaikan"
                ? { ...r, status: "Tersedia" }
                : r
            )
          );
        }
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
              ...(update.repair_cost !== undefined
                ? { repair_cost: update.repair_cost }
                : {}),
              ...(update.resolution_notes !== undefined
                ? { resolution_notes: update.resolution_notes }
                : {}),
              ...(isDone ? { completed_at: completedAt } : {}),
            },
            roomId: target?.room_id || null,
            setRoomAvailable: isDone,
          },
          "Memperbarui Perbaikan",
          "Status Pemeliharaan Diperbarui di Supabase",
          `Tiket ${target?.ticket_code || ""} diperbarui ke "${update.status}".`,
          true
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
      isLiveSupabase,
      maintenanceLogs,
      notify,
      requireStaffForLiveWrite,
      sendMutation,
    ]
  );

  const deleteMaintenanceLog = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = maintenanceLogs.find((m) => m.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_maintenance", id },
          "Menghapus Tiket Kerusakan",
          "Tiket Kerusakan Dihapus",
          `Tiket ${target?.ticket_code || ""} telah dihapus dari database.`
        );
      }

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
      if (!requireStaffForLiveWrite()) return;
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
      if (!requireStaffForLiveWrite()) return;
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
      if (!requireStaffForLiveWrite()) {
        return { ok: false, error: "Autentikasi staf diperlukan." };
      }
      const target = consumables.find((c) => c.id === id);

      if (isLiveSupabase && authUser) {
        return sendConfirmedMutation(
          { action: "delete_consumable", id },
          "Menghapus Item BHP",
          "Item BHP Dihapus dari Supabase",
          `${target?.code || ""} (${target?.name || ""}) telah dihapus dari database.`
        );
      }

      setConsumables((prev) => prev.filter((item) => item.id !== id));
      setConsumableTransactions((prev) =>
        prev.filter((tx) => tx.consumable_id !== id)
      );
      removeEntityArtifactsLocal("consumable", id);
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
      if (!requireStaffForLiveWrite()) {
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
              purpose_notes: payload.purpose_notes || null,
            },
          },
          "Mencatat Mutasi Stok",
          `Mutasi Stok (${payload.transaction_type}) Tersimpan`,
          `${payload.quantity} ${target.unit} ${target.name} berhasil dicatat ke database.`,
          true
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
      if (!requireStaffForLiveWrite()) {
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
      if (!requireStaffForLiveWrite()) {
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
      if (!requireStaffForLiveWrite()) return;
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
    [authUser, isLiveSupabase, requireStaffForLiveWrite, sendMutation]
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
