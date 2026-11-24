"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import {
  buildAcademicClassCode,
  normalizeAngkatanYear,
  useSarpras,
} from "@/lib/supabase/sarpras-context";
import {
  CLASS_SECTION_LIST,
  PRODI_ENUM_LIST,
  PRODI_LABELS,
} from "@/lib/supabase/seed-data";
import {
  AcademicClass,
  ClassSectionCode,
  ProdiCode,
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
import { matchesFlexibleQuery } from "@/lib/search-normalize";

export function KelasView() {
  const {
    academicClasses,
    rooms,
    campusUnits,
    officeKitLoans,
    bookings,
    canAccessPage,
    defaultHomeHref,
    uiSimState,
    setUiSimState,
    addAcademicClass,
    updateAcademicClass,
    deleteAcademicClass,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState("ALL");
  const [filterSection, setFilterSection] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AcademicClass | null>(null);
  const [formError, setFormError] = useState("");

  const [prodi, setProdi] = useState<ProdiCode>("MPI");
  const [angkatanYear, setAngkatanYear] = useState("24");
  const [classSection, setClassSection] = useState<ClassSectionCode>("A");
  const [dpmName, setDpmName] = useState("");
  const [dpmPhone, setDpmPhone] = useState("");
  const [studentsCount, setStudentsCount] = useState("35");
  const [defaultRoomId, setDefaultRoomId] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [notes, setNotes] = useState("");

  const [deletingItem, setDeletingItem] = useState<AcademicClass | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && academicClasses.some((c) => c.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [academicClasses]);

  const selectedClass = useMemo(
    () => academicClasses.find((c) => c.id === selectedId) || null,
    [academicClasses, selectedId]
  );

  const filteredClasses = useMemo(() => {
    return academicClasses.filter((c) => {
      const q = searchQuery.trim();
      const prodiName = PRODI_LABELS[c.prodi] || "";
      const matchSearch =
        !q ||
        matchesFlexibleQuery(
          `${c.class_code} ${c.prodi} ${prodiName} ${c.dpm_name} ${c.dpm_phone} ${c.angkatan_year}`,
          q
        );
      const matchProdi = filterProdi === "ALL" || c.prodi === filterProdi;
      const matchSection =
        filterSection === "ALL" || c.class_section === filterSection;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? c.is_active : !c.is_active);
      return matchSearch && matchProdi && matchSection && matchActive;
    });
  }, [
    academicClasses,
    searchQuery,
    filterProdi,
    filterSection,
    filterActive,
  ]);

  const activeFilterCount =
    (filterProdi !== "ALL" ? 1 : 0) +
    (filterSection !== "ALL" ? 1 : 0) +
    (filterActive !== "ALL" ? 1 : 0);

  if (!canAccessPage("kelas")) {
    return (
      <MasterAdminGuard
        sectionLabel="Data Master Kelas & DPM"
        backHref={defaultHomeHref}
      />
    );
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat direktori data master kelas dan DPM (ketua kelas)..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Kelas & DPM"
        description="Sistem gagal mengambil daftar kelas mahasiswa dan ketua kelas. Silakan muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const openAddModal = () => {
    setEditingItem(null);
    setProdi("MPI");
    setAngkatanYear("24");
    setClassSection("A");
    setDpmName("");
    setDpmPhone("");
    setStudentsCount("35");
    setDefaultRoomId("");
    setIsActive("true");
    setNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: AcademicClass) => {
    setEditingItem(item);
    setProdi(item.prodi);
    setAngkatanYear(item.angkatan_year);
    setClassSection(item.class_section);
    setDpmName(item.dpm_name);
    setDpmPhone(item.dpm_phone === "-" ? "" : item.dpm_phone);
    setStudentsCount(String(item.students_count));
    setDefaultRoomId(item.default_room_id || "");
    setIsActive(item.is_active ? "true" : "false");
    setNotes(item.notes || "");
    setFormError("");
    setModalOpen(true);
  };

  const normalizedPreviewYear = normalizeAngkatanYear(angkatanYear);
  const previewClassCode = /^\d{2}$/.test(normalizedPreviewYear)
    ? buildAcademicClassCode(prodi, normalizedPreviewYear, classSection)
    : `${prodi}-??${classSection}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const normYear = normalizeAngkatanYear(angkatanYear);
    if (!/^\d{2}$/.test(normYear)) {
      setFormError(
        "Tahun Angkatan wajib diisi 2 angka belakang tahun (contoh: 24 untuk angkatan 2024)."
      );
      return;
    }

    if (!dpmName.trim()) {
      setFormError("Nama DPM (Ketua Kelas) wajib diisi.");
      return;
    }

    const matchedUnit = campusUnits.find(
      (u) => u.code.toUpperCase() === prodi.toUpperCase()
    );
    const payload = {
      prodi,
      unit_id: matchedUnit?.id || null,
      angkatan_year: normYear,
      class_section: classSection,
      dpm_name: dpmName.trim(),
      dpm_phone: dpmPhone.trim() || "-",
      students_count: Math.min(200, Math.max(1, Number(studentsCount) || 30)),
      default_room_id: defaultRoomId || null,
      is_active: isActive === "true",
      notes: notes.trim(),
    };

    const res = editingItem
      ? updateAcademicClass(editingItem.id, payload)
      : addAcademicClass(payload);

    if (!res.ok) {
      setFormError(res.error || "Gagal menyimpan data kelas.");
      return;
    }
    setModalOpen(false);
  };

  const columns: DataTableColumn<AcademicClass>[] = [
    {
      key: "code_prodi",
      header: "Kode Kelas & Prodi",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.class_code}
            </span>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.prodi} - {PRODI_LABELS[row.prodi]}
          </p>
        </div>
      ),
    },
    {
      key: "angkatan_section",
      header: "Angkatan & Bagian",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
            Angkatan &apos;{row.angkatan_year} (20{row.angkatan_year}) • Bagian{" "}
            {row.class_section}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Kapasitas Rombel: {row.students_count} mahasiswa
          </p>
        </div>
      ),
    },
    {
      key: "dpm",
      header: "DPM (Ketua Kelas)",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.dpm_name}
          </p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {row.dpm_phone}
          </p>
        </div>
      ),
    },
    {
      key: "room_activity",
      header: "Ruang & Riwayat Sirkulasi",
      render: (row) => {
        const room = rooms.find((r) => r.id === row.default_room_id);
        const kitLoansCount = officeKitLoans.filter(
          (l) => l.class_id === row.id || l.class_code === row.class_code
        ).length;
        const bookingCount = bookings.filter(
          (b) => b.class_id === row.id || b.class_code === row.class_code
        ).length;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {room ? `Ruang ${room.code}` : "Ruang Fleksibel"}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              {kitLoansCount} Sirkulasi Alat • {bookingCount} Reservasi Ruang
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
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditModal(row)}
            aria-label={`Edit kelas ${row.class_code}`}
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
            aria-label={`Hapus kelas ${row.class_code}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const drawerLoans = selectedClass
    ? officeKitLoans.filter(
        (l) =>
          l.class_id === selectedClass.id ||
          l.class_code === selectedClass.class_code
      )
    : [];
  const drawerRoom = selectedClass?.default_room_id
    ? rooms.find((r) => r.id === selectedClass.default_room_id)
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • ROMBONGAN BELAJAR & KETUA KELAS (DPM)
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Master Kelas & DPM
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Referensi resmi Prodi (MPI, PBA, TBIG, TBIN, TMTK, TIPA, PAI),
            tahun angkatan 2 digit, bagian kelas A-D, serta nama DPM sebagai
            penanggung jawab peminjaman kelas.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Kelas Baru</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Kelas"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode kelas (MPI-24A), nama DPM, atau prodi..."
            aria-label="Cari data kelas dan DPM"
            className="min-h-[44px] w-full sm:w-80 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Data Kelas"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterProdi("ALL");
              setFilterSection("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "prodi",
                label: "Program Studi (Prodi)",
                value: filterProdi,
                onChange: setFilterProdi,
                options: [
                  { value: "ALL", label: "Semua Prodi" },
                  ...PRODI_ENUM_LIST.map((p) => ({
                    value: p,
                    label: `${p} - ${PRODI_LABELS[p]}`,
                  })),
                ],
              },
              {
                key: "section",
                label: "Bagian Angkatan",
                value: filterSection,
                onChange: setFilterSection,
                options: [
                  { value: "ALL", label: "Semua Bagian" },
                  ...CLASS_SECTION_LIST.map((s) => ({
                    value: s,
                    label: `Bagian ${s}`,
                  })),
                ],
              },
              {
                key: "active",
                label: "Status Kelas",
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
        data={filteredClasses}
        rowKey={(c) => c.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Master Kelas"
        emptyDescription="Tambahkan data kelas berdasarkan Prodi, tahun angkatan 2 digit, bagian A-D, dan ketua kelas (DPM)."
        emptyActionLabel="Tambah Kelas Baru"
        onEmptyAction={openAddModal}
      />

      {/* Slide-Over Detail Drawer Kelas */}
      <Drawer
        isOpen={Boolean(selectedClass)}
        onClose={() => setSelectedId(null)}
        title={
          selectedClass
            ? `${selectedClass.class_code} (${PRODI_LABELS[selectedClass.prodi]})`
            : ""
        }
        subtitle={
          selectedClass
            ? `Angkatan 20${selectedClass.angkatan_year} • Bagian ${selectedClass.class_section} • DPM: ${selectedClass.dpm_name}`
            : undefined
        }
        headerBadge={
          selectedClass ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                {selectedClass.class_code}
              </span>
              <Badge tone={selectedClass.is_active ? "success" : "neutral"}>
                {selectedClass.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedClass ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedClass);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedClass)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Kelas</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedClass ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Program Studi
                </dt>
                <dd className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                  {selectedClass.prodi} - {PRODI_LABELS[selectedClass.prodi]}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Tahun Angkatan & Bagian
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                  &apos;{selectedClass.angkatan_year} (20
                  {selectedClass.angkatan_year}) • Bagian{" "}
                  {selectedClass.class_section}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  DPM (Ketua Kelas)
                </dt>
                <dd className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                  {selectedClass.dpm_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  WhatsApp DPM
                </dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedClass.dpm_phone}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Jumlah Mahasiswa
                </dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {selectedClass.students_count} orang
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Ruang Kelas Homebase
                </dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {drawerRoom
                    ? `${drawerRoom.code} (${drawerRoom.name})`
                    : "Fleksibel"}
                </dd>
              </div>
              {selectedClass.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan Kelas
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedClass.notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Riwayat Sirkulasi Alat Kantor Staf ({drawerLoans.length})
              </h3>
              {drawerLoans.length === 0 ? (
                <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada riwayat peminjaman peralatan kantor staf untuk kelas
                  ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {drawerLoans.map((loan) => (
                    <li key={loan.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {loan.loan_code}
                        </span>
                        <Badge
                          tone={
                            loan.status === "Dipinjam" ? "warning" : "success"
                          }
                        >
                          {loan.status}
                        </Badge>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {loan.kit_items_label}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 font-mono">
                        {loan.loan_date} • Pengambil: {loan.borrower_name}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EntityDrawerSections
              entityType="class"
              entityId={selectedClass.id}
              baseEventDates={[selectedClass.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Tambah / Edit Kelas */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Kelas ${editingItem.class_code}`
            : "Tambah Data Master Kelas & DPM"
        }
        description="Isi enum Prodi, 2 digit angka belakang tahun angkatan, bagian A-D, serta nama DPM ketua kelas."
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

          <div className="p-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Kode Kelas Otomatis (Prodi + Angkatan + Bagian):
            </span>
            <span className="px-2.5 py-1 text-sm font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {previewClassCode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Program Studi (Prodi) *"
              value={prodi}
              onChange={(e) => setProdi(e.target.value as ProdiCode)}
              options={PRODI_ENUM_LIST.map((p) => ({
                value: p,
                label: `${p} - ${PRODI_LABELS[p]}`,
              }))}
            />

            <Input
              label="Tahun Angkatan (2 Digit) *"
              placeholder="Contoh: 24 (untuk 2024)"
              maxLength={4}
              value={angkatanYear}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setAngkatanYear(digits.length === 4 ? digits.slice(-2) : digits);
              }}
              hint={
                /^\d{2}$/.test(normalizedPreviewYear)
                  ? `Tersimpan sebagai '${normalizedPreviewYear}' (Angkatan 20${normalizedPreviewYear})`
                  : "Isi 2 digit angka belakang tahun, misal 24 untuk 2024."
              }
              required
            />

            <Select
              label="Bagian Angkatan *"
              value={classSection}
              onChange={(e) =>
                setClassSection(e.target.value as ClassSectionCode)
              }
              options={CLASS_SECTION_LIST.map((s) => ({
                value: s,
                label: `Bagian ${s}`,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Lengkap DPM (Ketua Kelas) *"
              placeholder="Contoh: Ahmad Fauzan"
              value={dpmName}
              onChange={(e) => setDpmName(e.target.value)}
              required
            />
            <Input
              label="Nomor WhatsApp DPM"
              placeholder="Contoh: 0852-4411-2401"
              value={dpmPhone}
              onChange={(e) => setDpmPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Jumlah Mahasiswa"
              type="number"
              min={1}
              max={200}
              value={studentsCount}
              onChange={(e) => setStudentsCount(e.target.value)}
            />
            <Select
              label="Ruang Kelas Homebase (Opsional)"
              value={defaultRoomId}
              onChange={(e) => setDefaultRoomId(e.target.value)}
              options={[
                { value: "", label: "Tidak tetap / fleksibel" },
                ...rooms.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                })),
              ]}
            />
            <Select
              label="Status Kelas *"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              options={[
                { value: "true", label: "Aktif" },
                { value: "false", label: "Nonaktif" },
              ]}
            />
          </div>

          <Input
            label="Catatan Tambahan"
            placeholder="Misal: nama wakil ketua kelas atau jadwal rutin..."
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
              {editingItem ? "Simpan Perubahan" : "Simpan Kelas"}
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
        title="Konfirmasi Hapus Data Kelas"
        targetBadge={deletingItem?.class_code}
        targetName={
          deletingItem
            ? `${PRODI_LABELS[deletingItem.prodi]} (DPM: ${deletingItem.dpm_name})`
            : ""
        }
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={[
          "Data kelas akan dihapus dari Data Master, namun riwayat label kode kelas pada transaksi peminjaman tetap dipertahankan.",
        ]}
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteAcademicClass(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus kelas.");
            return;
          }
          if (selectedId === deletingItem.id) setSelectedId(null);
          setDeletingItem(null);
        }}
      />
    </div>
  );
}
