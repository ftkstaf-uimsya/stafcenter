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
  getSupabaseBrowserClient,
  isSupabaseConfigured,
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
  uiSimState: UISimulationState;
  setUiSimState: (state: UISimulationState) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  notify: (type: ToastNotice["type"], title: string, message: string) => void;
  resetToSeedData: () => void;

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

export function SarprasProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(
    INITIAL_MAINTENANCE_LOGS
  );
  const [consumables, setConsumables] =
    useState<Consumable[]>(INITIAL_CONSUMABLES);
  const [consumableTransactions, setConsumableTransactions] = useState<
    ConsumableTransaction[]
  >(INITIAL_CONSUMABLE_TRANSACTIONS);

  const [uiSimState, setUiSimState] = useState<UISimulationState>("normal");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const isLiveSupabase = isSupabaseConfigured();

  const notify = useCallback(
    (type: ToastNotice["type"], title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Hydrate theme & local state or fetch from Supabase
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      }

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
    } catch {
      // Gunakan fallback seed data bila localStorage tidak tersedia
    }

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      Promise.all([
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
      ])
        .then(
          ([
            bRes,
            rRes,
            aRes,
            bkRes,
            mRes,
            cRes,
            ctRes,
          ]) => {
            if (bRes.data?.length) setBuildings(bRes.data as Building[]);
            if (rRes.data?.length) setRooms(rRes.data as Room[]);
            if (aRes.data?.length) setAssets(aRes.data as Asset[]);
            if (bkRes.data?.length) setBookings(bkRes.data as Booking[]);
            if (mRes.data?.length)
              setMaintenanceLogs(mRes.data as MaintenanceLog[]);
            if (cRes.data?.length) setConsumables(cRes.data as Consumable[]);
            if (ctRes.data?.length)
              setConsumableTransactions(ctRes.data as ConsumableTransaction[]);
          }
        )
        .catch(() => {
          // Tetap gunakan state seed lokal bila tabel belum dimigrasikan
        });
    }

    setHydrated(true);
  }, []);

  // Persist perubahan ke localStorage
  useEffect(() => {
    if (!hydrated) return;
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
    buildings,
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    consumableTransactions,
  ]);

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
  }, [notify]);

  const addBuilding = useCallback(
    (payload: Omit<Building, "id" | "created_at">) => {
      const newBuilding: Building = {
        ...payload,
        id: `bld-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setBuildings((prev) => [...prev, newBuilding]);
      notify(
        "success",
        "Gedung Ditambahkan",
        `${newBuilding.code} (${newBuilding.name}) berhasil disimpan.`
      );
    },
    [notify]
  );

  const addRoom = useCallback(
    (payload: Omit<Room, "id" | "created_at">) => {
      const newRoom: Room = {
        ...payload,
        id: `rm-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setRooms((prev) => [newRoom, ...prev]);
      notify(
        "success",
        "Ruangan Ditambahkan",
        `Ruang ${newRoom.code} (${newRoom.name}) berhasil didaftarkan.`
      );
    },
    [notify]
  );

  const updateRoom = useCallback(
    (id: string, payload: Partial<Omit<Room, "id" | "created_at">>) => {
      setRooms((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
      notify(
        "success",
        "Data Ruangan Diperbarui",
        "Perubahan atribut ruangan telah disimpan."
      );
    },
    [notify]
  );

  const deleteRoom = useCallback(
    (id: string) => {
      const target = rooms.find((r) => r.id === id);
      setRooms((prev) => prev.filter((item) => item.id !== id));
      setAssets((prev) =>
        prev.map((a) => (a.room_id === id ? { ...a, room_id: null } : a))
      );
      notify(
        "info",
        "Ruangan Dihapus",
        `Ruang ${target?.code || ""} telah dihapus dari daftar master.`
      );
    },
    [rooms, notify]
  );

  const previewNextInventoryCode = useCallback(
    (category: AssetCategoryCode, year: number) => {
      const nextSequence = assets.length + 1;
      return generateInventoryCode(category, year, nextSequence);
    },
    [assets.length]
  );

  const addAsset = useCallback(
    (
      payload: Omit<
        Asset,
        "id" | "inventory_code" | "category_label" | "created_at"
      >
    ): Asset => {
      const seq = assets.length + 1;
      const inventory_code = generateInventoryCode(
        payload.category,
        payload.procurement_year,
        seq
      );
      const newAsset: Asset = {
        ...payload,
        id: `ast-${Date.now()}`,
        inventory_code,
        category_label: ASSET_CATEGORY_LABELS[payload.category],
        created_at: new Date().toISOString(),
      };
      setAssets((prev) => [newAsset, ...prev]);
      notify(
        "success",
        "Aset Terdaftar",
        `${newAsset.inventory_code} (${newAsset.name}) berhasil dicatat ke inventaris.`
      );
      return newAsset;
    },
    [assets.length, notify]
  );

  const updateAsset = useCallback(
    (id: string, payload: Partial<Omit<Asset, "id" | "created_at">>) => {
      setAssets((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...payload,
                category_label: payload.category
                  ? ASSET_CATEGORY_LABELS[payload.category]
                  : item.category_label,
              }
            : item
        )
      );
      notify(
        "success",
        "Inventaris Diperbarui",
        "Perubahan data aset telah disimpan."
      );
    },
    [notify]
  );

  const deleteAsset = useCallback(
    (id: string) => {
      const target = assets.find((a) => a.id === id);
      setAssets((prev) => prev.filter((item) => item.id !== id));
      notify(
        "info",
        "Aset Dihapus",
        `Aset ${target?.inventory_code || ""} dihapus dari daftar inventaris.`
      );
    },
    [assets, notify]
  );

  const addBooking = useCallback(
    (
      payload: Omit<Booking, "id" | "booking_code" | "status" | "created_at">
    ): { ok: boolean; error?: string } => {
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

      const seq = String(bookings.length + 1).padStart(3, "0");
      const newBooking: Booking = {
        ...payload,
        id: `bkg-${Date.now()}`,
        booking_code: `PJM-202611-${seq}`,
        status: "Menunggu Persetujuan",
        created_at: new Date().toISOString(),
      };

      setBookings((prev) => [newBooking, ...prev]);
      notify(
        "success",
        "Reservasi Diajukan",
        `Tiket ${newBooking.booking_code} berhasil dibuat dan menunggu persetujuan sarpras.`
      );
      return { ok: true };
    },
    [bookings, notify]
  );

  const updateBookingStatus = useCallback(
    (
      id: string,
      status: BookingStatus,
      returnNotes?: string,
      approvedBy?: string
    ) => {
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

      if (target?.room_id) {
        if (status === "Sedang Dipinjam") {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === target.room_id ? { ...r, status: "Digunakan" } : r
            )
          );
        } else if (
          status === "Selesai / Dikembalikan" ||
          status === "Ditolak"
        ) {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === target.room_id && r.status === "Digunakan"
                ? { ...r, status: "Tersedia" }
                : r
            )
          );
        }
      }

      notify(
        "success",
        "Status Peminjaman Diperbarui",
        `Tiket ${target?.booking_code || ""} kini berstatus "${status}".`
      );
    },
    [bookings, notify]
  );

  const addMaintenanceLog = useCallback(
    (
      payload: Omit<
        MaintenanceLog,
        "id" | "ticket_code" | "status" | "reported_at"
      >
    ) => {
      const seq = String(maintenanceLogs.length + 1).padStart(3, "0");
      const newTicket: MaintenanceLog = {
        ...payload,
        id: `mnt-${Date.now()}`,
        ticket_code: `MNT-202611-${seq}`,
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
    [maintenanceLogs.length, notify]
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
      const target = maintenanceLogs.find((m) => m.id === id);
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
                completed_at:
                  update.status === "Selesai Diperbaiki"
                    ? new Date().toISOString()
                    : item.completed_at,
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

      notify(
        "success",
        "Status Pemeliharaan Diperbarui",
        `Tiket ${target?.ticket_code || ""} diperbarui ke "${update.status}".`
      );
    },
    [maintenanceLogs, notify]
  );

  const addConsumable = useCallback(
    (payload: Omit<Consumable, "id" | "last_restocked_at">) => {
      const newItem: Consumable = {
        ...payload,
        id: `bhp-${Date.now()}`,
        last_restocked_at: new Date().toISOString(),
      };
      setConsumables((prev) => [newItem, ...prev]);
      notify(
        "success",
        "Item BHP Ditambahkan",
        `${newItem.code} (${newItem.name}) berhasil ditambahkan ke katalog stok.`
      );
    },
    [notify]
  );

  const recordConsumableMutation = useCallback(
    (
      payload: Omit<ConsumableTransaction, "id" | "transaction_date">
    ): { ok: boolean; error?: string } => {
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

      const newTx: ConsumableTransaction = {
        ...payload,
        id: `ctx-${Date.now()}`,
        transaction_date: new Date().toISOString(),
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
                ? new Date().toISOString()
                : item.last_restocked_at,
          };
        })
      );

      setConsumableTransactions((prev) => [newTx, ...prev]);
      notify(
        "success",
        `Mutasi Stok (${payload.transaction_type}) Dicatat`,
        `${payload.quantity} ${target.unit} ${target.name} berhasil dicatat atas nama ${payload.actor_name}.`
      );
      return { ok: true };
    },
    [consumables, notify]
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
      uiSimState,
      setUiSimState,
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
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
      theme,
      toggleTheme,
      toasts,
      dismissToast,
      notify,
      resetToSeedData,
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
