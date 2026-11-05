"use client";

import React, { useMemo, useState } from "react";
import {
  Edit3,
  Package,
  Plus,
  Printer,
  QrCode,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  Asset,
  AssetCategoryCode,
  AssetCondition,
} from "@/types/sarpras";
import {
  ASSET_CATEGORY_LABELS,
  formatCurrencyIDR,
} from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import { AssetConditionBadge } from "@/components/sarpras/status-badges";

const CATEGORY_CODES: AssetCategoryCode[] = [
  "ELK",
  "KOM",
  "KLM",
  "AUD",
  "MBL",
  "LNY",
];

const ASSET_CONDITIONS: AssetCondition[] = [
  "Baik",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
];

/**
 * Menghasilkan matriks deterministik 9x9 dari string kode inventaris untuk representasi visual QR label aset.
 */
function buildDeterministicMatrix(code: string): boolean[][] {
  const size = 9;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Finder corners
      const isCorner =
        (r < 3 && c < 3) ||
        (r < 3 && c >= size - 3) ||
        (r >= size - 3 && c < 3);
      if (isCorner) {
        grid[r][c] = !(r === 1 && c === 1) && !(r === 1 && c === size - 2) && !(r === size - 2 && c === 1);
      } else {
        const charIndex = (r * size + c) % code.length;
        const charCode = code.charCodeAt(charIndex);
        grid[r][c] = (charCode + r * 3 + c * 7) % 2 === 0;
      }
    }
  }
  return grid;
}

export function InventarisView() {
  const {
    rooms,
    assets,
    uiSimState,
    setUiSimState,
    addAsset,
    updateAsset,
    deleteAsset,
    previewNextInventoryCode,
    notify,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRoom, setFilterRoom] = useState("ALL");
  const [filterCondition, setFilterCondition] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");

  // Modal Tambah/Edit Aset
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [category, setCategory] = useState<AssetCategoryCode>("ELK");
  const [roomId, setRoomId] = useState<string>("");
  const [procurementYear, setProcurementYear] = useState("2026");
  const [fundingSource, setFundingSource] = useState("Dana Operasional Kampus");
  const [acquisitionCost, setAcquisitionCost] = useState("5000000");
  const [condition, setCondition] = useState<AssetCondition>("Baik");
  const [isPortable, setIsPortable] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Modal Cetak Label / QR Code Inventaris
  const [qrLabelAsset, setQrLabelAsset] = useState<Asset | null>(null);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        a.inventory_code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.brand_model.toLowerCase().includes(q) ||
        a.serial_number.toLowerCase().includes(q);
      const matchRoom =
        filterRoom === "ALL" ||
        (filterRoom === "UNASSIGNED" ? !a.room_id : a.room_id === filterRoom);
      const matchCond =
        filterCondition === "ALL" || a.condition === filterCondition;
      const matchCat =
        filterCategory === "ALL" || a.category === filterCategory;
      return matchSearch && matchRoom && matchCond && matchCat;
    });
  }, [assets, searchQuery, filterRoom, filterCondition, filterCategory]);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat katalog inventaris aset dan barang kampus..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Katalog Inventaris Aset"
        description="Sistem gagal mengambil data registrasi inventaris. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingAsset(null);
    setName("");
    setBrandModel("");
    setCategory("ELK");
    setRoomId(rooms[0]?.id || "");
    setProcurementYear("2026");
    setFundingSource("Dana Operasional Kampus");
    setAcquisitionCost("5000000");
    setCondition("Baik");
    setIsPortable(false);
    setSerialNumber("");
    setNotes("");
    setFormError("");
    setAssetModalOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setBrandModel(asset.brand_model);
    setCategory(asset.category);
    setRoomId(asset.room_id || "");
    setProcurementYear(String(asset.procurement_year));
    setFundingSource(asset.funding_source);
    setAcquisitionCost(String(asset.acquisition_cost));
    setCondition(asset.condition);
    setIsPortable(asset.is_portable);
    setSerialNumber(asset.serial_number);
    setNotes(asset.notes || "");
    setFormError("");
    setAssetModalOpen(true);
  };

  const handleAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brandModel.trim() || !fundingSource.trim()) {
      setFormError("Nama Barang, Merk/Tipe, dan Sumber Dana wajib diisi.");
      return;
    }

    const yearNum = Number(procurementYear) || 2026;
    const costNum = Math.max(0, Number(acquisitionCost) || 0);

    if (editingAsset) {
      updateAsset(editingAsset.id, {
        name: name.trim(),
        brand_model: brandModel.trim(),
        category,
        room_id: roomId || null,
        procurement_year: yearNum,
        funding_source: fundingSource.trim(),
        acquisition_cost: costNum,
        condition,
        is_portable: isPortable,
        serial_number: serialNumber.trim() || "-",
        notes: notes.trim(),
      });
    } else {
      addAsset({
        name: name.trim(),
        brand_model: brandModel.trim(),
        category,
        room_id: roomId || null,
        procurement_year: yearNum,
        funding_source: fundingSource.trim(),
        acquisition_cost: costNum,
        condition,
        is_portable: isPortable,
        serial_number: serialNumber.trim() || "-",
        notes: notes.trim(),
      });
    }

    setAssetModalOpen(false);
  };

  const previewCode = editingAsset
    ? editingAsset.inventory_code
    : previewNextInventoryCode(category, Number(procurementYear) || 2026);

  const columns: DataTableColumn<Asset>[] = [
    {
      key: "inventory_code",
      header: "Kode Inventaris & Barang",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.inventory_code}
            </span>
            {row.is_portable ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border border-sky-600/40">
                Portabel / Bisa Dipinjam
              </span>
            ) : null}
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.brand_model} • SN:{" "}
            <span className="font-mono">{row.serial_number}</span>
          </p>
        </div>
      ),
    },
    {
      key: "category_room",
      header: "Kategori & Lokasi Ruang",
      render: (row) => {
        const room = rooms.find((r) => r.id === row.room_id);
        return (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {row.category_label} ({row.category})
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              Lokasi:{" "}
              <strong className="font-mono">
                {room ? `${room.code} (${room.name})` : "Gudang Cadangan"}
              </strong>
            </p>
          </div>
        );
      },
    },
    {
      key: "procurement",
      header: "Pengadaan & Nilai",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {formatCurrencyIDR(row.acquisition_cost)}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Tahun {row.procurement_year} • {row.funding_source}
          </p>
        </div>
      ),
    },
    {
      key: "condition",
      header: "Kondisi Fisik",
      render: (row) => <AssetConditionBadge condition={row.condition} />,
    },
    {
      key: "actions",
      header: "Label QR & Aksi",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQrLabelAsset(row)}
            aria-label={`Buat label QR untuk ${row.inventory_code}`}
          >
            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Label QR</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditModal(row)}
            aria-label={`Edit aset ${row.inventory_code}`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => deleteAsset(row.id)}
            aria-label={`Hapus aset ${row.inventory_code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 03 • REGISTRASI & AUDIT BARANG KAMPUS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Inventaris Aset & Barang
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Penomoran inventaris otomatis (
            <code className="font-mono font-bold">
              INV-[KATEGORI]-[TAHUN]-[URUT]
            </code>
            ), pelacakan kondisi fisik, dan pencetakan stiker QR aset.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Registrasi Aset Baru</span>
        </Button>
      </section>

      {/* Bar Pencarian & Filter */}
      <section
        aria-label="Filter Inventaris"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <Input
          label="Cari Kode / Nama / Merk / Serial"
          placeholder="Ketik INV-ELK atau Proyektor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          label="Filter Lokasi Ruangan"
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Lokasi Ruangan" },
            ...rooms.map((r) => ({
              value: r.id,
              label: `${r.code} - ${r.name}`,
            })),
            { value: "UNASSIGNED", label: "Gudang / Belum Ditempatkan" },
          ]}
        />
        <Select
          label="Filter Kondisi Fisik"
          value={filterCondition}
          onChange={(e) => setFilterCondition(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Kondisi" },
            ...ASSET_CONDITIONS.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="Filter Kategori Aset"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Kategori" },
            ...CATEGORY_CODES.map((code) => ({
              value: code,
              label: `${code} - ${ASSET_CATEGORY_LABELS[code]}`,
            })),
          ]}
        />
      </section>

      {/* Tabel Data Inventaris */}
      <DataTable
        columns={columns}
        data={filteredAssets}
        rowKey={(a) => a.id}
        emptyTitle="Tidak Ada Aset yang Ditemukan"
        emptyDescription="Belum ada barang inventaris yang sesuai dengan filter ruangan atau kondisi yang dipilih."
        emptyActionLabel="Registrasi Aset Baru"
        onEmptyAction={openAddModal}
      />

      {/* Modal Tambah / Edit Aset */}
      <Modal
        isOpen={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title={
          editingAsset
            ? `Edit Aset ${editingAsset.inventory_code}`
            : "Registrasi Aset Inventaris Baru"
        }
        description="Kode inventaris dibuat otomatis mengikuti kategori dan tahun pengadaan."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleAssetSubmit} className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {formError}
            </div>
          ) : null}

          <div className="p-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Kode Inventaris Unik (Auto-Generated):
            </span>
            <span className="px-2.5 py-1 text-sm font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {previewCode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kategori Inventaris *"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AssetCategoryCode)
              }
              options={CATEGORY_CODES.map((c) => ({
                value: c,
                label: `${c} - ${ASSET_CATEGORY_LABELS[c]}`,
              }))}
            />
            <Select
              label="Lokasi Penempatan Ruangan *"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              options={[
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                })),
                { value: "", label: "Gudang Cadangan Sarpras" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Barang / Aset *"
              placeholder="Contoh: Proyektor Laser WUXGA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Merk / Tipe / Model *"
              placeholder="Contoh: Epson EB-L530U"
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Tahun Pengadaan *"
              type="number"
              min={1995}
              max={2035}
              value={procurementYear}
              onChange={(e) => setProcurementYear(e.target.value)}
              required
            />
            <Input
              label="Harga Perolehan (Rp) *"
              type="number"
              min={0}
              step={50000}
              value={acquisitionCost}
              onChange={(e) => setAcquisitionCost(e.target.value)}
              required
            />
            <Select
              label="Kondisi Barang *"
              value={condition}
              onChange={(e) => setCondition(e.target.value as AssetCondition)}
              options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Sumber Dana Pengadaan *"
              placeholder="Contoh: Hibah Kemendikbudristek / Dana Kampus"
              value={fundingSource}
              onChange={(e) => setFundingSource(e.target.value)}
              required
            />
            <Input
              label="Nomor Seri Pabrik (Serial Number)"
              placeholder="Contoh: EPS-L530-9921"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              id="chk-portable"
              type="checkbox"
              checked={isPortable}
              onChange={(e) => setIsPortable(e.target.checked)}
              className="w-5 h-5 rounded border-slate-400 text-[#1E3A5F] focus:ring-[#1E3A5F]"
            />
            <label
              htmlFor="chk-portable"
              className="text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Aset portabel (dapat dipinjam lintas ruangan pada menu Peminjaman)
            </label>
          </div>

          <Input
            label="Catatan Teknis / Posisi Penempatan"
            placeholder="Contoh: Terpasang pada bracket plafon baris depan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssetModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingAsset ? "Simpan Perubahan" : "Daftarkan Aset"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Generate Label Inventaris / QR Code Siap Cetak */}
      <Modal
        isOpen={Boolean(qrLabelAsset)}
        onClose={() => setQrLabelAsset(null)}
        title="Label Stiker Inventaris & QR Code Aset"
        description="Stiker standar inventaris barang milik kampus untuk ditempel pada unit fisik."
      >
        {qrLabelAsset ? (
          <div className="space-y-4">
            <div className="p-5 rounded-lg border-2 border-slate-900 dark:border-slate-200 bg-white text-slate-950 flex flex-col sm:flex-row items-center gap-5">
              {/* SVG QR Matrix */}
              <div className="p-2 border border-slate-900 rounded bg-white shrink-0">
                <svg
                  width="108"
                  height="108"
                  viewBox="0 0 9 9"
                  aria-label={`QR Code untuk ${qrLabelAsset.inventory_code}`}
                  role="img"
                >
                  {buildDeterministicMatrix(qrLabelAsset.inventory_code).map(
                    (row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#0F172A"
                          />
                        ) : null
                      )
                  )}
                </svg>
              </div>

              <div className="space-y-1 text-left flex-1">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                  INVENTARIS BIRO SARPRAS • STAFCENTER
                </p>
                <p className="text-lg font-mono font-extrabold text-slate-950">
                  {qrLabelAsset.inventory_code}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {qrLabelAsset.name}
                </p>
                <p className="text-xs text-slate-700">
                  Merk/Tipe: {qrLabelAsset.brand_model}
                </p>
                <p className="text-xs font-mono text-slate-800">
                  Ruang:{" "}
                  {rooms.find((r) => r.id === qrLabelAsset.room_id)?.code ||
                    "GUDANG"}{" "}
                  • Tahun: {qrLabelAsset.procurement_year}
                </p>
                <p className="text-[11px] text-slate-600">
                  Sumber: {qrLabelAsset.funding_source}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQrLabelAsset(null)}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  notify(
                    "info",
                    "Siap Dicetak",
                    `Membuka dialog cetak untuk label ${qrLabelAsset.inventory_code}.`
                  );
                  if (typeof window !== "undefined") {
                    window.print();
                  }
                }}
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Cetak Label QR</span>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
