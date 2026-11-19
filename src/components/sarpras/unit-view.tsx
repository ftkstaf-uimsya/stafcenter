"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { CampusUnit, CampusUnitType } from "@/types/sarpras";
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
import { MasterAdminGuard } from "@/components/sarpras/master-admin-guard";

const UNIT_TYPES: CampusUnitType[] = [
  "Fakultas",
  "Program Studi",
  "Biro & Unit Kerja",
  "Ormawa / UKM",
];

function getUnitTypeTone(
  type: CampusUnitType
): "info" | "success" | "warning" | "neutral" {
  switch (type) {
    case "Fakultas":
      return "info";
    case "Program Studi":
      return "success";
    case "Ormawa / UKM":
      return "warning";
    default:
      return "neutral";
  }
}

export function UnitView() {
  const {
    campusUnits,
    lecturers,
    courses,
    campusOfficials,
    bookings,
    consumableTransactions,
    canManageDataMaster,
    uiSimState,
    setUiSimState,
    addCampusUnit,
    updateCampusUnit,
    deleteCampusUnit,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CampusUnit | null>(null);
  const [formError, setFormError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState<CampusUnitType>("Program Studi");
  const [parentUnitId, setParentUnitId] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [notes, setNotes] = useState("");

  const [deletingItem, setDeletingItem] = useState<CampusUnit | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && campusUnits.some((u) => u.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [campusUnits]);

  const selectedUnit = useMemo(
    () => campusUnits.find((u) => u.id === selectedId) || null,
    [campusUnits, selectedId]
  );

  const filteredUnits = useMemo(() => {
    return campusUnits.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.leader_name || "").toLowerCase().includes(q) ||
        u.unit_type.toLowerCase().includes(q);
      const matchType = filterType === "ALL" || u.unit_type === filterType;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? u.is_active : !u.is_active);
      return matchSearch && matchType && matchActive;
    });
  }, [campusUnits, searchQuery, filterType, filterActive]);

  const activeFilterCount =
    (filterType !== "ALL" ? 1 : 0) + (filterActive !== "ALL" ? 1 : 0);

  if (!canManageDataMaster) {
    return <MasterAdminGuard sectionLabel="Data Master Unit, Prodi & Ormawa" />;
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat direktori fakultas, program studi, biro, dan ormawa..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Unit & Prodi"
        description="Sistem gagal mengambil daftar unit kerja dan program studi. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setUnitType("Program Studi");
    setParentUnitId("");
    setLeaderName("");
    setPhone("");
    setEmail("");
    setIsActive("true");
    setNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: CampusUnit) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setUnitType(item.unit_type);
    setParentUnitId(item.parent_unit_id || "");
    setLeaderName(item.leader_name || "");
    setPhone(item.phone || "");
    setEmail(item.email || "");
    setIsActive(item.is_active ? "true" : "false");
    setNotes(item.notes || "");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      setFormError("Kode Unit dan Nama Unit/Prodi/Ormawa wajib diisi.");
      return;
    }

    const dupCode = campusUnits.some(
      (u) =>
        u.code.toLowerCase() === cleanCode.toLowerCase() &&
        u.id !== editingItem?.id
    );
    if (dupCode) {
      setFormError(`Kode Unit "${cleanCode}" sudah digunakan.`);
      return;
    }

    if (editingItem && parentUnitId === editingItem.id) {
      setFormError("Unit induk tidak boleh merujuk ke dirinya sendiri.");
      return;
    }

    const payload = {
      code: cleanCode,
      name: cleanName,
      unit_type: unitType,
      parent_unit_id: parentUnitId || null,
      leader_name: leaderName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      is_active: isActive === "true",
      notes: notes.trim(),
    };

    if (editingItem) {
      updateCampusUnit(editingItem.id, payload);
    } else {
      addCampusUnit(payload);
    }
    setModalOpen(false);
  };

  const countUnitUsage = (unit: CampusUnit) => {
    const cleanName = unit.name.trim().toLowerCase();
    const lecturerCount = lecturers.filter(
      (l) =>
        l.unit_id === unit.id ||
        l.homebase_prodi.trim().toLowerCase() === cleanName
    ).length;
    const courseCount = courses.filter(
      (c) =>
        c.unit_id === unit.id || c.prodi.trim().toLowerCase() === cleanName
    ).length;
    const officialCount = campusOfficials.filter(
      (o) =>
        o.unit_id === unit.id ||
        o.unit_name.trim().toLowerCase() === cleanName
    ).length;
    const bookingCount = bookings.filter(
      (b) =>
        b.unit_id === unit.id ||
        b.borrower_unit.trim().toLowerCase() === cleanName
    ).length;
    const txCount = consumableTransactions.filter(
      (t) =>
        t.unit_id === unit.id ||
        t.actor_unit.trim().toLowerCase() === cleanName
    ).length;
    return {
      lecturerCount,
      courseCount,
      officialCount,
      bookingCount,
      txCount,
      total:
        lecturerCount + courseCount + officialCount + bookingCount + txCount,
    };
  };

  const columns: DataTableColumn<CampusUnit>[] = [
    {
      key: "unit",
      header: "Kode & Nama Unit / Prodi",
      render: (row) => {
        const parent = campusUnits.find((p) => p.id === row.parent_unit_id);
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {row.code}
              </span>
              <Badge tone={getUnitTypeTone(row.unit_type)}>{row.unit_type}</Badge>
              <Badge tone={row.is_active ? "success" : "neutral"}>
                {row.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <p className="font-bold text-slate-900 dark:text-slate-100">
              {row.name}
            </p>
            {parent ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Induk: {parent.code} ({parent.name})
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "leader",
      header: "Pimpinan & Kontak",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.leader_name || "-"}
          </p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {row.phone || "-"}
          </p>
          <p className="text-slate-600 dark:text-slate-400 truncate max-w-[210px]">
            {row.email || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Keterkaitan Modul",
      render: (row) => {
        const usage = countUnitUsage(row);
        return (
          <div className="text-xs space-y-0.5 text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-[#1E3A5F] dark:text-sky-400">
              {usage.lecturerCount} Dosen • {usage.courseCount} Makul •{" "}
              {usage.officialCount} Pengurus
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              {usage.bookingCount} Peminjaman • {usage.txCount} Mutasi BHP
            </p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => (
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditModal(row)}
            aria-label={`Edit unit ${row.name}`}
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
              setDeletingItem(row);
            }}
            aria-label={`Hapus unit ${row.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const drawerParent = selectedUnit?.parent_unit_id
    ? campusUnits.find((p) => p.id === selectedUnit.parent_unit_id)
    : null;
  const drawerUsage = selectedUnit ? countUnitUsage(selectedUnit) : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • STRUKTUR ORGANISASI & AKADEMIK
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Master Unit, Prodi & Ormawa
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pusat data Fakultas, Program Studi, Biro Kerja, dan Ormawa/UKM
            sebagai referensi seragam di seluruh modul.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Unit / Prodi</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Unit Kampus"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik kode, nama prodi/unit, atau pimpinan..."
            aria-label="Cari unit, prodi, atau ormawa"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Unit & Prodi"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterType("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "type",
                label: "Kategori Unit",
                value: filterType,
                onChange: setFilterType,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...UNIT_TYPES.map((t) => ({ value: t, label: t })),
                ],
              },
              {
                key: "active",
                label: "Status Keaktifan",
                value: filterActive,
                onChange: setFilterActive,
                options: [
                  { value: "ALL", label: "Semua" },
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "INACTIVE", label: "Nonaktif" },
                ],
              },
            ]}
          />
        </div>

        <ColumnsTogglePopover
          columns={columns.map((c) => ({ key: c.key, label: c.header }))}
          hiddenKeys={hiddenColumnKeys}
          onToggleKey={(key) =>
            setHiddenColumnKeys((prev) =>
              prev.includes(key)
                ? prev.filter((k) => k !== key)
                : [...prev, key]
            )
          }
        />
      </section>

      <DataTable
        columns={columns}
        data={filteredUnits}
        rowKey={(u) => u.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Unit / Prodi"
        emptyDescription="Tambahkan fakultas, program studi, biro kerja, atau ormawa baru."
        emptyActionLabel="Tambah Unit / Prodi"
        onEmptyAction={openAddModal}
      />

      <Drawer
        isOpen={Boolean(selectedUnit)}
        onClose={() => setSelectedId(null)}
        title={selectedUnit?.name || ""}
        subtitle={
          selectedUnit
            ? `${selectedUnit.code} • ${selectedUnit.unit_type}`
            : undefined
        }
        headerBadge={
          selectedUnit ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedUnit.code}
              </span>
              <Badge tone={getUnitTypeTone(selectedUnit.unit_type)}>
                {selectedUnit.unit_type}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedUnit ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedUnit);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedUnit)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Unit</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedUnit && drawerUsage ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Pimpinan / Ketua Unit
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedUnit.leader_name || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Unit Induk
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {drawerParent
                    ? `${drawerParent.code} - ${drawerParent.name}`
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Telepon</dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedUnit.phone || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Email</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedUnit.email || "-"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-600 dark:text-slate-400">
                  Ringkasan Relasi Data
                </dt>
                <dd className="mt-0.5 font-semibold text-[#1E3A5F] dark:text-sky-400">
                  {drawerUsage.lecturerCount} Dosen Homebase,{" "}
                  {drawerUsage.courseCount} Mata Kuliah,{" "}
                  {drawerUsage.officialCount} Pengurus,{" "}
                  {drawerUsage.bookingCount} Peminjaman,{" "}
                  {drawerUsage.txCount} Mutasi BHP
                </dd>
              </div>
              {selectedUnit.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Keterangan
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedUnit.notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <EntityDrawerSections
              entityType="unit"
              entityId={selectedUnit.id}
              baseEventDates={[selectedUnit.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Unit ${editingItem.code}`
            : "Tambah Unit / Prodi / Ormawa Baru"
        }
        description="Unit yang aktif akan otomatis muncul di pilihan Prodi, Unit Pengurus, Peminjaman, dan Mutasi BHP."
        maxWidthClass="max-w-2xl"
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
              label="Kode Unit *"
              placeholder="Contoh: TIF / FTK / BEM-U"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Select
              label="Kategori Unit *"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as CampusUnitType)}
              options={UNIT_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <Input
            label="Nama Resmi Unit / Prodi / Ormawa *"
            placeholder="Contoh: Teknik Informatika"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Induk Fakultas / Biro (Opsional)"
              value={parentUnitId}
              onChange={(e) => setParentUnitId(e.target.value)}
              options={[
                { value: "", label: "Tidak ada induk (Berdiri sendiri)" },
                ...campusUnits
                  .filter((u) => u.id !== editingItem?.id)
                  .map((u) => ({
                    value: u.id,
                    label: `${u.code} - ${u.name}`,
                  })),
              ]}
            />
            <Select
              label="Status Keaktifan *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Aktif" },
                { value: "false", label: "Nonaktif" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Nama Pimpinan / Ketua"
              placeholder="Nama ketua/pimpinan"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
            />
            <Input
              label="Nomor Telepon / WA"
              placeholder="0812-xxxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Email Unit"
              type="email"
              placeholder="unit@kampus.ac.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Input
            label="Catatan / Deskripsi Tugas"
            placeholder="Keterangan singkat ruang lingkup unit..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
              {editingItem ? "Simpan Perubahan" : "Simpan Unit"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingItem)}
        onClose={() => {
          if (!deleting) {
            setDeletingItem(null);
            setDeleteError("");
          }
        }}
        title="Konfirmasi Hapus Unit / Prodi"
        targetBadge={deletingItem?.code}
        targetName={deletingItem?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingItem
            ? (() => {
                const usage = countUnitUsage(deletingItem);
                if (usage.total > 0) {
                  return [
                    `Unit ini terkait pada ${usage.lecturerCount} dosen, ${usage.courseCount} makul, ${usage.officialCount} pengurus, ${usage.bookingCount} peminjaman, dan ${usage.txCount} mutasi BHP.`,
                    "Tautan relasi (unit_id) akan dikosongkan otomatis, namun teks nama historis pada transaksi tetap dipertahankan.",
                  ];
                }
                return [
                  "Tidak ada dosen, makul, pengurus, atau transaksi yang terhubung pada unit ini.",
                ];
              })()
            : []
        }
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteCampusUnit(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus unit.");
            return;
          }
          if (selectedId === deletingItem.id) {
            setSelectedId(null);
          }
          setDeletingItem(null);
        }}
      />
    </div>
  );
}
