"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Edit3,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  Building,
  DeleteStrategyMode,
  Room,
  RoomCategory,
  RoomStatus,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import {
  AssetConditionBadge,
  BookingStatusBadge,
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
    bookings,
    maintenanceLogs,
    notes,
    attachments,
    uiSimState,
    setUiSimState,
    addBuilding,
    updateBuilding,
    deleteBuilding,
    addRoom,
    updateRoom,
    deleteRoom,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

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

  // Modal Tambah/Edit Gedung
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [bldCode, setBldCode] = useState("");
  const [bldName, setBldName] = useState("");
  const [bldFloors, setBldFloors] = useState("3");
  const [bldZone, setBldZone] = useState("Zona Utama");
  const [bldDesc, setBldDesc] = useState("");
  const [bldError, setBldError] = useState("");

  // Modal Konfirmasi Hapus Ruangan & Gedung
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<Building | null>(
    null
  );
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Slide-Over Detail Drawer Ruangan
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"assets" | "bookings" | "notes">(
    "assets"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && rooms.some((r) => r.id === inspect)) {
      setSelectedRoomId(inspect);
    }
  }, [rooms]);

  const selectedRoomDetail = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
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

  const activeFilterCount =
    (filterBuilding !== "ALL" ? 1 : 0) +
    (filterCategory !== "ALL" ? 1 : 0) +
    (filterStatus !== "ALL" ? 1 : 0);

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

  const openAddBuildingModal = () => {
    setEditingBuilding(null);
    setBldCode("");
    setBldName("");
    setBldFloors("3");
    setBldZone("Zona Utama");
    setBldDesc("");
    setBldError("");
    setBuildingModalOpen(true);
  };

  const openEditBuildingModal = (bld: Building) => {
    setEditingBuilding(bld);
    setBldCode(bld.code);
    setBldName(bld.name);
    setBldFloors(String(bld.floors_count));
    setBldZone(bld.zone);
    setBldDesc(bld.description || "");
    setBldError("");
    setBuildingModalOpen(true);
  };

  const handleBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldCode.trim() || !bldName.trim()) {
      setBldError("Kode Gedung dan Nama Gedung wajib diisi.");
      return;
    }
    const payload = {
      code: bldCode.trim().toUpperCase(),
      name: bldName.trim(),
      floors_count: Math.max(1, Number(bldFloors) || 1),
      zone: bldZone.trim() || "Kampus Utama",
      description: bldDesc.trim(),
    };
    if (editingBuilding) {
      updateBuilding(editingBuilding.id, payload);
    } else {
      addBuilding(payload);
    }
    setBldCode("");
    setBldName("");
    setBldDesc("");
    setBldError("");
    setEditingBuilding(null);
    setBuildingModalOpen(false);
  };

  const toggleColumnKey = (key: string) => {
    setHiddenColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
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
            onClick={() => {
              setDrawerTab("assets");
              setSelectedRoomId(row.id);
            }}
            aria-label={`Lihat aset di ruang ${row.code}`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Inspeksi</span>
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
            onClick={() => {
              setDeleteError("");
              setDeletingRoom(row);
            }}
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
  const detailRoomBookings = selectedRoomDetail
    ? bookings.filter((b) => b.room_id === selectedRoomDetail.id)
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
            Kelola data gedung, atribut ruangan, PIC, serta klik baris ruangan
            untuk menginspeksi aset, jadwal, dan catatan ruang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={openAddBuildingModal}
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
              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {roomCount} Ruangan Terdaftar
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setFilterBuilding((prev) =>
                        prev === bld.id ? "ALL" : bld.id
                      )
                    }
                    className="min-h-[44px] font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded px-2 py-1"
                  >
                    {filterBuilding === bld.id
                      ? "Tampilkan Semua"
                      : "Filter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditBuildingModal(bld)}
                    aria-label={`Edit gedung ${bld.code}`}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setDeletingBuilding(bld);
                    }}
                    aria-label={`Hapus gedung ${bld.code}`}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Toolbar Ringkas: Cari + Filter Popover + Kolom */}
      <section
        aria-label="Filter dan Pencarian Ruangan"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode ruang (1-SM6), nama ruang, atau PIC..."
            aria-label="Cari ruangan kampus"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Gedung & Ruangan"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterBuilding("ALL");
              setFilterCategory("ALL");
              setFilterStatus("ALL");
            }}
            groups={[
              {
                key: "building",
                label: "Gedung",
                value: filterBuilding,
                onChange: setFilterBuilding,
                options: [
                  { value: "ALL", label: "Semua Gedung" },
                  ...buildings.map((b) => ({
                    value: b.id,
                    label: `${b.code} - ${b.name}`,
                  })),
                ],
              },
              {
                key: "category",
                label: "Kategori Ruang",
                value: filterCategory,
                onChange: setFilterCategory,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...ROOM_CATEGORIES.map((c) => ({ value: c, label: c })),
                ],
              },
              {
                key: "status",
                label: "Status Operasional",
                value: filterStatus,
                onChange: setFilterStatus,
                options: [
                  { value: "ALL", label: "Semua Status" },
                  ...ROOM_STATUSES.map((s) => ({ value: s, label: s })),
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

      {/* Tabel Data Ruangan */}
      <DataTable
        columns={columns}
        data={filteredRooms}
        rowKey={(r) => r.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedRoomId}
        onRowClick={(row) => {
          setDrawerTab("assets");
          setSelectedRoomId(row.id);
        }}
        emptyTitle="Tidak Ada Ruangan yang Ditemukan"
        emptyDescription="Belum ada data ruangan yang cocok dengan kata kunci atau filter yang dipilih."
        emptyActionLabel="Tambah Ruangan Baru"
        onEmptyAction={openAddRoomModal}
      />

      {/* Slide-Over Detail Drawer Ruangan */}
      <Drawer
        isOpen={Boolean(selectedRoomDetail)}
        onClose={() => setSelectedRoomId(null)}
        title={selectedRoomDetail ? selectedRoomDetail.name : ""}
        subtitle={
          selectedRoomDetail
            ? `Kode: ${selectedRoomDetail.code} • PIC: ${selectedRoomDetail.pic_name} (${selectedRoomDetail.pic_contact})`
            : undefined
        }
        headerBadge={
          selectedRoomDetail ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                {selectedRoomDetail.code}
              </span>
              <RoomStatusBadge status={selectedRoomDetail.status} />
            </>
          ) : null
        }
        footer={
          selectedRoomDetail ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRoomId(null)}
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeleteError("");
                    setDeletingRoom(selectedRoomDetail);
                  }}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus</span>
                </Button>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditRoomModal(selectedRoomDetail)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Atribut Ruang</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedRoomDetail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
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
                  Kapasitas
                </span>
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {selectedRoomDetail.capacity} orang
                </strong>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400 block">
                  Lantai
                </span>
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  Lantai {selectedRoomDetail.floor}
                </strong>
              </div>
            </div>

            {/* Tab Internal Drawer */}
            <div
              role="tablist"
              aria-label="Detail inspeksi ruangan"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === "assets"}
                onClick={() => setDrawerTab("assets")}
                className={`min-h-[44px] rounded text-xs font-bold transition-colors ${
                  drawerTab === "assets"
                    ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Aset ({detailRoomAssets.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === "bookings"}
                onClick={() => setDrawerTab("bookings")}
                className={`min-h-[44px] rounded text-xs font-bold transition-colors ${
                  drawerTab === "bookings"
                    ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Jadwal ({detailRoomBookings.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === "notes"}
                onClick={() => setDrawerTab("notes")}
                className={`min-h-[44px] rounded text-xs font-bold transition-colors ${
                  drawerTab === "notes"
                    ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Catatan & File
              </button>
            </div>

            {drawerTab === "assets" ? (
              detailRoomAssets.length === 0 ? (
                <p className="p-4 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada aset yang ditempatkan di ruangan ini.
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
                          {ast.brand_model} • {formatCurrencyIDR(ast.acquisition_cost)}
                        </p>
                      </div>
                      <AssetConditionBadge condition={ast.condition} />
                    </li>
                  ))}
                </ul>
              )
            ) : drawerTab === "bookings" ? (
              detailRoomBookings.length === 0 ? (
                <p className="p-4 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada jadwal peminjaman untuk ruangan ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {detailRoomBookings.map((bk) => (
                    <li key={bk.id} className="p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {bk.booking_code}
                        </span>
                        <BookingStatusBadge status={bk.status} />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {bk.activity_name}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 font-mono">
                        {bk.booking_date} • {bk.start_time}-{bk.end_time} WIB •{" "}
                        {bk.borrower_name}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <EntityDrawerSections
                entityType="room"
                entityId={selectedRoomDetail.id}
                baseEventDates={[selectedRoomDetail.created_at]}
              />
            )}
          </div>
        ) : null}
      </Drawer>

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

      {/* Modal Tambah / Edit Gedung */}
      <Modal
        isOpen={buildingModalOpen}
        onClose={() => setBuildingModalOpen(false)}
        title={
          editingBuilding
            ? `Edit Gedung ${editingBuilding.code}`
            : "Tambah Gedung Kampus Baru"
        }
        description="Kelola data master gedung sebagai induk penempatan ruangan."
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
              {editingBuilding ? "Simpan Perubahan" : "Simpan Gedung"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Ruangan */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRoom)}
        onClose={() => {
          if (!deleting) {
            setDeletingRoom(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Ruangan"
        targetBadge={deletingRoom?.code}
        targetName={deletingRoom?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        showStrategySelector={Boolean(
          deletingRoom &&
            (bookings.some((b) => b.room_id === deletingRoom.id) ||
              maintenanceLogs.some((m) => m.room_id === deletingRoom.id))
        )}
        impactNotes={
          deletingRoom
            ? (() => {
                const roomAssets = assets.filter(
                  (a) => a.room_id === deletingRoom.id
                ).length;
                const bkCount = bookings.filter(
                  (b) => b.room_id === deletingRoom.id
                ).length;
                const mtCount = maintenanceLogs.filter(
                  (m) => m.room_id === deletingRoom.id
                ).length;
                const noteCount = notes.filter(
                  (n) =>
                    n.entity_type === "room" && n.entity_id === deletingRoom.id
                ).length;
                const attCount = attachments.filter(
                  (a) =>
                    a.entity_type === "room" && a.entity_id === deletingRoom.id
                ).length;
                const lines: string[] = [];
                if (roomAssets > 0) {
                  lines.push(
                    `${roomAssets} aset terpasang di ruang ini akan dipindahkan lokasinya ke "Gudang Cadangan".`
                  );
                }
                if (bkCount > 0) {
                  lines.push(
                    `Terhubung ke ${bkCount} tiket peminjaman / reservasi ruangan.`
                  );
                }
                if (mtCount > 0) {
                  lines.push(
                    `Terhubung ke ${mtCount} tiket laporan kerusakan ruang.`
                  );
                }
                if (noteCount > 0 || attCount > 0) {
                  lines.push(
                    `${noteCount} catatan & ${attCount} berkas lampiran ruangan ini ikut dihapus.`
                  );
                }
                if (lines.length === 0) {
                  lines.push(
                    "Tidak ada aset terpasang, peminjaman, maupun tiket kerusakan pada ruangan ini."
                  );
                }
                return lines;
              })()
            : []
        }
        activeBlockers={
          deletingRoom
            ? [
                ...bookings
                  .filter(
                    (b) =>
                      b.room_id === deletingRoom.id &&
                      (b.status === "Menunggu Persetujuan" ||
                        b.status === "Disetujui" ||
                        b.status === "Sedang Dipinjam")
                  )
                  .map((b) => `Peminjaman ${b.booking_code} (${b.status})`),
                ...maintenanceLogs
                  .filter(
                    (m) =>
                      m.room_id === deletingRoom.id &&
                      m.status !== "Selesai Diperbaiki"
                  )
                  .map((m) => `Perbaikan ${m.ticket_code} (${m.status})`),
              ]
            : []
        }
        onConfirm={async ({
          mode,
          forceActive,
        }: {
          mode: DeleteStrategyMode;
          forceActive: boolean;
        }) => {
          if (!deletingRoom) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteRoom(deletingRoom.id, { mode, forceActive });
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus ruangan.");
            return;
          }
          if (selectedRoomId === deletingRoom.id) {
            setSelectedRoomId(null);
          }
          setDeletingRoom(null);
        }}
      />

      {/* Modal Konfirmasi Hapus Gedung */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingBuilding)}
        onClose={() => {
          if (!deleting) {
            setDeletingBuilding(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Gedung"
        targetBadge={deletingBuilding?.code}
        targetName={deletingBuilding?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingBuilding
            ? [
                `Jumlah ruangan terdaftar di gedung ini: ${
                  rooms.filter((r) => r.building_id === deletingBuilding.id)
                    .length
                } ruangan.`,
                "Gedung hanya dapat dihapus jika seluruh ruangannya sudah dihapus atau dipindahkan ke gedung lain.",
              ]
            : []
        }
        hardBlockers={
          deletingBuilding
            ? (() => {
                const count = rooms.filter(
                  (r) => r.building_id === deletingBuilding.id
                ).length;
                return count > 0
                  ? [
                      `Masih terdapat ${count} ruangan terdaftar di gedung ${deletingBuilding.code}. Pindahkan atau hapus ruangan tersebut terlebih dahulu.`,
                    ]
                  : [];
              })()
            : []
        }
        onConfirm={async () => {
          if (!deletingBuilding) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteBuilding(deletingBuilding.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus gedung.");
            return;
          }
          if (filterBuilding === deletingBuilding.id) {
            setFilterBuilding("ALL");
          }
          setDeletingBuilding(null);
        }}
      />
    </div>
  );
}
