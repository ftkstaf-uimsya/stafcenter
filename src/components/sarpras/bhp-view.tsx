"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  Consumable,
  ConsumableCategory,
  ConsumableUnit,
  TransactionType,
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
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";

const BHP_CATEGORIES: ConsumableCategory[] = [
  "ATK & Kelas",
  "Cetakan & Kertas",
  "Tinta & Toner",
  "Kebersihan & Sanitasi",
  "Kelistrikan Ringan",
];

const BHP_UNITS: ConsumableUnit[] = [
  "Pcs",
  "Box",
  "Rim",
  "Botol",
  "Pack",
  "Roll",
];

export function BhpView() {
  const {
    consumables,
    consumableTransactions,
    notes,
    attachments,
    uiSimState,
    setUiSimState,
    addConsumable,
    updateConsumable,
    deleteConsumable,
    recordConsumableMutation,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStockStatus, setFilterStockStatus] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  // Slide-over detail drawer item BHP
  const [selectedConsumableId, setSelectedConsumableId] = useState<
    string | null
  >(null);

  // Modal Tambah / Edit Item BHP
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(
    null
  );
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ConsumableCategory>("ATK & Kelas");
  const [unit, setUnit] = useState<ConsumableUnit>("Box");
  const [currentStock, setCurrentStock] = useState("20");
  const [minStock, setMinStock] = useState("10");
  const [storageLocation, setStorageLocation] = useState(
    "Lemari ATK A1 - Biro Sarpras"
  );
  const [addError, setAddError] = useState("");

  // Modal Konfirmasi Hapus Item BHP
  const [deletingConsumable, setDeletingConsumable] =
    useState<Consumable | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Modal Catat Mutasi Masuk (Restock) / Keluar (Pengambilan)
  const [mutationTarget, setMutationTarget] = useState<Consumable | null>(null);
  const [txType, setTxType] = useState<TransactionType>("Masuk");
  const [quantity, setQuantity] = useState("5");
  const [actorName, setActorName] = useState("");
  const [actorUnit, setActorUnit] = useState("");
  const [purposeNotes, setPurposeNotes] = useState("");
  const [mutationError, setMutationError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && consumables.some((c) => c.id === inspect)) {
      setSelectedConsumableId(inspect);
    }
  }, [consumables]);

  const selectedConsumable = useMemo(
    () => consumables.find((c) => c.id === selectedConsumableId) || null,
    [consumables, selectedConsumableId]
  );

  const filteredConsumables = useMemo(() => {
    return consumables.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.storage_location.toLowerCase().includes(q);
      const matchCat =
        filterCategory === "ALL" || c.category === filterCategory;
      const isLow = c.current_stock < c.min_stock;
      const matchStock =
        filterStockStatus === "ALL" ||
        (filterStockStatus === "LOW" && isLow) ||
        (filterStockStatus === "SAFE" && !isLow);
      return matchSearch && matchCat && matchStock;
    });
  }, [consumables, searchQuery, filterCategory, filterStockStatus]);

  const activeFilterCount =
    (filterCategory !== "ALL" ? 1 : 0) + (filterStockStatus !== "ALL" ? 1 : 0);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat katalog stok barang habis pakai (ATK) dan riwayat mutasi..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Manajemen Stok BHP / ATK"
        description="Data inventori habis pakai dan log mutasi tidak dapat diakses sementara."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openMutationModal = (item: Consumable, defaultType: TransactionType) => {
    setMutationTarget(item);
    setTxType(defaultType);
    setQuantity("5");
    setActorName("");
    setActorUnit("");
    setPurposeNotes("");
    setMutationError("");
  };

  const openAddConsumableModal = () => {
    setEditingConsumable(null);
    setCode("");
    setName("");
    setCategory("ATK & Kelas");
    setUnit("Box");
    setCurrentStock("20");
    setMinStock("10");
    setStorageLocation("Lemari ATK A1 - Biro Sarpras");
    setAddError("");
    setAddModalOpen(true);
  };

  const openEditConsumableModal = (item: Consumable) => {
    setEditingConsumable(item);
    setCode(item.code);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setCurrentStock(String(item.current_stock));
    setMinStock(String(item.min_stock));
    setStorageLocation(item.storage_location);
    setAddError("");
    setAddModalOpen(true);
  };

  const handleAddConsumable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setAddError("Kode Barang dan Nama Barang wajib diisi.");
      return;
    }
    const basePayload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      unit,
      current_stock: Math.max(0, Number(currentStock) || 0),
      min_stock: Math.max(0, Number(minStock) || 0),
      storage_location: storageLocation.trim() || "Gudang Utama Sarpras",
    };
    if (editingConsumable) {
      updateConsumable(editingConsumable.id, basePayload);
    } else {
      addConsumable(basePayload);
    }
    setCode("");
    setName("");
    setAddError("");
    setEditingConsumable(null);
    setAddModalOpen(false);
  };

  const handleMutationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError("");
    if (!mutationTarget) return;

    const qtyNum = Number(quantity) || 0;
    if (qtyNum <= 0 || !actorName.trim() || !actorUnit.trim()) {
      setMutationError(
        "Jumlah mutasi (> 0), Nama Petugas/Pengambil, dan Unit wajib diisi."
      );
      return;
    }

    const res = recordConsumableMutation({
      consumable_id: mutationTarget.id,
      transaction_type: txType,
      quantity: qtyNum,
      actor_name: actorName.trim(),
      actor_unit: actorUnit.trim(),
      purpose_notes:
        purposeNotes.trim() ||
        (txType === "Masuk"
          ? "Restock persediaan gudang sarpras"
          : "Pengambilan operasional perkuliahan"),
    });

    if (!res.ok) {
      setMutationError(res.error || "Gagal mencatat mutasi stok.");
      return;
    }

    setMutationTarget(null);
  };

  const toggleColumnKey = (key: string) => {
    setHiddenColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const columns: DataTableColumn<Consumable>[] = [
    {
      key: "code_name",
      header: "Kode & Nama Barang Habis Pakai",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.code}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {row.category}
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Lokasi Simpan: {row.storage_location}
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stok Saat Ini vs Batas Minimum",
      render: (row) => {
        const isBelowMin = row.current_stock < row.min_stock;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-mono font-extrabold ${
                  isBelowMin
                    ? "text-red-700 dark:text-red-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {row.current_stock} {row.unit}
              </span>
              {isBelowMin ? (
                <Badge tone="danger">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Di Bawah Minimum</span>
                </Badge>
              ) : (
                <Badge tone="success">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Stok Aman</span>
                </Badge>
              )}
            </div>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Ambang Minimum: {row.min_stock} {row.unit}
            </p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Catat Mutasi Stok",
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => openMutationModal(row, "Masuk")}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Barang Masuk (Restock)</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openMutationModal(row, "Keluar")}
          >
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Barang Keluar</span>
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteError("");
              setDeletingConsumable(row);
            }}
            aria-label={`Hapus item BHP ${row.code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const selectedItemTransactions = selectedConsumable
    ? consumableTransactions.filter(
        (tx) => tx.consumable_id === selectedConsumable.id
      )
    : [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 06 • PERSEDIAAN OPERASIONAL & LOG MUTASI ATK
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Barang Habis Pakai (BHP) & ATK Kampus
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pemantauan stok operasional harian dengan indikator peringatan merah
            bila di bawah batas minimum. Klik baris item untuk membuka kartu
            riwayat mutasi.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={openAddConsumableModal}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Item BHP Baru</span>
        </Button>
      </section>

      {/* Toolbar Ringkas */}
      <section
        aria-label="Filter Barang Habis Pakai"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode BHP-, nama barang, atau rak..."
            aria-label="Cari barang habis pakai"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Persediaan BHP"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterCategory("ALL");
              setFilterStockStatus("ALL");
            }}
            groups={[
              {
                key: "category",
                label: "Kategori BHP",
                value: filterCategory,
                onChange: setFilterCategory,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...BHP_CATEGORIES.map((c) => ({ value: c, label: c })),
                ],
              },
              {
                key: "stock",
                label: "Kesehatan Stok",
                value: filterStockStatus,
                onChange: setFilterStockStatus,
                options: [
                  { value: "ALL", label: "Semua Status Stok" },
                  { value: "LOW", label: "Stok Kritis (Di Bawah Minimum)" },
                  { value: "SAFE", label: "Stok Aman" },
                ],
              },
            ]}
          />
        </div>

        <ColumnsTogglePopover
          columns={columns.map((c) => ({ key: c.key, label: c.header }))}
          hiddenKeys={hiddenColumnKeys}
          onToggleKey={toggleColumnKey}
        />
      </section>

      {/* Tabel Katalog Stok BHP */}
      <DataTable
        columns={columns}
        data={filteredConsumables}
        rowKey={(c) => c.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedConsumableId}
        onRowClick={(row) => setSelectedConsumableId(row.id)}
        emptyTitle="Tidak Ada Item BHP yang Ditemukan"
        emptyDescription="Belum ada barang habis pakai yang cocok dengan kriteria pencarian atau filter."
        emptyActionLabel="Tambah Item BHP Baru"
        onEmptyAction={() => setAddModalOpen(true)}
      />

      {/* Riwayat Log Mutasi Barang Masuk & Keluar */}
      <section className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Log Riwayat Mutasi Barang Masuk & Keluar
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Setiap pencatatan restock atau pengambilan oleh dosen/staf otomatis
            memperbarui saldo stok utama.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {consumableTransactions.map((tx) => {
            const item = consumables.find((c) => c.id === tx.consumable_id);
            const isIn = tx.transaction_type === "Masuk";
            return (
              <div
                key={tx.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isIn ? "success" : "warning"}>
                      <span>
                        {isIn
                          ? `MASUK (+${tx.quantity} ${item?.unit || ""})`
                          : `KELUAR (-${tx.quantity} ${item?.unit || ""})`}
                      </span>
                    </Badge>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item?.code || "-"}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {item?.name || "Item BHP"}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    Keterangan: {tx.purpose_notes}
                  </p>
                </div>
                <div className="sm:text-right text-slate-600 dark:text-slate-400 shrink-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {tx.actor_name} ({tx.actor_unit})
                  </p>
                  <p className="font-mono">
                    {tx.transaction_date.slice(0, 10)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Slide-Over Detail Drawer Item BHP */}
      <Drawer
        isOpen={Boolean(selectedConsumable)}
        onClose={() => setSelectedConsumableId(null)}
        title={selectedConsumable?.name || ""}
        subtitle={
          selectedConsumable
            ? `${selectedConsumable.code} • ${selectedConsumable.storage_location}`
            : undefined
        }
        headerBadge={
          selectedConsumable ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedConsumable.code}
              </span>
              {selectedConsumable.current_stock <
              selectedConsumable.min_stock ? (
                <Badge tone="danger">
                  <span>Di Bawah Minimum</span>
                </Badge>
              ) : (
                <Badge tone="success">
                  <span>Stok Aman</span>
                </Badge>
              )}
            </>
          ) : null
        }
        footer={
          selectedConsumable ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditConsumableModal(selectedConsumable)}
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
                    setDeletingConsumable(selectedConsumable);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Hapus</span>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openMutationModal(selectedConsumable, "Keluar")}
                >
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  <span>Keluar</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => openMutationModal(selectedConsumable, "Masuk")}
                >
                  <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Restock</span>
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedConsumable ? (
          <div className="space-y-5">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Saldo Persediaan Saat Ini
                </span>
                <span className="text-xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedConsumable.current_stock} {selectedConsumable.unit}
                </span>
              </div>
              <p className="font-mono text-slate-600 dark:text-slate-400">
                Batas Minimum: {selectedConsumable.min_stock}{" "}
                {selectedConsumable.unit} • Kategori:{" "}
                {selectedConsumable.category}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Riwayat Mutasi Item ({selectedItemTransactions.length})
              </h3>
              {selectedItemTransactions.length === 0 ? (
                <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada transaksi mutasi untuk barang ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {selectedItemTransactions.map((tx) => (
                    <li key={tx.id} className="p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          tone={
                            tx.transaction_type === "Masuk"
                              ? "success"
                              : "warning"
                          }
                        >
                          <span>
                            {tx.transaction_type === "Masuk" ? "+" : "-"}
                            {tx.quantity} {selectedConsumable.unit}
                          </span>
                        </Badge>
                        <span className="font-mono text-slate-500">
                          {tx.transaction_date.slice(0, 10)}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {tx.actor_name} ({tx.actor_unit})
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {tx.purpose_notes}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EntityDrawerSections
              entityType="consumable"
              entityId={selectedConsumable.id}
              baseEventDates={selectedItemTransactions.map(
                (t) => t.transaction_date
              )}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Tambah / Edit Item BHP */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={
          editingConsumable
            ? `Edit Item BHP ${editingConsumable.code}`
            : "Tambah Katalog Barang Habis Pakai (BHP)"
        }
        description="Tetapkan batas minimum stok agar sistem memberi peringatan saat stok menipis."
      >
        <form onSubmit={handleAddConsumable} className="space-y-4">
          {addError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {addError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Barang *"
              placeholder="Contoh: BHP-ATK-006"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Select
              label="Kategori *"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ConsumableCategory)
              }
              options={BHP_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <Input
            label="Nama Barang Habis Pakai *"
            placeholder="Contoh: Penghapus Whiteboard Magnetik"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Satuan *"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ConsumableUnit)}
              options={BHP_UNITS.map((u) => ({ value: u, label: u }))}
            />
            <Input
              label="Stok Awal *"
              type="number"
              min={0}
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              required
            />
            <Input
              label="Batas Minimum Stok *"
              type="number"
              min={1}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              required
            />
          </div>

          <Input
            label="Lokasi Rak / Penyimpanan"
            placeholder="Contoh: Lemari ATK A1 - Biro Sarpras"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Item BHP
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Catat Mutasi Masuk / Keluar */}
      <Modal
        isOpen={Boolean(mutationTarget)}
        onClose={() => setMutationTarget(null)}
        title={
          mutationTarget
            ? `Catat Mutasi ${txType}: ${mutationTarget.name}`
            : "Catat Mutasi BHP"
        }
        description={
          mutationTarget
            ? `Stok saat ini: ${mutationTarget.current_stock} ${mutationTarget.unit} (Batas minimum: ${mutationTarget.min_stock} ${mutationTarget.unit})`
            : undefined
        }
      >
        <form onSubmit={handleMutationSubmit} className="space-y-4">
          {mutationError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {mutationError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Jenis Mutasi *"
              value={txType}
              onChange={(e) => setTxType(e.target.value as TransactionType)}
              options={[
                { value: "Masuk", label: "Barang Masuk (Restock Gudang)" },
                {
                  value: "Keluar",
                  label: "Barang Keluar (Pengambilan Dosen/Staf)",
                },
              ]}
            />
            <Input
              label={`Jumlah (${mutationTarget?.unit || "Unit"}) *`}
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Petugas / Pengambil *"
              placeholder="Contoh: Hendra Wijaya, S.T."
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              required
            />
            <Input
              label="Unit Kerja / Gedung *"
              placeholder="Contoh: GKB Saintek Lt. 1"
              value={actorUnit}
              onChange={(e) => setActorUnit(e.target.value)}
              required
            />
          </div>

          <Input
            label="Keperluan / Catatan Mutasi"
            placeholder="Contoh: Distribusi spidol awal pekan untuk 10 ruang kelas"
            value={purposeNotes}
            onChange={(e) => setPurposeNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMutationTarget(null)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Mutasi Stok
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingConsumable)}
        onClose={() => {
          if (!deleting) {
            setDeletingConsumable(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Item BHP / ATK"
        targetBadge={deletingConsumable?.code}
        targetName={deletingConsumable?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingConsumable
            ? [
                `Saldo saat ini: ${deletingConsumable.current_stock} ${deletingConsumable.unit} di ${deletingConsumable.storage_location}.`,
                `PERINGATAN AUDIT: Seluruh riwayat mutasi masuk/keluar (${
                  consumableTransactions.filter(
                    (t) => t.consumable_id === deletingConsumable.id
                  ).length
                } transaksi) untuk item ini akan ikut terhapus permanen.`,
                `Catatan & lampiran terkait (${
                  notes.filter(
                    (n) =>
                      n.entity_type === "consumable" &&
                      n.entity_id === deletingConsumable.id
                  ).length
                } catatan, ${
                  attachments.filter(
                    (a) =>
                      a.entity_type === "consumable" &&
                      a.entity_id === deletingConsumable.id
                  ).length
                } file) ikut dibersihkan.`,
              ]
            : []
        }
        onConfirm={async () => {
          if (!deletingConsumable) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteConsumable(deletingConsumable.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus item BHP.");
            return;
          }
          if (selectedConsumableId === deletingConsumable.id) {
            setSelectedConsumableId(null);
          }
          setDeletingConsumable(null);
        }}
      />
    </div>
  );
}
