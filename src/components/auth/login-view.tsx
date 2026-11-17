"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingStateView } from "@/components/ui/data-states";

type AuthMode = "login" | "register";

export function LoginView() {
  const router = useRouter();
  const {
    isLiveSupabase,
    authUser,
    authLoading,
    signInWithPassword,
    signUpStaff,
    signOut,
  } = useSarpras();

  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

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
    setInfoMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Email dan kata sandi wajib diisi.");
      return;
    }

    if (mode === "register" && (!fullName.trim() || password.length < 6)) {
      setErrorMsg(
        "Nama lengkap wajib diisi dan kata sandi minimal 6 karakter."
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const res = await signInWithPassword(email, password);
        if (!res.ok) {
          setErrorMsg(res.error || "Gagal masuk ke sistem.");
          return;
        }
        router.push("/sarpras/dashboard");
      } else {
        const res = await signUpStaff(email, password, fullName);
        if (!res.ok) {
          setErrorMsg(res.error || "Gagal mendaftarkan akun staf.");
          return;
        }
        if (res.needsEmailConfirm) {
          setInfoMsg(
            `Akun berhasil dibuat. Periksa kotak masuk ${email.trim()} untuk klik tautan verifikasi sebelum masuk.`
          );
          setMode("login");
        } else {
          router.push("/sarpras/dashboard");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authUser) {
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
                Koneksi Database Supabase Aktif
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Seluruh pengelolaan data sarana prasarana tersimpan permanen ke
                PostgreSQL Supabase.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/60 p-4 rounded-md border border-slate-200 dark:border-slate-800">
            <div>
              <dt className="text-slate-600 dark:text-slate-400">
                Email Operator
              </dt>
              <dd className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100 break-all">
                {authUser.email}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600 dark:text-slate-400">
                Status Kebijakan RLS
              </dt>
              <dd className="mt-0.5 font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Terverifikasi (authenticated)</span>
              </dd>
            </div>
            {authUser.fullName ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Nama Petugas
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                  {authUser.fullName}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-600 dark:text-slate-400">User ID</dt>
              <dd className="mt-0.5 font-mono text-slate-700 dark:text-slate-300 truncate">
                {authUser.id}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link
              href="/sarpras/dashboard"
              className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center rounded-md bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-sky-400 dark:hover:bg-sky-300 text-sm font-bold text-white dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
            >
              Buka Dashboard Sarpras
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Keluar dari Sesi</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-2">
      <div className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            AUTENTIKASI OPERATOR BIRO SARPRAS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Masuk Akun Staf StafCenter
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Masuk menggunakan akun staf resmi untuk mengakses modul operasional
            Sarana Prasarana serta mengelola data secara langsung di database
            Supabase.
          </p>
        </div>

        {!isLiveSupabase ? (
          <div
            role="alert"
            className="p-3.5 rounded-md border border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-xs text-amber-950 dark:text-amber-200"
          >
            Koneksi Supabase belum dikonfigurasi pada environment saat ini.
            Tambahkan <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> terlebih dahulu.
          </div>
        ) : null}

        {/* Tab Masuk / Daftar Akun Staf */}
        <div
          role="tablist"
          aria-label="Pilih mode autentikasi staf"
          className="grid grid-cols-2 gap-2 p-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => {
              setMode("login");
              setErrorMsg("");
            }}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
              mode === "login"
                ? "bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950"
                : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
            }`}
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span>Masuk Akun Staf</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            onClick={() => {
              setMode("register");
              setErrorMsg("");
            }}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${
              mode === "register"
                ? "bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950"
                : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
            }`}
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Daftar Staf Baru</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg ? (
            <div
              role="alert"
              className="p-3 rounded-md border border-red-600 bg-red-50 dark:bg-red-950 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {errorMsg}
            </div>
          ) : null}

          {infoMsg ? (
            <div
              role="status"
              className="p-3 rounded-md border border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-xs font-medium text-emerald-900 dark:text-emerald-200"
            >
              {infoMsg}
            </div>
          ) : null}

          {mode === "register" ? (
            <Input
              label="Nama Lengkap Petugas *"
              placeholder="Contoh: Hendra Wijaya, S.T."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          ) : null}

          <Input
            label="Email Staf Kampus *"
            type="email"
            placeholder="ftkstaf@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <Input
            label="Kata Sandi *"
            type="password"
            placeholder="Minimal 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !isLiveSupabase}
              className="w-full"
            >
              {submitting
                ? "Memproses Autentikasi..."
                : mode === "login"
                ? "Masuk ke StafCenter"
                : "Daftarkan Akun Staf"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
