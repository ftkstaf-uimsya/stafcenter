"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Boxes,
  Cable,
  CalendarClock,
  ClipboardPlus,
  DoorOpen,
  GraduationCap,
  HardHat,
  Landmark,
  Monitor,
  Package,
  RotateCcw,
  School,
  ScrollText,
  Search,
  UserCog,
  Wrench,
  X,
} from "lucide-react";
import { getThesisHref, getThesisPageKey } from "@/lib/auth/permissions";
import { matchesFlexibleQuery } from "@/lib/search-normalize";
import { useSarpras } from "@/lib/supabase/sarpras-context";

interface SearchHit {
  id: string;
  category: string;
  code: string;
  title: string;
  meta: string;
  href?: string;
  onAction?: () => void;
  icon: React.ReactNode;
}

export function CommandSearch() {
  const router = useRouter();
  const {
    rooms,
    assets,
    bookings,
    maintenanceLogs,
    consumables,
    lecturers,
    courses,
    campusOfficials,
    campusUnits,
    maintenanceVendors,
    academicClasses,
    officeKitItems,
    officeKitLoans,
    thesisWorkflows,
    canAccessPage,
    isLiveSupabase,
    resetToSeedData,
    commandSearchOpen,
    setCommandSearchOpen,
  } = useSarpras();

  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandSearchOpen(!commandSearchOpen);
      } else if (e.key === "Escape" && commandSearchOpen && !e.defaultPrevented) {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== dialogRef.current) {
          return;
        }
        e.preventDefault();
        setCommandSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandSearchOpen, setCommandSearchOpen]);

  useEffect(() => {
    if (commandSearchOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandSearchOpen]);

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const hits: SearchHit[] = [];

    if (
      !q ||
      matchesFlexibleQuery(
        "meja kerja pixel workspace pomodoro to-do jurnal sticky notes cuaca",
        q
      )
    ) {
      hits.push({
        id: "nav-meja-kerja",
        category: "Ruang Kerja Staf",
        code: "MEJA KERJA",
        title: "Buka Meja Kerja Pixel (Produktivitas & Agenda Harian)",
        meta: "To-do, Pomodoro, Sticky Notes, Jurnal Harian, Kucing Pet, & Kalender Kampus",
        href: "/sarpras/meja-kerja",
        icon: <Monitor className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      });
    }

    if (canAccessPage("sirkulasi-invent")) {
      if (
        !q ||
        matchesFlexibleQuery(
          "pinjam cepat loket sirkulasi invent alat kantor staf",
          q
        )
      ) {
        hits.push({
          id: "nav-pinjam-cepat",
          category: "Pintasan Loket",
          code: "PINJAM CEPAT",
          title: "Buka Halaman Pinjam Cepat Alat Kantor Staf",
          meta: "Form peminjaman cepat berdampingan dengan daftar dipinjam & dikembalikan",
          href: "/sarpras/sirkulasi-invent/pinjam-cepat",
          icon: (
            <ClipboardPlus className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />
          ),
        });
      }
    }

    if (canAccessPage("peminjaman")) {
      if (
        !q ||
        matchesFlexibleQuery(
          "pinjam cepat ruangan alat portabel reservasi fasilitas",
          q
        )
      ) {
        hits.push({
          id: "nav-pinjam-cepat-fasilitas",
          category: "Pintasan Loket",
          code: "PINJAM CEPAT FASILITAS",
          title: "Buka Pinjam Cepat Ruangan & Alat Portabel",
          meta: "Form peminjaman ruangan/alat dengan foto bukti & antrean cepat",
          href: "/sarpras/sirkulasi-invent/pinjam-cepat?mode=fasilitas",
          icon: (
            <CalendarClock className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />
          ),
        });
      }
    }

    if (canAccessPage("ruangan")) {
      for (const r of rooms) {
        if (
          !q ||
          matchesFlexibleQuery(`${r.code} ${r.name} ${r.pic_name}`, q)
        ) {
          hits.push({
            id: `rm-${r.id}`,
            category: "Ruangan",
            code: r.code,
            title: r.name,
            meta: `PIC: ${r.pic_name} • ${r.status}`,
            href: `/sarpras/ruangan?inspect=${r.id}`,
            icon: <DoorOpen className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("dosen")) {
      for (const l of lecturers) {
        if (
          !qLower ||
          l.nidn_nip.toLowerCase().includes(qLower) ||
          l.full_name.toLowerCase().includes(qLower) ||
          l.homebase_prodi.toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `dsn-${l.id}`,
            category: "Dosen",
            code: l.nidn_nip,
            title: l.full_name,
            meta: `${l.homebase_prodi} • ${l.employment_status}`,
            href: `/sarpras/dosen?inspect=${l.id}`,
            icon: (
              <GraduationCap className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />
            ),
          });
        }
      }
    }

    if (canAccessPage("makul")) {
      for (const c of courses) {
        if (
          !qLower ||
          c.code.toLowerCase().includes(qLower) ||
          c.name.toLowerCase().includes(qLower) ||
          c.prodi.toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `mk-${c.id}`,
            category: "Makul",
            code: c.code,
            title: c.name,
            meta: `${c.prodi} • Smt ${c.semester} (${c.sks_theory + c.sks_practice} SKS)`,
            href: `/sarpras/makul?inspect=${c.id}`,
            icon: <BookOpen className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("pengurus")) {
      for (const o of campusOfficials) {
        if (
          !qLower ||
          o.official_code.toLowerCase().includes(qLower) ||
          o.full_name.toLowerCase().includes(qLower) ||
          o.position_title.toLowerCase().includes(qLower) ||
          o.unit_name.toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `pgr-${o.id}`,
            category: "Pengurus Kampus",
            code: o.official_code,
            title: o.full_name,
            meta: `${o.position_title} • ${o.unit_name}`,
            href: `/sarpras/pengurus?inspect=${o.id}`,
            icon: <UserCog className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("unit")) {
      for (const u of campusUnits) {
        if (
          !qLower ||
          u.code.toLowerCase().includes(qLower) ||
          u.name.toLowerCase().includes(qLower) ||
          u.unit_type.toLowerCase().includes(qLower) ||
          (u.leader_name || "").toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `unit-${u.id}`,
            category: "Unit / Prodi",
            code: u.code,
            title: u.name,
            meta: `${u.unit_type}${u.leader_name ? ` • ${u.leader_name}` : ""}`,
            href: `/sarpras/unit?inspect=${u.id}`,
            icon: <Landmark className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("vendor")) {
      for (const v of maintenanceVendors) {
        if (
          !qLower ||
          v.vendor_code.toLowerCase().includes(qLower) ||
          v.name.toLowerCase().includes(qLower) ||
          v.specialty.toLowerCase().includes(qLower) ||
          v.pic_name.toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `vnd-${v.id}`,
            category: "Vendor / Teknisi",
            code: v.vendor_code,
            title: v.name,
            meta: `${v.vendor_type} • ${v.specialty} (PIC: ${v.pic_name})`,
            href: `/sarpras/vendor?inspect=${v.id}`,
            icon: <HardHat className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("kelas")) {
      for (const cls of academicClasses) {
        if (
          !q ||
          matchesFlexibleQuery(
            `${cls.class_code} ${cls.prodi} ${cls.dpm_name}`,
            q
          )
        ) {
          hits.push({
            id: `cls-${cls.id}`,
            category: "Kelas & DPM",
            code: cls.class_code,
            title: `Prodi ${cls.prodi} (Angkatan '${cls.angkatan_year} Bagian ${cls.class_section})`,
            meta: `DPM: ${cls.dpm_name} • ${cls.students_count} mhs`,
            href: `/sarpras/kelas?inspect=${cls.id}`,
            icon: <School className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("sirkulasi-invent")) {
      for (const loan of officeKitLoans) {
        if (
          !q ||
          matchesFlexibleQuery(
            `${loan.loan_code} ${loan.class_code} ${loan.dpm_name} ${loan.borrower_name} ${loan.kit_items_label}`,
            q
          )
        ) {
          hits.push({
            id: `srk-${loan.id}`,
            category: "Sirkulasi Invent",
            code: loan.loan_code,
            title: `Kelas ${loan.class_code} - ${loan.borrower_name}`,
            meta: `${loan.status} • ${loan.kit_items_label}`,
            href: `/sarpras/sirkulasi-invent?inspect=${loan.id}`,
            icon: <Cable className="w-4 h-4 text-amber-700 dark:text-amber-400" />,
          });
        }
      }

      for (const kit of officeKitItems) {
        if (
          !q ||
          matchesFlexibleQuery(`${kit.kit_code} ${kit.name} ${kit.category}`, q)
        ) {
          hits.push({
            id: `kit-${kit.id}`,
            category: "Alat Kantor Staf",
            code: kit.kit_code,
            title: kit.name,
            meta: `${kit.category} • ${kit.status}`,
            href: `/sarpras/sirkulasi-invent?inspect=${kit.id}`,
            icon: <Cable className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("inventaris")) {
      for (const a of assets) {
        if (
          !q ||
          matchesFlexibleQuery(
            `${a.inventory_code} ${a.name} ${a.brand_model} ${a.serial_number || ""}`,
            q
          )
        ) {
          hits.push({
            id: `ast-${a.id}`,
            category: "Inventaris Aset",
            code: a.inventory_code,
            title: a.name,
            meta: `${a.brand_model} • Kondisi: ${a.condition}`,
            href: `/sarpras/inventaris?inspect=${a.id}`,
            icon: <Package className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
          });
        }
      }
    }

    if (canAccessPage("peminjaman")) {
      for (const b of bookings) {
        const rm = rooms.find((r) => r.id === b.room_id);
        const ast = assets.find((a) => a.id === b.asset_id);
        if (
          !q ||
          matchesFlexibleQuery(
            `${b.booking_code} ${b.activity_name} ${b.borrower_name} ${b.borrower_unit} ${rm?.code || ""} ${ast?.inventory_code || ""}`,
            q
          )
        ) {
          hits.push({
            id: `bk-${b.id}`,
            category: "Peminjaman",
            code: b.booking_code,
            title: b.activity_name,
            meta: `${b.borrower_name} • ${b.booking_date} (${b.status})`,
            href: `/sarpras/peminjaman?inspect=${b.id}`,
            icon: (
              <CalendarClock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            ),
          });
        }
      }
    }

    if (canAccessPage("pemeliharaan")) {
      for (const m of maintenanceLogs) {
        const kit = m.office_kit_item_id
          ? officeKitItems.find((k) => k.id === m.office_kit_item_id)
          : null;
        if (
          !qLower ||
          m.ticket_code.toLowerCase().includes(qLower) ||
          m.issue_title.toLowerCase().includes(qLower) ||
          m.reporter_name.toLowerCase().includes(qLower) ||
          (kit &&
            (kit.kit_code.toLowerCase().includes(qLower) ||
              kit.name.toLowerCase().includes(qLower)))
        ) {
          hits.push({
            id: `mnt-${m.id}`,
            category: "Pemeliharaan",
            code: m.ticket_code,
            title: m.issue_title,
            meta: `${m.priority} • ${m.status}${
              kit ? ` • Alat Kantor: ${kit.kit_code}` : ""
            }`,
            href: `/sarpras/pemeliharaan?inspect=${m.id}`,
            icon: <Wrench className="w-4 h-4 text-red-700 dark:text-red-400" />,
          });
        }
      }
    }

    if (canAccessPage("bhp")) {
      for (const c of consumables) {
        if (
          !qLower ||
          c.code.toLowerCase().includes(qLower) ||
          c.name.toLowerCase().includes(qLower)
        ) {
          hits.push({
            id: `bhp-${c.id}`,
            category: "Stok BHP",
            code: c.code,
            title: c.name,
            meta: `Stok: ${c.current_stock} ${c.unit} (Min. ${c.min_stock})`,
            href: `/sarpras/bhp?inspect=${c.id}`,
            icon: <Boxes className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />,
          });
        }
      }
    }

    for (const w of thesisWorkflows) {
      const taPageKey = getThesisPageKey(w.track, w.stage);
      if (!canAccessPage(taPageKey)) continue;
      if (
        !qLower ||
        w.ticket_code.toLowerCase().includes(qLower) ||
        w.student_name.toLowerCase().includes(qLower) ||
        w.student_nim.toLowerCase().includes(qLower) ||
        w.title.toLowerCase().includes(qLower) ||
        (w.journal_name || "").toLowerCase().includes(qLower)
      ) {
        hits.push({
          id: `ta-${w.id}`,
          category: "Tugas Akhir",
          code: w.ticket_code,
          title: w.student_name,
          meta: `NIM ${w.student_nim} • ${w.title}`,
          href: `${getThesisHref(w.track, w.stage)}?inspect=${w.id}`,
          icon: (
            <ScrollText className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />
          ),
        });
      }
    }

    if (
      !qLower ||
      "sinkron ulang database refresh reset".includes(qLower) ||
      "database".includes(qLower)
    ) {
      hits.push({
        id: "util-sync-db",
        category: "Utilitas",
        code: isLiveSupabase ? "SYNC" : "RESET",
        title: isLiveSupabase ? "Sinkron Ulang Database" : "Reset Data Seed",
        meta: isLiveSupabase
          ? "Muat ulang seluruh data operasional terbaru dari PostgreSQL Supabase"
          : "Kembalikan simulasi data awal kampus ke kondisi default",
        onAction: () => resetToSeedData(),
        icon: <RotateCcw className="w-4 h-4 text-[#1E3A5F] dark:text-sky-400" />,
      });
    }

    return hits.slice(0, 12);
  }, [
    academicClasses,
    assets,
    bookings,
    campusOfficials,
    campusUnits,
    canAccessPage,
    consumables,
    courses,
    isLiveSupabase,
    lecturers,
    maintenanceLogs,
    maintenanceVendors,
    officeKitItems,
    officeKitLoans,
    query,
    resetToSeedData,
    rooms,
    thesisWorkflows,
  ]);

  if (!commandSearchOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Cepat Lintas Modul StafCenter"
    >
      <div className="w-full max-w-xl rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search
            className="w-5 h-5 text-slate-500 shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode ruang (1-SM6), inventaris (INV-), tiket (PJM/MNT), atau BHP..."
            aria-label="Kata kunci pencarian cepat"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandSearchOpen(false)}
            aria-label="Tutup pencarian cepat"
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {results.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-600 dark:text-slate-400">
              Tidak ditemukan data yang cocok dengan &ldquo;{query}&rdquo;.
            </p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCommandSearchOpen(false);
                  if (item.onAction) {
                    item.onAction();
                  } else if (item.href) {
                    if (
                      item.href.startsWith(
                        "/sarpras/sirkulasi-invent/pinjam-cepat"
                      )
                    ) {
                      const modeMatch = item.href.includes("mode=fasilitas")
                        ? "fasilitas"
                        : "alat-staf";
                      window.dispatchEvent(
                        new CustomEvent("stafcenter:pinjam-cepat-mode", {
                          detail: { mode: modeMatch },
                        })
                      );
                    }
                    router.push(item.href);
                  }
                }}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 focus-visible:outline-none focus-visible:bg-sky-50 dark:focus-visible:bg-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#1E3A5F] dark:text-sky-400">
                        {item.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {item.meta}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
