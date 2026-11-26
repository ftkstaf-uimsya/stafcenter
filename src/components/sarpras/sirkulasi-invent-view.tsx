"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Cable,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  History,
  ImageIcon,
  KanbanSquare,
  Layers,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Table2,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  useSarpras,
} from "@/lib/supabase/sarpras-context";
import { formatCurrencyIDR } from "@/lib/supabase/client";
import {
  AssetCondition,
  DamageSeverity,
  SarprasAttachment,
  OfficeKitCategory,
  OfficeKitItem,
  OfficeKitLoan,
  OfficeKitStatus,
  ProdiCode,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ColumnsTogglePopover,
  FilterPopover,
} from "@/components/ui/filter-popover";
import { KanbanBoard, KanbanColumnDef } from "@/components/ui/kanban-board";
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";
import { AssetConditionBadge } from "@/components/sarpras/status-badges";
import { BarcodeLabelModal } from "@/components/ui/barcode-label-modal";
import { PrintableBarcodeItem } from "@/lib/barcode/render-codes";
import { LoanBoardCompactCard } from "@/components/sarpras/loan-compact-card";
import { QuickLoanForm } from "@/components/sarpras/quick-loan-form";
import { MaintenanceReportModal } from "@/components/sarpras/maintenance-report-modal";
import { ReplaceLoanItemModal } from "@/components/sarpras/replace-loan-item-modal";
import {
  formatWibDateTime,
  isLoanVisibleOnDailyDesk,
  useTodayWibIso,
} from "@/lib/sarpras/sirkulasi-utils";
import { matchesFlexibleQuery } from "@/lib/search-normalize";

const OFFICE_KIT_CATEGORIES: OfficeKitCategory[] = [
  "Kabel HDMI",
  "Stop Kontak",
  "Remote TV",
  "Kunci & Akses",
  "Adapter & Converter",
  "Lainnya",
];

const KIT_CATEGORY_NUMERIC_PREFIX: Record<OfficeKitCategory, number> = {
  "Kabel HDMI": 1,
  "Stop Kontak": 2,
  "Remote TV": 3,
  "Kunci & Akses": 4,
  "Adapter & Converter": 5,
  Lainnya: 9,
};

function getNextKitCodeForCategory(
  category: OfficeKitCategory,
  items: OfficeKitItem[]
): string {
  const base = (KIT_CATEGORY_NUMERIC_PREFIX[category] || 9) * 1000;
  const used = new Set(items.map((i) => i.kit_code.trim().toUpperCase()));
  let seq = 1;
  while (used.has(String(base + seq))) {
    seq += 1;
  }
  return String(base + seq);
}

function getNextKitNameForCategory(
  category: OfficeKitCategory,
  items: OfficeKitItem[]
): string {
  const usedNames = new Set(items.map((i) => i.name.trim().toLowerCase()));
  let seq = 1;
  while (usedNames.has(`${category} ${seq}`.toLowerCase())) {
    seq += 1;
  }
  return `${category} ${seq}`;
}

function isSimpleNumericOrCodeName(name: string, currentCode: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "-") return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.toUpperCase() === currentCode.trim().toUpperCase()) return true;
  return false;
}

const OFFICE_KIT_CONDITIONS: AssetCondition[] = [
  "Baik",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
];

const PRODI_OPTIONS: ProdiCode[] = [
  "MPI",
  "PBA",
  "TBIG",
  "TBIN",
  "TMTK",
  "TIPA",
  "PAI",
];

type ActiveTab = "loans" | "items" | "history";
type HistorySubTab = "log" | "recap";
type HistoryPeriodPreset = "ALL" | "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";
type RecapSaprasMode = "category" | "item";

function shiftIsoDate(baseIso: string, deltaDays: number): string {
  const parts = baseIso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return baseIso;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function inferKitCategoryFromLabel(label: string): OfficeKitCategory {
  const upper = label.toUpperCase();
  if (upper.includes("HDMI")) return "Kabel HDMI";
  if (upper.includes("STOP KONTAK") || upper.includes("STK")) return "Stop Kontak";
  if (upper.includes("REMOTE") || upper.includes("RMT")) return "Remote TV";
  if (upper.includes("KUNCI") || upper.includes("AKSES") || upper.includes("KNC")) {
    return "Kunci & Akses";
  }
  if (upper.includes("ADAPTER") || upper.includes("CONVERTER") || upper.includes("ADP")) {
    return "Adapter & Converter";
  }
  return "Lainnya";
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function KitStatusBadge({ status }: { status: OfficeKitStatus }) {
  if (status === "Tersedia") {
    return (
      <Badge tone="success">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Tersedia di Kantor Staf</span>
      </Badge>
    );
  }
  if (status === "Dipinjam") {
    return (
      <Badge tone="warning">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Sedang Dipinjam</span>
      </Badge>
    );
  }
  return (
    <Badge tone="danger">
      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Perbaikan</span>
    </Badge>
  );
}

export function SirkulasiInventView() {
  const {
    officeKitItems,
    officeKitLoans,
    rooms,
    notes,
    attachments,
    uiSimState,
    setUiSimState,
    isLiveSupabase,
    authUser,
    addOfficeKitItem,
    updateOfficeKitItem,
    deleteOfficeKitItem,
    bulkDeleteOfficeKitItems,
    checkinOfficeKitLoan,
    reopenOfficeKitLoan,
    deleteOfficeKitLoan,
    resequenceOfficeKitItems,
    notify,
  } = useSarpras();

  const todayWibIso = useTodayWibIso();
  const isMasterAdmin = !isLiveSupabase || authUser?.role === "master_admin";

  const [activeTab, setActiveTab] = useState<ActiveTab>("loans");
  const [viewMode, setViewMode] = useState<"board" | "table">("table");

  // State khusus tab Riwayat & Rekap (eksklusif Master Admin)
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>("log");
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriodPreset>("ALL");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyProdi, setHistoryProdi] = useState("ALL");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [historyPhotoFilter, setHistoryPhotoFilter] = useState<
    "ALL" | "WITH_PHOTO" | "NO_PHOTO"
  >("ALL");
  const [historyClassFilter, setHistoryClassFilter] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [photoLightbox, setPhotoLightbox] = useState<{
    loanCode: string;
    classCode: string;
    photos: SarprasAttachment[];
    index: number;
  } | null>(null);
  const [recapSaprasMode, setRecapSaprasMode] =
    useState<RecapSaprasMode>("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLoanStatus, setFilterLoanStatus] = useState("ALL");
  const [filterProdi, setFilterProdi] = useState("ALL");
  const [filterKitCategory, setFilterKitCategory] = useState("ALL");
  const [filterKitStatus, setFilterKitStatus] = useState("ALL");
  const [hiddenLoanCols, setHiddenLoanCols] = useState<string[]>([]);
  const [hiddenItemCols, setHiddenItemCols] = useState<string[]>([]);

  // Slide-over detail drawer
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [replacingLoan, setReplacingLoan] = useState<OfficeKitLoan | null>(
    null
  );

  // Modal Check-Out Pinjam Cepat Alat Kantor Staf
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutPreselectedKitId, setCheckoutPreselectedKitId] = useState<
    string | undefined
  >(undefined);

  // Seleksi, Cetak Label QR, Perbaikan Massal & Penomoran Ulang Barang Kantor Staf
  const [selectedKitRowKeys, setSelectedKitRowKeys] = useState<string[]>([]);
  const [bulkRepairMenuOpen, setBulkRepairMenuOpen] = useState(false);
  const [bulkRepairModal, setBulkRepairModal] = useState<{
    open: boolean;
    severity: DamageSeverity;
    kitIds: string[];
  }>({ open: false, severity: "Rusak Ringan", kitIds: [] });
  const [barcodePrintItems, setBarcodePrintItems] = useState<
    PrintableBarcodeItem[] | null
  >(null);
  const [resequenceModalOpen, setResequenceModalOpen] = useState(false);
  const [resequenceAllNames, setResequenceAllNames] = useState(false);
  const [resequenceSubmitting, setResequenceSubmitting] = useState(false);
  const [resequenceError, setResequenceError] = useState("");

  // Modal Check-In Pengembalian
  const [returningLoan, setReturningLoan] = useState<OfficeKitLoan | null>(
    null
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [damagedReturnIds, setDamagedReturnIds] = useState<string[]>([]);

  // Modal Tambah / Edit Barang Kantor Staf
  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<OfficeKitItem | null>(null);
  const [kitCode, setKitCode] = useState("");
  const [kitName, setKitName] = useState("");
  const [kitCodeDirty, setKitCodeDirty] = useState(false);
  const [kitNameDirty, setKitNameDirty] = useState(false);
  const [kitCategory, setKitCategory] =
    useState<OfficeKitCategory>("Kabel HDMI");
  const [kitSpec, setKitSpec] = useState("");
  const [kitTray, setKitTray] = useState("Kotak Kabel Loker A1 - Kantor Staf");
  const [kitLinkedRoomId, setKitLinkedRoomId] = useState("");
  const [kitProcurementYear, setKitProcurementYear] = useState("");
  const [kitAcquisitionCost, setKitAcquisitionCost] = useState("");
  const [kitCondition, setKitCondition] = useState<AssetCondition>("Baik");
  const [kitNotes, setKitNotes] = useState("");
  const [kitError, setKitError] = useState("");

  // Modal Hapus (Satuan & Massal)
  const [deletingLoan, setDeletingLoan] = useState<OfficeKitLoan | null>(null);
  const [deletingKit, setDeletingKit] = useState<OfficeKitItem | null>(null);
  const [bulkDeleteKitsOpen, setBulkDeleteKitsOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const selectedKitsForDelete = useMemo(
    () => officeKitItems.filter((k) => selectedKitRowKeys.includes(k.id)),
    [officeKitItems, selectedKitRowKeys]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (!inspect) return;
    if (officeKitLoans.some((l) => l.id === inspect)) {
      setActiveTab("loans");
      setSelectedLoanId(inspect);
    } else if (officeKitItems.some((i) => i.id === inspect)) {
      setActiveTab("items");
      setSelectedKitId(inspect);
    }
  }, [officeKitItems, officeKitLoans]);

  useEffect(() => {
    if (!isMasterAdmin && activeTab === "history") {
      setActiveTab("loans");
    }
  }, [activeTab, isMasterAdmin]);

  const activeLoansCount = useMemo(
    () => officeKitLoans.filter((l) => l.status === "Dipinjam").length,
    [officeKitLoans]
  );

  const countByCategory = (cat: OfficeKitCategory) => {
    const all = officeKitItems.filter((i) => i.category === cat && i.is_active);
    const available = all.filter((i) => i.status === "Tersedia");
    return { total: all.length, available: available.length };
  };

  const hdmiStats = countByCategory("Kabel HDMI");
  const stopKontakStats = countByCategory("Stop Kontak");
  const remoteTvStats = countByCategory("Remote TV");

  const dailyDeskLoans = useMemo(
    () =>
      officeKitLoans.filter((l) => isLoanVisibleOnDailyDesk(l, todayWibIso)),
    [officeKitLoans, todayWibIso]
  );

  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim();
    return dailyDeskLoans.filter((l) => {
      const matchSearch =
        !q ||
        matchesFlexibleQuery(
          `${l.loan_code} ${l.class_code} ${l.dpm_name} ${l.borrower_name} ${l.kit_items_label} ${l.course_name || ""}`,
          q
        );
      const matchStatus =
        filterLoanStatus === "ALL" || l.status === filterLoanStatus;
      const matchProdi = filterProdi === "ALL" || l.prodi === filterProdi;
      return matchSearch && matchStatus && matchProdi;
    });
  }, [dailyDeskLoans, searchQuery, filterLoanStatus, filterProdi]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim();
    return officeKitItems.filter((i) => {
      const matchSearch =
        !q ||
        matchesFlexibleQuery(
          `${i.kit_code} ${i.name} ${i.brand_spec} ${i.storage_tray}`,
          q
        );
      const matchCat =
        filterKitCategory === "ALL" || i.category === filterKitCategory;
      const matchStatus =
        filterKitStatus === "ALL" || i.status === filterKitStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [officeKitItems, searchQuery, filterKitCategory, filterKitStatus]);

  const activeLoanFilterCount =
    (filterLoanStatus !== "ALL" ? 1 : 0) + (filterProdi !== "ALL" ? 1 : 0);
  const activeItemFilterCount =
    (filterKitCategory !== "ALL" ? 1 : 0) + (filterKitStatus !== "ALL" ? 1 : 0);

  const loanPhotosById = useMemo(() => {
    const map = new Map<string, SarprasAttachment[]>();
    for (const att of attachments) {
      if (att.entity_type !== "office_loan") continue;
      if (!att.mime_type.startsWith("image/")) continue;
      if (
        !att.file_url.startsWith("https://") &&
        !att.file_url.startsWith("http://") &&
        !att.file_url.startsWith("blob:")
      ) {
        continue;
      }
      const list = map.get(att.entity_id);
      if (list) {
        list.push(att);
      } else {
        map.set(att.entity_id, [att]);
      }
    }
    return map;
  }, [attachments]);

  const historyFilteredLoans = useMemo(() => {
    const q = historySearch.trim();
    const min7d = shiftIsoDate(todayWibIso, -6);
    const min30d = shiftIsoDate(todayWibIso, -29);
    const monthPrefix = todayWibIso.slice(0, 7);

    return officeKitLoans
      .filter((l) => {
        if (historyPeriod === "TODAY" && l.loan_date !== todayWibIso) {
          return false;
        }
        if (historyPeriod === "7D" && l.loan_date < min7d) {
          return false;
        }
        if (historyPeriod === "30D" && l.loan_date < min30d) {
          return false;
        }
        if (
          historyPeriod === "MONTH" &&
          !l.loan_date.startsWith(monthPrefix)
        ) {
          return false;
        }
        if (historyPeriod === "CUSTOM") {
          if (historyStartDate && l.loan_date < historyStartDate) return false;
          if (historyEndDate && l.loan_date > historyEndDate) return false;
        }

        if (historyProdi !== "ALL" && l.prodi !== historyProdi) return false;
        if (historyStatus !== "ALL" && l.status !== historyStatus) return false;
        if (historyPhotoFilter !== "ALL") {
          const hasPhotos = (loanPhotosById.get(l.id)?.length || 0) > 0;
          if (historyPhotoFilter === "WITH_PHOTO" && !hasPhotos) return false;
          if (historyPhotoFilter === "NO_PHOTO" && hasPhotos) return false;
        }
        if (
          historyClassFilter &&
          l.class_code.toUpperCase() !== historyClassFilter.toUpperCase()
        ) {
          return false;
        }

        if (!q) return true;
        const room = rooms.find((r) => r.id === l.room_id);
        return matchesFlexibleQuery(
          `${l.loan_code} ${l.class_code} ${l.prodi} ${l.dpm_name} ${l.borrower_name} ${l.kit_items_label} ${l.course_name || ""} ${l.handed_by_staff || ""} ${l.received_by_staff || ""} ${room ? `${room.code} ${room.name}` : ""}`,
          q
        );
      })
      .sort((a, b) => {
        const byDate = b.loan_date.localeCompare(a.loan_date);
        if (byDate !== 0) return byDate;
        const byTime = b.borrow_time.localeCompare(a.borrow_time);
        if (byTime !== 0) return byTime;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [
    historyClassFilter,
    historyEndDate,
    historyPeriod,
    historyPhotoFilter,
    historyProdi,
    historySearch,
    historyStartDate,
    historyStatus,
    loanPhotosById,
    officeKitLoans,
    rooms,
    todayWibIso,
  ]);

  const recapSummary = useMemo(() => {
    const kitMap = new Map<string, OfficeKitItem>();
    for (const item of officeKitItems) {
      kitMap.set(item.id, item);
    }

    const totalLoans = historyFilteredLoans.length;
    const loansWithPhotoCount = historyFilteredLoans.filter(
      (l) => (loanPhotosById.get(l.id)?.length || 0) > 0
    ).length;
    const returnedLoans = historyFilteredLoans.filter(
      (l) => l.status === "Dikembalikan"
    ).length;
    const activeLoans = totalLoans - returnedLoans;
    const totalUnitsBorrowed = historyFilteredLoans.reduce(
      (acc, l) => acc + l.kit_item_ids.length,
      0
    );
    const completionRatePct =
      totalLoans > 0 ? Math.round((returnedLoans / totalLoans) * 100) : 0;

    type ClassAgg = {
      classCode: string;
      prodi: ProdiCode;
      dpmName: string;
      loanCount: number;
      photoLoanCount: number;
      activeCount: number;
      totalItemsBorrowed: number;
      lastLoanDate: string;
      catCounts: Map<OfficeKitCategory, number>;
    };

    const classMap = new Map<string, ClassAgg>();

    type CatAgg = {
      category: OfficeKitCategory;
      borrowCount: number;
      loanIds: Set<string>;
      classCounts: Map<string, number>;
    };
    const catMap = new Map<OfficeKitCategory, CatAgg>();
    for (const cat of OFFICE_KIT_CATEGORIES) {
      catMap.set(cat, {
        category: cat,
        borrowCount: 0,
        loanIds: new Set<string>(),
        classCounts: new Map<string, number>(),
      });
    }

    type ItemAgg = {
      kitId: string;
      kitCode: string;
      name: string;
      category: OfficeKitCategory;
      status: OfficeKitStatus | "Arsip";
      condition: AssetCondition | null;
      isDeleted: boolean;
      borrowCount: number;
      lastLoanDate: string;
      classCounts: Map<string, number>;
    };
    const itemMap = new Map<string, ItemAgg>();

    type RoomAgg = {
      roomKey: string;
      roomLabel: string;
      loanCount: number;
      totalUnitsBorrowed: number;
      lastLoanDate: string;
      catCounts: Map<OfficeKitCategory, number>;
    };
    const roomAggMap = new Map<string, RoomAgg>();

    for (const loan of historyFilteredLoans) {
      const normalizedClass = loan.class_code.trim().toUpperCase();
      const existingClass = classMap.get(normalizedClass) || {
        classCode: normalizedClass,
        prodi: loan.prodi,
        dpmName: loan.dpm_name,
        loanCount: 0,
        photoLoanCount: 0,
        activeCount: 0,
        totalItemsBorrowed: 0,
        lastLoanDate: loan.loan_date,
        catCounts: new Map<OfficeKitCategory, number>(),
      };
      existingClass.loanCount += 1;
      if ((loanPhotosById.get(loan.id)?.length || 0) > 0) {
        existingClass.photoLoanCount += 1;
      }
      if (loan.status === "Dipinjam") existingClass.activeCount += 1;
      existingClass.totalItemsBorrowed += loan.kit_item_ids.length;
      if (loan.loan_date > existingClass.lastLoanDate) {
        existingClass.lastLoanDate = loan.loan_date;
        existingClass.dpmName = loan.dpm_name;
      }

      const roomKey = loan.room_id || "__REGULAR__";
      const roomObj = rooms.find((r) => r.id === loan.room_id);
      const roomLabel = roomObj
        ? `${roomObj.code} (${roomObj.name})`
        : "Ruang Kelas Reguler";
      const existingRoom = roomAggMap.get(roomKey) || {
        roomKey,
        roomLabel,
        loanCount: 0,
        totalUnitsBorrowed: 0,
        lastLoanDate: loan.loan_date,
        catCounts: new Map<OfficeKitCategory, number>(),
      };
      existingRoom.loanCount += 1;
      existingRoom.totalUnitsBorrowed += loan.kit_item_ids.length;
      if (loan.loan_date > existingRoom.lastLoanDate) {
        existingRoom.lastLoanDate = loan.loan_date;
      }

      for (const kitId of loan.kit_item_ids) {
        const kit = kitMap.get(kitId);
        const category = kit
          ? kit.category
          : inferKitCategoryFromLabel(loan.kit_items_label);

        existingClass.catCounts.set(
          category,
          (existingClass.catCounts.get(category) || 0) + 1
        );
        existingRoom.catCounts.set(
          category,
          (existingRoom.catCounts.get(category) || 0) + 1
        );

        const catAgg = catMap.get(category)!;
        catAgg.borrowCount += 1;
        catAgg.loanIds.add(loan.id);
        catAgg.classCounts.set(
          normalizedClass,
          (catAgg.classCounts.get(normalizedClass) || 0) + 1
        );

        const existingItem = itemMap.get(kitId) || {
          kitId,
          kitCode: kit ? kit.kit_code : `UNIT-${kitId.slice(0, 6).toUpperCase()}`,
          name: kit ? kit.name : `Unit Arsip (${loan.loan_code})`,
          category,
          status: kit ? kit.status : "Arsip",
          condition: kit ? kit.condition : null,
          isDeleted: !kit,
          borrowCount: 0,
          lastLoanDate: loan.loan_date,
          classCounts: new Map<string, number>(),
        };
        existingItem.borrowCount += 1;
        if (loan.loan_date > existingItem.lastLoanDate) {
          existingItem.lastLoanDate = loan.loan_date;
        }
        existingItem.classCounts.set(
          normalizedClass,
          (existingItem.classCounts.get(normalizedClass) || 0) + 1
        );
        itemMap.set(kitId, existingItem);
      }

      classMap.set(normalizedClass, existingClass);
      roomAggMap.set(roomKey, existingRoom);
    }

    const classRankings = Array.from(classMap.values())
      .map((entry) => {
        const topCategories = Array.from(entry.catCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat, count]) => `${cat} (${count}x)`)
          .join(", ");
        return {
          classCode: entry.classCode,
          prodi: entry.prodi,
          dpmName: entry.dpmName,
          loanCount: entry.loanCount,
          photoLoanCount: entry.photoLoanCount,
          activeCount: entry.activeCount,
          totalItemsBorrowed: entry.totalItemsBorrowed,
          lastLoanDate: entry.lastLoanDate,
          topCategories: topCategories || "-",
        };
      })
      .sort((a, b) => {
        if (b.loanCount !== a.loanCount) return b.loanCount - a.loanCount;
        if (b.totalItemsBorrowed !== a.totalItemsBorrowed) {
          return b.totalItemsBorrowed - a.totalItemsBorrowed;
        }
        return b.lastLoanDate.localeCompare(a.lastLoanDate);
      });

    const categoryRankings = Array.from(catMap.values())
      .map((entry) => {
        const itemsInCat = officeKitItems.filter(
          (i) => i.category === entry.category && i.is_active
        );
        const availableUnits = itemsInCat.filter(
          (i) => i.status === "Tersedia"
        ).length;
        const topClassEntry = Array.from(entry.classCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];
        const sharePct =
          totalUnitsBorrowed > 0
            ? Math.round((entry.borrowCount / totalUnitsBorrowed) * 100)
            : 0;
        return {
          category: entry.category,
          borrowCount: entry.borrowCount,
          ticketCount: entry.loanIds.size,
          sharePct,
          totalUnits: itemsInCat.length,
          availableUnits,
          topClassCode: topClassEntry ? topClassEntry[0] : "-",
          topClassCount: topClassEntry ? topClassEntry[1] : 0,
        };
      })
      .filter((c) => c.borrowCount > 0 || c.totalUnits > 0)
      .sort((a, b) => {
        if (b.borrowCount !== a.borrowCount) return b.borrowCount - a.borrowCount;
        return b.totalUnits - a.totalUnits;
      });

    const itemRankings = Array.from(itemMap.values())
      .map((entry) => {
        const topClassEntry = Array.from(entry.classCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];
        return {
          kitId: entry.kitId,
          kitCode: entry.kitCode,
          name: entry.name,
          category: entry.category,
          status: entry.status,
          condition: entry.condition,
          isDeleted: entry.isDeleted,
          borrowCount: entry.borrowCount,
          lastLoanDate: entry.lastLoanDate,
          topClassLabel: topClassEntry
            ? `${topClassEntry[0]} (${topClassEntry[1]}x)`
            : "-",
        };
      })
      .sort((a, b) => {
        if (b.borrowCount !== a.borrowCount) return b.borrowCount - a.borrowCount;
        return b.lastLoanDate.localeCompare(a.lastLoanDate);
      });

    const roomRankings = Array.from(roomAggMap.values())
      .map((entry) => {
        const topCats = Array.from(entry.catCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([cat, count]) => `${cat} (${count}x)`)
          .join(", ");
        return {
          roomKey: entry.roomKey,
          roomLabel: entry.roomLabel,
          loanCount: entry.loanCount,
          totalUnitsBorrowed: entry.totalUnitsBorrowed,
          lastLoanDate: entry.lastLoanDate,
          topCategoryLabel: topCats || "-",
        };
      })
      .sort((a, b) => {
        if (b.loanCount !== a.loanCount) return b.loanCount - a.loanCount;
        return b.totalUnitsBorrowed - a.totalUnitsBorrowed;
      });

    return {
      totalLoans,
      loansWithPhotoCount,
      returnedLoans,
      activeLoans,
      totalUnitsBorrowed,
      completionRatePct,
      uniqueClassesCount: classRankings.length,
      classRankings,
      categoryRankings,
      itemRankings,
      roomRankings,
    };
  }, [historyFilteredLoans, loanPhotosById, officeKitItems, rooms]);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat loket Sirkulasi Invent peralatan kantor staf dan status kelas..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Modul Sirkulasi Invent"
        description="Sistem gagal mengambil data peminjaman kabel HDMI, stop kontak, dan remote TV kantor staf."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openCheckoutModal = (preselectedKitId?: string) => {
    setCheckoutPreselectedKitId(preselectedKitId);
    setCheckoutModalOpen(true);
  };

  const toKitPrintableItem = (item: OfficeKitItem): PrintableBarcodeItem => {
    const linkedRoom = rooms.find((r) => r.id === item.linked_room_id);
    return {
      id: item.id,
      code: item.kit_code,
      title: item.name,
      subtitle: `${item.category}${
        item.brand_spec && item.brand_spec !== "-"
          ? ` • ${item.brand_spec}`
          : ""
      }`,
      meta: linkedRoom
        ? `${item.storage_tray} (${linkedRoom.code})`
        : item.storage_tray,
      headerTag: "ALAT KANTOR STAF • STAFCENTER",
    };
  };

  const openBulkKitBarcodePrint = () => {
    const selectedSet = new Set(selectedKitRowKeys);
    const chosen =
      selectedSet.size > 0
        ? officeKitItems.filter((item) => selectedSet.has(item.id))
        : filteredItems;
    if (chosen.length === 0) return;
    setBarcodePrintItems(chosen.map(toKitPrintableItem));
  };

  const openReturnModal = (loan: OfficeKitLoan, preDamagedIds?: string[]) => {
    setReturningLoan(loan);
    setReturnNotes("");
    setDamagedReturnIds(preDamagedIds || []);
  };

  const getActiveLoanForKit = (kitId: string) =>
    officeKitLoans.find(
      (l) => l.status === "Dipinjam" && l.kit_item_ids.includes(kitId)
    ) || null;

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningLoan) return;
    checkinOfficeKitLoan(returningLoan.id, {
      returnConditionNotes: returnNotes,
      damagedItemIds: damagedReturnIds,
    });
    setReturningLoan(null);
  };

  const openAddKitModal = () => {
    const defaultCategory: OfficeKitCategory = "Kabel HDMI";
    setEditingKit(null);
    setKitCategory(defaultCategory);
    setKitCode(getNextKitCodeForCategory(defaultCategory, officeKitItems));
    setKitName(getNextKitNameForCategory(defaultCategory, officeKitItems));
    setKitCodeDirty(false);
    setKitNameDirty(false);
    setKitSpec("");
    setKitTray("Kotak Kabel Loker A1 - Kantor Staf");
    setKitLinkedRoomId("");
    setKitProcurementYear(String(new Date().getFullYear()));
    setKitAcquisitionCost("");
    setKitCondition("Baik");
    setKitNotes("");
    setKitError("");
    setKitModalOpen(true);
  };

  const openEditKitModal = (item: OfficeKitItem) => {
    setEditingKit(item);
    setKitCode(item.kit_code);
    setKitName(item.name);
    setKitCodeDirty(true);
    setKitNameDirty(true);
    setKitCategory(item.category);
    setKitSpec(item.brand_spec);
    setKitTray(item.storage_tray);
    setKitLinkedRoomId(item.linked_room_id || "");
    setKitProcurementYear(
      item.procurement_year ? String(item.procurement_year) : ""
    );
    setKitAcquisitionCost(
      typeof item.acquisition_cost === "number" && item.acquisition_cost > 0
        ? String(item.acquisition_cost)
        : ""
    );
    setKitCondition(item.condition);
    setKitNotes(item.notes || "");
    setKitError("");
    setKitModalOpen(true);
  };

  const handleKitCategoryChange = (nextCategory: OfficeKitCategory) => {
    setKitCategory(nextCategory);
    if (!editingKit) {
      if (!kitCodeDirty) {
        setKitCode(getNextKitCodeForCategory(nextCategory, officeKitItems));
      }
      if (!kitNameDirty) {
        setKitName(getNextKitNameForCategory(nextCategory, officeKitItems));
      }
    }
  };

  const resequencePreviewRows = useMemo(() => {
    const seqByCategory = new Map<OfficeKitCategory, number>();
    const sorted = [...officeKitItems].sort((a, b) => {
      const catCompare =
        OFFICE_KIT_CATEGORIES.indexOf(a.category) -
        OFFICE_KIT_CATEGORIES.indexOf(b.category);
      if (catCompare !== 0) return catCompare;
      const byCreated = a.created_at.localeCompare(b.created_at);
      if (byCreated !== 0) return byCreated;
      return a.kit_code.localeCompare(b.kit_code, undefined, { numeric: true });
    });

    return sorted.map((item) => {
      const nextSeq = (seqByCategory.get(item.category) || 0) + 1;
      seqByCategory.set(item.category, nextSeq);
      const base = (KIT_CATEGORY_NUMERIC_PREFIX[item.category] || 9) * 1000;
      const nextCode = String(base + nextSeq);
      const shouldFixName =
        resequenceAllNames || isSimpleNumericOrCodeName(item.name, item.kit_code);
      const nextName = shouldFixName ? `${item.category} ${nextSeq}` : item.name;
      return {
        id: item.id,
        category: item.category,
        oldCode: item.kit_code,
        oldName: item.name,
        nextCode,
        nextName,
        changed: nextCode !== item.kit_code || nextName !== item.name,
      };
    });
  }, [officeKitItems, resequenceAllNames]);

  const handleApplyResequence = async () => {
    const toUpdate = resequencePreviewRows
      .filter((r) => r.changed)
      .map((r) => ({ id: r.id, kit_code: r.nextCode, name: r.nextName }));
    if (toUpdate.length === 0) {
      setResequenceModalOpen(false);
      return;
    }
    setResequenceSubmitting(true);
    setResequenceError("");
    const res = await resequenceOfficeKitItems(toUpdate);
    setResequenceSubmitting(false);
    if (!res.ok) {
      setResequenceError(res.error || "Gagal merapikan kode unit barang.");
      return;
    }
    setResequenceModalOpen(false);
  };

  const handleKitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKitError("");
    if (!kitCode.trim() || !kitName.trim()) {
      setKitError("Kode Barang dan Nama Barang wajib diisi.");
      return;
    }

    let parsedYear: number | null = null;
    if (kitProcurementYear.trim()) {
      const yr = Number(kitProcurementYear.trim());
      if (!Number.isInteger(yr) || yr < 1990 || yr > 2100) {
        setKitError("Tahun pengadaan harus berupa angka antara 1990 s.d. 2100.");
        return;
      }
      parsedYear = yr;
    }

    let parsedCost = 0;
    if (kitAcquisitionCost.trim()) {
      const cost = Number(kitAcquisitionCost.trim());
      if (!Number.isFinite(cost) || cost < 0) {
        setKitError("Harga perolehan harus berupa angka 0 atau lebih.");
        return;
      }
      parsedCost = Math.round(cost);
    }

    const nextStatus: OfficeKitStatus =
      kitCondition === "Rusak Ringan" ||
      kitCondition === "Rusak Berat" ||
      kitCondition === "Hilang"
        ? "Perbaikan"
        : editingKit?.status === "Dipinjam"
        ? "Dipinjam"
        : "Tersedia";

    if (editingKit) {
      updateOfficeKitItem(editingKit.id, {
        kit_code: kitCode.trim().toUpperCase(),
        name: kitName.trim(),
        category: kitCategory,
        brand_spec: kitSpec.trim() || "-",
        storage_tray: kitTray.trim() || "Loker Kantor Staf",
        linked_room_id: kitLinkedRoomId || null,
        procurement_year: parsedYear,
        acquisition_cost: parsedCost,
        condition: kitCondition,
        status: nextStatus,
        notes: kitNotes.trim(),
      });
      setKitModalOpen(false);
    } else {
      const res = addOfficeKitItem({
        kit_code: kitCode.trim().toUpperCase(),
        name: kitName.trim(),
        category: kitCategory,
        brand_spec: kitSpec.trim() || "-",
        storage_tray: kitTray.trim() || "Loker Kantor Staf",
        linked_room_id: kitLinkedRoomId || null,
        procurement_year: parsedYear,
        acquisition_cost: parsedCost,
        condition: kitCondition,
        status: nextStatus,
        is_active: true,
        notes: kitNotes.trim(),
      });
      if (!res.ok) {
        setKitError(res.error || "Gagal menyimpan barang kantor staf.");
        return;
      }
      setKitModalOpen(false);
    }
  };

  const loanColumns: DataTableColumn<OfficeKitLoan>[] = [
    {
      key: "code_items",
      header: "Tiket & Barang Dipinjam",
      render: (row) => (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.loan_code}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              {row.kit_item_ids.length} item
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 max-w-md leading-relaxed">
            {row.kit_items_label}
          </p>
          {row.return_condition_notes ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              Catatan Kembali: {row.return_condition_notes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "class_dpm",
      header: "Kelas & Penanggung Jawab (DPM)",
      render: (row) => (
        <div className="text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.class_code}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Prodi {row.prodi}
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            Pengambil: {row.borrower_name}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            DPM (Ketua Kelas):{" "}
            <strong className="text-slate-800 dark:text-slate-200">
              {row.dpm_name}
            </strong>{" "}
            • <span className="font-mono">{row.borrower_phone}</span>
          </p>
        </div>
      ),
    },
    {
      key: "room_schedule",
      header: "Ruang & Jam Kuliah",
      render: (row) => {
        const room = rooms.find((r) => r.id === row.room_id);
        return (
          <div className="text-xs space-y-1">
            <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {room ? `${room.code} (${room.name})` : "Ruang Kelas Reguler"}
            </p>
            {row.course_name ? (
              <p className="text-slate-700 dark:text-slate-300">
                {row.course_name}
              </p>
            ) : null}
            <p className="font-mono text-slate-600 dark:text-slate-400">
              {row.loan_date} • {row.borrow_time} - {row.expected_return_time}{" "}
              WIB
            </p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.status === "Dipinjam" ? (
          <Badge tone="warning">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sedang Dipinjam</span>
          </Badge>
        ) : (
          <Badge tone="success">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dikembalikan</span>
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Kendali Loket",
      render: (row) => (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {row.status === "Dipinjam" ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openReturnModal(row)}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Terima Kembali</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reopenOfficeKitLoan(row.id)}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ubah ke Dipinjam</span>
            </Button>
          )}
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteError("");
              setDeletingLoan(row);
            }}
            aria-label={`Hapus tiket ${row.loan_code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const itemColumns: DataTableColumn<OfficeKitItem>[] = [
    {
      key: "kit",
      header: "Kode & Nama Peralatan",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.kit_code}
            </span>
            <Badge tone="info">{row.category}</Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.brand_spec}
          </p>
        </div>
      ),
    },
    {
      key: "tray_room",
      header: "Lokasi Loker & Keterkaitan Ruang",
      render: (row) => {
        const linkedRoom = rooms.find((r) => r.id === row.linked_room_id);
        return (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {row.storage_tray}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Khusus Ruang:{" "}
              <span className="font-mono font-semibold">
                {linkedRoom
                  ? `${linkedRoom.code} (${linkedRoom.name})`
                  : "Universal (Semua Kelas)"}
              </span>
            </p>
          </div>
        );
      },
    },
    {
      key: "acquisition",
      header: "Pengadaan & Nilai",
      render: (row) => (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.procurement_year ? `Tahun ${row.procurement_year}` : "Tahun -"}
          </p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {typeof row.acquisition_cost === "number" && row.acquisition_cost > 0
              ? formatCurrencyIDR(row.acquisition_cost)
              : "-"}
          </p>
        </div>
      ),
    },
    {
      key: "condition_status",
      header: "Kondisi & Ketersediaan",
      render: (row) => {
        const activeLoan =
          row.status === "Dipinjam"
            ? officeKitLoans.find(
                (l) => l.status === "Dipinjam" && l.kit_item_ids.includes(row.id)
              )
            : null;
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <KitStatusBadge status={row.status} />
              <AssetConditionBadge condition={row.condition} />
            </div>
            {activeLoan ? (
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                Dibawa kelas{" "}
                <span className="font-mono">{activeLoan.class_code}</span> (
                {activeLoan.borrower_name})
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Label QR & Aksi",
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBarcodePrintItems([toKitPrintableItem(row)])}
            aria-label={`Cetak QR ${row.kit_code}`}
          >
            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Label QR</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditKitModal(row)}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteError("");
              setDeletingKit(row);
            }}
            aria-label={`Hapus barang ${row.kit_code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const handleExportHistoryCsv = () => {
    const filenameDate = todayWibIso;
    if (historySubTab === "log") {
      const headers = [
        "Kode Tiket",
        "Tanggal Pinjam",
        "Jam Ambil",
        "Estimasi Kembali",
        "Waktu Kembali Aktual",
        "Kode Kelas",
        "Prodi",
        "DPM / Ketua Kelas",
        "Pengambil",
        "No WhatsApp",
        "Ruangan",
        "Mata Kuliah",
        "Jumlah Unit",
        "Barang Dipinjam",
        "Status",
        "Petugas Penyerah",
        "Petugas Penerima",
        "Catatan Kondisi Kembali",
        "Jumlah Foto Bukti",
        "Tautan Foto Bukti",
      ];
      const rows = historyFilteredLoans.map((loan) => {
        const room = rooms.find((r) => r.id === loan.room_id);
        const photos = loanPhotosById.get(loan.id) || [];
        return [
          loan.loan_code,
          loan.loan_date,
          loan.borrow_time,
          loan.expected_return_time,
          loan.returned_at ? formatWibDateTime(loan.returned_at) : "-",
          loan.class_code,
          loan.prodi,
          loan.dpm_name,
          loan.borrower_name,
          loan.borrower_phone,
          room ? `${room.code} (${room.name})` : "Ruang Kelas Reguler",
          loan.course_name || "-",
          loan.kit_item_ids.length,
          loan.kit_items_label,
          loan.status,
          loan.handed_by_staff || "Staf Loket",
          loan.received_by_staff || "-",
          loan.return_condition_notes || "-",
          photos.length,
          photos.length > 0 ? photos.map((p) => p.file_url).join(" | ") : "-",
        ]
          .map(escapeCsvCell)
          .join(",");
      });
      const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riwayat-sirkulasi-invent-${filenameDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const headers = [
      "Peringkat",
      "Kode Kelas",
      "Prodi",
      "DPM / Ketua Kelas",
      "Frekuensi Peminjaman",
      "Transaksi Berfoto",
      "Total Unit Dipinjam",
      "Sedang Dipinjam",
      "Sapras Terbanyak Kelas Ini",
      "Peminjaman Terakhir",
    ];
    const rows = recapSummary.classRankings.map((cls, idx) =>
      [
        idx + 1,
        cls.classCode,
        cls.prodi,
        cls.dpmName,
        cls.loanCount,
        cls.photoLoanCount,
        cls.totalItemsBorrowed,
        cls.activeCount,
        cls.topCategories,
        cls.lastLoanDate,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-kelas-sapras-${filenameDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const historyLogColumns: DataTableColumn<OfficeKitLoan>[] = [
    {
      key: "ticket_time",
      header: "Tiket & Jadwal Pinjam",
      render: (row) => (
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.loan_code}
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {row.kit_item_ids.length} unit
            </span>
          </div>
          <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {row.loan_date}
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            {row.borrow_time} - {row.expected_return_time} WIB
          </p>
        </div>
      ),
    },
    {
      key: "class_borrower",
      header: "Kelas, DPM & Pengambil",
      render: (row) => (
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.class_code}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Prodi {row.prodi}
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.borrower_name}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            DPM: {row.dpm_name} • <span className="font-mono">{row.borrower_phone}</span>
          </p>
        </div>
      ),
    },
    {
      key: "items_room",
      header: "Barang & Ruang Kuliah",
      render: (row) => {
        const room = rooms.find((r) => r.id === row.room_id);
        return (
          <div className="space-y-1 text-xs max-w-md">
            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
              {row.kit_items_label}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {room ? `${room.code} (${room.name})` : "Ruang Kelas Reguler"}
              </span>
              {row.course_name ? ` • ${row.course_name}` : ""}
            </p>
          </div>
        );
      },
    },
    {
      key: "staff_audit",
      header: "Audit Loket & Pengembalian",
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p className="text-slate-700 dark:text-slate-300">
            Serah: <strong>{row.handed_by_staff || "Staf Loket"}</strong>
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            Terima: <strong>{row.received_by_staff || "-"}</strong>
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            Kembali:{" "}
            {row.returned_at
              ? formatWibDateTime(row.returned_at)
              : "Belum dikembalikan"}
          </p>
          {row.return_condition_notes ? (
            <p className="text-emerald-800 dark:text-emerald-300 font-medium">
              Catatan: {row.return_condition_notes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "photo_proof",
      header: "Foto Bukti",
      render: (row) => {
        const photos = loanPhotosById.get(row.id) || [];
        if (photos.length === 0) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <ImageIcon className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
              <span>Tanpa Foto</span>
            </span>
          );
        }
        return (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setPhotoLightbox({
                  loanCode: row.loan_code,
                  classCode: row.class_code,
                  photos,
                  index: 0,
                })
              }
              aria-label={`Lihat foto bukti ${row.loan_code}`}
              className="group relative w-11 h-11 rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[0].file_url}
                alt={`Bukti ${row.loan_code}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              {photos.length > 1 ? (
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[10px] font-mono font-bold bg-slate-950/80 text-white">
                  +{photos.length - 1}
                </span>
              ) : null}
            </button>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.status === "Dipinjam" ? (
          <Badge tone="warning">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sedang Dipinjam</span>
          </Badge>
        ) : (
          <Badge tone="success">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dikembalikan</span>
          </Badge>
        ),
    },
  ];

  const selectedLoan =
    officeKitLoans.find((l) => l.id === selectedLoanId) || null;
  const selectedKit = officeKitItems.find((i) => i.id === selectedKitId) || null;

  const loanBoardColumns: KanbanColumnDef<OfficeKitLoan>[] = [
    {
      id: "Dipinjam",
      title: "Sedang Dipinjam",
      dotColorClass: "bg-amber-500",
      items: filteredLoans.filter((l) => l.status === "Dipinjam"),
      onQuickAdd: () => openCheckoutModal(),
    },
    {
      id: "Dikembalikan",
      title: "Dikembalikan",
      dotColorClass: "bg-emerald-600 dark:bg-emerald-400",
      items: filteredLoans.filter((l) => l.status === "Dikembalikan"),
    },
  ];

  const itemBoardColumns: KanbanColumnDef<OfficeKitItem>[] = [
    {
      id: "Tersedia",
      title: "Tersedia di Kantor Staf",
      dotColorClass: "bg-emerald-600 dark:bg-emerald-400",
      items: filteredItems.filter((i) => i.status === "Tersedia"),
      onQuickAdd: openAddKitModal,
    },
    {
      id: "Dipinjam",
      title: "Sedang Dipinjam",
      dotColorClass: "bg-amber-500",
      items: filteredItems.filter((i) => i.status === "Dipinjam"),
    },
    {
      id: "Perbaikan",
      title: "Perbaikan",
      dotColorClass: "bg-red-600",
      items: filteredItems.filter((i) => i.status === "Perbaikan"),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 02 • LOKET PERALATAN KANTOR STAF
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Sirkulasi Invent (Kabel HDMI, Stop Kontak & Remote TV)
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Pencatatan cepat peminjaman dan pengembalian peralatan perkuliahan
            di kantor staf oleh perwakilan mahasiswa dan DPM kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button type="button" variant="outline" onClick={openAddKitModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Barang Kantor Staf</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => openCheckoutModal()}
          >
            <Cable className="w-4 h-4" aria-hidden="true" />
            <span>Pinjamkan Alat ke Kelas</span>
          </Button>
        </div>
      </section>

      {/* Ringkasan Loker Kantor Staf (Hierarki R-14) */}
      <section aria-label="Status Ketersediaan Alat Kantor Staf">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 rounded-lg border-2 border-amber-700 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  PANTAUAN LOKET AKTIF
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sedang Dipinjam Kelas
                </h2>
              </div>
              <Clock
                className="w-5 h-5 text-amber-800 dark:text-amber-300"
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                {activeLoansCount}
              </span>
              <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                kelas masih membawa barang (
                {officeKitItems.filter((i) => i.status === "Dipinjam").length}{" "}
                unit di luar loker)
              </span>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
              KABEL HDMI
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {hdmiStats.available}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                / {hdmiStats.total} unit tersedia
              </span>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
              STOP KONTAK
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {stopKontakStats.available}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                / {stopKontakStats.total} unit tersedia
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
              REMOTE TV
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {remoteTvStats.available}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                / {remoteTvStats.total} siap
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Navigasi Meja Sirkulasi vs Katalog Barang */}
      <div
        role="tablist"
        aria-label="Sub-bagian Sirkulasi Invent"
        className="flex flex-wrap gap-2 border-b border-slate-300 dark:border-slate-800 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "loans"}
          onClick={() => setActiveTab("loans")}
          className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-bold inline-flex items-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
            activeTab === "loans"
              ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Meja Sirkulasi Pinjam Kelas</span>
          <span
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
              activeTab === "loans"
                ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {dailyDeskLoans.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "items"}
          onClick={() => setActiveTab("items")}
          className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-bold inline-flex items-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
            activeTab === "items"
              ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Katalog Barang Kantor Staf</span>
          <span
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
              activeTab === "items"
                ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {officeKitItems.length}
          </span>
        </button>

        {isMasterAdmin ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-bold inline-flex items-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
              activeTab === "history"
                ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            <span>Riwayat & Rekap</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${
                activeTab === "history"
                  ? "bg-white/20 text-white border-white/30 dark:bg-slate-950/20 dark:text-slate-950 dark:border-slate-950/30"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700"
              }`}
            >
              Master Admin
            </span>
          </button>
        ) : null}
      </div>

      {/* Toolbar Filter & Pencarian (Meja Sirkulasi & Katalog) */}
      {activeTab !== "history" ? (
        <section
          aria-label="Filter dan Pencarian Sirkulasi Invent"
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "loans"
                ? "Cari SRK-, kelas MPI-24A, nama DPM, atau barang..."
                : "Cari KST-HDMI, Stop Kontak, Remote TV, atau loker..."
            }
            aria-label="Cari sirkulasi invent"
            className="min-h-[44px] w-full sm:w-80 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          {activeTab === "loans" ? (
            <FilterPopover
              title="Filter Sirkulasi Kelas"
              activeCount={activeLoanFilterCount}
              onResetAll={() => {
                setFilterLoanStatus("ALL");
                setFilterProdi("ALL");
              }}
              groups={[
                {
                  key: "status",
                  label: "Status Pinjam",
                  value: filterLoanStatus,
                  onChange: setFilterLoanStatus,
                  options: [
                    { value: "ALL", label: "Semua Status" },
                    { value: "Dipinjam", label: "Sedang Dipinjam" },
                    { value: "Dikembalikan", label: "Sudah Dikembalikan" },
                  ],
                },
                {
                  key: "prodi",
                  label: "Program Studi",
                  value: filterProdi,
                  onChange: setFilterProdi,
                  options: [
                    { value: "ALL", label: "Semua Prodi" },
                    ...PRODI_OPTIONS.map((p) => ({ value: p, label: p })),
                  ],
                },
              ]}
            />
          ) : (
            <FilterPopover
              title="Filter Katalog Barang Kantor Staf"
              activeCount={activeItemFilterCount}
              onResetAll={() => {
                setFilterKitCategory("ALL");
                setFilterKitStatus("ALL");
              }}
              groups={[
                {
                  key: "category",
                  label: "Kategori Alat",
                  value: filterKitCategory,
                  onChange: setFilterKitCategory,
                  options: [
                    { value: "ALL", label: "Semua Kategori" },
                    ...OFFICE_KIT_CATEGORIES.map((c) => ({
                      value: c,
                      label: c,
                    })),
                  ],
                },
                {
                  key: "status",
                  label: "Ketersediaan",
                  value: filterKitStatus,
                  onChange: setFilterKitStatus,
                  options: [
                    { value: "ALL", label: "Semua Status" },
                    { value: "Tersedia", label: "Tersedia di Kantor Staf" },
                    { value: "Dipinjam", label: "Sedang Dipinjam" },
                    { value: "Perbaikan", label: "Perbaikan" },
                  ],
                },
              ]}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "items" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={officeKitItems.length === 0}
                onClick={() => {
                  setResequenceError("");
                  setResequenceAllNames(false);
                  setResequenceModalOpen(true);
                }}
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Rapikan Kode &amp; Nama Unit</span>
              </Button>
              {selectedKitsForDelete.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedKitRowKeys([])}
                  className="min-h-[44px] px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline"
                >
                  Batal Pilih ({selectedKitsForDelete.length})
                </button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={
                  filteredItems.length === 0 && selectedKitsForDelete.length === 0
                }
                onClick={openBulkKitBarcodePrint}
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>
                  {selectedKitsForDelete.length > 0
                    ? `Cetak QR (${selectedKitsForDelete.length} dipilih)`
                    : "Cetak QR Massal"}
                </span>
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  disabled={officeKitItems.length === 0}
                  aria-expanded={bulkRepairMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setBulkRepairMenuOpen((prev) => !prev)}
                >
                  <Wrench className="w-4 h-4" aria-hidden="true" />
                  <span>Perbaikan Massal</span>
                </Button>
                {bulkRepairMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Pilih kondisi barang untuk perbaikan massal"
                    className="absolute right-0 z-30 mt-1.5 w-60 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5 space-y-1"
                  >
                    {(["Rusak Ringan", "Rusak Berat", "Hilang"] as const).map(
                      (cond) => {
                        const matchCount = officeKitItems.filter(
                          (k) => k.condition === cond
                        ).length;
                        return (
                          <button
                            key={cond}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setBulkRepairMenuOpen(false);
                              const matched = officeKitItems.filter(
                                (k) => k.condition === cond
                              );
                              if (matched.length === 0) {
                                notify(
                                  "info",
                                  "Tidak Ada Barang Ditemukan",
                                  `Tidak ada barang di katalog dengan kondisi ${cond}.`
                                );
                                return;
                              }
                              const ids = matched.map((k) => k.id);
                              setSelectedKitRowKeys(ids);
                              setBulkRepairModal({
                                open: true,
                                severity: cond,
                                kitIds: ids,
                              });
                            }}
                            className="w-full min-h-[40px] px-3 py-2 rounded-md text-left text-xs font-semibold flex items-center justify-between gap-2 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                          >
                            <span>{cond}</span>
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {matchCount}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="danger"
                disabled={selectedKitsForDelete.length === 0}
                onClick={() => {
                  setDeleteError("");
                  setBulkDeleteKitsOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {selectedKitsForDelete.length > 0
                    ? `Hapus Massal (${selectedKitsForDelete.length})`
                    : "Hapus Massal"}
                </span>
              </Button>
            </>
          ) : null}

          {viewMode === "table" ? (
            <ColumnsTogglePopover
              columns={
                activeTab === "loans"
                  ? loanColumns.map((c) => ({ key: c.key, label: c.header }))
                  : itemColumns.map((c) => ({ key: c.key, label: c.header }))
              }
              hiddenKeys={
                activeTab === "loans" ? hiddenLoanCols : hiddenItemCols
              }
              onToggleKey={(key) => {
                if (activeTab === "loans") {
                  setHiddenLoanCols((prev) =>
                    prev.includes(key)
                      ? prev.filter((k) => k !== key)
                      : [...prev, key]
                  );
                } else {
                  setHiddenItemCols((prev) =>
                    prev.includes(key)
                      ? prev.filter((k) => k !== key)
                      : [...prev, key]
                  );
                }
              }}
            />
          ) : null}

          <div
            role="group"
            aria-label="Pilih tampilan daftar sirkulasi invent"
            className="inline-flex rounded-md border border-slate-400 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setViewMode("board")}
              aria-pressed={viewMode === "board"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "board"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <KanbanSquare className="w-4 h-4" aria-hidden="true" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
              <span>Tabel</span>
            </button>
          </div>
        </div>
        </section>
      ) : null}

      {/* Konten Utama: Riwayat & Rekap (Master Admin), Board Status, atau Tabel */}
      {activeTab === "history" && isMasterAdmin ? (
        <section
          aria-label="Riwayat dan Rekap Sirkulasi Invent Master Admin"
          className="space-y-5"
        >
          {/* Header Sub-Switch Eksklusif Master Admin */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Akses Khusus Master Admin</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Riwayat Peminjaman & Rekap Intensitas Kelas dan Sapras
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Pantau seluruh riwayat transaksi loket beserta peringkat kelas dan peralatan kantor staf yang paling sering dipinjam.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="tablist"
                aria-label="Pilih mode Riwayat atau Rekap"
                className="inline-flex flex-wrap rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={historySubTab === "log"}
                  onClick={() => setHistorySubTab("log")}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded text-xs font-bold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                    historySubTab === "log"
                      ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                      : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-700"
                  }`}
                >
                  <History className="w-4 h-4" aria-hidden="true" />
                  <span>Riwayat Peminjaman</span>
                  <span
                    className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                      historySubTab === "log"
                        ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {historyFilteredLoans.length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={historySubTab === "recap"}
                  onClick={() => setHistorySubTab("recap")}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded text-xs font-bold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                    historySubTab === "recap"
                      ? "bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                      : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-700"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" aria-hidden="true" />
                  <span>Rekap Kelas & Sapras</span>
                  <span
                    className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                      historySubTab === "recap"
                        ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {recapSummary.uniqueClassesCount} kelas
                  </span>
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleExportHistoryCsv}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Ekspor CSV</span>
              </Button>
            </div>
          </div>

          {/* Filter Periode, Prodi, Status & Pencarian Riwayat */}
          <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-3">
                <Input
                  label="Cari Riwayat Sirkulasi"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tiket, kelas, DPM, pengambil, ruangan, atau barang..."
                />
              </div>

              <div className="lg:col-span-3">
                <Select
                  label="Periode Data"
                  value={historyPeriod}
                  onChange={(e) =>
                    setHistoryPeriod(e.target.value as HistoryPeriodPreset)
                  }
                  options={[
                    { value: "ALL", label: "Semua Waktu" },
                    { value: "TODAY", label: `Hari Ini (${todayWibIso})` },
                    { value: "7D", label: "7 Hari Terakhir" },
                    { value: "30D", label: "30 Hari Terakhir" },
                    { value: "MONTH", label: "Bulan Berjalan" },
                    { value: "CUSTOM", label: "Rentang Tanggal Kustom" },
                  ]}
                />
              </div>

              <div className="lg:col-span-2">
                <Select
                  label="Program Studi"
                  value={historyProdi}
                  onChange={(e) => setHistoryProdi(e.target.value)}
                  options={[
                    { value: "ALL", label: "Semua Prodi" },
                    ...PRODI_OPTIONS.map((p) => ({
                      value: p,
                      label: `Prodi ${p}`,
                    })),
                  ]}
                />
              </div>

              <div className="lg:col-span-2">
                <Select
                  label="Status Pengembalian"
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  options={[
                    { value: "ALL", label: "Semua Status" },
                    { value: "Dipinjam", label: "Sedang Dipinjam" },
                    { value: "Dikembalikan", label: "Sudah Dikembalikan" },
                  ]}
                />
              </div>

              <div className="lg:col-span-2">
                <Select
                  label="Foto Bukti"
                  value={historyPhotoFilter}
                  onChange={(e) =>
                    setHistoryPhotoFilter(
                      e.target.value as "ALL" | "WITH_PHOTO" | "NO_PHOTO"
                    )
                  }
                  options={[
                    { value: "ALL", label: "Semua" },
                    { value: "WITH_PHOTO", label: "Ada Foto Bukti" },
                    { value: "NO_PHOTO", label: "Tanpa Foto" },
                  ]}
                />
              </div>
            </div>

            {historyPeriod === "CUSTOM" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  label="Dari Tanggal"
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                />
                <Input
                  label="Sampai Tanggal"
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                />
              </div>
            ) : null}

            {(historyClassFilter ||
              historyPeriod !== "ALL" ||
              historyProdi !== "ALL" ||
              historyStatus !== "ALL" ||
              historyPhotoFilter !== "ALL" ||
              historySearch.trim()) ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Menampilkan <strong>{historyFilteredLoans.length}</strong> transaksi
                    {historyClassFilter ? " untuk kelas terfilter:" : ":"}
                  </span>
                  {historyClassFilter ? (
                    <button
                      type="button"
                      onClick={() => setHistoryClassFilter("")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-90"
                    >
                      <span>Kelas: {historyClassFilter}</span>
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHistoryPeriod("ALL");
                    setHistoryStartDate("");
                    setHistoryEndDate("");
                    setHistoryProdi("ALL");
                    setHistoryStatus("ALL");
                    setHistoryPhotoFilter("ALL");
                    setHistoryClassFilter("");
                    setHistorySearch("");
                  }}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </Button>
              </div>
            ) : null}
          </div>

          {historySubTab === "log" ? (
            <DataTable
              columns={historyLogColumns}
              data={historyFilteredLoans}
              rowKey={(l) => l.id}
              activeRowKey={selectedLoanId}
              onRowClick={(row) => setSelectedLoanId(row.id)}
              emptyTitle="Tidak Ada Riwayat Peminjaman yang Cocok"
              emptyDescription="Ubah filter periode, prodi, status, atau kata kunci pencarian untuk melihat transaksi sirkulasi lainnya."
            />
          ) : (
            <div className="space-y-5">
              {/* 4 KPI Cards Data Riil */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Total Peminjaman
                    </p>
                    <TrendingUp
                      className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                    {recapSummary.totalLoans}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {recapSummary.totalUnitsBorrowed} unit keluar •{" "}
                    {recapSummary.loansWithPhotoCount} berfoto bukti
                  </p>
                </div>

                <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Kelas Paling Sering Pinjam
                    </p>
                    <Users
                      className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold font-mono text-[#1E3A5F] dark:text-sky-400">
                    {recapSummary.classRankings[0]?.classCode || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {recapSummary.classRankings[0]
                      ? `${recapSummary.classRankings[0].loanCount}x transaksi (${recapSummary.classRankings[0].totalItemsBorrowed} unit • Prodi ${recapSummary.classRankings[0].prodi})`
                      : "Belum ada transaksi kelas pada filter ini"}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Sapras Paling Sering Dipinjam
                    </p>
                    <Layers
                      className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white truncate">
                    {recapSummary.categoryRankings[0]?.borrowCount
                      ? recapSummary.categoryRankings[0].category
                      : "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {recapSummary.categoryRankings[0]?.borrowCount
                      ? `${recapSummary.categoryRankings[0].borrowCount}x dipinjam (${recapSummary.categoryRankings[0].sharePct}% pangsa pemakaian)`
                      : "Belum ada pemakaian sapras tercatat"}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono font-semibold uppercase text-slate-600 dark:text-slate-400">
                      Rasio Pengembalian
                    </p>
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold font-mono text-emerald-800 dark:text-emerald-300">
                    {recapSummary.completionRatePct}%
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {recapSummary.returnedLoans} kembali, {recapSummary.activeLoans} aktif,{" "}
                    {recapSummary.uniqueClassesCount} kelas
                  </p>
                </div>
              </div>

              {/* 2 Panel Peringkat Utama: Kelas vs Sapras */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Panel Kiri: Peringkat Kelas Paling Sering Meminjam */}
                <div className="lg:col-span-7 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Peringkat Kelas Paling Sering Meminjam
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Klik tombol Lihat Log pada baris kelas untuk menelusuri riwayat transaksinya.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                      {recapSummary.classRankings.length} kelas
                    </span>
                  </div>

                  {recapSummary.classRankings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-400">
                      Belum ada transaksi peminjaman kelas pada rentang filter saat ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400">
                            <th className="px-3 py-2.5 w-12">#</th>
                            <th className="px-3 py-2.5">Kelas & DPM</th>
                            <th className="px-3 py-2.5">Frekuensi Pinjam</th>
                            <th className="px-3 py-2.5">Sapras Terbanyak</th>
                            <th className="px-3 py-2.5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                          {recapSummary.classRankings.map((cls, idx) => {
                            const maxLoans =
                              recapSummary.classRankings[0]?.loanCount || 1;
                            const pct = Math.max(
                              8,
                              Math.round((cls.loanCount / maxLoans) * 100)
                            );
                            return (
                              <tr
                                key={cls.classCode}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <td className="px-3 py-3 font-mono font-bold text-slate-700 dark:text-slate-300 align-top">
                                  #{idx + 1}
                                </td>
                                <td className="px-3 py-3 align-top space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                                      {cls.classCode}
                                    </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {cls.prodi}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-400">
                                    DPM: <strong className="text-slate-800 dark:text-slate-200">{cls.dpmName}</strong>
                                  </p>
                                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    Terakhir: {cls.lastLoanDate} •{" "}
                                    {cls.photoLoanCount} berfoto
                                  </p>
                                </td>
                                <td className="px-3 py-3 align-top min-w-[140px] space-y-1.5">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                      {cls.loanCount}x pinjam
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                      {cls.totalItemsBorrowed} unit
                                    </span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#1E3A5F] dark:bg-sky-400"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  {cls.activeCount > 0 ? (
                                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                      {cls.activeCount} tiket masih aktif dipinjam
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-300">
                                  {cls.topCategories}
                                </td>
                                <td className="px-3 py-3 align-top text-right">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setHistoryClassFilter(cls.classCode);
                                      setHistorySubTab("log");
                                    }}
                                  >
                                    <span>Lihat Log</span>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Panel Kanan: Peringkat Sapras Paling Sering Dipinjam */}
                <div className="lg:col-span-5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Sapras Paling Sering Dipinjam
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Pantau intensitas pemakaian per kategori maupun per unit alat.
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="Mode rincian rekap sapras"
                      className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => setRecapSaprasMode("category")}
                        aria-pressed={recapSaprasMode === "category"}
                        className={`min-h-[34px] px-2.5 rounded text-[11px] font-bold transition-colors ${
                          recapSaprasMode === "category"
                            ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Per Kategori
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecapSaprasMode("item")}
                        aria-pressed={recapSaprasMode === "item"}
                        className={`min-h-[34px] px-2.5 rounded text-[11px] font-bold transition-colors ${
                          recapSaprasMode === "item"
                            ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Per Unit Barang
                      </button>
                    </div>
                  </div>

                  {recapSaprasMode === "category" ? (
                    recapSummary.categoryRankings.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-400">
                        Belum ada kategori sapras yang tercatat.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {recapSummary.categoryRankings.map((cat, idx) => {
                          const maxCat =
                            recapSummary.categoryRankings[0]?.borrowCount || 1;
                          const pct =
                            cat.borrowCount > 0
                              ? Math.max(
                                  8,
                                  Math.round((cat.borrowCount / maxCat) * 100)
                                )
                              : 0;
                          return (
                            <li key={cat.category} className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                                      #{idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                      {cat.category}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                    Katalog aktif: {cat.availableUnits}/{cat.totalUnits} siap di loket
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                                    {cat.borrowCount}x unit keluar
                                  </span>
                                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    {cat.sharePct}% pangsa
                                  </p>
                                </div>
                              </div>

                              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#1E3A5F] dark:bg-sky-400"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {cat.topClassCount > 0 ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                  <span>
                                    Kelas tersering:{" "}
                                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                                      {cat.topClassCode} ({cat.topClassCount}x)
                                    </strong>
                                  </span>
                                  <span className="font-mono">
                                    {cat.ticketCount} tiket
                                  </span>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : recapSummary.itemRankings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-400">
                      Belum ada unit barang yang dipinjam pada rentang filter saat ini.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                      {recapSummary.itemRankings.map((item, idx) => (
                        <li
                          key={item.kitId}
                          className="p-4 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                                #{idx + 1}
                              </span>
                              <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                                {item.kitCode}
                              </span>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <span>
                                Tersering:{" "}
                                <strong className="font-mono text-slate-800 dark:text-slate-200">
                                  {item.topClassLabel}
                                </strong>
                              </span>
                              <span>• Terakhir: {item.lastLoanDate}</span>
                            </div>
                          </div>

                          <div className="text-right space-y-1 shrink-0">
                            <p className="text-xs font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                              {item.borrowCount}x dipinjam
                            </p>
                            {item.isDeleted ? (
                              <Badge tone="neutral">Unit Terhapus</Badge>
                            ) : (
                              <div className="flex justify-end">
                                <KitStatusBadge
                                  status={item.status as OfficeKitStatus}
                                />
                              </div>
                            )}
                            {item.condition ? (
                              <div className="flex justify-end">
                                <AssetConditionBadge condition={item.condition} />
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Panel Bawah: Peringkat Ruang Perkuliahan Paling Sering Memakai Alat */}
              <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2
                      className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Peringkat Ruang Perkuliahan Pemakai Alat Kantor Staf
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Membantu identifikasi ruang kelas yang paling sering membutuhkan peralatan tambahan dari kantor staf.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                    {recapSummary.roomRankings.length} ruangan
                  </span>
                </div>

                {recapSummary.roomRankings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-400">
                    Belum ada riwayat penggunaan ruangan pada filter saat ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400">
                          <th className="px-4 py-2.5 w-12">#</th>
                          <th className="px-4 py-2.5">Ruang Perkuliahan</th>
                          <th className="px-4 py-2.5">Frekuensi</th>
                          <th className="px-4 py-2.5">Total Unit</th>
                          <th className="px-4 py-2.5">Kebutuhan Alat Utama</th>
                          <th className="px-4 py-2.5 text-right">Terakhir Dipakai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {recapSummary.roomRankings.map((rm, idx) => (
                          <tr
                            key={rm.roomKey}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-600 dark:text-slate-400">
                              #{idx + 1}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                              {rm.roomLabel}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                              {rm.loanCount}x transaksi
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                              {rm.totalUnitsBorrowed} unit
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                              {rm.topCategoryLabel}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">
                              {rm.lastLoanDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : activeTab === "loans" ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-700 dark:text-slate-300 px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            Menampilkan seluruh pinjaman aktif serta pengembalian hari ini (WIB:{" "}
            <span className="font-mono font-bold">{todayWibIso}</span>). Data
            yang sudah dikembalikan otomatis bersih dari meja harian keesokan
            harinya dan tetap tersimpan lengkap di{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              Riwayat &amp; Rekap
            </strong>
            .
          </p>
          {viewMode === "board" ? (
            <KanbanBoard
              columns={loanBoardColumns}
              rowKey={(l) => l.id}
              activeItemId={selectedLoanId}
              onCardClick={(item) => setSelectedLoanId(item.id)}
              columnEmptyMessage="Tidak ada tiket pada status ini"
              onCardDrop={(loan, sourceColId, targetColId) => {
                if (sourceColId === "Dipinjam" && targetColId === "Dikembalikan") {
                  checkinOfficeKitLoan(loan.id);
                } else if (
                  sourceColId === "Dikembalikan" &&
                  targetColId === "Dipinjam"
                ) {
                  reopenOfficeKitLoan(loan.id);
                }
              }}
              renderCustomCard={(row, meta) => (
                <LoanBoardCompactCard
                  loan={row}
                  todayWibIso={todayWibIso}
                  isDraggable={meta.isDraggable}
                  onOpenDetail={meta.onClick}
                  onQuickCheckin={() => checkinOfficeKitLoan(row.id)}
                  onOpenCheckinModal={() => openReturnModal(row)}
                  onReopen={() => reopenOfficeKitLoan(row.id)}
                  onDelete={() => {
                    setDeleteError("");
                    setDeletingLoan(row);
                  }}
                />
              )}
            />
          ) : (
            <DataTable
              columns={loanColumns}
              data={filteredLoans}
              rowKey={(l) => l.id}
              hiddenColumnKeys={hiddenLoanCols}
              activeRowKey={selectedLoanId}
              onRowClick={(row) => setSelectedLoanId(row.id)}
              emptyTitle="Belum Ada Transaksi Aktif atau Pengembalian Hari Ini"
              emptyDescription="Catat peminjaman Kabel HDMI, Stop Kontak, atau Remote TV saat perwakilan kelas mengambil di kantor staf. Arsip hari sebelumnya tersimpan di Riwayat & Rekap."
              emptyActionLabel="Pinjamkan Alat ke Kelas"
              onEmptyAction={() => openCheckoutModal()}
            />
          )}
        </div>
      ) : viewMode === "board" ? (
        <KanbanBoard
          columns={itemBoardColumns}
          rowKey={(i) => i.id}
          activeItemId={selectedKitId}
          onCardClick={(item) => setSelectedKitId(item.id)}
          columnEmptyMessage="Tidak ada barang kantor staf di status ini"
          onCardDrop={(item, sourceColId, targetColId) => {
            if (targetColId === "Tersedia") {
              if (sourceColId === "Perbaikan") {
                updateOfficeKitItem(item.id, {
                  status: "Tersedia",
                  condition: "Baik",
                });
              } else if (sourceColId === "Dipinjam") {
                const activeLoan = getActiveLoanForKit(item.id);
                if (activeLoan) {
                  openReturnModal(activeLoan);
                } else {
                  updateOfficeKitItem(item.id, { status: "Tersedia" });
                }
              }
            } else if (targetColId === "Dipinjam") {
              if (sourceColId === "Tersedia") {
                openCheckoutModal(item.id);
              }
            } else if (targetColId === "Perbaikan") {
              if (sourceColId === "Tersedia") {
                updateOfficeKitItem(item.id, {
                  status: "Perbaikan",
                  condition:
                    item.condition === "Baik" ? "Rusak Ringan" : item.condition,
                });
              } else if (sourceColId === "Dipinjam") {
                const activeLoan = getActiveLoanForKit(item.id);
                if (activeLoan) {
                  openReturnModal(activeLoan, [item.id]);
                } else {
                  updateOfficeKitItem(item.id, {
                    status: "Perbaikan",
                    condition:
                      item.condition === "Baik" ? "Rusak Ringan" : item.condition,
                  });
                }
              }
            }
          }}
          renderCard={(row) => {
            const linkedRoom = rooms.find((r) => r.id === row.linked_room_id);
            const activeLoan = getActiveLoanForKit(row.id);
            const noteCount = notes.filter(
              (n) => n.entity_type === "office_kit" && n.entity_id === row.id
            ).length;
            const attCount = attachments.filter(
              (a) => a.entity_type === "office_kit" && a.entity_id === row.id
            ).length;

            return {
              code: row.kit_code,
              title: row.name,
              subtitle: `${row.category}${
                linkedRoom ? ` • Ruang ${linkedRoom.code}` : " • Universal"
              }`,
              description: `${row.brand_spec} • ${row.storage_tray}`,
              priorityBadge: <AssetConditionBadge condition={row.condition} />,
              assigneeName: activeLoan
                ? `${activeLoan.class_code} (${activeLoan.borrower_name})`
                : undefined,
              notesCount: noteCount,
              attachmentsCount: attCount,
              footerAction: (
                <div className="flex flex-wrap items-center gap-1.5">
                  {row.status === "Tersedia" ? (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => openCheckoutModal(row.id)}
                      >
                        <Cable className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Pinjamkan</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateOfficeKitItem(row.id, {
                            status: "Perbaikan",
                            condition:
                              row.condition === "Baik"
                                ? "Rusak Ringan"
                                : row.condition,
                          })
                        }
                      >
                        <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Perbaikan</span>
                      </Button>
                    </>
                  ) : row.status === "Dipinjam" ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (activeLoan) {
                          openReturnModal(activeLoan);
                        } else {
                          updateOfficeKitItem(row.id, { status: "Tersedia" });
                        }
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Terima Kembali</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          updateOfficeKitItem(row.id, {
                            status: "Tersedia",
                            condition: "Baik",
                          })
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Siap Pakai</span>
                      </Button>
                      <Link
                        href={`/sarpras/pemeliharaan?reportKit=${encodeURIComponent(
                          row.id
                        )}`}
                        className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-md border border-amber-700/50 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
                      >
                        <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Lapor</span>
                      </Link>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBarcodePrintItems([toKitPrintableItem(row)])
                    }
                    aria-label={`Cetak barcode ${row.kit_code}`}
                  >
                    <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError("");
                      setDeletingKit(row);
                    }}
                    aria-label={`Hapus barang ${row.kit_code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ),
            };
          }}
        />
      ) : (
        <DataTable
          columns={itemColumns}
          data={filteredItems}
          rowKey={(i) => i.id}
          hiddenColumnKeys={hiddenItemCols}
          activeRowKey={selectedKitId}
          onRowClick={(row) => setSelectedKitId(row.id)}
          selectable
          selectedRowKeys={selectedKitRowKeys}
          onToggleRowKey={(key) =>
            setSelectedKitRowKeys((prev) =>
              prev.includes(key)
                ? prev.filter((item) => item !== key)
                : [...prev, key]
            )
          }
          onToggleAllVisible={(visibleKeys, nextChecked) => {
            setSelectedKitRowKeys((prev) => {
              const nextSet = new Set(prev);
              for (const k of visibleKeys) {
                if (nextChecked) {
                  nextSet.add(k);
                } else {
                  nextSet.delete(k);
                }
              }
              return Array.from(nextSet);
            });
          }}
          emptyTitle="Belum Ada Barang Kantor Staf"
          emptyDescription="Tambahkan unit Kabel HDMI, Stop Kontak, atau Remote TV yang dikumpulkan di kantor staf."
          emptyActionLabel="Tambah Barang Kantor Staf"
          onEmptyAction={openAddKitModal}
        />
      )}

      {/* Drawer Detail Sirkulasi Pinjaman */}
      <Drawer
        isOpen={Boolean(selectedLoan)}
        onClose={() => setSelectedLoanId(null)}
        title={
          selectedLoan
            ? `Sirkulasi Kelas ${selectedLoan.class_code}`
            : ""
        }
        subtitle={
          selectedLoan
            ? `${selectedLoan.loan_code} • DPM: ${selectedLoan.dpm_name}`
            : undefined
        }
        headerBadge={
          selectedLoan ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedLoan.loan_code}
              </span>
              {selectedLoan.status === "Dipinjam" ? (
                <Badge tone="warning">Sedang Dipinjam</Badge>
              ) : (
                <Badge tone="success">Dikembalikan</Badge>
              )}
            </>
          ) : null
        }
        footer={
          selectedLoan ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingLoan(selectedLoan);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              {selectedLoan.status === "Dipinjam" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openReturnModal(selectedLoan)}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>Terima Kembali (Cek Rusak)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      checkinOfficeKitLoan(selectedLoan.id);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Tandai Dikembalikan</span>
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reopenOfficeKitLoan(selectedLoan.id)}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Ubah ke Dipinjam</span>
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {selectedLoan ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Kelas & Prodi
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {selectedLoan.class_code} ({selectedLoan.prodi})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  DPM (Ketua Kelas)
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.dpm_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Pengambil Barang
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.borrower_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Kontak WA
                </dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedLoan.borrower_phone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-400">
                  <span>Barang Dipinjam</span>
                  {selectedLoan.status === "Dipinjam" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReplacingLoan(selectedLoan)}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ganti Barang Dipinjam</span>
                    </Button>
                  ) : null}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.kit_items_label}
                </dd>
              </div>
              {selectedLoan.returned_at ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Waktu Kembali Aktual
                  </dt>
                  <dd className="mt-0.5 font-mono font-semibold text-emerald-800 dark:text-emerald-300">
                    {formatWibDateTime(selectedLoan.returned_at)}
                    {selectedLoan.received_by_staff
                      ? ` • Diterima oleh ${selectedLoan.received_by_staff}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              {selectedLoan.return_condition_notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan Pengembalian
                  </dt>
                  <dd className="mt-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                    {selectedLoan.return_condition_notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            {(() => {
              const loanPhotos = attachments.filter(
                (a) =>
                  a.entity_type === "office_loan" &&
                  a.entity_id === selectedLoan.id &&
                  a.mime_type.startsWith("image/") &&
                  (a.file_url.startsWith("https://") ||
                    a.file_url.startsWith("http://") ||
                    a.file_url.startsWith("blob:"))
              );
              if (loanPhotos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Foto Bukti Peminjaman ({loanPhotos.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {loanPhotos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.file_url}
                          alt={`Foto serah terima ${selectedLoan.loan_code}`}
                          className="w-full h-40 object-cover group-hover:opacity-90 transition-opacity"
                        />
                        <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                          {photo.file_name}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            <EntityDrawerSections
              entityType="office_loan"
              entityId={selectedLoan.id}
              baseEventDates={[selectedLoan.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Drawer Detail Barang Kantor Staf */}
      <Drawer
        isOpen={Boolean(selectedKit)}
        onClose={() => setSelectedKitId(null)}
        title={selectedKit?.name || ""}
        subtitle={
          selectedKit
            ? `${selectedKit.kit_code} • ${selectedKit.category}`
            : undefined
        }
        headerBadge={
          selectedKit ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedKit.kit_code}
              </span>
              <KitStatusBadge status={selectedKit.status} />
            </>
          ) : null
        }
        footer={
          selectedKit ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeleteError("");
                    setDeletingKit(selectedKit);
                  }}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus</span>
                </Button>
                <Link
                  href={`/sarpras/pemeliharaan?reportKit=${encodeURIComponent(
                    selectedKit.id
                  )}`}
                  className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-md border border-amber-700/50 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  <Wrench className="w-4 h-4" aria-hidden="true" />
                  <span>Laporkan Kerusakan</span>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBarcodePrintItems([toKitPrintableItem(selectedKit)])
                  }
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  <span>Cetak Barcode</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => openEditKitModal(selectedKit)}
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>Edit Barang</span>
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedKit ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Merek / Spesifikasi
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedKit.brand_spec}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Lokasi Loker Kantor Staf
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedKit.storage_tray}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Kondisi</dt>
                <dd className="mt-1">
                  <AssetConditionBadge condition={selectedKit.condition} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Tahun Pengadaan
                </dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {selectedKit.procurement_year || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Harga Perolehan
                </dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {typeof selectedKit.acquisition_cost === "number" &&
                  selectedKit.acquisition_cost > 0
                    ? formatCurrencyIDR(selectedKit.acquisition_cost)
                    : "-"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-600 dark:text-slate-400">Catatan</dt>
                <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                  {selectedKit.notes || "-"}
                </dd>
              </div>
            </dl>

            <EntityDrawerSections
              entityType="office_kit"
              entityId={selectedKit.id}
              baseEventDates={[selectedKit.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Check-Out Pinjam Cepat Alat Kantor Staf */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="Pinjamkan Alat Kantor Staf ke Kelas"
        description="Pilih kelas dari Data Master Kelas (DPM otomatis tercatat) lalu centang satu atau lebih peralatan yang dipinjam."
        maxWidthClass="max-w-2xl"
      >
        {checkoutModalOpen ? (
          <QuickLoanForm
            mode="modal"
            preselectedKitId={checkoutPreselectedKitId}
            onSuccess={() => setCheckoutModalOpen(false)}
            onCancel={() => setCheckoutModalOpen(false)}
          />
        ) : null}
      </Modal>

      {/* Modal Terima Pengembalian Alat */}
      <Modal
        isOpen={Boolean(returningLoan)}
        onClose={() => setReturningLoan(null)}
        title={`Terima Pengembalian: ${returningLoan?.class_code || ""}`}
        description={`Tiket ${returningLoan?.loan_code || ""} • Pastikan seluruh barang kembali ke loker kantor staf.`}
      >
        {returningLoan ? (
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Cek Kelengkapan & Kondisi Barang yang Dikembalikan:
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Centang barang di bawah ini HANYA apabila barang kembali dalam
                kondisi bermasalah/rusak agar otomatis dikunci untuk perbaikan.
              </p>
              <div className="space-y-1.5">
                {returningLoan.kit_item_ids.map((itemId) => {
                  const item = officeKitItems.find((i) => i.id === itemId);
                  if (!item) return null;
                  const isDamaged = damagedReturnIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-md border text-xs cursor-pointer ${
                        isDamaged
                          ? "border-red-600 bg-red-50 dark:bg-red-950/40"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <span>
                        <strong className="font-mono">{item.kit_code}</strong>{" "}
                        - {item.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-red-800 dark:text-red-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={isDamaged}
                          onChange={() =>
                            setDamagedReturnIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((x) => x !== item.id)
                                : [...prev, item.id]
                            )
                          }
                          className="w-4 h-4 accent-red-700"
                        />
                        <span>Tandai Rusak</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Input
              label="Catatan Kondisi Saat Diterima"
              placeholder="Contoh: Kabel HDMI, stop kontak, dan remote TV lengkap serta berfungsi baik."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturningLoan(null)}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary">
                Konfirmasi Barang Kembali
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Modal Tambah / Edit Barang Kantor Staf */}
      <Modal
        isOpen={kitModalOpen}
        onClose={() => setKitModalOpen(false)}
        title={
          editingKit
            ? `Edit Barang ${editingKit.kit_code}`
            : "Tambah Barang Kantor Staf Baru"
        }
        description="Daftarkan kabel HDMI, stop kontak, remote TV, atau alat bantu kelas yang disimpan di kantor staf."
      >
        <form onSubmit={handleKitSubmit} className="space-y-4">
          {kitError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {kitError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="kit-code-input"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Kode Unit Barang *
                </label>
                {!editingKit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setKitCodeDirty(false);
                      setKitCode(
                        getNextKitCodeForCategory(kitCategory, officeKitItems)
                      );
                    }}
                    className="text-[11px] font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                  >
                    Auto Angka
                  </button>
                ) : null}
              </div>
              <Input
                id="kit-code-input"
                placeholder="Otomatis: 1001, 2001, ..."
                value={kitCode}
                onChange={(e) => {
                  setKitCodeDirty(true);
                  setKitCode(e.target.value);
                }}
                required
              />
            </div>
            <Select
              label="Kategori Peralatan *"
              value={kitCategory}
              onChange={(e) =>
                handleKitCategoryChange(e.target.value as OfficeKitCategory)
              }
              options={OFFICE_KIT_CATEGORIES.map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="kit-name-input"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Nama Barang *
              </label>
              {!editingKit ? (
                <button
                  type="button"
                  onClick={() => {
                    setKitNameDirty(false);
                    setKitName(
                      getNextKitNameForCategory(kitCategory, officeKitItems)
                    );
                  }}
                  className="text-[11px] font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                >
                  Auto Nama
                </button>
              ) : null}
            </div>
            <Input
              id="kit-name-input"
              placeholder="Otomatis: Kabel HDMI 1, Kabel HDMI 2, ..."
              value={kitName}
              onChange={(e) => {
                setKitNameDirty(true);
                setKitName(e.target.value);
              }}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Merek / Spesifikasi"
              placeholder="Contoh: Vention Braided 5M"
              value={kitSpec}
              onChange={(e) => setKitSpec(e.target.value)}
            />
            <Input
              label="Lokasi Loker Kantor Staf"
              placeholder="Contoh: Kotak Kabel Loker A1"
              value={kitTray}
              onChange={(e) => setKitTray(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Terikat Khusus Ruangan (Opsional)"
              value={kitLinkedRoomId}
              onChange={(e) => setKitLinkedRoomId(e.target.value)}
              options={[
                { value: "", label: "Universal (Bisa untuk Semua Ruang)" },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                })),
              ]}
            />
            <Select
              label="Kondisi Fisik *"
              value={kitCondition}
              onChange={(e) =>
                setKitCondition(e.target.value as AssetCondition)
              }
              options={OFFICE_KIT_CONDITIONS.map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Tahun Pengadaan (Opsional)"
              type="number"
              min={1990}
              max={2100}
              placeholder="Contoh: 2026"
              value={kitProcurementYear}
              onChange={(e) => setKitProcurementYear(e.target.value)}
            />
            <Input
              label="Harga Perolehan (Rp) (Opsional)"
              type="number"
              min={0}
              step={50000}
              placeholder="Contoh: 175000"
              value={kitAcquisitionCost}
              onChange={(e) => setKitAcquisitionCost(e.target.value)}
            />
          </div>

          <Input
            label="Catatan Tambahan"
            placeholder="Keterangan kabel, panjang, atau pasangan Smart TV..."
            value={kitNotes}
            onChange={(e) => setKitNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setKitModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingKit ? "Simpan Perubahan" : "Simpan Barang"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Transaksi Sirkulasi */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingLoan)}
        onClose={() => {
          if (!deleting) {
            setDeletingLoan(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Tiket Sirkulasi"
        targetBadge={deletingLoan?.loan_code}
        targetName={`Peminjaman Kelas ${deletingLoan?.class_code || ""}`}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingLoan?.status === "Dipinjam"
            ? [
                "Tiket ini masih berstatus Dipinjam. Menghapus tiket akan otomatis memulihkan status barang terkait menjadi Tersedia di Kantor Staf.",
              ]
            : [
                "Tiket ini sudah dikembalikan. Menghapus permanen akan turut menghapus catatan ini dari tab Riwayat & Rekap (Master Admin) serta memengaruhi rekap intensitas kelas dan sapras.",
              ]
        }
        onConfirm={async () => {
          if (!deletingLoan) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteOfficeKitLoan(deletingLoan.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus tiket sirkulasi.");
            return;
          }
          if (selectedLoanId === deletingLoan.id) setSelectedLoanId(null);
          setDeletingLoan(null);
        }}
      />

      {/* Modal Konfirmasi Hapus Barang Kantor Staf */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingKit)}
        onClose={() => {
          if (!deleting) {
            setDeletingKit(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Barang Kantor Staf"
        targetBadge={deletingKit?.kit_code}
        targetName={deletingKit?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={[
          "Barang ini akan dihapus dari katalog loker kantor staf.",
        ]}
        onConfirm={async () => {
          if (!deletingKit) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteOfficeKitItem(deletingKit.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus barang.");
            return;
          }
          if (selectedKitId === deletingKit.id) setSelectedKitId(null);
          setSelectedKitRowKeys((prev) =>
            prev.filter((k) => k !== deletingKit.id)
          );
          setDeletingKit(null);
        }}
      />

      {/* Modal Konfirmasi Hapus Massal Barang Kantor Staf */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteKitsOpen && selectedKitsForDelete.length > 0}
        onClose={() => {
          if (!deleting) {
            setBulkDeleteKitsOpen(false);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Massal Barang Kantor Staf"
        targetBadge={`${selectedKitsForDelete.length} Barang Dipilih`}
        targetName={
          selectedKitsForDelete
            .slice(0, 5)
            .map((k) => `${k.kit_code} (${k.name})`)
            .join(", ") +
          (selectedKitsForDelete.length > 5
            ? `, dan ${selectedKitsForDelete.length - 5} barang lainnya`
            : "")
        }
        errorMessage={deleteError}
        isSubmitting={deleting}
        confirmLabel={`Ya, Hapus ${selectedKitsForDelete.length} Barang`}
        hardBlockers={selectedKitsForDelete
          .filter((k) => k.status === "Dipinjam")
          .map((k) => {
            const activeLoan = getActiveLoanForKit(k.id);
            return `${k.kit_code} (${k.name}) sedang dipinjam${
              activeLoan ? ` oleh kelas ${activeLoan.class_code}` : ""
            }. Catat pengembalian atau hapus centang terlebih dahulu.`;
          })}
        impactNotes={(() => {
          const idSet = new Set(selectedKitsForDelete.map((k) => k.id));
          const noteCount = notes.filter(
            (n) => n.entity_type === "office_kit" && idSet.has(n.entity_id)
          ).length;
          const attCount = attachments.filter(
            (a) => a.entity_type === "office_kit" && idSet.has(a.entity_id)
          ).length;
          const lines = [
            "Barang terpilih akan dihapus permanen dari katalog loker kantor staf.",
            "Riwayat sirkulasi terdahulu pada tab Riwayat & Rekap tetap tersimpan sebagai unit arsip.",
          ];
          if (noteCount > 0 || attCount > 0) {
            lines.push(
              `${noteCount} catatan & ${attCount} berkas lampiran barang terpilih akan ikut dihapus permanen.`
            );
          }
          return lines;
        })()}
        onConfirm={async () => {
          if (selectedKitsForDelete.length === 0) return;
          const ids = selectedKitsForDelete.map((k) => k.id);
          const idSet = new Set(ids);
          setDeleting(true);
          setDeleteError("");
          const res = await bulkDeleteOfficeKitItems(ids);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus massal barang.");
            return;
          }
          if (selectedKitId && idSet.has(selectedKitId)) {
            setSelectedKitId(null);
          }
          setSelectedKitRowKeys([]);
          setBulkDeleteKitsOpen(false);
        }}
      />

      {/* Modal Cetak Stiker QR Satuan & Massal Barang Kantor Staf */}
      <BarcodeLabelModal
        isOpen={Boolean(barcodePrintItems && barcodePrintItems.length > 0)}
        onClose={() => setBarcodePrintItems(null)}
        title={
          barcodePrintItems && barcodePrintItems.length > 1
            ? `Cetak Label QR Massal (${barcodePrintItems.length} Barang Kantor Staf)`
            : `Label Stiker QR ${barcodePrintItems?.[0]?.code || ""}`
        }
        items={barcodePrintItems || []}
      />

      {/* Modal Penomoran Ulang Kode Unit & Nama Barang Eksisting */}
      <Modal
        isOpen={resequenceModalOpen}
        onClose={() => {
          if (!resequenceSubmitting) setResequenceModalOpen(false);
        }}
        title="Rapikan Kode Unit & Nama Barang Kantor Staf"
        description="Menstandarkan Kode Unit Barang menjadi kode angka Pola A (1001+ Kabel HDMI, 2001+ Stop Kontak, 3001+ Remote TV, dst.) dan merapikan nama yang masih berupa angka."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          {resequenceError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {resequenceError}
            </div>
          ) : null}

          <label className="flex items-center gap-2.5 p-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={resequenceAllNames}
              onChange={(e) => setResequenceAllNames(e.target.checked)}
              className="w-4 h-4 accent-[#1E3A5F]"
            />
            <span className="text-slate-800 dark:text-slate-200">
              Standarkan <strong>semua nama barang</strong> menjadi format{" "}
              <code className="font-mono font-bold">&lt;Kategori&gt; &lt;No&gt;</code>{" "}
              (bila tidak dicentang, hanya nama yang berupa angka atau kode saja yang dirapikan).
            </span>
          </label>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-300">
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2">Kode &amp; Nama Lama</th>
                  <th className="px-3 py-2">Kode &amp; Nama Baru (Pola A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {resequencePreviewRows.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.changed
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50/70 dark:bg-slate-950/40 opacity-70"
                    }
                  >
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      {r.category}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                        {r.oldCode}
                      </span>{" "}
                      <span className="text-slate-700 dark:text-slate-300">
                        ({r.oldName})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                        {r.nextCode}
                      </span>{" "}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {r.nextName}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {resequencePreviewRows.filter((r) => r.changed).length} dari{" "}
              {resequencePreviewRows.length} barang akan diperbarui.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={resequenceSubmitting}
                onClick={() => setResequenceModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  resequenceSubmitting ||
                  resequencePreviewRows.filter((r) => r.changed).length === 0
                }
                onClick={handleApplyResequence}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {resequenceSubmitting
                    ? "Menyimpan..."
                    : "Terapkan Kode Angka Baru"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <MaintenanceReportModal
        isOpen={bulkRepairModal.open}
        onClose={() =>
          setBulkRepairModal((prev) => ({ ...prev, open: false }))
        }
        initialTargetKind="office_kit"
        initialOfficeKitIds={bulkRepairModal.kitIds}
        initialSeverity={bulkRepairModal.severity}
        bulkPresetLabel={bulkRepairModal.severity}
        onSubmitted={() => setSelectedKitRowKeys([])}
      />

      <Modal
        isOpen={Boolean(photoLightbox)}
        onClose={() => setPhotoLightbox(null)}
        title={
          photoLightbox
            ? `Foto Bukti Peminjaman ${photoLightbox.loanCode}`
            : "Foto Bukti Peminjaman"
        }
        description={
          photoLightbox
            ? `Kelas ${photoLightbox.classCode} • ${photoLightbox.photos.length} lampiran foto`
            : undefined
        }
        maxWidthClass="max-w-2xl"
      >
        {photoLightbox ? (
          <div className="space-y-4">
            {(() => {
              const activePhoto =
                photoLightbox.photos[photoLightbox.index] ||
                photoLightbox.photos[0];
              if (!activePhoto) return null;
              return (
                <>
                  <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center max-h-[60dvh]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePhoto.file_url}
                      alt={`Foto bukti ${photoLightbox.loanCode}`}
                      className="max-h-[60dvh] w-auto object-contain"
                    />
                  </div>
                  {photoLightbox.photos.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {photoLightbox.photos.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setPhotoLightbox((prev) =>
                              prev ? { ...prev, index: idx } : null
                            )
                          }
                          className={`w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                            idx === photoLightbox.index
                              ? "border-[#1E3A5F] dark:border-sky-400"
                              : "border-slate-300 dark:border-slate-700 opacity-75 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.file_url}
                            alt={p.file_name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[240px]">
                      {activePhoto.file_name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={activePhoto.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Buka Tab Baru</span>
                      </a>
                      <a
                        href={activePhoto.file_url}
                        download={activePhoto.file_name}
                        className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 text-xs font-bold hover:opacity-90"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Unduh Foto</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPhotoLightbox(null)}
                      >
                        Tutup
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
      <ReplaceLoanItemModal
        isOpen={Boolean(replacingLoan)}
        onClose={() => setReplacingLoan(null)}
        loan={replacingLoan}
      />
    </div>
  );
}
