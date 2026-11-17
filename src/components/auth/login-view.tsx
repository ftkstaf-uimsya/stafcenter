"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingStateView } from "@/components/ui/data-states";

export function LoginView() {
  const router = useRouter();
  const {
    isLiveSupabase,
    serverConfigured,
    authUser,
    authLoading,
    signInWithUsername,
    signOut,
  } = useSarpras();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (authLoading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <LoadingStateView message="Memeriksa status sesi autentikasi staf..." />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim() || !password) {
      setErrorMsg("Username dan kata sandi wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signInWithUsername(username, password);
      if (!res.ok) {
        setErrorMsg(res.error || "Gagal masuk ke sistem.");
        return;
      }
      router.push("/sarpras/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  if (authUser) {
    const isMaster = authUser.role === "master_admin";
    return (
      <div className="w-full max-w-xl mx-auto py-4">
        <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                SESI STAF TERAUTENTIKASI
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                {authUser.fullName}
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Seluruh pengelolaan data sarana prasarana tersimpan permanen ke
                PostgreSQL Supabase.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/60 p-4 rounded-md border border-slate-200 dark:border-slate-800">
            <div>
              <dt className="text-slate-600 dark:text-slate-400">Username</dt>
              <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                {authUser.username}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600 dark:text-slate-400">Peran Akses</dt>
              <dd className="mt-0.5 font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{isMaster ? "Master Admin" : "Staf Operasional"}</span>
              </dd>
            </div>
            {authUser.email ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-600 dark:text-slate-400">Email</dt>
                <dd className="mt-0.5 font-mono text-slate-800 dark:text-slate-200 break-all">
                  {authUser.email}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/sarpras/dashboard"
                className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center rounded-md bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-sky-400 dark:hover:bg-sky-300 text-sm font-bold text-white dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              >
                Buka Dashboard Sarpras
              </Link>
              {isMaster ? (
                <Link
                  href="/sarpras/akun"
                  className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center gap-2 rounded-md border border-slate-400 dark:border-slate-600 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                >
                  <Users className="w-4 h-4" aria-hidden="true" />
                  <span>Kelola Akun Staf</span>
                </Link>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Keluar</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-2">
      <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-5">
        <div className="space-y-1.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>AUTENTIKASI OPERATOR BIRO SARPRAS</span>
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Masuk Akun StafCenter
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Gunakan username dan kata sandi akun staf resmi yang dikelola oleh
            Master Admin untuk mengakses modul operasional Sarana Prasarana.
          </p>
        </div>

        {!isLiveSupabase ? (
          <div
            role="alert"
            className="p-3.5 rounded-md border border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-xs text-amber-950 dark:text-amber-200"
          >
            Konfigurasi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> belum tersedia.
          </div>
        ) : !serverConfigured ? (
          <div
            role="alert"
            className="p-3.5 rounded-md border border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-xs text-amber-950 dark:text-amber-200 space-y-1"
          >
            <p className="font-bold">Konfigurasi Server Belum Lengkap</p>
            <p>
              Tambahkan variabel <code>SUPABASE_SERVICE_ROLE_KEY</code> pada
              environment server dan jalankan migrasi{" "}
              <code>002_staff_accounts.sql</code> di Supabase.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg ? (
            <div
              role="alert"
              className="p-3 rounded-md border border-red-600 bg-red-50 dark:bg-red-950 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {errorMsg}
            </div>
          ) : null}

          <Input
            label="Username *"
            type="text"
            placeholder="Contoh: staf"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <Input
            label="Kata Sandi *"
            type="password"
            placeholder="Masukkan kata sandi akun"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !isLiveSupabase}
              className="w-full"
            >
              {submitting ? "Memverifikasi Akun..." : "Masuk ke StafCenter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
