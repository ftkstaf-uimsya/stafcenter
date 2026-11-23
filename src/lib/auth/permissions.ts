import {
  SarprasEntityType,
  SarprasPageKey,
  StaffRole,
} from "@/types/sarpras";

export interface SarprasPageMeta {
  key: SarprasPageKey;
  href: string;
  label: string;
  shortLabel: string;
  group: "sapras" | "data_master";
}

export const SARPRAS_PAGES: SarprasPageMeta[] = [
  {
    key: "dashboard",
    href: "/sarpras/dashboard",
    label: "Dashboard Ringkasan",
    shortLabel: "Ringkasan",
    group: "sapras",
  },
  {
    key: "sirkulasi-invent",
    href: "/sarpras/sirkulasi-invent",
    label: "Sirkulasi Invent",
    shortLabel: "Sirkulasi",
    group: "sapras",
  },
  {
    key: "inventaris",
    href: "/sarpras/inventaris",
    label: "Inventaris Aset & Barang",
    shortLabel: "Inventaris",
    group: "sapras",
  },
  {
    key: "peminjaman",
    href: "/sarpras/peminjaman",
    label: "Peminjaman & Reservasi",
    shortLabel: "Peminjaman",
    group: "sapras",
  },
  {
    key: "pemeliharaan",
    href: "/sarpras/pemeliharaan",
    label: "Pemeliharaan & Kerusakan",
    shortLabel: "Perbaikan",
    group: "sapras",
  },
  {
    key: "bhp",
    href: "/sarpras/bhp",
    label: "Barang Habis Pakai / ATK",
    shortLabel: "Stok BHP",
    group: "sapras",
  },
  {
    key: "ruangan",
    href: "/sarpras/ruangan",
    label: "Gedung & Ruangan",
    shortLabel: "Ruangan",
    group: "data_master",
  },
  {
    key: "kelas",
    href: "/sarpras/kelas",
    label: "Kelas & DPM",
    shortLabel: "Kelas",
    group: "data_master",
  },
  {
    key: "dosen",
    href: "/sarpras/dosen",
    label: "Dosen",
    shortLabel: "Dosen",
    group: "data_master",
  },
  {
    key: "makul",
    href: "/sarpras/makul",
    label: "Mata Kuliah (Makul)",
    shortLabel: "Makul",
    group: "data_master",
  },
  {
    key: "pengurus",
    href: "/sarpras/pengurus",
    label: "Pengurus Kampus",
    shortLabel: "Pengurus",
    group: "data_master",
  },
  {
    key: "unit",
    href: "/sarpras/unit",
    label: "Unit, Prodi & Ormawa",
    shortLabel: "Unit Kerja",
    group: "data_master",
  },
  {
    key: "vendor",
    href: "/sarpras/vendor",
    label: "Teknisi & Vendor",
    shortLabel: "Vendor",
    group: "data_master",
  },
  {
    key: "referensi",
    href: "/sarpras/referensi",
    label: "Master Referensi",
    shortLabel: "Referensi",
    group: "data_master",
  },
];

export const ALL_MANAGEABLE_PAGES: SarprasPageKey[] = SARPRAS_PAGES.map(
  (p) => p.key
);

export const DEFAULT_STAFF_PAGES: SarprasPageKey[] = SARPRAS_PAGES.filter(
  (p) => p.group === "sapras"
).map((p) => p.key);

export const DATA_MASTER_PAGE_KEYS: SarprasPageKey[] = SARPRAS_PAGES.filter(
  (p) => p.group === "data_master"
).map((p) => p.key);

const VALID_PAGE_KEY_SET = new Set<string>(ALL_MANAGEABLE_PAGES);
const PAGE_META_BY_KEY = new Map<SarprasPageKey, SarprasPageMeta>(
  SARPRAS_PAGES.map((p) => [p.key, p])
);

export const PERMISSION_PRESETS: Array<{
  id: string;
  label: string;
  pages: SarprasPageKey[];
}> = [
  {
    id: "default_sapras",
    label: "Default SAPRAS (6)",
    pages: [...DEFAULT_STAFF_PAGES],
  },
  {
    id: "loket_sirkulasi",
    label: "Loket Sirkulasi (2)",
    pages: ["sirkulasi-invent", "pemeliharaan"],
  },
  {
    id: "all_pages",
    label: "Pilih Semua (14)",
    pages: [...ALL_MANAGEABLE_PAGES],
  },
];

export function normalizeAllowedPages(
  role: StaffRole,
  raw: unknown
): SarprasPageKey[] {
  if (role === "master_admin") {
    return [...ALL_MANAGEABLE_PAGES];
  }
  if (raw === null || raw === undefined) {
    return [...DEFAULT_STAFF_PAGES];
  }
  if (!Array.isArray(raw)) {
    return [...DEFAULT_STAFF_PAGES];
  }
  const picked = new Set<SarprasPageKey>();
  for (const item of raw) {
    if (typeof item === "string" && VALID_PAGE_KEY_SET.has(item)) {
      picked.add(item as SarprasPageKey);
    }
  }
  return ALL_MANAGEABLE_PAGES.filter((k) => picked.has(k));
}

export function getPageMeta(
  pageKey: SarprasPageKey
): SarprasPageMeta | undefined {
  return PAGE_META_BY_KEY.get(pageKey);
}

export function canAccessPage(
  user:
    | { role: StaffRole; allowedPages?: SarprasPageKey[] | null }
    | null
    | undefined,
  pageKey: SarprasPageKey | "akun"
): boolean {
  if (!user) return false;
  if (user.role === "master_admin") return true;
  if (pageKey === "akun") return false;
  const normalized = normalizeAllowedPages(user.role, user.allowedPages);
  return normalized.includes(pageKey);
}

export function getPageKeyFromPathname(
  pathname: string | null | undefined
): SarprasPageKey | "akun" | null {
  if (!pathname) return null;
  if (pathname === "/sarpras/akun" || pathname.startsWith("/sarpras/akun/")) {
    return "akun";
  }
  const matched = SARPRAS_PAGES.find(
    (p) => pathname === p.href || pathname.startsWith(`${p.href}/`)
  );
  return matched ? matched.key : null;
}

export function getFirstAllowedHref(
  user:
    | { role: StaffRole; allowedPages?: SarprasPageKey[] | null }
    | null
    | undefined
): string {
  if (!user) return "/sarpras/dashboard";
  if (user.role === "master_admin") return "/sarpras/dashboard";
  const allowed = normalizeAllowedPages(user.role, user.allowedPages);
  const firstKey = allowed[0];
  if (!firstKey) return "/sarpras/dashboard";
  return PAGE_META_BY_KEY.get(firstKey)?.href || "/sarpras/dashboard";
}

export const ACTION_TO_PAGE_KEY: Record<string, SarprasPageKey> = {
  insert_building: "ruangan",
  update_building: "ruangan",
  delete_building: "ruangan",
  insert_room: "ruangan",
  update_room: "ruangan",
  delete_room: "ruangan",

  insert_asset: "inventaris",
  bulk_insert_assets: "inventaris",
  update_asset: "inventaris",
  delete_asset: "inventaris",

  insert_booking: "peminjaman",
  update_booking_status: "peminjaman",
  delete_booking: "peminjaman",

  insert_maintenance: "pemeliharaan",
  update_maintenance: "pemeliharaan",
  delete_maintenance: "pemeliharaan",

  insert_consumable: "bhp",
  update_consumable: "bhp",
  delete_consumable: "bhp",
  insert_consumable_tx: "bhp",

  insert_lecturer: "dosen",
  update_lecturer: "dosen",
  delete_lecturer: "dosen",

  insert_course: "makul",
  update_course: "makul",
  delete_course: "makul",

  insert_official: "pengurus",
  update_official: "pengurus",
  delete_official: "pengurus",

  insert_campus_unit: "unit",
  update_campus_unit: "unit",
  delete_campus_unit: "unit",

  insert_vendor: "vendor",
  update_vendor: "vendor",
  delete_vendor: "vendor",

  insert_asset_category: "referensi",
  update_asset_category: "referensi",
  delete_asset_category: "referensi",
  insert_funding_source: "referensi",
  update_funding_source: "referensi",
  delete_funding_source: "referensi",
  insert_consumable_category: "referensi",
  update_consumable_category: "referensi",
  delete_consumable_category: "referensi",
  insert_consumable_unit: "referensi",
  update_consumable_unit: "referensi",
  delete_consumable_unit: "referensi",

  insert_academic_class: "kelas",
  update_academic_class: "kelas",
  delete_academic_class: "kelas",

  insert_office_kit_item: "sirkulasi-invent",
  update_office_kit_item: "sirkulasi-invent",
  delete_office_kit_item: "sirkulasi-invent",
  checkout_office_kit_loan: "sirkulasi-invent",
  checkin_office_kit_loan: "sirkulasi-invent",
  reopen_office_kit_loan: "sirkulasi-invent",
  delete_office_kit_loan: "sirkulasi-invent",
};

export const ENTITY_TYPE_TO_PAGE_KEY: Record<
  SarprasEntityType,
  SarprasPageKey
> = {
  booking: "peminjaman",
  maintenance: "pemeliharaan",
  asset: "inventaris",
  room: "ruangan",
  consumable: "bhp",
  lecturer: "dosen",
  course: "makul",
  official: "pengurus",
  unit: "unit",
  vendor: "vendor",
  class: "kelas",
  office_kit: "sirkulasi-invent",
  office_loan: "sirkulasi-invent",
};
