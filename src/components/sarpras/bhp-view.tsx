"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Plus,
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
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
    uiSimState,
    setUiSimState,
    addConsumable,
    recordConsumableMutation,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStockStatus, setFilterStockStatus] = useState("ALL");

  // Modal Tambah Item BHP Baru
  const [addModalOpen, setAddModalOpen] = useState(false);
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

  // Modal Catat Mutasi Masuk (Restock) / Keluar (Pengambilan)
  const [mutationTarget, setMutationTarget] = useState<Consumable | null>(null);
  const [txType, setTxType] = useState<TransactionType>("Masuk");
  const [quantity, setQuantity] = useState("5");
  const [actorName, setActorName] = useState("");
  const [actorUnit, setActorUnit] = useState("");
  const [purposeNotes, setPurposeNotes] = useState("");
  const [mutationError, setMutationError] = useState("");

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

  const handleAddConsumable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setAddError("Kode Barang dan Nama Barang wajib diisi.");
      return;
    }
    addConsumable({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      unit,
      current_stock: Math.max(0, Number(currentStock) || 0),
      min_stock: Math.max(0, Number(minStock) || 0),
      storage_location: storageLocation.trim() || "Gudang Utama Sarpras",
    });
    setCode("");
    setName("");
    setAddError("");
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
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
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
            otomatis apabila stok berada di bawah batas minimum (
            <em>Minimum Threshold</em>).
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setAddError("");
            setAddModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Item BHP Baru</span>
        </Button>
      </section>

      {/* Bar Pencarian & Filter */}
      <section
        aria-label="Filter Barang Habis Pakai"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <Input
          label="Cari Kode / Nama Barang / Rak"
          placeholder="Contoh: Spidol, HVS, atau BHP-ATK..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          label="Filter Kategori BHP"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Kategori BHP" },
            ...BHP_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="Filter Kesehatan Stok"
          value={filterStockStatus}
          onChange={(e) => setFilterStockStatus(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Status Stok" },
            { value: "LOW", label: "Stok Kritis (Di Bawah Minimum)" },
            { value: "SAFE", label: "Stok Aman" },
          ]}
        />
      </section>

      {/* Tabel Katalog Stok BHP */}
      <DataTable
        columns={columns}
        data={filteredConsumables}
        rowKey={(c) => c.id}
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

      {/* Modal Tambah Item BHP Baru */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Tambah Katalog Barang Habis Pakai (BHP)"
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
    </div>
  );
}
