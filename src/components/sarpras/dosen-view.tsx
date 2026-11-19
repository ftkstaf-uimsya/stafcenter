"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  Lecturer,
  LecturerAcademicRank,
  LecturerEmploymentStatus,
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
import { MasterAdminGuard } from "@/components/sarpras/master-admin-guard";

const EMPLOYMENT_STATUSES: LecturerEmploymentStatus[] = [
  "Dosen Tetap",
  "Dosen Tidak Tetap",
  "Dosen Tamu",
];

const ACADEMIC_RANKS: LecturerAcademicRank[] = [
  "-",
  "Tenaga Pengajar",
  "Asisten Ahli",
  "Lektor",
  "Lektor Kepala",
  "Guru Besar",
];

export function DosenView() {
  const {
    lecturers,
    courses,
    rooms,
    campusUnits,
    canManageDataMaster,
    uiSimState,
    setUiSimState,
    addLecturer,
    updateLecturer,
    deleteLecturer,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Lecturer | null>(null);
  const [formError, setFormError] = useState("");

  const [nidnNip, setNidnNip] = useState("");
  const [fullName, setFullName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [homebaseProdi, setHomebaseProdi] = useState("");
  const [employmentStatus, setEmploymentStatus] =
    useState<LecturerEmploymentStatus>("Dosen Tetap");
  const [academicRank, setAcademicRank] =
    useState<LecturerAcademicRank>("Asisten Ahli");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [officeRoomId, setOfficeRoomId] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [notes, setNotes] = useState("");

  const [deletingItem, setDeletingItem] = useState<Lecturer | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && lecturers.some((l) => l.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [lecturers]);

  const selectedLecturer = useMemo(
    () => lecturers.find((l) => l.id === selectedId) || null,
    [lecturers, selectedId]
  );

  const filteredLecturers = useMemo(() => {
    return lecturers.filter((l) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        l.nidn_nip.toLowerCase().includes(q) ||
        l.full_name.toLowerCase().includes(q) ||
        l.homebase_prodi.toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q);
      const matchStatus =
        filterStatus === "ALL" || l.employment_status === filterStatus;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? l.is_active : !l.is_active);
      return matchSearch && matchStatus && matchActive;
    });
  }, [lecturers, searchQuery, filterStatus, filterActive]);

  const activeFilterCount =
    (filterStatus !== "ALL" ? 1 : 0) + (filterActive !== "ALL" ? 1 : 0);

  if (!canManageDataMaster) {
    return <MasterAdminGuard sectionLabel="Data Master Dosen" />;
  }

  if (uiSimState === "loading") {
    return <LoadingStateView message="Memuat direktori data induk dosen..." />;
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Dosen"
        description="Sistem gagal mengambil daftar dosen. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const academicUnitOptions = useMemo(
    () =>
      campusUnits.filter(
        (u) => u.is_active && u.unit_type !== "Ormawa / UKM"
      ),
    [campusUnits]
  );

  const openAddModal = () => {
    setEditingItem(null);
    setNidnNip("");
    setFullName("");
    const firstUnit = academicUnitOptions[0];
    setUnitId(firstUnit?.id || "");
    setHomebaseProdi(firstUnit?.name || "");
    setEmploymentStatus("Dosen Tetap");
    setAcademicRank("Asisten Ahli");
    setEmail("");
    setPhone("");
    setOfficeRoomId("");
    setIsActive("true");
    setNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: Lecturer) => {
    setEditingItem(item);
    setNidnNip(item.nidn_nip);
    setFullName(item.full_name);
    const matchedUnit =
      campusUnits.find((u) => u.id === item.unit_id) ||
      campusUnits.find(
        (u) =>
          u.name.trim().toLowerCase() ===
          item.homebase_prodi.trim().toLowerCase()
      );
    setUnitId(matchedUnit?.id || "");
    setHomebaseProdi(matchedUnit?.name || item.homebase_prodi);
    setEmploymentStatus(item.employment_status);
    setAcademicRank(item.academic_rank);
    setEmail(item.email || "");
    setPhone(item.phone || "");
    setOfficeRoomId(item.office_room_id || "");
    setIsActive(item.is_active ? "true" : "false");
    setNotes(item.notes || "");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = nidnNip.trim();
    const cleanName = fullName.trim();
    const selectedUnit = campusUnits.find((u) => u.id === unitId);
    const cleanProdi = (selectedUnit?.name || homebaseProdi).trim();

    if (!cleanCode || !cleanName || !cleanProdi) {
      setFormError("NIDN/NIP, Nama Lengkap, dan Program Studi wajib diisi.");
      return;
    }

    const dupCode = lecturers.some(
      (l) =>
        l.nidn_nip.toLowerCase() === cleanCode.toLowerCase() &&
        l.id !== editingItem?.id
    );
    if (dupCode) {
      setFormError(`NIDN/NIP "${cleanCode}" sudah terdaftar pada dosen lain.`);
      return;
    }

    const payload = {
      nidn_nip: cleanCode,
      full_name: cleanName,
      homebase_prodi: cleanProdi,
      unit_id: selectedUnit?.id || null,
      employment_status: employmentStatus,
      academic_rank: academicRank,
      email: email.trim(),
      phone: phone.trim(),
      office_room_id: officeRoomId || null,
      is_active: isActive === "true",
      notes: notes.trim(),
    };

    if (editingItem) {
      updateLecturer(editingItem.id, payload);
    } else {
      addLecturer(payload);
    }
    setModalOpen(false);
  };

  const columns: DataTableColumn<Lecturer>[] = [
    {
      key: "identity",
      header: "NIDN / NIP & Nama Dosen",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.nidn_nip}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.full_name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.academic_rank !== "-" ? `${row.academic_rank} • ` : ""}
            {row.employment_status}
          </p>
        </div>
      ),
    },
    {
      key: "prodi_room",
      header: "Homebase & Ruang Kerja",
      render: (row) => {
        const office = rooms.find((r) => r.id === row.office_room_id);
        return (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {row.homebase_prodi}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Ruang:{" "}
              <span className="font-mono font-semibold">
                {office ? `${office.code} (${office.name})` : "-"}
              </span>
            </p>
          </div>
        );
      },
    },
    {
      key: "contact",
      header: "Kontak & Ampuan Makul",
      render: (row) => {
        const courseCount = courses.filter((c) => c.lecturer_id === row.id).length;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-mono text-slate-900 dark:text-slate-100">
              {row.phone || "-"}
            </p>
            <p className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
              {row.email || "-"}
            </p>
            <p className="text-[11px] font-semibold text-[#1E3A5F] dark:text-sky-400">
              {courseCount} mata kuliah diampu
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
            aria-label={`Edit dosen ${row.full_name}`}
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
            aria-label={`Hapus dosen ${row.full_name}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const drawerCourses = selectedLecturer
    ? courses.filter((c) => c.lecturer_id === selectedLecturer.id)
    : [];
  const drawerRoom = selectedLecturer
    ? rooms.find((r) => r.id === selectedLecturer.office_room_id)
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • DIREKTORI TENAGA PENDIDIK
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Master Dosen
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola daftar dosen homebase kampus untuk referensi pengampu mata kuliah dan peminjaman fasilitas.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Dosen</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Dosen"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik NIDN/NIP, nama dosen, atau prodi..."
            aria-label="Cari data dosen"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Data Dosen"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterStatus("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "status",
                label: "Status Ikatan",
                value: filterStatus,
                onChange: setFilterStatus,
                options: [
                  { value: "ALL", label: "Semua Status Ikatan" },
                  ...EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s })),
                ],
              },
              {
                key: "active",
                label: "Keaktifan",
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
        data={filteredLecturers}
        rowKey={(l) => l.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Dosen"
        emptyDescription="Tambahkan data dosen baru atau sesuaikan kata kunci pencarian Anda."
        emptyActionLabel="Tambah Dosen"
        onEmptyAction={openAddModal}
      />

      <Drawer
        isOpen={Boolean(selectedLecturer)}
        onClose={() => setSelectedId(null)}
        title={selectedLecturer?.full_name || ""}
        subtitle={
          selectedLecturer
            ? `${selectedLecturer.nidn_nip} • ${selectedLecturer.homebase_prodi}`
            : undefined
        }
        headerBadge={
          selectedLecturer ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedLecturer.nidn_nip}
              </span>
              <Badge tone={selectedLecturer.is_active ? "success" : "neutral"}>
                {selectedLecturer.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedLecturer ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedLecturer);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedLecturer)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Dosen</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedLecturer ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Ikatan & Jabatan Fungsional
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLecturer.employment_status}
                  {selectedLecturer.academic_rank !== "-"
                    ? ` (${selectedLecturer.academic_rank})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Ruang Kerja / Transit
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {drawerRoom ? `${drawerRoom.code} (${drawerRoom.name})` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Telepon</dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedLecturer.phone || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Email</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedLecturer.email || "-"}
                </dd>
              </div>
              {selectedLecturer.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">Catatan</dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedLecturer.notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Mata Kuliah Diampu ({drawerCourses.length})
              </h3>
              {drawerCourses.length === 0 ? (
                <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada mata kuliah yang ditautkan ke dosen ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {drawerCourses.map((c) => (
                    <li key={c.id} className="p-3 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {c.code}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          Smt {c.semester} • {c.sks_theory + c.sks_practice} SKS
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EntityDrawerSections
              entityType="lecturer"
              entityId={selectedLecturer.id}
              baseEventDates={[selectedLecturer.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Dosen ${editingItem.nidn_nip}`
            : "Tambah Data Dosen Baru"
        }
        description="Lengkapi identitas akademik dan kontak dosen untuk kebutuhan administrasi kampus."
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
              label="NIDN / NIP / Kode Dosen *"
              placeholder="Contoh: 0418058201"
              value={nidnNip}
              onChange={(e) => setNidnNip(e.target.value)}
              required
            />
            {academicUnitOptions.length > 0 ? (
              <Select
                label="Program Studi / Unit Homebase *"
                value={unitId || (homebaseProdi ? "__LEGACY__" : "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__LEGACY__") {
                    setUnitId("");
                    return;
                  }
                  setUnitId(val);
                  const found = campusUnits.find((u) => u.id === val);
                  if (found) setHomebaseProdi(found.name);
                }}
                options={[
                  ...academicUnitOptions.map((u) => ({
                    value: u.id,
                    label: `${u.code} - ${u.name}`,
                  })),
                  ...(!unitId && homebaseProdi
                    ? [
                        {
                          value: "__LEGACY__",
                          label: `${homebaseProdi} (Data Historis)`,
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Input
                label="Program Studi Homebase *"
                placeholder="Contoh: Teknik Informatika"
                value={homebaseProdi}
                onChange={(e) => setHomebaseProdi(e.target.value)}
                required
              />
            )}
          </div>

          <Input
            label="Nama Lengkap & Gelar *"
            placeholder="Contoh: Dr. Eng. Lukman Hakim, M.T."
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Status Ikatan *"
              value={employmentStatus}
              onChange={(e) =>
                setEmploymentStatus(e.target.value as LecturerEmploymentStatus)
              }
              options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Jabatan Fungsional"
              value={academicRank}
              onChange={(e) =>
                setAcademicRank(e.target.value as LecturerAcademicRank)
              }
              options={ACADEMIC_RANKS.map((r) => ({ value: r, label: r }))}
            />
            <Select
              label="Status Keaktifan *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Aktif" },
                { value: "false", label: "Nonaktif / Cuti" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nomor Telepon / WhatsApp"
              placeholder="Contoh: 0813-2211-9001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Email Kampus"
              type="email"
              placeholder="Contoh: dosen@kampus.ac.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Select
            label="Ruang Kerja / Ruang Dosen (Opsional)"
            value={officeRoomId}
            onChange={(e) => setOfficeRoomId(e.target.value)}
            options={[
              { value: "", label: "Belum ditautkan ke ruangan" },
              ...rooms.map((r) => ({
                value: r.id,
                label: `${r.code} - ${r.name}`,
              })),
            ]}
          />

          <Input
            label="Catatan Bidang / Keterangan"
            placeholder="Contoh: Koordinator laboratorium atau riset terkait"
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
              {editingItem ? "Simpan Perubahan" : "Simpan Data Dosen"}
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
        title="Konfirmasi Hapus Data Dosen"
        targetBadge={deletingItem?.nidn_nip}
        targetName={deletingItem?.full_name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingItem
            ? (() => {
                const linkedCourses = courses.filter(
                  (c) => c.lecturer_id === deletingItem.id
                ).length;
                if (linkedCourses > 0) {
                  return [
                    `Dosen ini terhubung pada ${linkedCourses} mata kuliah; tautan pengampu di Makul terkait akan dikosongkan otomatis.`,
                  ];
                }
                return ["Tidak ada mata kuliah yang terikat pada dosen ini."];
              })()
            : []
        }
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteLecturer(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus data dosen.");
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
