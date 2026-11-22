"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Cable,
  CheckCircle2,
  Clock,
  Edit3,
  PackageCheck,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  useSarpras,
} from "@/lib/supabase/sarpras-context";
import { TODAY_ISO } from "@/lib/supabase/seed-data";
import {
  AssetCondition,
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
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";
import { AssetConditionBadge } from "@/components/sarpras/status-badges";

const OFFICE_KIT_CATEGORIES: OfficeKitCategory[] = [
  "Kabel HDMI",
  "Stop Kontak",
  "Remote TV",
  "Kunci & Akses",
  "Adapter & Converter",
  "Lainnya",
];

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

type ActiveTab = "loans" | "items";

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
    academicClasses,
    rooms,
    courses,
    uiSimState,
    setUiSimState,
    addOfficeKitItem,
    updateOfficeKitItem,
    deleteOfficeKitItem,
    checkoutOfficeKitLoan,
    checkinOfficeKitLoan,
    deleteOfficeKitLoan,
  } = useSarpras();

  const [activeTab, setActiveTab] = useState<ActiveTab>("loans");
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

  // Modal Check-Out Pinjam Cepat Alat Kantor Staf
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [borrowerType, setBorrowerType] = useState<"dpm" | "representative">(
    "representative"
  );
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerPhone, setBorrowerPhone] = useState("");
  const [roomId, setRoomId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [selectedKitIds, setSelectedKitIds] = useState<string[]>([]);
  const [loanDate, setLoanDate] = useState(TODAY_ISO);
  const [borrowTime, setBorrowTime] = useState("08:00");
  const [expectedReturnTime, setExpectedReturnTime] = useState("10:30");
  const [checkoutError, setCheckoutError] = useState("");

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
  const [kitCategory, setKitCategory] =
    useState<OfficeKitCategory>("Kabel HDMI");
  const [kitSpec, setKitSpec] = useState("");
  const [kitTray, setKitTray] = useState("Kotak Kabel Loker A1 - Kantor Staf");
  const [kitLinkedRoomId, setKitLinkedRoomId] = useState("");
  const [kitCondition, setKitCondition] = useState<AssetCondition>("Baik");
  const [kitNotes, setKitNotes] = useState("");
  const [kitError, setKitError] = useState("");

  // Modal Hapus
  const [deletingLoan, setDeletingLoan] = useState<OfficeKitLoan | null>(null);
  const [deletingKit, setDeletingKit] = useState<OfficeKitItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const activeClasses = useMemo(
    () => academicClasses.filter((c) => c.is_active),
    [academicClasses]
  );

  const selectedClassObj = useMemo(
    () => academicClasses.find((c) => c.id === selectedClassId) || null,
    [academicClasses, selectedClassId]
  );

  const availableKitItems = useMemo(
    () =>
      officeKitItems.filter(
        (item) =>
          item.is_active &&
          item.status === "Tersedia" &&
          item.condition !== "Hilang"
      ),
    [officeKitItems]
  );

  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return officeKitLoans.filter((l) => {
      const matchSearch =
        !q ||
        l.loan_code.toLowerCase().includes(q) ||
        l.class_code.toLowerCase().includes(q) ||
        l.dpm_name.toLowerCase().includes(q) ||
        l.borrower_name.toLowerCase().includes(q) ||
        l.kit_items_label.toLowerCase().includes(q) ||
        (l.course_name || "").toLowerCase().includes(q);
      const matchStatus =
        filterLoanStatus === "ALL" || l.status === filterLoanStatus;
      const matchProdi = filterProdi === "ALL" || l.prodi === filterProdi;
      return matchSearch && matchStatus && matchProdi;
    });
  }, [officeKitLoans, searchQuery, filterLoanStatus, filterProdi]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return officeKitItems.filter((i) => {
      const matchSearch =
        !q ||
        i.kit_code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.brand_spec.toLowerCase().includes(q) ||
        i.storage_tray.toLowerCase().includes(q);
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

  const openCheckoutModal = () => {
    const firstCls = activeClasses[0] || null;
    setSelectedClassId(firstCls?.id || "");
    setBorrowerType("representative");
    setBorrowerName("");
    setBorrowerPhone(firstCls?.dpm_phone || "");
    setRoomId(firstCls?.default_room_id || rooms[0]?.id || "");
    setCourseName("");
    setSelectedKitIds([]);
    setLoanDate(TODAY_ISO);
    setBorrowTime("08:00");
    setExpectedReturnTime("10:30");
    setCheckoutError("");
    setCheckoutModalOpen(true);
  };

  const handleClassChange = (clsId: string) => {
    setSelectedClassId(clsId);
    const cls = academicClasses.find((c) => c.id === clsId);
    if (!cls) return;
    if (borrowerType === "dpm") {
      setBorrowerName(`${cls.dpm_name} (DPM)`);
    }
    setBorrowerPhone(cls.dpm_phone || "");
    if (cls.default_room_id) {
      setRoomId(cls.default_room_id);
    }
  };

  const handleToggleKitSelection = (id: string) => {
    setSelectedKitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");

    if (!selectedClassObj) {
      setCheckoutError(
        "Pilih Kelas Mahasiswa terlebih dahulu dari Data Master Kelas."
      );
      return;
    }

    const finalBorrowerName =
      borrowerType === "dpm"
        ? `${selectedClassObj.dpm_name} (DPM)`
        : borrowerName.trim();

    if (!finalBorrowerName) {
      setCheckoutError(
        "Isi nama perwakilan mahasiswa yang mengambil barang di kantor staf."
      );
      return;
    }

    const res = checkoutOfficeKitLoan({
      class_id: selectedClassObj.id,
      class_code: selectedClassObj.class_code,
      prodi: selectedClassObj.prodi,
      dpm_name: selectedClassObj.dpm_name,
      borrower_name: finalBorrowerName,
      borrower_phone: borrowerPhone.trim() || selectedClassObj.dpm_phone || "-",
      room_id: roomId || null,
      course_name: courseName.trim(),
      kit_item_ids: selectedKitIds,
      loan_date: loanDate,
      borrow_time: borrowTime,
      expected_return_time: expectedReturnTime,
    });

    if (!res.ok) {
      setCheckoutError(res.error || "Gagal mencatat peminjaman alat.");
      return;
    }
    setCheckoutModalOpen(false);
  };

  const openReturnModal = (loan: OfficeKitLoan) => {
    setReturningLoan(loan);
    setReturnNotes("");
    setDamagedReturnIds([]);
  };

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
    setEditingKit(null);
    setKitCode("");
    setKitName("");
    setKitCategory("Kabel HDMI");
    setKitSpec("");
    setKitTray("Kotak Kabel Loker A1 - Kantor Staf");
    setKitLinkedRoomId("");
    setKitCondition("Baik");
    setKitNotes("");
    setKitError("");
    setKitModalOpen(true);
  };

  const openEditKitModal = (item: OfficeKitItem) => {
    setEditingKit(item);
    setKitCode(item.kit_code);
    setKitName(item.name);
    setKitCategory(item.category);
    setKitSpec(item.brand_spec);
    setKitTray(item.storage_tray);
    setKitLinkedRoomId(item.linked_room_id || "");
    setKitCondition(item.condition);
    setKitNotes(item.notes || "");
    setKitError("");
    setKitModalOpen(true);
  };

  const handleKitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKitError("");
    if (!kitCode.trim() || !kitName.trim()) {
      setKitError("Kode Barang dan Nama Barang wajib diisi.");
      return;
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
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Selesai
            </span>
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
      header: "Aksi",
      render: (row) => (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
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

  const selectedLoan =
    officeKitLoans.find((l) => l.id === selectedLoanId) || null;
  const selectedKit = officeKitItems.find((i) => i.id === selectedKitId) || null;

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
          <Button type="button" variant="primary" onClick={openCheckoutModal}>
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
            {officeKitLoans.length}
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
      </div>

      {/* Toolbar Filter & Pencarian */}
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

        <ColumnsTogglePopover
          columns={
            activeTab === "loans"
              ? loanColumns.map((c) => ({ key: c.key, label: c.header }))
              : itemColumns.map((c) => ({ key: c.key, label: c.header }))
          }
          hiddenKeys={activeTab === "loans" ? hiddenLoanCols : hiddenItemCols}
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
      </section>

      {/* Tabel Konten Utama */}
      {activeTab === "loans" ? (
        <DataTable
          columns={loanColumns}
          data={filteredLoans}
          rowKey={(l) => l.id}
          hiddenColumnKeys={hiddenLoanCols}
          activeRowKey={selectedLoanId}
          onRowClick={(row) => setSelectedLoanId(row.id)}
          emptyTitle="Belum Ada Transaksi Sirkulasi Alat Kantor Staf"
          emptyDescription="Catat peminjaman Kabel HDMI, Stop Kontak, atau Remote TV saat perwakilan kelas mengambil di kantor staf."
          emptyActionLabel="Pinjamkan Alat ke Kelas"
          onEmptyAction={openCheckoutModal}
        />
      ) : (
        <DataTable
          columns={itemColumns}
          data={filteredItems}
          rowKey={(i) => i.id}
          hiddenColumnKeys={hiddenItemCols}
          activeRowKey={selectedKitId}
          onRowClick={(row) => setSelectedKitId(row.id)}
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
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => openReturnModal(selectedLoan)}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Terima Pengembalian</span>
                </Button>
              ) : null}
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
                <dt className="text-slate-600 dark:text-slate-400">
                  Barang Dipinjam
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLoan.kit_items_label}
                </dd>
              </div>
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
            <div className="flex items-center justify-between gap-2">
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
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditKitModal(selectedKit)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Barang</span>
              </Button>
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
        <form onSubmit={handleCheckoutSubmit} className="space-y-4">
          {checkoutError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {checkoutError}
            </div>
          ) : null}

          <Select
            label="Pilih Kelas Mahasiswa (Data Master Kelas & DPM) *"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={
              activeClasses.length === 0
                ? [
                    {
                      value: "",
                      label: "Belum ada kelas aktif di Master Kelas",
                    },
                  ]
                : activeClasses.map((c) => ({
                    value: c.id,
                    label: `${c.class_code} | Prodi ${c.prodi} Angk. '${c.angkatan_year} Bagian ${c.class_section} (DPM: ${c.dpm_name})`,
                  }))
            }
          />

          {selectedClassObj ? (
            <div className="p-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-slate-600 dark:text-slate-400">
                  Kode Kelas:
                </span>{" "}
                <strong className="font-mono text-[#1E3A5F] dark:text-sky-400">
                  {selectedClassObj.class_code}
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">
                  DPM (Ketua Kelas):
                </span>{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {selectedClassObj.dpm_name}
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">
                  WA DPM:
                </span>{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {selectedClassObj.dpm_phone}
                </strong>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Pengambil di Loket Kantor Staf *"
              value={borrowerType}
              onChange={(e) => {
                const mode = e.target.value as "dpm" | "representative";
                setBorrowerType(mode);
                if (mode === "dpm" && selectedClassObj) {
                  setBorrowerName(`${selectedClassObj.dpm_name} (DPM)`);
                  setBorrowerPhone(selectedClassObj.dpm_phone || "");
                } else {
                  setBorrowerName("");
                }
              }}
              options={[
                {
                  value: "representative",
                  label: "Perwakilan Mahasiswa Kelas",
                },
                {
                  value: "dpm",
                  label: "Langsung DPM (Ketua Kelas)",
                },
              ]}
            />

            {borrowerType === "representative" ? (
              <Input
                label="Nama Perwakilan Mahasiswa *"
                placeholder="Ketik nama mahasiswa yang mengambil alat"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                required
              />
            ) : (
              <Input
                label="Nama DPM Pengambil"
                value={selectedClassObj ? `${selectedClassObj.dpm_name} (DPM)` : ""}
                readOnly
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="No. WhatsApp Kontak"
              placeholder="08xx-xxxx-xxxx"
              value={borrowerPhone}
              onChange={(e) => setBorrowerPhone(e.target.value)}
            />
            <Select
              label="Ruang Perkuliahan"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              options={[
                { value: "", label: "Pilih ruangan (opsional)" },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                })),
              ]}
            />
            <Input
              label="Mata Kuliah / Keperluan"
              placeholder="Contoh: Manajemen Mutu"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              list="sirkulasi-makul-list"
            />
            <datalist id="sirkulasi-makul-list">
              {courses.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Pilih Barang Kantor Staf yang Dipinjam * (
                {selectedKitIds.length} dipilih)
              </span>
              {selectedKitIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedKitIds([])}
                  className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
                >
                  Kosongkan pilihan
                </button>
              ) : null}
            </div>

            {availableKitItems.length === 0 ? (
              <p className="p-3 rounded-md border border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
                Seluruh Kabel HDMI, Stop Kontak, dan Remote TV di kantor staf
                sedang dipinjam atau dalam perbaikan.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                {availableKitItems.map((item) => {
                  const checked = selectedKitIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer text-xs transition-colors ${
                        checked
                          ? "border-[#1E3A5F] bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/40"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleKitSelection(item.id)}
                        className="mt-0.5 w-4 h-4 accent-[#1E3A5F]"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <strong className="font-mono text-slate-900 dark:text-slate-100">
                            {item.kit_code}
                          </strong>
                          <span className="text-[11px] font-semibold text-[#1E3A5F] dark:text-sky-400">
                            ({item.category})
                          </span>
                        </span>
                        <span className="block font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Tanggal *"
              type="date"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              required
            />
            <Input
              label="Jam Ambil *"
              type="time"
              value={borrowTime}
              onChange={(e) => setBorrowTime(e.target.value)}
              required
            />
            <Input
              label="Estimasi Kembali *"
              type="time"
              value={expectedReturnTime}
              onChange={(e) => setExpectedReturnTime(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckoutModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              <PackageCheck className="w-4 h-4" aria-hidden="true" />
              <span>Serahkan Alat ke Kelas</span>
            </Button>
          </div>
        </form>
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
            <Input
              label="Kode Unit Barang *"
              placeholder="Contoh: KST-HDMI-04"
              value={kitCode}
              onChange={(e) => setKitCode(e.target.value)}
              required
            />
            <Select
              label="Kategori Peralatan *"
              value={kitCategory}
              onChange={(e) =>
                setKitCategory(e.target.value as OfficeKitCategory)
              }
              options={OFFICE_KIT_CATEGORIES.map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </div>

          <Input
            label="Nama Barang *"
            placeholder="Contoh: Kabel HDMI 5 Meter #04"
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
            required
          />

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
            : ["Riwayat sirkulasi ini akan dihapus permanen."]
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
          setDeletingKit(null);
        }}
      />
    </div>
  );
}
