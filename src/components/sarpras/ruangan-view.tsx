"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  DoorOpen,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { Room, RoomCategory, RoomStatus } from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ErrorStateView,
  LoadingStateView,
} from "@/components/ui/data-states";
import {
  AssetConditionBadge,
  RoomStatusBadge,
} from "@/components/sarpras/status-badges";
import { formatCurrencyIDR } from "@/lib/supabase/client";

const ROOM_CATEGORIES: RoomCategory[] = [
  "Ruang Kelas",
  "Laboratorium",
  "Aula",
  "Ruang Staf/Dosen",
];

const ROOM_STATUSES: RoomStatus[] = ["Tersedia", "Digunakan", "Perbaikan"];

export function RuanganView() {
  const {
    buildings,
    rooms,
    assets,
    uiSimState,
    setUiSimState,
    addBuilding,
    addRoom,
    updateRoom,
    deleteRoom,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modal Tambah/Edit Ruangan
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formError, setFormError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [floor, setFloor] = useState("1");
  const [category, setCategory] = useState<RoomCategory>("Ruang Kelas");
  const [capacity, setCapacity] = useState("40");
  const [picName, setPicName] = useState("");
  const [picContact, setPicContact] = useState("");
  const [status, setStatus] = useState<RoomStatus>("Tersedia");
  const [facilitiesNotes, setFacilitiesNotes] = useState("");

  // Modal Tambah Gedung
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [bldCode, setBldCode] = useState("");
  const [bldName, setBldName] = useState("");
  const [bldFloors, setBldFloors] = useState("3");
  const [bldZone, setBldZone] = useState("Zona Utama");
  const [bldDesc, setBldDesc] = useState("");
  const [bldError, setBldError] = useState("");

  // Modal Detail Ruangan & Daftar Aset di Dalamnya
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<Room | null>(
    null
  );

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.pic_name.toLowerCase().includes(q);
      const matchBld =
        filterBuilding === "ALL" || r.building_id === filterBuilding;
      const matchCat =
        filterCategory === "ALL" || r.category === filterCategory;
      const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
      return matchSearch && matchBld && matchCat && matchStatus;
    });
  }, [rooms, searchQuery, filterBuilding, filterCategory, filterStatus]);

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat daftar gedung dan ruangan kampus..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Gedung & Ruangan"
        description="Terjadi kendala saat mengambil daftar ruangan. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddRoomModal = () => {
    setEditingRoom(null);
    setCode("");
    setName("");
    setBuildingId(buildings[0]?.id || "");
    setFloor("1");
    setCategory("Ruang Kelas");
    setCapacity("40");
    setPicName("");
    setPicContact("");
    setStatus("Tersedia");
    setFacilitiesNotes("");
    setFormError("");
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (room: Room) => {
    setEditingRoom(room);
    setCode(room.code);
    setName(room.name);
    setBuildingId(room.building_id);
    setFloor(String(room.floor));
    setCategory(room.category);
    setCapacity(String(room.capacity));
    setPicName(room.pic_name);
    setPicContact(room.pic_contact);
    setStatus(room.status);
    setFacilitiesNotes(room.facilities_notes);
    setFormError("");
    setRoomModalOpen(true);
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !buildingId || !picName.trim()) {
      setFormError(
        "Kode Ruang, Nama Ruang, Gedung, dan Nama Penanggung Jawab (PIC) wajib diisi."
      );
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      building_id: buildingId,
      floor: Math.max(1, Number(floor) || 1),
      category,
      capacity: Math.max(1, Number(capacity) || 1),
      pic_name: picName.trim(),
      pic_contact: picContact.trim() || "-",
      status,
      facilities_notes: facilitiesNotes.trim(),
    };

    if (editingRoom) {
      updateRoom(editingRoom.id, payload);
    } else {
      addRoom(payload);
    }
    setRoomModalOpen(false);
  };

  const handleBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldCode.trim() || !bldName.trim()) {
      setBldError("Kode Gedung dan Nama Gedung wajib diisi.");
      return;
    }
    addBuilding({
      code: bldCode.trim().toUpperCase(),
      name: bldName.trim(),
      floors_count: Math.max(1, Number(bldFloors) || 1),
      zone: bldZone.trim() || "Kampus Utama",
      description: bldDesc.trim(),
    });
    setBldCode("");
    setBldName("");
    setBldDesc("");
    setBldError("");
    setBuildingModalOpen(false);
  };

  const columns: DataTableColumn<Room>[] = [
    {
      key: "code",
      header: "Kode & Nama Ruangan",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.code}
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {row.name}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.facilities_notes || "Belum ada catatan spesifikasi fasilitas"}
          </p>
        </div>
      ),
    },
    {
      key: "building",
      header: "Gedung & Lantai",
      render: (row) => {
        const bld = buildings.find((b) => b.id === row.building_id);
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {bld?.name || "-"}
            </p>
            <p className="font-mono text-slate-600 dark:text-slate-400">
              {bld?.code || "-"} • Lantai {row.floor}
            </p>
          </div>
        );
      },
    },
    {
      key: "category_capacity",
      header: "Kategori & Kapasitas",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.category}
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            Maks. {row.capacity} orang
          </p>
        </div>
      ),
    },
    {
      key: "pic",
      header: "Penanggung Jawab (PIC)",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.pic_name}
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            {row.pic_contact}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status & Aset",
      render: (row) => {
        const count = assets.filter((a) => a.room_id === row.id).length;
        return (
          <div className="space-y-1">
            <RoomStatusBadge status={row.status} />
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
              {count} unit inventaris
            </p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Tindakan",
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedRoomDetail(row)}
            aria-label={`Lihat aset di ruang ${row.code}`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Aset</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditRoomModal(row)}
            aria-label={`Edit ruang ${row.code}`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => deleteRoom(row.id)}
            aria-label={`Hapus ruang ${row.code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const detailRoomAssets = selectedRoomDetail
    ? assets.filter((a) => a.room_id === selectedRoomDetail.id)
    : [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            SUB-MODUL 02 • INFRASTRUKTUR GEDUNG & RUANG
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Master Gedung & Ruangan Kampus
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola data gedung, atribut ruangan, penanggung jawab (PIC), serta
            klik baris ruangan untuk menginspeksi daftar aset di dalamnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setBuildingModalOpen(true)}
          >
            <Building2 className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Gedung</span>
          </Button>
          <Button type="button" variant="primary" onClick={openAddRoomModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Ruangan</span>
          </Button>
        </div>
      </section>

      {/* Ringkasan Gedung */}
      <section
        aria-label="Daftar Gedung Kampus"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {buildings.map((bld) => {
          const roomCount = rooms.filter((r) => r.building_id === bld.id).length;
          return (
            <div
              key={bld.id}
              className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {bld.code}
                  </span>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {bld.zone} • {bld.floors_count} Lantai
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {bld.name}
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {bld.description}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {roomCount} Ruangan Terdaftar
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFilterBuilding((prev) =>
                      prev === bld.id ? "ALL" : bld.id
                    )
                  }
                  className="font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-1 py-0.5"
                >
                  {filterBuilding === bld.id
                    ? "Tampilkan Semua"
                    : "Filter Gedung Ini"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bar Pencarian & Filter */}
      <section
        aria-label="Filter dan Pencarian Ruangan"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="relative">
          <Input
            label="Cari Kode / Nama Ruang / PIC"
            placeholder="Contoh: 1-SM6 atau LAB-KOM1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          label="Filter Gedung"
          value={filterBuilding}
          onChange={(e) => setFilterBuilding(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Gedung Kampus" },
            ...buildings.map((b) => ({
              value: b.id,
              label: `${b.code} - ${b.name}`,
            })),
          ]}
        />
        <Select
          label="Filter Kategori Ruang"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Kategori" },
            ...ROOM_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="Filter Status Ketersediaan"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Status" },
            ...ROOM_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
      </section>

      {/* Tabel Data Ruangan */}
      <DataTable
        columns={columns}
        data={filteredRooms}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelectedRoomDetail(r)}
        emptyTitle="Tidak Ada Ruangan yang Sesuai Kriteria"
        emptyDescription="Belum ada ruangan yang cocok dengan kata kunci atau filter yang dipilih. Ubah filter atau tambahkan ruangan baru."
        emptyActionLabel="Tambah Ruangan Baru"
        onEmptyAction={openAddRoomModal}
      />

      {/* Modal Detail Ruangan & Aset di Dalamnya */}
      <Modal
        isOpen={Boolean(selectedRoomDetail)}
        onClose={() => setSelectedRoomDetail(null)}
        title={
          selectedRoomDetail
            ? `Detail Ruang ${selectedRoomDetail.code}: ${selectedRoomDetail.name}`
            : "Detail Ruangan"
        }
        description="Daftar seluruh aset dan inventaris yang ditempatkan di dalam ruangan ini."
        maxWidthClass="max-w-2xl"
      >
        {selectedRoomDetail ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-md bg-slate-100 dark:bg-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-600 dark:text-slate-400 block">
                  Kategori
                </span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {selectedRoomDetail.category}
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400 block">
                  Lantai / Kapasitas
                </span>
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  Lt. {selectedRoomDetail.floor} / {selectedRoomDetail.capacity}{" "}
                  Kursi
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400 block">
                  Penanggung Jawab
                </span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {selectedRoomDetail.pic_name}
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400 block">
                  Status Saat Ini
                </span>
                <div className="mt-0.5">
                  <RoomStatusBadge status={selectedRoomDetail.status} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Inventaris Terpasang di Ruang {selectedRoomDetail.code} (
                {detailRoomAssets.length} Unit)
              </h3>
              {detailRoomAssets.length === 0 ? (
                <p className="p-4 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada aset yang ditempatkan di ruangan ini. Tambahkan aset
                  melalui menu Inventaris Aset & Barang.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {detailRoomAssets.map((ast) => (
                    <li
                      key={ast.id}
                      className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                            {ast.inventory_code}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {ast.name}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">
                          {ast.brand_model} • Pengadaan {ast.procurement_year} •{" "}
                          {formatCurrencyIDR(ast.acquisition_cost)}
                        </p>
                      </div>
                      <AssetConditionBadge condition={ast.condition} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedRoomDetail(null)}
              >
                Tutup Detail
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal Form Tambah / Edit Ruangan */}
      <Modal
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title={
          editingRoom
            ? `Edit Ruangan ${editingRoom.code}`
            : "Tambah Ruangan Kampus Baru"
        }
        description="Lengkapi atribut ruangan sesuai standar penomoran sarana prasarana kampus."
      >
        <form onSubmit={handleRoomSubmit} className="space-y-4">
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
              label="Kode Ruang *"
              placeholder="Contoh: 1-SM6 atau LAB-KOM2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Select
              label="Gedung *"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              options={buildings.map((b) => ({
                value: b.id,
                label: `${b.code} - ${b.name}`,
              }))}
            />
          </div>

          <Input
            label="Nama Lengkap Ruangan *"
            placeholder="Contoh: Ruang Kelas Reguler 1-SM6"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Kategori Ruang *"
              value={category}
              onChange={(e) => setCategory(e.target.value as RoomCategory)}
              options={ROOM_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <Input
              label="Lantai *"
              type="number"
              min={1}
              max={25}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              required
            />
            <Input
              label="Kapasitas Maksimal *"
              type="number"
              min={1}
              max={2000}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Penanggung Jawab (PIC) *"
              placeholder="Nama lengkap staf/koordinator ruang"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              required
            />
            <Input
              label="Nomor Kontak PIC"
              placeholder="Contoh: 0812-3400-xxxx"
              value={picContact}
              onChange={(e) => setPicContact(e.target.value)}
            />
          </div>

          <Select
            label="Status Operasional Ruangan *"
            value={status}
            onChange={(e) => setStatus(e.target.value as RoomStatus)}
            options={ROOM_STATUSES.map((s) => ({ value: s, label: s }))}
          />

          <Input
            label="Catatan Spesifikasi Fasilitas Ruang"
            placeholder="Contoh: Proyektor Laser, 2 Unit AC Split, Papan Tulis Kaca"
            value={facilitiesNotes}
            onChange={(e) => setFacilitiesNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoomModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingRoom ? "Simpan Perubahan" : "Simpan Ruangan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah Gedung Baru */}
      <Modal
        isOpen={buildingModalOpen}
        onClose={() => setBuildingModalOpen(false)}
        title="Tambah Gedung Kampus Baru"
        description="Daftarkan gedung baru sebagai induk penempatan ruangan."
      >
        <form onSubmit={handleBuildingSubmit} className="space-y-4">
          {bldError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {bldError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Gedung *"
              placeholder="Contoh: GD-TEKNIK"
              value={bldCode}
              onChange={(e) => setBldCode(e.target.value)}
              required
            />
            <Input
              label="Jumlah Lantai *"
              type="number"
              min={1}
              max={30}
              value={bldFloors}
              onChange={(e) => setBldFloors(e.target.value)}
              required
            />
          </div>

          <Input
            label="Nama Gedung *"
            placeholder="Contoh: Gedung Laboratorium Teknik Terpadu"
            value={bldName}
            onChange={(e) => setBldName(e.target.value)}
            required
          />

          <Input
            label="Zona Lokasi Kampus"
            placeholder="Contoh: Zona Timur Kampus"
            value={bldZone}
            onChange={(e) => setBldZone(e.target.value)}
          />

          <Input
            label="Keterangan Fungsi Gedung"
            placeholder="Deskripsi singkat peruntukan gedung..."
            value={bldDesc}
            onChange={(e) => setBldDesc(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBuildingModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Gedung
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
