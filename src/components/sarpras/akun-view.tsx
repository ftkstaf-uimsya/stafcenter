"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { StaffAccount, StaffRole } from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";

export function AkunView() {
  const { authUser, notify, uiSimState, setUiSimState } = useSarpras();

  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  // Modal Tambah / Edit Akun
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StaffAccount | null>(
    null
  );
  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("staff");
  const [formIsActive, setFormIsActive] = useState("true");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal Konfirmasi Hapus Akun
  const [deletingAccount, setDeletingAccount] = useState<StaffAccount | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const isMasterAdmin = authUser?.role === "master_admin";

  const loadAccounts = useCallback(async () => {
    if (!isMasterAdmin) {
      setLoadingAccounts(false);
      return;
    }
    setLoadingAccounts(true);
    setFetchError("");
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || "Gagal mengambil daftar akun staf.");
        return;
      }
      setAccounts((data.accounts || []) as StaffAccount[]);
    } catch {
      setFetchError("Koneksi terputus saat mengambil daftar akun staf.");
    } finally {
      setLoadingAccounts(false);
    }
  }, [isMasterAdmin]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        acc.username.toLowerCase().includes(q) ||
        acc.full_name.toLowerCase().includes(q) ||
        (acc.email || "").toLowerCase().includes(q);
      const matchRole = filterRole === "ALL" || acc.role === filterRole;
      return matchQuery && matchRole;
    });
  }, [accounts, searchQuery, filterRole]);

  if (!isMasterAdmin) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div
          role="alert"
          className="p-6 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-center space-y-4"
        >
          <ShieldAlert
            className="w-10 h-10 text-red-700 dark:text-red-400 mx-auto"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-red-950 dark:text-red-100">
              Akses Terbatas: Khusus Master Admin
            </h1>
            <p className="text-xs text-red-900 dark:text-red-200">
              Halaman pengelolaan akun staf hanya dapat dibuka oleh akun Master
              Admin.
            </p>
          </div>
          <Link
            href="/sarpras/dashboard"
            className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center rounded-md bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#162C49] dark:bg-sky-400 dark:text-slate-950"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (uiSimState === "loading" || loadingAccounts) {
    return <LoadingStateView message="Memuat daftar akun operator StafCenter..." />;
  }

  if (uiSimState === "error" || fetchError) {
    return (
      <ErrorStateView
        title="Gagal Memuat Manajemen Akun Staf"
        description={
          fetchError ||
          "Terjadi gangguan saat mengambil data akun staf dari server."
        }
        onRetry={() => {
          setUiSimState("normal");
          void loadAccounts();
        }}
      />
    );
  }

  const openAddModal = () => {
    setEditingAccount(null);
    setFormUsername("");
    setFormFullName("");
    setFormEmail("");
    setFormRole("staff");
    setFormIsActive("true");
    setFormPassword("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (acc: StaffAccount) => {
    setEditingAccount(acc);
    setFormUsername(acc.username);
    setFormFullName(acc.full_name);
    setFormEmail(acc.email || "");
    setFormRole(acc.role);
    setFormIsActive(acc.is_active ? "true" : "false");
    setFormPassword("");
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanUsername = formUsername.trim().toLowerCase();
    if (!cleanUsername || !/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
      setFormError(
        "Username wajib 3-40 karakter (huruf kecil, angka, titik, underscore, atau strip)."
      );
      return;
    }

    if (!formFullName.trim()) {
      setFormError("Nama lengkap petugas wajib diisi.");
      return;
    }

    if (!editingAccount && formPassword.length < 8) {
      setFormError("Kata sandi awal akun baru minimal 8 karakter.");
      return;
    }

    if (editingAccount && formPassword && formPassword.length < 8) {
      setFormError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingAccount) {
        const res = await fetch(`/api/admin/accounts/${editingAccount.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUsername,
            full_name: formFullName.trim(),
            email: formEmail.trim(),
            role: formRole,
            is_active: formIsActive === "true",
            new_password: formPassword || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Gagal memperbarui akun staf.");
          return;
        }
        notify(
          "success",
          "Akun Staf Diperbarui",
          `Data akun "${cleanUsername}" berhasil disimpan ke Supabase.`
        );
      } else {
        const res = await fetch("/api/admin/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUsername,
            full_name: formFullName.trim(),
            email: formEmail.trim(),
            role: formRole,
            password: formPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Gagal menambah akun staf.");
          return;
        }
        notify(
          "success",
          "Akun Staf Ditambahkan",
          `Akun "${cleanUsername}" siap dipakai masuk di halaman login.`
        );
      }
      setModalOpen(false);
      await loadAccounts();
    } catch {
      setFormError("Terjadi gangguan jaringan saat menyimpan akun.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/accounts/${deletingAccount.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        notify("error", "Gagal Menghapus Akun", data.error || "Operasi ditolak.");
        return;
      }
      notify(
        "info",
        "Akun Staf Dihapus",
        `Akun "${deletingAccount.username}" telah dihapus permanen.`
      );
      setDeletingAccount(null);
      await loadAccounts();
    } catch {
      notify("error", "Gagal Menghapus Akun", "Koneksi ke server terputus.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<StaffAccount>[] = [
    {
      key: "username",
      header: "Username & Petugas",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.username}
            </span>
            {row.id === authUser?.id ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-500/40">
                Sesi Anda
              </span>
            ) : null}
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.full_name}
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {row.email || "Tanpa alamat email"}
          </p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Peran Akses",
      render: (row) => (
        <Badge tone={row.role === "master_admin" ? "info" : "neutral"}>
          <span>
            {row.role === "master_admin" ? "Master Admin" : "Staf Operasional"}
          </span>
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status Akun",
      render: (row) => (
        <Badge tone={row.is_active ? "success" : "danger"}>
          {row.is_active ? (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{row.is_active ? "Aktif" : "Nonaktif"}</span>
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Kelola Akun",
      render: (row) => {
        const isRootMaster = row.username === "staf";
        const isSelf = row.id === authUser?.id;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditModal(row)}
              aria-label={`Edit akun ${row.username}`}
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Edit / Reset Sandi</span>
            </Button>
            {!isRootMaster && !isSelf ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setDeletingAccount(row)}
                aria-label={`Hapus akun ${row.username}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hapus</span>
              </Button>
            ) : (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2">
                Dilindungi
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const displayData = uiSimState === "empty" ? [] : filteredAccounts;

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            ADMINISTRASI SISTEM • KONTROL MASTER ADMIN
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Manajemen Akun Staf StafCenter
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tambah, ubah peran, atur ulang kata sandi, nonaktifkan, atau hapus
            akun operator kampus melalui hak akses Master Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadAccounts()}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Muat Ulang</span>
          </Button>
          <Button type="button" variant="primary" onClick={openAddModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Akun Staf</span>
          </Button>
        </div>
      </section>

      {/* Ringkasan Statistik Akun */}
      <section
        aria-label="Ringkasan Akun Staf"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Total Akun Terdaftar
          </p>
          <p className="mt-1 text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
            {accounts.length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Akun Aktif
          </p>
          <p className="mt-1 text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400">
            {accounts.filter((a) => a.is_active).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Master Admin
          </p>
          <p className="mt-1 text-2xl font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
            {accounts.filter((a) => a.role === "master_admin").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Staf Operasional
          </p>
          <p className="mt-1 text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
            {accounts.filter((a) => a.role === "staff").length}
          </p>
        </div>
      </section>

      {/* Filter & Pencarian */}
      <section
        aria-label="Filter Daftar Akun Staf"
        className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <Input
          label="Cari Username / Nama / Email"
          placeholder="Contoh: staf, hendra, atau email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          label="Filter Peran Akses"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          options={[
            { value: "ALL", label: "Semua Peran Akun" },
            { value: "master_admin", label: "Master Admin" },
            { value: "staff", label: "Staf Operasional" },
          ]}
        />
      </section>

      {/* Tabel Data Akun */}
      <DataTable
        columns={columns}
        data={displayData}
        rowKey={(a) => a.id}
        emptyTitle="Tidak Ada Akun Staf yang Cocok"
        emptyDescription="Belum ada akun staf sesuai filter pencarian yang dipilih."
        emptyActionLabel="Tambah Akun Staf"
        onEmptyAction={openAddModal}
      />

      {/* Modal Tambah / Edit Akun Staf */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingAccount
            ? `Edit Akun: ${editingAccount.username}`
            : "Tambah Akun Staf Baru"
        }
        description="Akun yang dibuat langsung aktif dan dapat digunakan masuk pada halaman login."
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
              label="Username Login *"
              placeholder="Contoh: hendra.sarpras"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              disabled={editingAccount?.username === "staf"}
              required
            />
            <Select
              label="Peran Akses *"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as StaffRole)}
              disabled={editingAccount?.username === "staf"}
              options={[
                { value: "staff", label: "Staf Operasional" },
                { value: "master_admin", label: "Master Admin" },
              ]}
            />
          </div>

          <Input
            label="Nama Lengkap Petugas *"
            placeholder="Contoh: Hendra Wijaya, S.T."
            value={formFullName}
            onChange={(e) => setFormFullName(e.target.value)}
            required
          />

          <Input
            label="Alamat Email (Opsional)"
            type="email"
            placeholder="Contoh: hendra@kampus.ac.id"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />

          {editingAccount ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Status Akun *"
                value={formIsActive}
                onChange={(e) => setFormIsActive(e.target.value)}
                disabled={
                  editingAccount.username === "staf" ||
                  editingAccount.id === authUser?.id
                }
                options={[
                  { value: "true", label: "Aktif (Diizinkan Masuk)" },
                  { value: "false", label: "Nonaktif (Diblokir)" },
                ]}
              />
              <Input
                label="Kata Sandi Baru (Opsional)"
                type="password"
                placeholder="Kosongkan jika tetap"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
          ) : (
            <Input
              label="Kata Sandi Awal *"
              type="password"
              placeholder="Minimal 8 karakter"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? "Menyimpan..."
                  : editingAccount
                  ? "Simpan Perubahan"
                  : "Buat Akun Staf"}
              </span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Akun */}
      <Modal
        isOpen={Boolean(deletingAccount)}
        onClose={() => setDeletingAccount(null)}
        title="Konfirmasi Hapus Akun Staf"
        description="Tindakan ini akan menghapus akun secara permanen dan mencabut seluruh aksesnya."
      >
        {deletingAccount ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-800 dark:text-slate-200">
              Apakah Anda yakin ingin menghapus akun{" "}
              <strong className="font-mono">{deletingAccount.username}</strong> (
              {deletingAccount.full_name})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingAccount(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={() => void handleDeleteConfirm()}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>{deleting ? "Menghapus..." : "Ya, Hapus Akun"}</span>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
