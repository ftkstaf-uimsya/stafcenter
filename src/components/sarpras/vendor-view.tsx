"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { MaintenanceVendor, MaintenanceVendorType } from "@/types/sarpras";
import { formatCurrencyIDR } from "@/lib/supabase/client";
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
import { MaintenanceStatusBadge } from "@/components/sarpras/status-badges";
import { MasterAdminGuard } from "@/components/sarpras/master-admin-guard";

const VENDOR_TYPES: MaintenanceVendorType[] = [
  "Teknisi Internal",
  "Vendor Eksternal",
];

const SPECIALTY_PRESETS = [
  "AC & Tata Udara (HVAC)",
  "Elektronik & Visual",
  "Audio Visual & Videotron",
  "Komputer & Jaringan",
  "Listrik & Utilitas",
  "Sipil & Furnitur",
  "Umum / Multi-Bidang",
];

export function VendorView() {
  const {
    maintenanceVendors,
    maintenanceLogs,
    canManageDataMaster,
    uiSimState,
    setUiSimState,
    addMaintenanceVendor,
    updateMaintenanceVendor,
    deleteMaintenanceVendor,
  } = useSarpras();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaintenanceVendor | null>(null);
  const [formError, setFormError] = useState("");

  const [vendorCode, setVendorCode] = useState("");
  const [name, setName] = useState("");
  const [vendorType, setVendorType] =
    useState<MaintenanceVendorType>("Vendor Eksternal");
  const [specialty, setSpecialty] = useState(SPECIALTY_PRESETS[0]);
  const [picName, setPicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [notes, setNotes] = useState("");

  const [deletingItem, setDeletingItem] = useState<MaintenanceVendor | null>(
    null
  );
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && maintenanceVendors.some((v) => v.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [maintenanceVendors]);

  const selectedVendor = useMemo(
    () => maintenanceVendors.find((v) => v.id === selectedId) || null,
    [maintenanceVendors, selectedId]
  );

  const filteredVendors = useMemo(() => {
    return maintenanceVendors.filter((v) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        v.vendor_code.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.specialty.toLowerCase().includes(q) ||
        v.pic_name.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q);
      const matchType = filterType === "ALL" || v.vendor_type === filterType;
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" ? v.is_active : !v.is_active);
      return matchSearch && matchType && matchActive;
    });
  }, [maintenanceVendors, searchQuery, filterType, filterActive]);

  const activeFilterCount =
    (filterType !== "ALL" ? 1 : 0) + (filterActive !== "ALL" ? 1 : 0);

  if (!canManageDataMaster) {
    return (
      <MasterAdminGuard sectionLabel="Data Master Teknisi & Vendor Pemeliharaan" />
    );
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat direktori teknisi internal dan vendor pemeliharaan..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Data Master Teknisi & Vendor"
        description="Sistem gagal mengambil daftar teknisi dan vendor pemeliharaan. Silakan coba muat ulang."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const getVendorTickets = (vendor: MaintenanceVendor) =>
    maintenanceLogs.filter(
      (m) =>
        m.vendor_id === vendor.id ||
        (m.technician_vendor || "")
          .toLowerCase()
          .includes(vendor.name.toLowerCase())
    );

  const openAddModal = () => {
    setEditingItem(null);
    setVendorCode("");
    setName("");
    setVendorType("Vendor Eksternal");
    setSpecialty(SPECIALTY_PRESETS[0]);
    setPicName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setIsActive("true");
    setNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item: MaintenanceVendor) => {
    setEditingItem(item);
    setVendorCode(item.vendor_code);
    setName(item.name);
    setVendorType(item.vendor_type);
    setSpecialty(item.specialty);
    setPicName(item.pic_name);
    setPhone(item.phone);
    setEmail(item.email || "");
    setAddress(item.address || "");
    setIsActive(item.is_active ? "true" : "false");
    setNotes(item.notes || "");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = vendorCode.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanPic = picName.trim();
    const cleanPhone = phone.trim();
    const cleanSpecialty = specialty.trim();

    if (!cleanCode || !cleanName || !cleanPic || !cleanPhone || !cleanSpecialty) {
      setFormError(
        "Kode Vendor, Nama Vendor/Tim, Spesialisasi, Nama PIC Teknisi, dan Nomor Telepon wajib diisi."
      );
      return;
    }

    const dup = maintenanceVendors.some(
      (v) =>
        v.vendor_code.toLowerCase() === cleanCode.toLowerCase() &&
        v.id !== editingItem?.id
    );
    if (dup) {
      setFormError(`Kode Vendor "${cleanCode}" sudah terdaftar.`);
      return;
    }

    const payload = {
      vendor_code: cleanCode,
      name: cleanName,
      vendor_type: vendorType,
      specialty: cleanSpecialty,
      pic_name: cleanPic,
      phone: cleanPhone,
      email: email.trim(),
      address: address.trim(),
      is_active: isActive === "true",
      notes: notes.trim(),
    };

    if (editingItem) {
      updateMaintenanceVendor(editingItem.id, payload);
    } else {
      addMaintenanceVendor(payload);
    }
    setModalOpen(false);
  };

  const columns: DataTableColumn<MaintenanceVendor>[] = [
    {
      key: "vendor",
      header: "Kode & Nama Teknisi / Vendor",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.vendor_code}
            </span>
            <Badge
              tone={
                row.vendor_type === "Teknisi Internal" ? "info" : "warning"
              }
            >
              {row.vendor_type}
            </Badge>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.name}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Bidang: {row.specialty}
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Teknisi PIC & Kontak",
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {row.pic_name}
          </p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {row.phone}
          </p>
          <p className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
            {row.email || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "metrics",
      header: "Riwayat Pekerjaan & Biaya",
      render: (row) => {
        const tickets = getVendorTickets(row);
        const totalCost = tickets.reduce((acc, t) => acc + t.repair_cost, 0);
        const openCount = tickets.filter(
          (t) => t.status !== "Selesai Diperbaiki"
        ).length;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-[#1E3A5F] dark:text-sky-400">
              {tickets.length} tiket ({openCount} aktif)
            </p>
            <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {formatCurrencyIDR(totalCost)}
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
            aria-label={`Edit vendor ${row.name}`}
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
            aria-label={`Hapus vendor ${row.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const drawerTickets = selectedVendor ? getVendorTickets(selectedVendor) : [];
  const drawerTotalCost = drawerTickets.reduce(
    (acc, t) => acc + t.repair_cost,
    0
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            DATA MASTER • MITRA PERBAIKAN & TEKNISI
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Master Teknisi & Vendor Pemeliharaan
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola tim teknisi internal dan vendor eksternal yang ditugaskan
            pada tiket pemeliharaan dan perbaikan fasilitas.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openAddModal}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah Teknisi / Vendor</span>
        </Button>
      </section>

      <section
        aria-label="Filter dan Pencarian Vendor"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik kode, nama vendor, bidang, atau PIC teknisi..."
            aria-label="Cari teknisi atau vendor"
            className="min-h-[44px] w-full sm:w-80 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Teknisi & Vendor"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterType("ALL");
              setFilterActive("ALL");
            }}
            groups={[
              {
                key: "type",
                label: "Kategori Mitra",
                value: filterType,
                onChange: setFilterType,
                options: [
                  { value: "ALL", label: "Semua Kategori" },
                  ...VENDOR_TYPES.map((t) => ({ value: t, label: t })),
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
        data={filteredVendors}
        rowKey={(v) => v.id}
        hiddenColumnKeys={hiddenColumnKeys}
        activeRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="Belum Ada Data Teknisi / Vendor"
        emptyDescription="Tambahkan tim teknisi internal atau mitra vendor eksternal untuk penugasan perbaikan."
        emptyActionLabel="Tambah Teknisi / Vendor"
        onEmptyAction={openAddModal}
      />

      <Drawer
        isOpen={Boolean(selectedVendor)}
        onClose={() => setSelectedId(null)}
        title={selectedVendor?.name || ""}
        subtitle={
          selectedVendor
            ? `${selectedVendor.vendor_code} • ${selectedVendor.specialty}`
            : undefined
        }
        headerBadge={
          selectedVendor ? (
            <>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {selectedVendor.vendor_code}
              </span>
              <Badge
                tone={
                  selectedVendor.vendor_type === "Teknisi Internal"
                    ? "info"
                    : "warning"
                }
              >
                {selectedVendor.vendor_type}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedVendor ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setDeletingItem(selectedVendor);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => openEditModal(selectedVendor)}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
                <span>Edit Vendor</span>
              </Button>
            </div>
          ) : null
        }
      >
        {selectedVendor ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  PIC / Teknisi Utama
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedVendor.pic_name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Telepon / WhatsApp
                </dt>
                <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {selectedVendor.phone}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Email</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedVendor.email || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Akumulasi Biaya Perbaikan
                </dt>
                <dd className="mt-0.5 font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                  {formatCurrencyIDR(drawerTotalCost)}
                </dd>
              </div>
              {selectedVendor.address ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Alamat / Lokasi Workshop
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedVendor.address}
                  </dd>
                </div>
              ) : null}
              {selectedVendor.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-600 dark:text-slate-400">Catatan</dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {selectedVendor.notes}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Riwayat Tiket Ditangani ({drawerTickets.length})
              </h3>
              {drawerTickets.length === 0 ? (
                <p className="p-3 text-xs text-slate-600 dark:text-slate-400 rounded border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Belum ada tiket pemeliharaan yang ditugaskan ke vendor ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {drawerTickets.map((t) => (
                    <li key={t.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                          {t.ticket_code}
                        </span>
                        <MaintenanceStatusBadge status={t.status} />
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {t.issue_title}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {t.reported_at.slice(0, 10)} •{" "}
                        {formatCurrencyIDR(t.repair_cost)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EntityDrawerSections
              entityType="vendor"
              entityId={selectedVendor.id}
              baseEventDates={[selectedVendor.created_at]}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Edit Vendor ${editingItem.vendor_code}`
            : "Tambah Teknisi / Vendor Baru"
        }
        description="Data teknisi & vendor akan tersedia langsung di form Update Progres Perbaikan."
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
              label="Kode Teknisi / Vendor *"
              placeholder="Contoh: VND-HVAC-01"
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              required
            />
            <Select
              label="Jenis Mitra *"
              value={vendorType}
              onChange={(e) =>
                setVendorType(e.target.value as MaintenanceVendorType)
              }
              options={VENDOR_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <Input
            label="Nama Perusahaan Vendor / Tim Teknisi *"
            placeholder="Contoh: CV Sejuk Teknik Mandiri"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Bidang Spesialisasi *"
              value={
                SPECIALTY_PRESETS.includes(specialty) ? specialty : "CUSTOM"
              }
              onChange={(e) => {
                if (e.target.value !== "CUSTOM") {
                  setSpecialty(e.target.value);
                }
              }}
              options={[
                ...SPECIALTY_PRESETS.map((s) => ({ value: s, label: s })),
                ...(!SPECIALTY_PRESETS.includes(specialty)
                  ? [{ value: "CUSTOM", label: `Lainnya: ${specialty}` }]
                  : []),
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
              label="Nama PIC / Teknisi Utama *"
              placeholder="Nama teknisi lapangan"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              required
            />
            <Input
              label="Nomor Telepon / WA *"
              placeholder="0812-xxxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="support@vendor.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Input
            label="Alamat / Lokasi Workshop"
            placeholder="Contoh: Jl. Industri Raya No. 18 atau Ruang Workshop Sarpras"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Input
            label="Catatan Kontrak / Layanan"
            placeholder="Contoh: Mitra servis AC berkala setiap 4 bulan"
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
              {editingItem ? "Simpan Perubahan" : "Simpan Teknisi / Vendor"}
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
        title="Konfirmasi Hapus Teknisi / Vendor"
        targetBadge={deletingItem?.vendor_code}
        targetName={deletingItem?.name || ""}
        errorMessage={deleteError}
        isSubmitting={deleting}
        impactNotes={
          deletingItem
            ? (() => {
                const count = getVendorTickets(deletingItem).length;
                if (count > 0) {
                  return [
                    `Vendor ini terhubung pada ${count} tiket pemeliharaan. Tautan vendor akan dilepas, namun nama historis pada tiket tetap tersimpan.`,
                  ];
                }
                return [
                  "Tidak ada tiket pemeliharaan yang terikat pada vendor ini.",
                ];
              })()
            : []
        }
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteMaintenanceVendor(deletingItem.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus teknisi/vendor.");
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
