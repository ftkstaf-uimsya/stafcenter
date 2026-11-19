"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { Course, CourseType } from "@/types/sarpras";
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

const COURSE_TYPES: CourseType[] = [
  "Wajib Prodi",
  "Wajib Universitas",
  "Pilihan",
  "Praktikum",
  "Tugas Akhir",
];

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function MakulView() {
  const {
    courses,
    lecturers,
    rooms,
    canManageDataMaster,
    uiSimState,
    setUiSimState,
    addCourse,
    updateCourse,
    deleteCourse,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterSemester, setFilterSemester] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Course | null>(null);
  const [formError, setFormError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [prodi, setProdi] = useState("");
  const [semester, setSemester] = useState("1");
  const [curriculumYear, setCurriculumYear] = useState("2024");
  const [sksTheory, setSksTheory] = useState("2");
  const [sksPractice, setSksPractice] = useState("1");
  const [courseType, setCourseType] = useState<CourseType>("Wajib Prodi");
  const [lecturerId, setLecturerId] = useState("");
  const [preferredRoomId, setPreferredRoomId] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [description, setDescription] = useState("");

  const [deletingItem, setDeletingItem] = useState<Course | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && courses.some((c) => c.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [courses]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedId) || null,
    [courses, selectedId]
  );

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const lecturer = lecturers.find((l) => l.id === c.lecturer_id);
      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.prodi.toLowerCase().includes(q) ||
        (lecturer?.full_name || "").toLowerCase().includes(q);
      const matchType = filterType === "ALL" || c.course_type === filterType;
      const matchSemester =
        filterSemester === "ALL" || String(c.semester) === filterSemester;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? c.is_active : !c.is_active);
      return matchSearch && matchType && matchSemester && matchActive;
    });
  }, [courses, lecturers, searchQuery, filterType, filterSemester, filterActive]);

  const activeFilterCount =
    (filterType !== "ALL" ? 1 : 0) +
    (filterSemester !== "ALL" ? 1 : 0) +
    (filterActive !== "ALL" ? 1 : 0);

  if (!canManageDataMaster) {
    return <MasterAdminGuard sectionLabel="Data Master Mata Kuliah (Makul)" />;
  }

  if (uiSimState === "loading") {
    return <LoadingStateView message="Memuat katalog data master mata kuliah..." />;
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Makul"
        description="Sistem gagal mengambil daftar mata kuliah. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setProdi("");
    setSemester("1");
    setCurriculumYear("2024");
    setSksTheory("2");
    setSksPractice("0");
    setCourseType("Wajib Prodi");
    setLecturerId("");
    setPreferredRoomId("");
    setIsActive("true");
    setDescription("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: Course) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setProdi(item.prodi);
    setSemester(String(item.semester));
    setCurriculumYear(String(item.curriculum_year));
    setSksTheory(String(item.sks_theory));
    setSksPractice(String(item.sks_practice));
    setCourseType(item.course_type);
    setLecturerId(item.lecturer_id || "");
    setPreferredRoomId(item.preferred_room_id || "");
    setIsActive(item.is_active ? "true" : "false");
    setDescription(item.description || "");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanProdi = prodi.trim();

    if (!cleanCode || !cleanName || !cleanProdi) {
      setFormError("Kode MK, Nama Mata Kuliah, dan Program Studi wajib diisi.");
      return;
    }

    const dup = courses.some(
      (c) =>
        c.code.toLowerCase() === cleanCode.toLowerCase() &&
        c.id !== editingItem?.id
    );
    if (dup) {
      setFormError(`Kode Mata Kuliah "${cleanCode}" sudah terdaftar.`);
      return;
    }

    const theoryNum = Math.max(0, Number(sksTheory) || 0);
    const practiceNum = Math.max(0, Number(sksPractice) || 0);
    if (theoryNum + practiceNum <= 0) {
      setFormError("Total SKS (Teori + Praktik) minimal harus 1 SKS.");
      return;
    }

    const payload = {
      code: cleanCode,
      name: cleanName,
      prodi: cleanProdi,
      semester: Math.min(8, Math.max(1, Number(semester) || 1)),
      curriculum_year: Number(curriculumYear) || 2024,
      sks_theory: theoryNum,
      sks_practice: practiceNum,
      course_type: courseType,
      lecturer_id: lecturerId || null,
      preferred_room_id: preferredRoomId || null,
      is_active: isActive === "true",
      description: description.trim(),
    };

    if (editingItem) {
      updateCourse(editingItem.id, payload);
    } else {
      addCourse(payload);
    }
    setModalOpen(false);
  };

  const columns: DataTableColumn<Course>[] = [
    {
      key: "course_info",
      header: "Kode & Nama Mata Kuliah",
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
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {row.course_type} • Kurikulum {row.curriculum_year}
          </p>
        </div>
      ),
    },
    {
      key: "prodi_sks",
      header: "Prodi, Semester & SKS",
      render: (row) => (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.prodi}
          </p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            Semester {row.semester} •{" "}
            <strong>{row.sks_theory + row.sks_practice} SKS</strong> (T:
            {row.sks_theory} / P:{row.sks_practice})
          </p>
        </div>
      ),
    },
    {
      key: "lecturer_room",
      header: "Pengampu & Preferensi Ruang",
      render: (row) => {
        const lecturer = lecturers.find((l) => l.id === row.lecturer_id);
        const room = rooms.find((r) => r.id === row.preferred_room_id);
        return (
          <div className="text-xs space-y-1">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {lecturer ? lecturer.full_name : "Belum ditentukan"}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Ruang:{" "}
              <span className="font-mono font-semibold">
                {room ? `${room.code} (${room.name})` : "-"}
              </span>
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
            aria-label={`Edit makul ${row.code}`}
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
            aria-label={`Hapus makul ${row.code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const drawerLecturer = selectedCourse
    ? lecturers.find((l) => l.id === selectedCourse.lecturer_id)
    : null;
  const drawerRoom = selectedCourse
    ? rooms.find((r) => r.id === selectedCourse.preferred_room_id)
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • KATALOG KURIKULUM & PERKULIAHAN
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Master Mata Kuliah (MAKUL)
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola daftar mata kuliah, bobot SKS, dosen koordinator, dan kebutuhan ruangan atau laboratorium perkuliahan.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Makul</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Makul"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik kode MK, nama mata kuliah, prodi, atau dosen..."
            aria-label="Cari data mata kuliah"
            className="min-h-[44px] w-full sm:w-72 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Data Mata Kuliah"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterType("ALL");
              setFilterSemester("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "type",
                label: "Jenis Mata Kuliah",
                value: filterType,
                onChange: setFilterType,
                options: [
                  { value: "ALL", label: "Semua Jenis" },
                  ...COURSE_TYPES.map((t) => ({ value: t, label: t })),
                ],
              },
              {
                key: "semester",
                label: "Semester",
                value: filterSemester,
                onChange: setFilterSemester,
                options: [
                  { value: "ALL", label: "Semua Semester" },
                  ...SEMESTER_OPTIONS.map((s) => ({
                    value: String(s),
                    label: `Semester ${s}`,
                  })),
                ],
              },
              {
                key: "active",
                label: "Status Penawaran",
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
        data={filteredCourses}
        rowKey={(c) => c.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Mata Kuliah"
        emptyDescription="Tambahkan mata kuliah baru atau ubah filter pencarian Anda."
        emptyActionLabel="Tambah Makul"
        onEmptyAction={openAddModal}
      />

      <Drawer
        isOpen={Boolean(selectedCourse)}
        onClose={() => setSelectedId(null)}
        title={selectedCourse?.name || ""}
        subtitle={
          selectedCourse
            ? `${selectedCourse.code} • ${selectedCourse.prodi}`
            : undefined
        }
        headerBadge={
          selectedCourse ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedCourse.code}
              </span>
              <Badge tone={selectedCourse.is_active ? "success" : "neutral"}>
                {selectedCourse.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedCourse ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedCourse);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedCourse)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Makul</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedCourse ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Semester & Kurikulum
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  Semester {selectedCourse.semester} • Kurikulum{" "}
                  {selectedCourse.curriculum_year}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Bobot SKS & Jenis
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {selectedCourse.sks_theory + selectedCourse.sks_practice} SKS (T:
                  {selectedCourse.sks_theory} / P:{selectedCourse.sks_practice})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Dosen Pengampu
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {drawerLecturer
                    ? `${drawerLecturer.full_name} (${drawerLecturer.nidn_nip})`
                    : "Belum ditentukan"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Preferensi Ruang / Lab
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {drawerRoom ? `${drawerRoom.code} (${drawerRoom.name})` : "-"}
                </dd>
              </div>
              {selectedCourse.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Kebutuhan Fasilitas / Deskripsi
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedCourse.description}
                  </dd>
                </div>
              ) : null}
            </dl>

            <EntityDrawerSections
              entityType="course"
              entityId={selectedCourse.id}
              baseEventDates={[selectedCourse.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Makul ${editingItem.code}`
            : "Tambah Mata Kuliah Baru"
        }
        description="Lengkapi informasi kurikulum, pengampu, dan kebutuhan ruang perkuliahan."
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
              label="Kode Mata Kuliah *"
              placeholder="Contoh: TIF-501"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="Program Studi *"
              placeholder="Contoh: Teknik Informatika"
              value={prodi}
              onChange={(e) => setProdi(e.target.value)}
              required
            />
          </div>

          <Input
            label="Nama Mata Kuliah *"
            placeholder="Contoh: Pengolahan Citra Digital & Visi Komputer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select
              label="Semester *"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              options={SEMESTER_OPTIONS.map((s) => ({
                value: String(s),
                label: `Semester ${s}`,
              }))}
            />
            <Input
              label="Tahun Kurikulum *"
              type="number"
              min={2000}
              max={2100}
              value={curriculumYear}
              onChange={(e) => setCurriculumYear(e.target.value)}
              required
            />
            <Input
              label="SKS Teori *"
              type="number"
              min={0}
              max={8}
              value={sksTheory}
              onChange={(e) => setSksTheory(e.target.value)}
              required
            />
            <Input
              label="SKS Praktik *"
              type="number"
              min={0}
              max={8}
              value={sksPractice}
              onChange={(e) => setSksPractice(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Jenis Mata Kuliah *"
              value={courseType}
              onChange={(e) => setCourseType(e.target.value as CourseType)}
              options={COURSE_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Select
              label="Status Penawaran *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Aktif" },
                { value: "false", label: "Nonaktif" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Dosen Pengampu / Koordinator"
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
              options={[
                { value: "", label: "Belum ditentukan" },
                ...lecturers.map((l) => ({
                  value: l.id,
                  label: `${l.nidn_nip} - ${l.full_name}`,
                })),
              ]}
            />
            <Select
              label="Preferensi Ruang / Lab Standar"
              value={preferredRoomId}
              onChange={(e) => setPreferredRoomId(e.target.value)}
              options={[
                { value: "", label: "Tidak ada preferensi khusus" },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                })),
              ]}
            />
          </div>

          <Input
            label="Deskripsi & Kebutuhan Sarana Kelas"
            placeholder="Contoh: Membutuhkan komputer lab GPU dan proyektor resolusi tinggi"
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
              {editingItem ? "Simpan Perubahan" : "Simpan Makul"}
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
        title="Konfirmasi Hapus Mata Kuliah"
        targetBadge={deletingItem?.code}
        targetName={deletingItem?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={[
          "Data mata kuliah beserta catatan dan lampiran terkait akan dihapus dari Data Master.",
        ]}
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteCourse(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus mata kuliah.");
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
