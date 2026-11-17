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
  Asset,
  AssetCategoryCode,
  Booking,
  BookingStatus,
  Building,
  Consumable,
  ConsumableTransaction,
  MaintenanceLog,
  MaintenanceStatus,
  Room,
  UISimulationState,
} from "@/types/sarpras";
import {
  ASSET_CATEGORY_LABELS,
  findBookingConflict,
  generateInventoryCode,
  generateUuid,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  normalizeTimeHHMM,
} from "@/lib/supabase/client";
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
  email: string;
  fullName?: string;
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
  isLiveSupabase: boolean;
  authUser: AuthStaffUser | null;
  authLoading: boolean;
  isSyncingDb: boolean;
  uiSimState: UISimulationState;
  setUiSimState: (state: UISimulationState) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  notify: (type: ToastNotice["type"], title: string, message: string) => void;
  resetToSeedData: () => void;
  refreshFromSupabase: () => Promise<void>;

  // Autentikasi Staf (Supabase Auth)
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signUpStaff: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;

  // Gedung & Ruangan CRUD
  addBuilding: (payload: Omit<Building, "id" | "created_at">) => void;
  addRoom: (payload: Omit<Room, "id" | "created_at">) => void;
  updateRoom: (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => void;
  deleteRoom: (id: string) => void;

  // Inventaris Aset CRUD
  addAsset: (
    payload: Omit<
      Asset,
      "id" | "inventory_code" | "category_label" | "created_at"
    >
  ) => Asset;
  updateAsset: (
    id: string,
    payload: Partial<Omit<Asset, "id" | "created_at">>
  ) => void;
  deleteAsset: (id: string) => void;
  previewNextInventoryCode: (category: AssetCategoryCode, year: number) => string;

  // Peminjaman & Reservasi
  addBooking: (
    payload: Omit<Booking, "id" | "booking_code" | "status" | "created_at">
  ) => { ok: boolean; error?: string };
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    returnNotes?: string,
    approvedBy?: string
  ) => void;

  // Pemeliharaan & Laporan Kerusakan
  addMaintenanceLog: (
    payload: Omit<
      MaintenanceLog,
      "id" | "ticket_code" | "status" | "reported_at"
    >
  ) => void;
  updateMaintenanceStatus: (
    id: string,
    update: {
      status: MaintenanceStatus;
      technician_vendor?: string;
      repair_cost?: number;
      resolution_notes?: string;
    }
  ) => void;

  // Barang Habis Pakai (BHP)
  addConsumable: (
    payload: Omit<Consumable, "id" | "last_restocked_at">
  ) => void;
  recordConsumableMutation: (
    payload: Omit<ConsumableTransaction, "id" | "transaction_date">
  ) => { ok: boolean; error?: string };
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

  const [authUser, setAuthUser] = useState<AuthStaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isLiveSupabase);
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);

  const [uiSimState, setUiSimState] = useState<UISimulationState>("normal");
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
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setIsSyncingDb(true);
    try {
      const [bRes, rRes, aRes, bkRes, mRes, cRes, ctRes] = await Promise.all([
        supabase.from("buildings").select("*").order("code"),
        supabase.from("rooms").select("*").order("code"),
        supabase.from("assets").select("*").order("inventory_code"),
        supabase
          .from("bookings")
          .select("*")
          .order("booking_date", { ascending: false }),
        supabase
          .from("maintenance_logs")
          .select("*")
          .order("reported_at", { ascending: false }),
        supabase.from("consumables").select("*").order("code"),
        supabase
          .from("consumable_transactions")
          .select("*")
          .order("transaction_date", { ascending: false }),
      ]);

      if (bRes.data) setBuildings(bRes.data as Building[]);
      if (rRes.data) setRooms(rRes.data as Room[]);
      if (aRes.data) {
        setAssets(
          (aRes.data as Asset[]).map((item) => ({
            ...item,
            acquisition_cost: Number(item.acquisition_cost) || 0,
            procurement_year: Number(item.procurement_year) || 2026,
          }))
        );
      }
      if (bkRes.data) {
        setBookings(
          (bkRes.data as Booking[]).map((item) => ({
            ...item,
            attendees_count: Number(item.attendees_count) || 1,
            start_time: normalizeTimeHHMM(item.start_time),
            end_time: normalizeTimeHHMM(item.end_time),
          }))
        );
      }
      if (mRes.data) {
        setMaintenanceLogs(
          (mRes.data as MaintenanceLog[]).map((item) => ({
            ...item,
            repair_cost: Number(item.repair_cost) || 0,
          }))
        );
      }
      if (cRes.data) {
        setConsumables(
          (cRes.data as Consumable[]).map((item) => ({
            ...item,
            current_stock: Number(item.current_stock) || 0,
            min_stock: Number(item.min_stock) || 0,
          }))
        );
      }
      if (ctRes.data) {
        setConsumableTransactions(
          (ctRes.data as ConsumableTransaction[]).map((item) => ({
            ...item,
            quantity: Number(item.quantity) || 0,
          }))
        );
      }
    } catch {
      // Tetap gunakan state sebelumnya bila koneksi terputus
    } finally {
      setIsSyncingDb(false);
    }
  }, []);

  // Hydrate theme, auth session, and Supabase or localStorage data
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
      }
    } catch {
      // Gunakan fallback seed data bila localStorage tidak tersedia
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthLoading(false);
      setHydrated(true);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const user = data.session?.user;
        if (user) {
          setAuthUser({
            id: user.id,
            email: user.email || "staf@kampus.ac.id",
            fullName:
              (user.user_metadata?.full_name as string | undefined) || undefined,
          });
          void refreshFromSupabase();
        } else {
          setAuthUser(null);
          clearOperationalData();
        }
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) {
          clearOperationalData();
          setAuthLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        if (user) {
          setAuthUser({
            id: user.id,
            email: user.email || "staf@kampus.ac.id",
            fullName:
              (user.user_metadata?.full_name as string | undefined) || undefined,
          });
          void refreshFromSupabase();
        } else {
          setAuthUser(null);
          clearOperationalData();
        }
      }
    );

    setHydrated(true);

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearOperationalData, isLiveSupabase, refreshFromSupabase]);

  // Persist perubahan ke localStorage hanya bila tidak menggunakan Supabase
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
    authUser,
    buildings,
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    consumableTransactions,
  ]);

  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return {
          ok: false,
          error: "Konfigurasi Supabase (.env.local) belum tersedia.",
        };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.user) {
        return {
          ok: false,
          error:
            error?.message === "Invalid login credentials"
              ? "Email atau kata sandi staf tidak cocok."
              : error?.message || "Gagal masuk ke akun staf.",
        };
      }
      setAuthUser({
        id: data.user.id,
        email: data.user.email || email.trim(),
        fullName:
          (data.user.user_metadata?.full_name as string | undefined) ||
          undefined,
      });
      await refreshFromSupabase();
      notify(
        "success",
        "Berhasil Masuk Staf",
        `Sesi aktif sebagai ${data.user.email}. Perubahan data kini tersimpan permanen ke Supabase.`
      );
      return { ok: true };
    },
    [notify, refreshFromSupabase]
  );

  const signUpStaff = useCallback(
    async (
      email: string,
      password: string,
      fullName: string
    ): Promise<{
      ok: boolean;
      error?: string;
      needsEmailConfirm?: boolean;
    }> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return {
          ok: false,
          error: "Konfigurasi Supabase (.env.local) belum tersedia.",
        };
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: "staff_sarpras",
          },
        },
      });
      if (error) {
        return { ok: false, error: error.message };
      }

      if (data.session && data.user) {
        setAuthUser({
          id: data.user.id,
          email: data.user.email || email.trim(),
          fullName: fullName.trim(),
        });
        await refreshFromSupabase();
        notify(
          "success",
          "Akun Staf Terdaftar",
          `Selamat datang, ${fullName.trim()}. Sinkronisasi tulis Supabase langsung aktif.`
        );
        return { ok: true, needsEmailConfirm: false };
      }

      notify(
        "info",
        "Verifikasi Email Diperlukan",
        `Tautan konfirmasi pendaftaran telah dikirim ke ${email.trim()}.`
      );
      return { ok: true, needsEmailConfirm: true };
    },
    [notify, refreshFromSupabase]
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setAuthUser(null);
    clearOperationalData();
    notify(
      "info",
      "Keluar dari Sesi Staf",
      "Sesi telah diakhiri. Silakan masuk kembali untuk mengakses modul StafCenter."
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

  const handleDbError = useCallback(
    async (actionLabel: string, errMessage: string) => {
      notify("error", `Gagal ${actionLabel}`, errMessage);
      await refreshFromSupabase();
    },
    [notify, refreshFromSupabase]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("buildings").insert({
            id,
            code: payload.code,
            name: payload.name,
            floors_count: payload.floors_count,
            zone: payload.zone,
            description: payload.description || null,
          });
          if (error) {
            await handleDbError("Menyimpan Gedung", error.message);
          } else {
            notify(
              "success",
              "Gedung Tersimpan di Supabase",
              `${newBuilding.code} (${newBuilding.name}) berhasil disimpan ke database.`
            );
          }
        })();
        return;
      }

      notify(
        "success",
        "Gedung Ditambahkan",
        `${newBuilding.code} (${newBuilding.name}) berhasil dicatat.`
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("rooms").insert({
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
          });
          if (error) {
            await handleDbError("Menyimpan Ruangan", error.message);
          } else {
            notify(
              "success",
              "Ruangan Tersimpan di Supabase",
              `Ruang ${newRoom.code} (${newRoom.name}) berhasil disimpan ke database.`
            );
          }
        })();
        return;
      }

      notify(
        "success",
        "Ruangan Ditambahkan",
        `Ruang ${newRoom.code} (${newRoom.name}) berhasil didaftarkan.`
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite]
  );

  const updateRoom = useCallback(
    (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => {
      if (!requireStaffForLiveWrite()) return;
      setRooms((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase
            .from("rooms")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (error) {
            await handleDbError("Memperbarui Ruangan", error.message);
          } else {
            notify(
              "success",
              "Data Ruangan Diperbarui",
              "Perubahan atribut ruangan telah tersimpan di Supabase."
            );
          }
        })();
        return;
      }

      notify(
        "success",
        "Data Ruangan Diperbarui",
        "Perubahan atribut ruangan telah disimpan."
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite]
  );

  const deleteRoom = useCallback(
    (id: string) => {
      if (!requireStaffForLiveWrite()) return;
      const target = rooms.find((r) => r.id === id);
      setRooms((prev) => prev.filter((item) => item.id !== id));
      setAssets((prev) =>
        prev.map((a) => (a.room_id === id ? { ...a, room_id: null } : a))
      );

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("rooms").delete().eq("id", id);
          if (error) {
            await handleDbError("Menghapus Ruangan", error.message);
          } else {
            notify(
              "info",
              "Ruangan Dihapus dari Supabase",
              `Ruang ${target?.code || ""} telah dihapus dari database.`
            );
          }
        })();
        return;
      }

      notify(
        "info",
        "Ruangan Dihapus",
        `Ruang ${target?.code || ""} telah dihapus dari daftar master.`
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite, rooms]
  );

  const previewNextInventoryCode = useCallback(
    (category: AssetCategoryCode, year: number) => {
      const nextSequence = extractMaxSequence(assets.map((a) => a.inventory_code)) + 1;
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("assets").insert({
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
          });
          if (error) {
            await handleDbError("Mendaftarkan Aset", error.message);
          } else {
            notify(
              "success",
              "Aset Tersimpan di Supabase",
              `${newAsset.inventory_code} (${newAsset.name}) berhasil dicatat ke database.`
            );
          }
        })();
        return newAsset;
      }

      notify(
        "success",
        "Aset Terdaftar",
        `${newAsset.inventory_code} (${newAsset.name}) berhasil dicatat ke inventaris.`
      );
      return newAsset;
    },
    [assets, authUser, handleDbError, notify, requireStaffForLiveWrite]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase
            .from("assets")
            .update({
              ...payload,
              ...(nextLabel ? { category_label: nextLabel } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
          if (error) {
            await handleDbError("Memperbarui Aset", error.message);
          } else {
            notify(
              "success",
              "Inventaris Diperbarui",
              "Perubahan data aset telah tersimpan di Supabase."
            );
          }
        })();
        return;
      }

      notify(
        "success",
        "Inventaris Diperbarui",
        "Perubahan data aset telah disimpan."
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite]
  );

  const deleteAsset = useCallback(
    (id: string) => {
      if (!requireStaffForLiveWrite()) return;
      const target = assets.find((a) => a.id === id);
      setAssets((prev) => prev.filter((item) => item.id !== id));

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("assets").delete().eq("id", id);
          if (error) {
            await handleDbError("Menghapus Aset", error.message);
          } else {
            notify(
              "info",
              "Aset Dihapus dari Supabase",
              `Aset ${target?.inventory_code || ""} dihapus dari database.`
            );
          }
        })();
        return;
      }

      notify(
        "info",
        "Aset Dihapus",
        `Aset ${target?.inventory_code || ""} dihapus dari daftar inventaris.`
      );
    },
    [assets, authUser, handleDbError, notify, requireStaffForLiveWrite]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("bookings").insert({
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
          });
          if (error) {
            await handleDbError("Menyimpan Reservasi", error.message);
          } else {
            notify(
              "success",
              "Reservasi Tersimpan di Supabase",
              `Tiket ${booking_code} berhasil dicatat dan menunggu persetujuan sarpras.`
            );
          }
        })();
        return { ok: true };
      }

      notify(
        "success",
        "Reservasi Diajukan",
        `Tiket ${newBooking.booking_code} berhasil dibuat dan menunggu persetujuan sarpras.`
      );
      return { ok: true };
    },
    [authUser, bookings, handleDbError, notify, requireStaffForLiveWrite]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase
            .from("bookings")
            .update({
              status,
              ...(returnNotes !== undefined
                ? { return_condition_notes: returnNotes }
                : {}),
              ...(approvedBy ? { approved_by: approvedBy } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          if (error) {
            await handleDbError("Memperbarui Status Peminjaman", error.message);
            return;
          }

          if (target?.room_id && nextRoomStatus) {
            await supabase
              .from("rooms")
              .update({
                status: nextRoomStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", target.room_id);
          }

          notify(
            "success",
            "Status Peminjaman Diperbarui di Supabase",
            `Tiket ${target?.booking_code || ""} kini berstatus "${status}".`
          );
        })();
        return;
      }

      notify(
        "success",
        "Status Peminjaman Diperbarui",
        `Tiket ${target?.booking_code || ""} kini berstatus "${status}".`
      );
    },
    [authUser, bookings, handleDbError, notify, requireStaffForLiveWrite, rooms]
  );

  const addMaintenanceLog = useCallback(
    (
      payload: Omit<
        MaintenanceLog,
        "id" | "ticket_code" | "status" | "reported_at"
      >
    ) => {
      if (!requireStaffForLiveWrite()) return;
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

      setMaintenanceLogs((prev) => [newTicket, ...prev]);

      // Otomatisasi: perbarui kondisi aset di tabel Inventaris bila rusak berat/ringan
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

      if (payload.room_id && payload.priority === "Tinggi/Darurat") {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === payload.room_id ? { ...r, status: "Perbaikan" } : r
          )
        );
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("maintenance_logs").insert({
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
          });
          if (error) {
            await handleDbError("Membuat Tiket Kerusakan", error.message);
            return;
          }

          if (payload.room_id && payload.priority === "Tinggi/Darurat") {
            await supabase
              .from("rooms")
              .update({
                status: "Perbaikan",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payload.room_id);
          }

          // Trigger DB trg_sync_asset_condition ikut memperbarui kondisi aset
          await refreshFromSupabase();
          notify(
            "success",
            "Laporan Kerusakan Tersimpan di Supabase",
            `Tiket ${ticket_code} berhasil dibuat dan disinkronkan ke database.`
          );
        })();
        return;
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
    },
    [
      authUser,
      handleDbError,
      maintenanceLogs,
      notify,
      refreshFromSupabase,
      requireStaffForLiveWrite,
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

      // Bila perbaikan selesai, kembalikan kondisi aset menjadi Baik dan ruangan menjadi Tersedia
      if (update.status === "Selesai Diperbaiki") {
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase
            .from("maintenance_logs")
            .update({
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
              ...(update.status === "Selesai Diperbaiki"
                ? { completed_at: completedAt }
                : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          if (error) {
            await handleDbError("Memperbarui Perbaikan", error.message);
            return;
          }

          if (update.status === "Selesai Diperbaiki" && target?.room_id) {
            await supabase
              .from("rooms")
              .update({
                status: "Tersedia",
                updated_at: new Date().toISOString(),
              })
              .eq("id", target.room_id);
          }

          await refreshFromSupabase();
          notify(
            "success",
            "Status Pemeliharaan Diperbarui di Supabase",
            `Tiket ${target?.ticket_code || ""} diperbarui ke "${update.status}".`
          );
        })();
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
      handleDbError,
      maintenanceLogs,
      notify,
      refreshFromSupabase,
      requireStaffForLiveWrite,
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          const { error } = await supabase.from("consumables").insert({
            id,
            code: payload.code,
            name: payload.name,
            category: payload.category,
            unit: payload.unit,
            current_stock: payload.current_stock,
            min_stock: payload.min_stock,
            storage_location: payload.storage_location,
            last_restocked_at: nowIso,
          });
          if (error) {
            await handleDbError("Menambah Item BHP", error.message);
          } else {
            notify(
              "success",
              "Item BHP Tersimpan di Supabase",
              `${newItem.code} (${newItem.name}) berhasil ditambahkan ke database.`
            );
          }
        })();
        return;
      }

      notify(
        "success",
        "Item BHP Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil ditambahkan ke katalog stok.`
      );
    },
    [authUser, handleDbError, notify, requireStaffForLiveWrite]
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

      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        void (async () => {
          // Trigger PostgreSQL trg_apply_consumable_tx otomatis mengupdate saldo di tabel consumables
          const { error } = await supabase
            .from("consumable_transactions")
            .insert({
              id,
              consumable_id: payload.consumable_id,
              transaction_type: payload.transaction_type,
              quantity: payload.quantity,
              actor_name: payload.actor_name,
              actor_unit: payload.actor_unit,
              purpose_notes: payload.purpose_notes || null,
            });
          if (error) {
            await handleDbError("Mencatat Mutasi Stok", error.message);
          } else {
            await refreshFromSupabase();
            notify(
              "success",
              `Mutasi Stok (${payload.transaction_type}) Tersimpan`,
              `${payload.quantity} ${target.unit} ${target.name} berhasil dicatat ke database.`
            );
          }
        })();
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
      handleDbError,
      notify,
      refreshFromSupabase,
      requireStaffForLiveWrite,
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
      isLiveSupabase,
      authUser,
      authLoading,
      isSyncingDb,
      uiSimState,
      setUiSimState,
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
      refreshFromSupabase,
      signInWithPassword,
      signUpStaff,
      signOut,
      addBuilding,
      addRoom,
      updateRoom,
      deleteRoom,
      addAsset,
      updateAsset,
      deleteAsset,
      previewNextInventoryCode,
      addBooking,
      updateBookingStatus,
      addMaintenanceLog,
      updateMaintenanceStatus,
      addConsumable,
      recordConsumableMutation,
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
      isLiveSupabase,
      authUser,
      authLoading,
      isSyncingDb,
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
      refreshFromSupabase,
      signInWithPassword,
      signUpStaff,
      signOut,
      addBuilding,
      addRoom,
      updateRoom,
      deleteRoom,
      addAsset,
      updateAsset,
      deleteAsset,
      previewNextInventoryCode,
      addBooking,
      updateBookingStatus,
      addMaintenanceLog,
      updateMaintenanceStatus,
      addConsumable,
      recordConsumableMutation,
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
