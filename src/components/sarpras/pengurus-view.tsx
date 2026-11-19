"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { CampusOfficial, CampusOfficialCategory } from "@/types/sarpras";
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

const OFFICIAL_CATEGORIES: CampusOfficialCategory[] = [
  "Pimpinan Kampus",
  "Dekanat & Prodi",
  "Biro & Unit Administrasi",
  "Koordinator Sarpras & Lab",
];

export function PengurusView() {
  const {
    campusOfficials,
    rooms,
    canManageDataMaster,
    uiSimState,
    setUiSimState,
    addCampusOfficial,
    updateCampusOfficial,
    deleteCampusOfficial,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CampusOfficial | null>(null);
  const [formError, setFormError] = useState("");

  const [officialCode, setOfficialCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [unitName, setUnitName] = useState("");
  const [category, setCategory] = useState<CampusOfficialCategory>(
    "Biro & Unit Administrasi"
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [periodLabel, setPeriodLabel] = useState("2024 - 2028");
  const [isActive, setIsActive] = useState("true");
  const [notes, setNotes] = useState("");

  const [deletingItem, setDeletingItem] = useState<CampusOfficial | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && campusOfficials.some((o) => o.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [campusOfficials]);

  const selectedOfficial = useMemo(
    () => campusOfficials.find((o) => o.id === selectedId) || null,
    [campusOfficials, selectedId]
  );

  const filteredOfficials = useMemo(() => {
    return campusOfficials.filter((o) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        o.official_code.toLowerCase().includes(q) ||
        o.full_name.toLowerCase().includes(q) ||
        o.position_title.toLowerCase().includes(q) ||
        o.unit_name.toLowerCase().includes(q) ||
        (o.phone || "").toLowerCase().includes(q);
      const matchCat =
        filterCategory === "ALL" || o.category === filterCategory;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? o.is_active : !o.is_active);
      return matchSearch && matchCat && matchActive;
    });
  }, [campusOfficials, searchQuery, filterCategory, filterActive]);

  const activeFilterCount =
    (filterCategory !== "ALL" ? 1 : 0) + (filterActive !== "ALL" ? 1 : 0);

  if (!canManageDataMaster) {
    return <MasterAdminGuard sectionLabel="Data Master Pengurus Kampus" />;
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat struktur pengurus dan pejabat kampus..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Pengurus Kampus"
        description="Sistem gagal mengambil daftar pengurus kampus. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingItem(null);
    setOfficialCode("");
    setFullName("");
    setPositionTitle("");
    setUnitName("");
    setCategory("Biro & Unit Administrasi");
    setEmail("");
    setPhone("");
    setPeriodLabel("2024 - 2028");
    setIsActive("true");
    setNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: CampusOfficial) => {
    setEditingItem(item);
    setOfficialCode(item.official_code);
    setFullName(item.full_name);
    setPositionTitle(item.position_title);
    setUnitName(item.unit_name);
    setCategory(item.category);
    setEmail(item.email || "");
    setPhone(item.phone || "");
    setPeriodLabel(item.period_label);
    setIsActive(item.is_active ? "true" : "false");
    setNotes(item.notes || "");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = officialCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanPos = positionTitle.trim();
    const cleanUnit = unitName.trim();

    if (!cleanCode || !cleanName || !cleanPos || !cleanUnit) {
      setFormError(
        "Kode/NIP, Nama Lengkap, Jabatan, dan Unit Kerja wajib diisi."
      );
      return;
    }

    const dup = campusOfficials.some(
      (o) =>
        o.official_code.toLowerCase() === cleanCode.toLowerCase() &&
        o.id !== editingItem?.id
    );
    if (dup) {
      setFormError(`Kode Pengurus "${cleanCode}" sudah digunakan.`);
      return;
    }

    const payload = {
      official_code: cleanCode,
      full_name: cleanName,
      position_title: cleanPos,
      unit_name: cleanUnit,
      category,
      email: email.trim(),
      phone: phone.trim(),
      period_label: periodLabel.trim() || "2024 - 2028",
      is_active: isActive === "true",
      notes: notes.trim(),
    };

    if (editingItem) {
      updateCampusOfficial(editingItem.id, payload);
    } else {
      addCampusOfficial(payload);
    }
    setModalOpen(false);
  };

  const columns: DataTableColumn<CampusOfficial>[] = [
    {
      key: "official",
      header: "Kode & Nama Pengurus",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.official_code}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Menjabat" : "Purna Tugas"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.full_name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Periode {row.period_label}
          </p>
        </div>
      ),
    },
    {
      key: "position",
      header: "Jabatan & Unit Kerja",
      render: (row) => (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.position_title}
          </p>
          <p className="text-slate-700 dark:text-slate-300">{row.unit_name}</p>
          <p className="text-[11px] font-mono text-[#1E3A5F] dark:text-sky-400">
            {row.category}
          </p>
        </div>
      ),
    },
    {
      key: "contact_pic",
      header: "Kontak & Tanggung Jawab Ruang",
      render: (row) => {
        const picRoomsCount = rooms.filter(
          (r) => r.pic_name.trim().toLowerCase() === row.full_name.trim().toLowerCase()
        ).length;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-mono text-slate-900 dark:text-slate-100">
              {row.phone || "-"}
            </p>
            <p className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
              {row.email || "-"}
            </p>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              PIC pada {picRoomsCount} ruangan
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
            aria-label={`Edit pengurus ${row.full_name}`}
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
            aria-label={`Hapus pengurus ${row.full_name}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const picRooms = selectedOfficial
    ? rooms.filter(
        (r) =>
          r.pic_name.trim().toLowerCase() ===
          selectedOfficial.full_name.trim().toLowerCase()
      )
    : [];

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • STRUKTUR PEJABAT & KOORDINATOR UNIT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Master Pengurus Kampus
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola daftar pimpinan, kepala biro, dan koordinator fasilitas yang menjadi referensi penanggung jawab (PIC) ruangan.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Pengurus</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Pengurus Kampus"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik kode, nama pengurus, jabatan, atau unit..."
            aria-label="Cari pengurus kampus"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Pengurus Kampus"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterCategory("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "category",
                label: "Kategori Jabatan",
                value: filterCategory,
                onChange: setFilterCategory,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...OFFICIAL_CATEGORIES.map((c) => ({ value: c, label: c })),
                ],
              },
              {
                key: "active",
                label: "Status Masa Bakti",
                value: filterActive,
                onChange: setFilterActive,
                options: [
                  { value: "ALL", label: "Semua" },
                  { value: "ACTIVE", label: "Menjabat" },
                  { value: "INACTIVE", label: "Purna Tugas" },
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
        data={filteredOfficials}
        rowKey={(o) => o.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Pengurus Kampus"
        emptyDescription="Tambahkan pengurus kampus baru atau ubah kata kunci pencarian Anda."
        emptyActionLabel="Tambah Pengurus"
        onEmptyAction={openAddModal}
      />

      <Drawer
        isOpen={Boolean(selectedOfficial)}
        onClose={() => setSelectedId(null)}
        title={selectedOfficial?.full_name || ""}
        subtitle={
          selectedOfficial
            ? `${selectedOfficial.official_code} • ${selectedOfficial.position_title}`
            : undefined
        }
        headerBadge={
          selectedOfficial ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedOfficial.official_code}
              </span>
              <Badge tone={selectedOfficial.is_active ? "success" : "neutral"}>
                {selectedOfficial.is_active ? "Menjabat" : "Purna Tugas"}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedOfficial ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedOfficial);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedOfficial)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Pengurus</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedOfficial ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Unit / Biro / Fakultas
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedOfficial.unit_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Kategori & Periode
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedOfficial.category} ({selectedOfficial.period_label})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Telepon</dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedOfficial.phone || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Email</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedOfficial.email || "-"}
                </dd>
              </div>
              {selectedOfficial.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan Tugas Pokok
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedOfficial.notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Ruangan dalam Tanggung Jawab PIC ({picRooms.length})
              </h3>
              {picRooms.length === 0 ? (
                <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada ruangan yang menunjuk pengurus ini sebagai PIC.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {picRooms.map((r) => (
                    <li key={r.id} className="p-3 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {r.code}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {r.category} • Kap. {r.capacity}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.name}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EntityDrawerSections
              entityType="official"
              entityId={selectedOfficial.id}
              baseEventDates={[selectedOfficial.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Pengurus ${editingItem.official_code}`
            : "Tambah Pengurus Kampus Baru"
        }
        description="Catat data pejabat, koordinator biro, atau penanggung jawab fasilitas kampus."
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
              label="Kode Jabatan / NIP *"
              placeholder="Contoh: PGR-004"
              value={officialCode}
              onChange={(e) => setOfficialCode(e.target.value)}
              required
            />
            <Select
              label="Kategori Jabatan *"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as CampusOfficialCategory)
              }
              options={OFFICIAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <Input
            label="Nama Lengkap & Gelar *"
            placeholder="Contoh: Hendra Wijaya, S.T."
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Jabatan Struktural / Fungsional *"
              placeholder="Contoh: Kepala Biro Umum & Sarpras"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              required
            />
            <Input
              label="Unit / Biro / Fakultas *"
              placeholder="Contoh: Biro Umum & Sarana Prasarana"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Periode Masa Bakti *"
              placeholder="Contoh: 2024 - 2028"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              required
            />
            <Input
              label="Nomor Telepon / WhatsApp"
              placeholder="Contoh: 0812-3400-1101"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Select
              label="Status Menjabat *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Menjabat (Aktif)" },
                { value: "false", label: "Purna Tugas" },
              ]}
            />
          </div>

          <Input
            label="Email Resmi"
            type="email"
            placeholder="Contoh: sarpras@kampus.ac.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Catatan Kewenangan / Tanggung Jawab"
            placeholder="Contoh: Penanggung jawab BAST aset dan ruang Gedung Saintek"
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
              {editingItem ? "Simpan Perubahan" : "Simpan Pengurus"}
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
        title="Konfirmasi Hapus Pengurus Kampus"
        targetBadge={deletingItem?.official_code}
        targetName={deletingItem?.full_name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={[
          "Data pengurus kampus beserta catatan dan lampirannya akan dihapus. Nama PIC pada ruangan yang sudah tercatat tidak ikut terhapus.",
        ]}
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteCampusOfficial(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus pengurus kampus.");
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
