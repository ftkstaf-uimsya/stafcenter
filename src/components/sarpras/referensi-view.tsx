"use client";

import React, { useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  AssetCategory,
  ConsumableCategoryMaster,
  ConsumableUnitMaster,
  FundingSource,
  FundingSourceType,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";
import { MasterAdminGuard } from "@/components/sarpras/master-admin-guard";

type ReferensiTab =
  | "asset_categories"
  | "funding_sources"
  | "consumable_categories"
  | "consumable_units";

const FUNDING_SOURCE_TYPES: FundingSourceType[] = [
  "Internal Kampus",
  "Yayasan",
  "Hibah Pemerintah",
  "Kerjasama / CSR",
  "Lainnya",
];

export function ReferensiView() {
  const {
    assetCategories,
    fundingSources,
    consumableCategories,
    consumableUnits,
    assets,
    consumables,
    canAccessPage,
    defaultHomeHref,
    uiSimState,
    setUiSimState,
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
  } = useSarpras();

  const [activeTab, setActiveTab] = useState<ReferensiTab>("asset_categories");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("5");
  const [sourceType, setSourceType] =
    useState<FundingSourceType>("Internal Kampus");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [formError, setFormError] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    tab: ReferensiTab;
    id: string;
    badge: string;
    name: string;
    impactNotes: string[];
  } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const filteredAssetCats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assetCategories.filter(
      (c) =>
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [assetCategories, searchQuery]);

  const filteredFundingSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fundingSources.filter(
      (f) =>
        !q ||
        f.code.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.source_type.toLowerCase().includes(q)
    );
  }, [fundingSources, searchQuery]);

  const filteredBhpCats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consumableCategories.filter(
      (c) =>
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [consumableCategories, searchQuery]);

  const filteredBhpUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consumableUnits.filter(
      (u) =>
        !q ||
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.description || "").toLowerCase().includes(q)
    );
  }, [consumableUnits, searchQuery]);

  if (!canAccessPage("referensi")) {
    return (
      <MasterAdminGuard
        sectionLabel="Master Referensi & Klasifikasi"
        backHref={defaultHomeHref}
      />
    );
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat katalog referensi kategori aset, sumber dana, dan satuan BHP..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Master Referensi"
        description="Sistem gagal mengambil data referensi klasifikasi. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setUsefulLifeYears("5");
    setSourceType("Internal Kampus");
    setDescription("");
    setIsActive("true");
    setFormError("");
    setModalOpen(true);
  };

  const openEditAssetCat = (item: AssetCategory) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setUsefulLifeYears(String(item.useful_life_years));
    setDescription(item.description || "");
    setIsActive(item.is_active ? "true" : "false");
    setFormError("");
    setModalOpen(true);
  };

  const openEditFunding = (item: FundingSource) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setSourceType(item.source_type);
    setDescription(item.notes || "");
    setIsActive(item.is_active ? "true" : "false");
    setFormError("");
    setModalOpen(true);
  };

  const openEditBhpCat = (item: ConsumableCategoryMaster) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description || "");
    setIsActive(item.is_active ? "true" : "false");
    setFormError("");
    setModalOpen(true);
  };

  const openEditBhpUnit = (item: ConsumableUnitMaster) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description || "");
    setIsActive(item.is_active ? "true" : "false");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const activeBool = isActive === "true";

    if (!cleanCode || !cleanName) {
      setFormError("Kode dan Nama Referensi wajib diisi.");
      return;
    }

    if (activeTab === "asset_categories") {
      if (cleanCode.length > 16) {
        setFormError("Kode kategori aset maksimal 16 karakter.");
        return;
      }
      const dup = assetCategories.some(
        (c) =>
          c.code.toLowerCase() === cleanCode.toLowerCase() && c.id !== editingId
      );
      if (dup) {
        setFormError(`Kode kategori "${cleanCode}" sudah terdaftar.`);
        return;
      }
      const years = Math.min(50, Math.max(1, Number(usefulLifeYears) || 5));
      if (editingId) {
        updateAssetCategory(editingId, {
          name: cleanName,
          useful_life_years: years,
          description: description.trim(),
          is_active: activeBool,
        });
      } else {
        addAssetCategory({
          code: cleanCode,
          name: cleanName,
          useful_life_years: years,
          description: description.trim(),
          is_active: activeBool,
        });
      }
    } else if (activeTab === "funding_sources") {
      const dupCode = fundingSources.some(
        (f) =>
          f.code.toLowerCase() === cleanCode.toLowerCase() && f.id !== editingId
      );
      const dupName = fundingSources.some(
        (f) =>
          f.name.toLowerCase() === cleanName.toLowerCase() && f.id !== editingId
      );
      if (dupCode) {
        setFormError(`Kode sumber dana "${cleanCode}" sudah terdaftar.`);
        return;
      }
      if (dupName) {
        setFormError(`Nama sumber dana "${cleanName}" sudah terdaftar.`);
        return;
      }
      if (editingId) {
        updateFundingSource(editingId, {
          code: cleanCode,
          name: cleanName,
          source_type: sourceType,
          notes: description.trim(),
          is_active: activeBool,
        });
      } else {
        addFundingSource({
          code: cleanCode,
          name: cleanName,
          source_type: sourceType,
          notes: description.trim(),
          is_active: activeBool,
        });
      }
    } else if (activeTab === "consumable_categories") {
      const dupCode = consumableCategories.some(
        (c) =>
          c.code.toLowerCase() === cleanCode.toLowerCase() && c.id !== editingId
      );
      const dupName = consumableCategories.some(
        (c) =>
          c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== editingId
      );
      if (dupCode) {
        setFormError(`Kode kategori BHP "${cleanCode}" sudah terdaftar.`);
        return;
      }
      if (dupName) {
        setFormError(`Nama kategori BHP "${cleanName}" sudah terdaftar.`);
        return;
      }
      if (editingId) {
        updateConsumableCategory(editingId, {
          code: cleanCode,
          name: cleanName,
          description: description.trim(),
          is_active: activeBool,
        });
      } else {
        addConsumableCategory({
          code: cleanCode,
          name: cleanName,
          description: description.trim(),
          is_active: activeBool,
        });
      }
    } else {
      const dupCode = consumableUnits.some(
        (u) =>
          u.code.toLowerCase() === cleanCode.toLowerCase() && u.id !== editingId
      );
      const dupName = consumableUnits.some(
        (u) =>
          u.name.toLowerCase() === cleanName.toLowerCase() && u.id !== editingId
      );
      if (dupCode) {
        setFormError(`Kode satuan "${cleanCode}" sudah terdaftar.`);
        return;
      }
      if (dupName) {
        setFormError(`Nama satuan "${cleanName}" sudah terdaftar.`);
        return;
      }
      if (editingId) {
        updateConsumableUnit(editingId, {
          code: cleanCode,
          name: cleanName,
          description: description.trim(),
          is_active: activeBool,
        });
      } else {
        addConsumableUnit({
          code: cleanCode,
          name: cleanName,
          description: description.trim(),
          is_active: activeBool,
        });
      }
    }

    setModalOpen(false);
  };

  const assetCatColumns: DataTableColumn<AssetCategory>[] = [
    {
      key: "cat",
      header: "Kode & Nama Kategori Aset",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.code}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
        </div>
      ),
    },
    {
      key: "life",
      header: "Umur Ekonomis & Pemakaian",
      render: (row) => {
        const count = assets.filter((a) => a.category === row.code).length;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              Estimasi {row.useful_life_years} Tahun
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Digunakan pada {count} unit aset
            </p>
          </div>
        );
      },
    },
    {
      key: "desc",
      header: "Keterangan",
      render: (row) => (
        <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xs">
          {row.description || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => {
        const count = assets.filter((a) => a.category === row.code).length;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditAssetCat(row)}
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
                setDeleteTarget({
                  tab: "asset_categories",
                  id: row.id,
                  badge: row.code,
                  name: row.name,
                  impactNotes:
                    count > 0
                      ? [
                          `Kategori ini sedang dipakai oleh ${count} unit aset. Penghapusan akan ditolak sampai aset dipindahkan ke kategori lain.`,
                        ]
                      : ["Tidak ada aset yang menggunakan kategori ini."],
                });
              }}
              aria-label={`Hapus kategori ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  const fundingColumns: DataTableColumn<FundingSource>[] = [
    {
      key: "fund",
      header: "Kode & Nama Sumber Dana",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.code}
            </span>
            <Badge tone="info">{row.source_type}</Badge>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Penggunaan di Inventaris",
      render: (row) => {
        const count = assets.filter(
          (a) =>
            a.funding_source_id === row.id ||
            a.funding_source.trim().toLowerCase() ===
              row.name.trim().toLowerCase()
        ).length;
        return (
          <p className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400">
            {count} unit aset
          </p>
        );
      },
    },
    {
      key: "notes",
      header: "Keterangan",
      render: (row) => (
        <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xs">
          {row.notes || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => {
        const count = assets.filter(
          (a) =>
            a.funding_source_id === row.id ||
            a.funding_source.trim().toLowerCase() ===
              row.name.trim().toLowerCase()
        ).length;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditFunding(row)}
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
                setDeleteTarget({
                  tab: "funding_sources",
                  id: row.id,
                  badge: row.code,
                  name: row.name,
                  impactNotes:
                    count > 0
                      ? [
                          `Terkait pada ${count} unit aset. Label teks sumber dana historis pada aset tetap dipertahankan.`,
                        ]
                      : ["Tidak ada aset yang tertaut pada sumber dana ini."],
                });
              }}
              aria-label={`Hapus sumber dana ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  const bhpCatColumns: DataTableColumn<ConsumableCategoryMaster>[] = [
    {
      key: "cat",
      header: "Kode & Nama Kategori BHP",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.code}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Item BHP Terdaftar",
      render: (row) => {
        const count = consumables.filter((c) => c.category === row.name).length;
        return (
          <p className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400">
            {count} item BHP
          </p>
        );
      },
    },
    {
      key: "desc",
      header: "Keterangan",
      render: (row) => (
        <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xs">
          {row.description || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => {
        const count = consumables.filter((c) => c.category === row.name).length;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditBhpCat(row)}
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
                setDeleteTarget({
                  tab: "consumable_categories",
                  id: row.id,
                  badge: row.code,
                  name: row.name,
                  impactNotes:
                    count > 0
                      ? [
                          `Kategori ini sedang dipakai oleh ${count} item BHP. Penghapusan akan ditolak sampai kategori item diubah.`,
                        ]
                      : ["Tidak ada item BHP yang memakai kategori ini."],
                });
              }}
              aria-label={`Hapus kategori BHP ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  const bhpUnitColumns: DataTableColumn<ConsumableUnitMaster>[] = [
    {
      key: "unit",
      header: "Kode & Nama Satuan BHP",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.code}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Item BHP Terdaftar",
      render: (row) => {
        const count = consumables.filter((c) => c.unit === row.name).length;
        return (
          <p className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400">
            {count} item BHP
          </p>
        );
      },
    },
    {
      key: "desc",
      header: "Keterangan",
      render: (row) => (
        <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xs">
          {row.description || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => {
        const count = consumables.filter((c) => c.unit === row.name).length;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditBhpUnit(row)}
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
                setDeleteTarget({
                  tab: "consumable_units",
                  id: row.id,
                  badge: row.code,
                  name: row.name,
                  impactNotes:
                    count > 0
                      ? [
                          `Satuan ini sedang dipakai oleh ${count} item BHP. Penghapusan akan ditolak sampai satuan item diubah.`,
                        ]
                      : ["Tidak ada item BHP yang memakai satuan ini."],
                });
              }}
              aria-label={`Hapus satuan BHP ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  const tabs: Array<{ id: ReferensiTab; label: string; count: number }> = [
    {
      id: "asset_categories",
      label: "Kategori Aset",
      count: assetCategories.length,
    },
    {
      id: "funding_sources",
      label: "Sumber Dana",
      count: fundingSources.length,
    },
    {
      id: "consumable_categories",
      label: "Kategori BHP",
      count: consumableCategories.length,
    },
    {
      id: "consumable_units",
      label: "Satuan BHP",
      count: consumableUnits.length,
    },
  ];

  const activeAddLabel =
    activeTab === "asset_categories"
      ? "Tambah Kategori Aset"
      : activeTab === "funding_sources"
      ? "Tambah Sumber Dana"
      : activeTab === "consumable_categories"
      ? "Tambah Kategori BHP"
      : "Tambah Satuan BHP";

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • REFERENSI KLASIFIKASI & ANGGARAN
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Master Referensi & Klasifikasi
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola daftar standar kategori inventaris, sumber dana pengadaan,
            kategori BHP/ATK, serta satuan barang habis pakai.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{activeAddLabel}</span>
        </Button>
      </section>

      {/* Tab Navigasi Klasifikasi */}
      <div
        role="tablist"
        aria-label="Kategori Data Master Referensi"
        className="flex flex-wrap gap-2 border-b border-slate-300 dark:border-slate-800 pb-3"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery("");
              }}
              className={`min-h-[44px] px-4 py-2 rounded-md text-xs font-bold inline-flex items-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
                isSelected
                  ? "bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                  : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                  isSelected
                    ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari kode atau nama referensi..."
          aria-label="Cari referensi klasifikasi"
          className="min-h-[44px] w-full sm:w-80 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
        />
      </section>

      {activeTab === "asset_categories" ? (
        <DataTable
          columns={assetCatColumns}
          data={filteredAssetCats}
          rowKey={(c) => c.id}
          emptyTitle="Belum Ada Kategori Aset"
          emptyDescription="Tambahkan kategori aset baru untuk kode inventaris otomatis."
          emptyActionLabel="Tambah Kategori Aset"
          onEmptyAction={openAddModal}
        />
      ) : activeTab === "funding_sources" ? (
        <DataTable
          columns={fundingColumns}
          data={filteredFundingSources}
          rowKey={(f) => f.id}
          emptyTitle="Belum Ada Sumber Dana"
          emptyDescription="Tambahkan sumber dana pengadaan sebagai referensi resmi inventaris dan import Excel."
          emptyActionLabel="Tambah Sumber Dana"
          onEmptyAction={openAddModal}
        />
      ) : activeTab === "consumable_categories" ? (
        <DataTable
          columns={bhpCatColumns}
          data={filteredBhpCats}
          rowKey={(c) => c.id}
          emptyTitle="Belum Ada Kategori BHP"
          emptyDescription="Tambahkan kategori barang habis pakai untuk pengelompokan stok ATK."
          emptyActionLabel="Tambah Kategori BHP"
          onEmptyAction={openAddModal}
        />
      ) : (
        <DataTable
          columns={bhpUnitColumns}
          data={filteredBhpUnits}
          rowKey={(u) => u.id}
          emptyTitle="Belum Ada Satuan BHP"
          emptyDescription="Tambahkan satuan kemasan untuk katalog barang habis pakai."
          emptyActionLabel="Tambah Satuan BHP"
          onEmptyAction={openAddModal}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId ? `Edit Referensi (${code})` : activeAddLabel
        }
        description="Perubahan referensi langsung tersedia pada dropdown form operasional dan template import."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {formError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Referensi *"
              placeholder={
                activeTab === "asset_categories"
                  ? "Contoh: ELK / LAB"
                  : activeTab === "funding_sources"
                  ? "Contoh: DANA-OPS"
                  : activeTab === "consumable_categories"
                  ? "Contoh: BHP-ATK"
                  : "Contoh: BOX / PCS"
              }
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={Boolean(editingId && activeTab === "asset_categories")}
              required
            />
            <Select
              label="Status *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Aktif" },
                { value: "false", label: "Nonaktif" },
              ]}
            />
          </div>

          <Input
            label="Nama Resmi *"
            placeholder={
              activeTab === "asset_categories"
                ? "Contoh: Elektronik & Visual"
                : activeTab === "funding_sources"
                ? "Contoh: Dana Operasional Kampus"
                : activeTab === "consumable_categories"
                ? "Contoh: ATK & Kelas"
                : "Contoh: Box"
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {activeTab === "asset_categories" ? (
            <Input
              label="Estimasi Umur Ekonomis (Tahun) *"
              type="number"
              min={1}
              max={50}
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
              required
            />
          ) : null}

          {activeTab === "funding_sources" ? (
            <Select
              label="Kelompok Sumber Dana *"
              value={sourceType}
              onChange={(e) =>
                setSourceType(e.target.value as FundingSourceType)
              }
              options={FUNDING_SOURCE_TYPES.map((t) => ({
                value: t,
                label: t,
              }))}
            />
          ) : null}

          <Input
            label="Keterangan / Deskripsi"
            placeholder="Catatan ruang lingkup referensi..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingId ? "Simpan Perubahan" : "Simpan Referensi"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Referensi"
        targetBadge={deleteTarget?.badge}
        targetName={deleteTarget?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={deleteTarget?.impactNotes || []}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          setDeleteError("");
          const res =
            deleteTarget.tab === "asset_categories"
              ? await deleteAssetCategory(deleteTarget.id)
              : deleteTarget.tab === "funding_sources"
              ? await deleteFundingSource(deleteTarget.id)
              : deleteTarget.tab === "consumable_categories"
              ? await deleteConsumableCategory(deleteTarget.id)
              : await deleteConsumableUnit(deleteTarget.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus referensi.");
            return;
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
